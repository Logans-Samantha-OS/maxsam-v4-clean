/**
 * Phase 2 ORION Validators
 * MaxSam V4 - Controlled Autonomy System
 *
 * These validators gate ALL autonomous actions.
 * Every autonomous action must pass ALL relevant validators before execution.
 *
 * Validator types:
 * - PRE_ACTION: Must pass before action can be queued
 * - POST_ACTION: Checked after action execution
 * - ROLLBACK: Determines if rollback is possible
 * - ESCALATION: Determines if human escalation is needed
 */

import { createClient } from '@/lib/supabase/server';
import {
  canExecuteAutonomously,
  getActionThresholds,
  getAutonomyFlags,
} from './flags';

// ============================================================================
// TYPES
// ============================================================================

export interface ValidatorResult {
  passed: boolean;
  reason: string;
  validator_name: string;
  conditions?: string[];
}

export interface ValidationContext {
  lead_id: string;
  action_type: string;
  confidence_score: number;
  sentiment_score: number;
  data_completeness: number;
  risk_multiplier: number;
  intent: string;
  message_intelligence_id?: string;
}

export interface FullValidationResult {
  can_execute: boolean;
  dry_run: boolean;
  requires_confirmation: boolean;
  escalate: boolean;
  escalation_reasons: string[];
  validators_passed: ValidatorResult[];
  validators_failed: ValidatorResult[];
  action_score: number;
  recommendation: 'execute' | 'hold' | 'escalate' | 'block';
}

// ============================================================================
// RATE LIMITS & COOLDOWNS
// ============================================================================

const DEFAULT_RATE_LIMITS = {
  send_sms: { per_lead_per_hour: 1, global_per_hour: 50 },
  schedule_callback: { per_lead_per_hour: 1, global_per_hour: 20 },
  update_status: { per_lead_per_hour: 5, global_per_hour: 200 },
  generate_contract: { per_lead_per_hour: 1, global_per_hour: 10 },
  escalate_human: { per_lead_per_hour: 2, global_per_hour: 50 },
};

const DEFAULT_COOLDOWNS = {
  send_sms: 4 * 60 * 60 * 1000, // 4 hours
  schedule_callback: 24 * 60 * 60 * 1000, // 24 hours
  generate_contract: 7 * 24 * 60 * 60 * 1000, // 7 days
  update_status: 0, // No cooldown
  escalate_human: 60 * 60 * 1000, // 1 hour
};

// ============================================================================
// PRE-ACTION VALIDATORS
// ============================================================================

/**
 * Validate autonomy flag is enabled
 */
async function validateAutonomyFlag(
  context: ValidationContext
): Promise<ValidatorResult> {
  const result = await canExecuteAutonomously(context.action_type);

  return {
    passed: result.allowed,
    reason: result.reason,
    validator_name: 'AUTONOMY_FLAG_CHECK',
  };
}

/**
 * Validate confidence threshold
 */
async function validateConfidenceThreshold(
  context: ValidationContext
): Promise<ValidatorResult> {
  const thresholds = await getActionThresholds(context.action_type);
  const minConfidence = thresholds?.min_confidence ?? 0.7;

  return {
    passed: context.confidence_score >= minConfidence,
    reason:
      context.confidence_score >= minConfidence
        ? `Confidence ${context.confidence_score.toFixed(2)} >= threshold ${minConfidence}`
        : `BLOCKED: Confidence ${context.confidence_score.toFixed(2)} < threshold ${minConfidence}`,
    validator_name: 'CONFIDENCE_THRESHOLD',
  };
}

/**
 * Validate sentiment threshold
 */
async function validateSentimentThreshold(
  context: ValidationContext
): Promise<ValidatorResult> {
  const thresholds = await getActionThresholds(context.action_type);
  const minSentiment = thresholds?.min_sentiment ?? -0.3;

  return {
    passed: context.sentiment_score >= minSentiment,
    reason:
      context.sentiment_score >= minSentiment
        ? `Sentiment ${context.sentiment_score.toFixed(2)} >= threshold ${minSentiment}`
        : `BLOCKED: Sentiment ${context.sentiment_score.toFixed(2)} < threshold ${minSentiment}`,
    validator_name: 'SENTIMENT_THRESHOLD',
  };
}

/**
 * Validate data completeness
 */
