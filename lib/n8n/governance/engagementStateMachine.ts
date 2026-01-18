/**
 * engagementStateMachine.ts
 * Phase 13.1 - Human-in-the-Loop State Visibility
 *
 * Deterministic engagement state machine with ORION-gated human involvement.
 * Provides state VISIBILITY without authority leak.
 *
 * KEY PRINCIPLE: Logan can SEE exactly where a seller is,
 *                but cannot BYPASS the system to take action.
 */

import { createClient } from '@supabase/supabase-js';
import {
  EngagementState,
  EngagementGuard,
  EngagementStateRecord,
  EngagementStateTransition,
  VALID_ENGAGEMENT_TRANSITIONS,
  GovernanceResult,
  ORIONDecision,
} from './types';

// ============================================================================
// STATE MACHINE CORE
// ============================================================================

export interface TransitionRequest {
  leadId: string;
  targetState: EngagementState;
  guard: EngagementGuard;
  transitionedBy: string;
  reason: string;
  orionDecisionId?: string;
  humanActorId?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  previousState: EngagementState;
  newState: EngagementState;
  samPaused: boolean;
  message: string;
}

// ============================================================================
// VALIDATE TRANSITION (CLIENT-SIDE PRE-CHECK)
// ============================================================================

export function isValidTransition(
  fromState: EngagementState,
  toState: EngagementState,
  guard: EngagementGuard
): boolean {
  return VALID_ENGAGEMENT_TRANSITIONS.some(
    (t) =>
      t.from === fromState &&
      t.to === toState &&
      t.guard === guard
  );
}

export function getValidTransitions(fromState: EngagementState): EngagementStateTransition[] {
  return VALID_ENGAGEMENT_TRANSITIONS.filter((t) => t.from === fromState);
}

export function getRequiredGuard(
  fromState: EngagementState,
  toState: EngagementState
): EngagementGuard | null {
  const transition = VALID_ENGAGEMENT_TRANSITIONS.find(
    (t) => t.from === fromState && t.to === toState
  );
  return transition?.guard ?? null;
}

// ============================================================================
// STATE TRANSITION (VIA DATABASE FUNCTION)
// ============================================================================

