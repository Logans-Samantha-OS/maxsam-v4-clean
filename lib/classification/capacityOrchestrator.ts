/**
 * Capacity Orchestration Engine
 * Phase 13.3 - Economic Lead Classification
 *
 * AUTONOMY ENGINE owns capacity orchestration.
 * - Drain Class A fully first
 * - Use Class B to fill unused capacity
 * - Target ~90% utilization during allowed hours
 * - Never allow lower classes to delay higher classes
 *
 * No classification logic lives here.
 */

import { createClient } from '@supabase/supabase-js';
import {
  LeadClass,
  CapacityState,
  CapacityConfig,
  CLASS_PRIORITY_ORDER,
  CLASS_DEFINITIONS,
  DailyRank,
  getNextClass,
} from './types';
import { checkAndHaltLowerClasses, getClassConstraints } from './orionClassApproval';

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_DAILY_TARGET = 50;
const TARGET_UTILIZATION = 0.90; // 90%
const RECHECK_INTERVAL_MINUTES = 15;

// ============================================================================
// GET CURRENT CAPACITY STATE
// ============================================================================

export async function getCapacityState(
  supabaseUrl: string,
  supabaseKey: string
): Promise<CapacityState> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Get or create campaign state
  let { data: state, error } = await supabase
    .from('campaign_state')
    .select('*')
    .eq('date', today)
    .single();

  if (!state || error) {
    // Create new state for today
    const { data: newState } = await supabase.rpc('get_or_create_today_campaign_state');
    state = newState;
  }

  if (!state) {
    // Fallback defaults
    return {
      date: today,
      daily_capacity_target: DEFAULT_DAILY_TARGET,
      used_capacity: 0,
      remaining_capacity: DEFAULT_DAILY_TARGET,
      utilization_percent: 0,
      class_a_contacted: 0,
      class_a_remaining: 0,
      class_b_contacted: 0,
      class_b_remaining: 0,
      class_c_contacted: 0,
      class_c_remaining: 0,
      active_class: 'A',
      halted_reason: null,
      updated_at: new Date().toISOString(),
    };
  }

  const remaining = state.daily_capacity_target - state.used_capacity;
  const utilization = state.daily_capacity_target > 0
    ? (state.used_capacity / state.daily_capacity_target) * 100
    : 0;

  return {
    date: today,
    daily_capacity_target: state.daily_capacity_target,
    used_capacity: state.used_capacity,
    remaining_capacity: Math.max(0, remaining),
    utilization_percent: Math.round(utilization * 10) / 10,
    class_a_contacted: state.class_a_contacted,
    class_a_remaining: state.class_a_remaining,
    class_b_contacted: state.class_b_contacted,
    class_b_remaining: state.class_b_remaining,
    class_c_contacted: state.class_c_contacted,
    class_c_remaining: state.class_c_remaining,
    active_class: state.active_class,
    halted_reason: state.halted_reason,
    updated_at: state.updated_at,
  };
}

// ============================================================================
// GET NEXT LEADS TO CONTACT
// ============================================================================

export interface NextLeadResult {
  lead_id: string;
  lead_class: LeadClass;
  daily_rank: number;
  expected_value: number;
  owner_name: string | null;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  class_reason: string | null;
}

/**
 * Get the next batch of leads to contact.
 * Respects class priority: A > B > C
 * Never returns lower-class leads if higher-class leads are available.
 */