async function validateDataCompleteness(
  context: ValidationContext
): Promise<ValidatorResult> {
  const thresholds = await getActionThresholds(context.action_type);
  const minCompleteness = thresholds?.min_data_completeness ?? 0.5;

  return {
    passed: context.data_completeness >= minCompleteness,
    reason:
      context.data_completeness >= minCompleteness
        ? `Data completeness ${(context.data_completeness * 100).toFixed(0)}% >= threshold ${(minCompleteness * 100).toFixed(0)}%`
        : `BLOCKED: Data completeness ${(context.data_completeness * 100).toFixed(0)}% < threshold ${(minCompleteness * 100).toFixed(0)}%`,
    validator_name: 'DATA_COMPLETENESS',
  };
}

/**
 * Validate risk multiplier (0 = blocked by compliance)
 */
function validateRiskMultiplier(
  context: ValidationContext
): ValidatorResult {
  return {
    passed: context.risk_multiplier > 0,
    reason:
      context.risk_multiplier > 0
        ? `Risk multiplier ${context.risk_multiplier.toFixed(2)} > 0`
        : 'BLOCKED: Risk multiplier is 0 (compliance flag active)',
    validator_name: 'RISK_CHECK',
  };
}

/**
 * Validate rate limit not exceeded
 */
async function validateRateLimit(
  context: ValidationContext
): Promise<ValidatorResult> {
  try {
    const supabase = createClient();
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    const limits = DEFAULT_RATE_LIMITS[context.action_type as keyof typeof DEFAULT_RATE_LIMITS] || {
      per_lead_per_hour: 1,
      global_per_hour: 50,
    };

    // Check per-lead rate
    const { count: leadCount } = await supabase
      .from('autonomy_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', context.lead_id)
      .eq('action_type', context.action_type)
      .eq('approved', true)
      .gte('decided_at', oneHourAgo);

    if ((leadCount || 0) >= limits.per_lead_per_hour) {
      return {
        passed: false,
        reason: `BLOCKED: Rate limit exceeded for lead (${leadCount}/${limits.per_lead_per_hour} per hour)`,
        validator_name: 'RATE_LIMIT_CHECK',
      };
    }

    // Check global rate
    const { count: globalCount } = await supabase
      .from('autonomy_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('action_type', context.action_type)
      .eq('approved', true)
      .gte('decided_at', oneHourAgo);

    if ((globalCount || 0) >= limits.global_per_hour) {
      return {
        passed: false,
        reason: `BLOCKED: Global rate limit exceeded (${globalCount}/${limits.global_per_hour} per hour)`,
        validator_name: 'RATE_LIMIT_CHECK',
      };
    }

    return {
      passed: true,
      reason: `Rate limits OK (lead: ${leadCount}/${limits.per_lead_per_hour}, global: ${globalCount}/${limits.global_per_hour})`,
      validator_name: 'RATE_LIMIT_CHECK',
    };
  } catch (err) {
    return {
      passed: false,
      reason: `BLOCKED: Rate limit check failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      validator_name: 'RATE_LIMIT_CHECK',
    };
  }
}

/**
 * Validate opt-out status
 */
async function validateOptOutStatus(
  context: ValidationContext
): Promise<ValidatorResult> {
  try {
    const supabase = createClient();

    const { data } = await supabase
      .from('opt_outs')
      .select('id')
      .eq('lead_id', context.lead_id)
      .single();

    return {
      passed: !data,
      reason: data
        ? 'BLOCKED: Lead has opted out'
        : 'Lead has not opted out',
      validator_name: 'OPT_OUT_CHECK',
    };
  } catch {
    // No opt-out record found (expected)
    return {
      passed: true,
      reason: 'Lead has not opted out',
      validator_name: 'OPT_OUT_CHECK',
    };
  }
}

/**
 * Validate cooldown period
 */
async function validateCooldown(
  context: ValidationContext
): Promise<ValidatorResult> {
  try {
    const supabase = createClient();
    const cooldown = DEFAULT_COOLDOWNS[context.action_type as keyof typeof DEFAULT_COOLDOWNS] || 0;

    if (cooldown === 0) {
      return {
        passed: true,
        reason: 'No cooldown required for this action',
        validator_name: 'COOLDOWN_CHECK',
      };
    }

    const cooldownStart = new Date(Date.now() - cooldown).toISOString();

    const { data } = await supabase
      .from('autonomy_decisions')
      .select('decided_at')
      .eq('lead_id', context.lead_id)
      .eq('action_type', context.action_type)
      .eq('approved', true)
      .gte('decided_at', cooldownStart)
      .order('decided_at', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      const elapsed = Date.now() - new Date(data.decided_at).getTime();
      const remaining = cooldown - elapsed;
      return {
        passed: false,
        reason: `BLOCKED: Cooldown not elapsed (${Math.round(remaining / 60000)} minutes remaining)`,
        validator_name: 'COOLDOWN_CHECK',
      };
    }

    return {
      passed: true,
      reason: 'Cooldown elapsed',
      validator_name: 'COOLDOWN_CHECK',
    };
  } catch {
    // No previous action found
    return {
      passed: true,
      reason: 'No previous action found',
      validator_name: 'COOLDOWN_CHECK',
    };
  }
}

/**
 * Validate business hours
 */
function validateBusinessHours(): ValidatorResult {
  const now = new Date();
  const hour = now.getHours();
  const isBusinessHours = hour >= 9 && hour < 20; // 9 AM - 8 PM

  return {
    passed: isBusinessHours,
    reason: isBusinessHours
      ? `Within business hours (${hour}:00)`
      : `BLOCKED: Outside business hours (${hour}:00, allowed: 9:00-20:00)`,
    validator_name: 'BUSINESS_HOURS_CHECK',
  };
}

/**
 * Validate governance gates
 */
async function validateGovernanceGates(
  context: ValidationContext
): Promise<ValidatorResult> {
  try {
    const supabase = createClient();

    // Map action types to gates
    const gateMapping: Record<string, string> = {
      send_sms: 'gate_sam_outreach',
      schedule_callback: 'gate_sam_outreach',
      generate_contract: 'gate_sam_contracts',
      create_invoice: 'gate_sam_payments',
    };

    const gateKey = gateMapping[context.action_type];
    if (!gateKey) {
      return {
        passed: true,
        reason: 'No specific gate required for this action',
        validator_name: 'GATE_CHECK',
      };
    }

    const { data } = await supabase
      .from('governance_gates')
      .select('enabled')
      .eq('control_key', gateKey)
      .single();

    return {
      passed: data?.enabled === true,
      reason: data?.enabled
        ? `Gate ${gateKey} is open`
        : `BLOCKED: Gate ${gateKey} is closed`,
      validator_name: 'GATE_CHECK',
    };
  } catch (err) {
    return {
      passed: false,
      reason: `BLOCKED: Gate check failed: ${err instanceof Error ? err.message : 'Unknown'}`,
      validator_name: 'GATE_CHECK',
    };
  }
}

// ============================================================================
// ESCALATION VALIDATORS
// ============================================================================

/**
 * Check if escalation is required due to low confidence
 */
function checkLowConfidenceEscalation(
  context: ValidationContext
): { escalate: boolean; reason: string } {
  if (context.confidence_score < 0.5) {
    return {
      escalate: true,
      reason: `Low confidence: ${context.confidence_score.toFixed(2)}`,
    };
  }
  return { escalate: false, reason: '' };
}

/**
 * Check if escalation is required due to negative sentiment
 */
function checkNegativeSentimentEscalation(
  context: ValidationContext
): { escalate: boolean; reason: string } {
  if (context.sentiment_score < -0.5) {
    return {
      escalate: true,
      reason: `Negative sentiment: ${context.sentiment_score.toFixed(2)}`,
    };
  }
  return { escalate: false, reason: '' };
}

/**
 * Check if escalation is required due to unknown intent
 */
function checkUnknownIntentEscalation(
  context: ValidationContext
): { escalate: boolean; reason: string } {
  if (context.intent === 'unknown') {
    return {
      escalate: true,
      reason: 'Unknown intent detected',
    };
  }
  return { escalate: false, reason: '' };
}

/**
 * Check if escalation is required due to high value
 */
async function checkHighValueEscalation(
  context: ValidationContext
): Promise<{ escalate: boolean; reason: string }> {
  try {
    const supabase = createClient();
    const thresholds = await getActionThresholds(context.action_type);

    if (!thresholds?.escalate_on_high_value) {
      return { escalate: false, reason: '' };
    }

    const { data } = await supabase
      .from('maxsam_leads')
      .select('excess_amount')
      .eq('id', context.lead_id)
      .single();

    const excessAmount = data?.excess_amount || 0;
    const threshold = thresholds.high_value_threshold || 50000;

    if (excessAmount > threshold) {
      return {
        escalate: true,
        reason: `High value lead: $${excessAmount.toLocaleString()} > $${threshold.toLocaleString()}`,
      };
    }

    return { escalate: false, reason: '' };
  } catch {
    return { escalate: false, reason: '' };
  }
}

// ============================================================================
// MAIN VALIDATION FUNCTION
// ============================================================================

/**
 * Run all validators and return comprehensive result.
 * This is THE function that determines if an autonomous action can proceed.
 */
export async function runFullValidation(
  context: ValidationContext
): Promise<FullValidationResult> {
  const passed: ValidatorResult[] = [];
  const failed: ValidatorResult[] = [];
  const escalationReasons: string[] = [];

  // Run all pre-action validators
  const validators = [
    validateAutonomyFlag,
    validateConfidenceThreshold,
    validateSentimentThreshold,
    validateDataCompleteness,
    () => Promise.resolve(validateRiskMultiplier(context)),
    validateRateLimit,
    validateOptOutStatus,
    validateCooldown,
    () => Promise.resolve(validateBusinessHours()),
    validateGovernanceGates,
  ];

  for (const validator of validators) {
    const result = await validator(context);
    if (result.passed) {
      passed.push(result);
    } else {
      failed.push(result);
    }
  }

  // Run escalation checks
  const escalationChecks = [
    checkLowConfidenceEscalation(context),
    checkNegativeSentimentEscalation(context),
    checkUnknownIntentEscalation(context),
    await checkHighValueEscalation(context),
  ];

  for (const check of escalationChecks) {
    if (check.escalate) {
      escalationReasons.push(check.reason);
    }
  }

  // Calculate action score
  const actionScore =
    context.confidence_score * 0.35 +
    ((context.sentiment_score + 1) / 2) * 0.2 + // Normalize -1..1 to 0..1
    context.data_completeness * 0.25 +
    (context.intent === 'interested' ? 0.2 : context.intent === 'question' ? 0.14 : 0.1);

  // Get autonomy check result for dry_run and confirmation flags
  const autonomyResult = await canExecuteAutonomously(context.action_type);

  // Determine recommendation
  let recommendation: 'execute' | 'hold' | 'escalate' | 'block';
  if (failed.length > 0) {
    // Check if it's a soft block (can be held) or hard block
    const hardBlocks = failed.filter(
      (f) =>
        f.validator_name === 'OPT_OUT_CHECK' ||
        f.validator_name === 'RISK_CHECK' ||
        f.validator_name === 'GATE_CHECK'
    );
    recommendation = hardBlocks.length > 0 ? 'block' : 'hold';
  } else if (escalationReasons.length > 0) {
    recommendation = 'escalate';
  } else {
    recommendation = 'execute';
  }

  return {
    can_execute: failed.length === 0 && escalationReasons.length === 0,
    dry_run: autonomyResult.dry_run,
    requires_confirmation: autonomyResult.requires_confirmation,
    escalate: escalationReasons.length > 0,
    escalation_reasons: escalationReasons,
    validators_passed: passed,
    validators_failed: failed,
    action_score: actionScore * context.risk_multiplier,
    recommendation,
  };
}

// ============================================================================
// POST-ACTION VALIDATORS (for after execution)
// ============================================================================

/**
 * Validate that an action was properly recorded
 */
export async function validateActionRecorded(
  executionId: string
): Promise<ValidatorResult> {
  try {
    const supabase = createClient();

    const { data } = await supabase
      .from('autonomy_decisions')
      .select('id, execution_status')
      .eq('execution_queue_id', executionId)
      .single();

    return {
      passed: !!data,
      reason: data
        ? `Action recorded with status: ${data.execution_status}`
        : 'WARNING: Action not found in autonomy_decisions',
      validator_name: 'POST_ACTION_RECORDED',
    };
  } catch {
    return {
      passed: false,
      reason: 'Failed to verify action recording',
      validator_name: 'POST_ACTION_RECORDED',
    };
  }
}

/**
 * Validate SMS delivery (if applicable)
 */
export async function validateSmsDelivery(
  messageId: string
): Promise<ValidatorResult> {
  try {
    const supabase = createClient();

    const { data } = await supabase
      .from('communication_logs')
      .select('delivery_status')
      .eq('id', messageId)
      .single();

    const delivered = data?.delivery_status === 'delivered' || data?.delivery_status === 'sent';

    return {
      passed: delivered,
      reason: delivered
        ? `SMS delivery confirmed: ${data?.delivery_status}`
        : `SMS delivery failed: ${data?.delivery_status || 'unknown'}`,
      validator_name: 'POST_SMS_DELIVERY',
    };
  } catch {
    return {
      passed: false,
      reason: 'Failed to verify SMS delivery',
      validator_name: 'POST_SMS_DELIVERY',
    };
  }
}

// ============================================================================
// ROLLBACK VALIDATORS
// ============================================================================

const ROLLBACK_CAPABLE_ACTIONS = ['update_status', 'schedule_callback'];

/**
 * Check if an action can be rolled back
 */
export function canRollback(actionType: string): ValidatorResult {
  const canRollback = ROLLBACK_CAPABLE_ACTIONS.includes(actionType);

  return {
    passed: canRollback,
    reason: canRollback
      ? 'Action type supports rollback'
      : 'Action type does not support rollback (SMS sent, contract generated, etc.)',
    validator_name: 'ROLLBACK_CAPABLE',
  };
}