export async function transitionEngagementState(
  request: TransitionRequest,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<TransitionResult>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Call the database function which enforces all guards
    const { data, error } = await supabase.rpc('transition_engagement_state', {
      p_lead_id: request.leadId,
      p_new_state: request.targetState,
      p_guard: request.guard,
      p_transitioned_by: request.transitionedBy,
      p_reason: request.reason,
      p_orion_decision_id: request.orionDecisionId || null,
      p_human_actor_id: request.humanActorId || null,
      p_metadata: request.metadata || {},
    });

    if (error) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: error.message,
        },
      };
    }

    const result = data[0];

    if (!result.success) {
      return {
        success: false,
        error: {
          code: 'INVALID_STATE_TRANSITION',
          message: result.message,
        },
      };
    }

    return {
      success: true,
      data: {
        success: true,
        previousState: request.targetState, // Note: DB function returns this
        newState: result.new_state,
        samPaused: shouldPauseSam(result.new_state),
        message: result.message,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

// ============================================================================
// STATE QUERIES (READ-ONLY VISIBILITY)
// ============================================================================

export async function getLeadEngagementState(
  leadId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<EngagementStateRecord | null>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('lead_engagement_state')
      .select('*')
      .eq('lead_id', leadId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
        },
      };
    }

    if (!data) {
      // Lead exists but no engagement state yet
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        lead_id: data.lead_id,
        current_state: data.current_state,
        previous_state: null, // Not stored in current state table
        transition_guard: null,
        transitioned_by: '',
        transition_reason: '',
        orion_decision_id: data.orion_decision_id,
        sam_paused: data.sam_paused,
        human_actor_id: data.human_actor_id,
        transitioned_at: data.updated_at,
        metadata: {},
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

export async function getLeadEngagementHistory(
  leadId: string,
  supabaseUrl: string,
  supabaseKey: string,
  limit: number = 20
): Promise<GovernanceResult<EngagementStateRecord[]>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('engagement_state_log')
      .select('*')
      .eq('lead_id', leadId)
      .order('transitioned_at', { ascending: false })
      .limit(limit);

    if (error) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
        },
      };
    }

    const records: EngagementStateRecord[] = (data || []).map((d) => ({
      lead_id: d.lead_id,
      current_state: d.new_state,
      previous_state: d.previous_state,
      transition_guard: d.transition_guard,
      transitioned_by: d.transitioned_by,
      transition_reason: d.transition_reason,
      orion_decision_id: d.orion_decision_id,
      sam_paused: d.sam_paused,
      human_actor_id: d.human_actor_id,
      transitioned_at: d.transitioned_at,
      metadata: d.metadata || {},
    }));

    return {
      success: true,
      data: records,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

export async function getHumanControlledLeads(
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<{ leadId: string; state: EngagementState; humanActorId: string | null }[]>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('v_human_controlled_leads')
      .select('*');

    if (error) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: error.message,
        },
      };
    }

    return {
      success: true,
      data: (data || []).map((d) => ({
        leadId: d.lead_id,
        state: d.current_state,
        humanActorId: d.human_actor_id,
      })),
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

// ============================================================================
// SAM INTEGRATION HELPERS
// ============================================================================

export function shouldPauseSam(state: EngagementState): boolean {
  return ['HUMAN_REQUESTED', 'HUMAN_APPROVED', 'HUMAN_IN_PROGRESS'].includes(state);
}

export async function isSamPausedForLead(
  leadId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<boolean> {
  const result = await getLeadEngagementState(leadId, supabaseUrl, supabaseKey);

  if (!result.success || !result.data) {
    return false; // Default to not paused if state unknown
  }

  return result.data.sam_paused;
}

export async function getLeadsWithSamPaused(
  supabaseUrl: string,
  supabaseKey: string
): Promise<string[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('lead_engagement_state')
      .select('lead_id')
      .eq('sam_paused', true);

    if (error) {
      console.error('Failed to get Sam-paused leads:', error);
      return [];
    }

    return (data || []).map((d) => d.lead_id);
  } catch (err) {
    console.error('Failed to get Sam-paused leads:', err);
    return [];
  }
}

// ============================================================================
// ORION-GATED HUMAN APPROVAL
// ============================================================================

export interface HumanApprovalRequest {
  leadId: string;
  requestedBy: string;
  reason: string;
  metadata?: Record<string, unknown>;
}

/**
 * Request human involvement for a lead.
 * This transitions to HUMAN_REQUESTED state and pauses Sam.
 * ORION must approve before moving to HUMAN_APPROVED.
 */
export async function requestHumanInvolvement(
  request: HumanApprovalRequest,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<TransitionResult>> {
  // First get current state
  const currentState = await getLeadEngagementState(
    request.leadId,
    supabaseUrl,
    supabaseKey
  );

  if (!currentState.success) {
    return {
      success: false,
      error: currentState.error,
    };
  }

  const fromState = currentState.data?.current_state || 'NOT_CONTACTED';

  // Check if transition is valid
  if (!isValidTransition(fromState, 'HUMAN_REQUESTED', 'HUMAN_REQUEST_TRIGGERED')) {
    return {
      success: false,
      error: {
        code: 'INVALID_STATE_TRANSITION',
        message: `Cannot request human involvement from state ${fromState}`,
      },
    };
  }

  return transitionEngagementState(
    {
      leadId: request.leadId,
      targetState: 'HUMAN_REQUESTED',
      guard: 'HUMAN_REQUEST_TRIGGERED',
      transitionedBy: request.requestedBy,
      reason: request.reason,
      metadata: request.metadata,
    },
    supabaseUrl,
    supabaseKey
  );
}

/**
 * ORION approves human involvement.
 * This transitions from HUMAN_REQUESTED to HUMAN_APPROVED.
 * ONLY ORION can call this function.
 */
export async function approveHumanInvolvement(
  leadId: string,
  orionDecision: ORIONDecision,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<TransitionResult>> {
  if (!orionDecision.allowed) {
    return {
      success: false,
      error: {
        code: 'ORION_REJECTED',
        message: `ORION rejected human involvement: ${orionDecision.reason}`,
      },
    };
  }

  return transitionEngagementState(
    {
      leadId,
      targetState: 'HUMAN_APPROVED',
      guard: 'ORION_APPROVED',
      transitionedBy: 'ORION',
      reason: orionDecision.reason,
      orionDecisionId: orionDecision.decisionId,
    },
    supabaseUrl,
    supabaseKey
  );
}

/**
 * Ops Console activates human work on a lead.
 * This transitions from HUMAN_APPROVED to HUMAN_IN_PROGRESS.
 */
export async function activateHumanWork(
  leadId: string,
  humanActorId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<TransitionResult>> {
  return transitionEngagementState(
    {
      leadId,
      targetState: 'HUMAN_IN_PROGRESS',
      guard: 'OPS_CONSOLE_ACTIVATED',
      transitionedBy: 'OPS_CONSOLE',
      reason: `Human actor ${humanActorId} activated work`,
      humanActorId,
    },
    supabaseUrl,
    supabaseKey
  );
}

/**
 * Complete human work and optionally return to autonomy.
 */
export async function completeHumanWork(
  leadId: string,
  humanActorId: string,
  returnToAutonomy: boolean,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<TransitionResult>> {
  // First transition to HUMAN_COMPLETED
  const completeResult = await transitionEngagementState(
    {
      leadId,
      targetState: 'HUMAN_COMPLETED',
      guard: 'HUMAN_TASK_COMPLETE',
      transitionedBy: humanActorId,
      reason: 'Human work completed',
      humanActorId,
    },
    supabaseUrl,
    supabaseKey
  );

  if (!completeResult.success) {
    return completeResult;
  }

  // If returning to autonomy, make that transition too
  if (returnToAutonomy) {
    return transitionEngagementState(
      {
        leadId,
        targetState: 'RETURNED_TO_AUTONOMY',
        guard: 'RETURN_AUTHORIZED',
        transitionedBy: humanActorId,
        reason: 'Returning to autonomous processing',
        humanActorId,
      },
      supabaseUrl,
      supabaseKey
    );
  }

  return completeResult;
}

// ============================================================================
// STATE VISIBILITY HELPERS (FOR DASHBOARD)
// ============================================================================

export function getStateDisplayInfo(state: EngagementState): {
  label: string;
  color: string;
  icon: string;
  description: string;
} {
  const stateInfo: Record<EngagementState, { label: string; color: string; icon: string; description: string }> = {
    NOT_CONTACTED: {
      label: 'Not Contacted',
      color: '#6B7280', // gray
      icon: '⏸️',
      description: 'Lead has not been contacted yet',
    },
    SAM_ACTIVE: {
      label: 'Sam Active',
      color: '#10B981', // green
      icon: '🤖',
      description: 'Sam is actively working this lead',
    },
    AWAITING_RESPONSE: {
      label: 'Awaiting Response',
      color: '#F59E0B', // amber
      icon: '⏳',
      description: 'Waiting for seller response',
    },
    HUMAN_REQUESTED: {
      label: 'Human Requested',
      color: '#8B5CF6', // purple
      icon: '🙋',
      description: 'Human involvement requested, pending ORION approval',
    },
    HUMAN_APPROVED: {
      label: 'Human Approved',
      color: '#3B82F6', // blue
      icon: '✅',
      description: 'ORION approved, ready for human action',
    },
    HUMAN_IN_PROGRESS: {
      label: 'Human Active',
      color: '#EC4899', // pink
      icon: '👤',
      description: 'Human is actively working this lead',
    },
    HUMAN_COMPLETED: {
      label: 'Human Complete',
      color: '#14B8A6', // teal
      icon: '✔️',
      description: 'Human work completed',
    },
    RETURNED_TO_AUTONOMY: {
      label: 'Back to Auto',
      color: '#10B981', // green
      icon: '🔄',
      description: 'Returned to autonomous processing',
    },
    CLOSED: {
      label: 'Closed',
      color: '#6B7280', // gray
      icon: '🔒',
      description: 'Lead is closed',
    },
  };

  return stateInfo[state];
}