export async function getNextLeadsToContact(
  count: number,
  supabaseUrl: string,
  supabaseKey: string
): Promise<NextLeadResult[]> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // First, check if higher classes need to halt lower classes
  await checkAndHaltLowerClasses(supabaseUrl, supabaseKey);

  // Get current capacity state
  const state = await getCapacityState(supabaseUrl, supabaseKey);

  // Check if we have capacity
  if (state.remaining_capacity <= 0) {
    return [];
  }

  // Limit to remaining capacity
  const limit = Math.min(count, state.remaining_capacity);

  // Query leads by priority (daily_rank already respects class order)
  const { data: leads, error } = await supabase
    .from('maxsam_leads')
    .select(`
      id,
      lead_class,
      daily_rank,
      expected_value,
      owner_name,
      phone,
      phone_1,
      phone_2,
      class_reason,
      last_attempt_at,
      contact_attempts
    `)
    .not('lead_class', 'is', null)
    .not('daily_rank', 'is', null)
    .not('status', 'in', '("closed","dead")')
    .order('daily_rank', { ascending: true })
    .limit(limit);

  if (error || !leads) {
    console.error('Failed to get next leads:', error);
    return [];
  }

  // Filter by cooldown
  const now = new Date();
  const eligible: NextLeadResult[] = [];

  for (const lead of leads) {
    const constraints = getClassConstraints(lead.lead_class);

    // Check max attempts
    if ((lead.contact_attempts || 0) >= constraints.maxContactAttempts) {
      continue;
    }

    // Check cooldown
    if (lead.last_attempt_at) {
      const lastAttempt = new Date(lead.last_attempt_at);
      const cooldownMs = constraints.cooldownHours * 60 * 60 * 1000;
      if (now.getTime() - lastAttempt.getTime() < cooldownMs) {
        continue;
      }
    }

    // Check that we're not working lower class while higher has leads
    if (lead.lead_class !== 'A' && state.class_a_remaining > 0) {
      continue; // Skip - Class A has leads
    }
    if (lead.lead_class === 'C' && state.class_b_remaining > 0 && state.class_a_remaining === 0) {
      continue; // Skip - Class B has leads
    }

    eligible.push({
      lead_id: lead.id,
      lead_class: lead.lead_class,
      daily_rank: lead.daily_rank,
      expected_value: lead.expected_value,
      owner_name: lead.owner_name,
      phone: lead.phone || lead.phone_1 || lead.phone_2,
      phone_1: lead.phone_1,
      phone_2: lead.phone_2,
      class_reason: lead.class_reason,
    });

    if (eligible.length >= limit) break;
  }

  return eligible;
}

// ============================================================================
// RECORD CONTACT ATTEMPT
// ============================================================================

export async function recordContactAttempt(
  leadId: string,
  leadClass: LeadClass,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.rpc('record_contact_attempt', {
    p_lead_id: leadId,
    p_class: leadClass,
  });
}

// ============================================================================
// CAPACITY UTILIZATION
// ============================================================================

export interface UtilizationReport {
  date: string;
  target: number;
  used: number;
  remaining: number;
  utilization_percent: number;
  on_target: boolean;
  recommendation: string;

  by_class: {
    A: { contacted: number; remaining: number; exhausted: boolean };
    B: { contacted: number; remaining: number; exhausted: boolean };
    C: { contacted: number; remaining: number; exhausted: boolean };
  };

  hours_remaining: number;
  projected_utilization: number;
}

export async function getUtilizationReport(
  supabaseUrl: string,
  supabaseKey: string
): Promise<UtilizationReport> {
  const state = await getCapacityState(supabaseUrl, supabaseKey);

  // Calculate hours remaining in Sam window
  const now = new Date();
  const endHour = 18; // 6 PM
  const hoursRemaining = Math.max(0, endHour - now.getHours());

  // Project utilization
  const contactsPerHour = state.used_capacity / Math.max(1, 18 - 9 - hoursRemaining);
  const projectedAdditional = contactsPerHour * hoursRemaining;
  const projectedTotal = state.used_capacity + projectedAdditional;
  const projectedUtilization = (projectedTotal / state.daily_capacity_target) * 100;

  // Check if on target
  const onTarget = state.utilization_percent >= TARGET_UTILIZATION * 100 ||
    projectedUtilization >= TARGET_UTILIZATION * 100;

  // Generate recommendation
  let recommendation: string;
  if (state.remaining_capacity === 0) {
    recommendation = 'Daily capacity exhausted. Consider adjusting target if demand exists.';
  } else if (state.class_a_remaining > 0) {
    recommendation = `Focus on Class A: ${state.class_a_remaining} golden leads remaining.`;
  } else if (state.class_b_remaining > 0) {
    recommendation = `Class A exhausted. Working Class B: ${state.class_b_remaining} big fish remaining.`;
  } else if (state.class_c_remaining > 0 && projectedUtilization < TARGET_UTILIZATION * 100) {
    recommendation = `Fill capacity with Class C: ${state.class_c_remaining} standard leads available.`;
  } else if (projectedUtilization >= TARGET_UTILIZATION * 100) {
    recommendation = 'On track for target utilization.';
  } else {
    recommendation = 'Consider sourcing additional leads.';
  }

  return {
    date: state.date,
    target: state.daily_capacity_target,
    used: state.used_capacity,
    remaining: state.remaining_capacity,
    utilization_percent: state.utilization_percent,
    on_target: onTarget,
    recommendation,
    by_class: {
      A: {
        contacted: state.class_a_contacted,
        remaining: state.class_a_remaining,
        exhausted: state.class_a_remaining === 0,
      },
      B: {
        contacted: state.class_b_contacted,
        remaining: state.class_b_remaining,
        exhausted: state.class_b_remaining === 0 && state.class_a_remaining === 0,
      },
      C: {
        contacted: state.class_c_contacted,
        remaining: state.class_c_remaining,
        exhausted: state.class_c_remaining === 0 && state.class_b_remaining === 0,
      },
    },
    hours_remaining: hoursRemaining,
    projected_utilization: Math.round(projectedUtilization * 10) / 10,
  };
}

// ============================================================================
// TRANSITION TO NEXT CLASS
// ============================================================================

export async function transitionToNextClass(
  currentClass: LeadClass,
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ transitioned: boolean; newClass: LeadClass | null; reason: string }> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Get next class
  const nextClass = getNextClass(currentClass);

  if (!nextClass) {
    return {
      transitioned: false,
      newClass: null,
      reason: 'All classes exhausted',
    };
  }

  // Check if current class is actually exhausted
  const state = await getCapacityState(supabaseUrl, supabaseKey);
  const currentRemaining =
    currentClass === 'A'
      ? state.class_a_remaining
      : currentClass === 'B'
        ? state.class_b_remaining
        : state.class_c_remaining;

  if (currentRemaining > 0) {
    return {
      transitioned: false,
      newClass: null,
      reason: `Class ${currentClass} still has ${currentRemaining} leads remaining`,
    };
  }

  // Transition to next class
  await supabase
    .from('campaign_state')
    .update({
      active_class: nextClass,
      halted_reason: null,
      updated_at: new Date().toISOString(),
    })
    .eq('date', today);

  return {
    transitioned: true,
    newClass: nextClass,
    reason: `Class ${currentClass} exhausted, transitioned to Class ${nextClass}`,
  };
}

// ============================================================================
// REFRESH CLASS COUNTS
// ============================================================================

export async function refreshClassCounts(
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Count contactable leads by class
  const { data: counts } = await supabase
    .from('maxsam_leads')
    .select('lead_class')
    .not('lead_class', 'is', null)
    .not('status', 'in', '("closed","dead")')
    .not('phone', 'is', null);

  const classARemaining = counts?.filter((l) => l.lead_class === 'A').length || 0;
  const classBRemaining = counts?.filter((l) => l.lead_class === 'B').length || 0;
  const classCRemaining = counts?.filter((l) => l.lead_class === 'C').length || 0;

  await supabase
    .from('campaign_state')
    .update({
      class_a_remaining: classARemaining,
      class_b_remaining: classBRemaining,
      class_c_remaining: classCRemaining,
      updated_at: new Date().toISOString(),
    })
    .eq('date', today);
}

// ============================================================================
// ORCHESTRATION LOOP (for cron)
// ============================================================================

export interface OrchestrationResult {
  timestamp: string;
  state: CapacityState;
  utilization: UtilizationReport;
  actions_taken: string[];
}

/**
 * Main orchestration function - call this on a schedule.
 * Checks capacity, transitions classes, and returns status.
 */
export async function runOrchestrationCycle(
  supabaseUrl: string,
  supabaseKey: string
): Promise<OrchestrationResult> {
  const actions: string[] = [];

  // 1. Refresh class counts
  await refreshClassCounts(supabaseUrl, supabaseKey);
  actions.push('Refreshed class counts');

  // 2. Check for higher-class priority violations
  const haltResult = await checkAndHaltLowerClasses(supabaseUrl, supabaseKey);
  if (haltResult) {
    actions.push(`Halted classes ${haltResult.halted.join(', ')}: ${haltResult.reason}`);
  }

  // 3. Get current state
  const state = await getCapacityState(supabaseUrl, supabaseKey);

  // 4. Check for class transition
  if (state.active_class) {
    const remaining =
      state.active_class === 'A'
        ? state.class_a_remaining
        : state.active_class === 'B'
          ? state.class_b_remaining
          : state.class_c_remaining;

    if (remaining === 0) {
      const transition = await transitionToNextClass(
        state.active_class,
        supabaseUrl,
        supabaseKey
      );
      if (transition.transitioned) {
        actions.push(transition.reason);
      }
    }
  }

  // 5. Get utilization report
  const utilization = await getUtilizationReport(supabaseUrl, supabaseKey);
  actions.push(`Utilization: ${utilization.utilization_percent}% (target: ${TARGET_UTILIZATION * 100}%)`);

  // 6. Return result
  return {
    timestamp: new Date().toISOString(),
    state: await getCapacityState(supabaseUrl, supabaseKey), // Refresh after changes
    utilization,
    actions_taken: actions,
  };
}
