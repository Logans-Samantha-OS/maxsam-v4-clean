/**
 * Phase 2 Autonomy Feature Flags
 * MaxSam V4 - Controlled Autonomy System
 *
 * This module provides the single source of truth for Phase 2 autonomy flags.
 * ALL automation paths MUST check these flags before executing.
 *
 * CRITICAL: autonomy_enabled = false is the MASTER gate.
 * Nothing autonomous can execute without this flag being true.
 */

import { createClient } from '@/lib/supabase/server';

// ============================================================================
// TYPES
// ============================================================================

export interface AutonomyFlags {
  autonomy_enabled: boolean;
  phase2_active: boolean;
  phase2_dry_run: boolean;
  phase2_require_confirmation: boolean;
  autonomy_level: 0 | 1 | 2 | 3;
  master_killed: boolean;
  max_auto_actions_per_hour: number;
  self_pause_error_threshold: number;
  self_pause_escalation_threshold: number;
}

export interface AutonomyCheckResult {
  allowed: boolean;
  reason: string;
  dry_run: boolean;
  requires_confirmation: boolean;
  autonomy_level_current: number;
  autonomy_level_required: number;
}

export interface ActionThreshold {
  action_type: string;
  min_confidence: number;
  min_sentiment: number;
  min_data_completeness: number;
  required_autonomy_level: number;
  max_per_lead_per_hour: number;
  max_global_per_hour: number;
  cooldown_seconds: number;
  escalate_on_high_value: boolean;
  high_value_threshold: number;
  require_confirmation: boolean;
}

// ============================================================================
// DEFAULT VALUES (when database unavailable)
// ============================================================================

const DEFAULT_FLAGS: AutonomyFlags = {
  autonomy_enabled: false,
  phase2_active: false,
  phase2_dry_run: true,
  phase2_require_confirmation: true,
  autonomy_level: 0,
  master_killed: false,
  max_auto_actions_per_hour: 10,
  self_pause_error_threshold: 10,
  self_pause_escalation_threshold: 20,
};

// Action autonomy requirements (default thresholds)
export const ACTION_AUTONOMY_REQUIREMENTS: Record<string, number> = {
  send_sms: 3,
  schedule_callback: 2,
  update_status: 1,
  generate_contract: 3,
  create_invoice: 3,
  escalate_human: 0,
  log_only: 0,
};

// ============================================================================
// FLAG RETRIEVAL
// ============================================================================

/**
 * Get current autonomy flags from database.
 * Returns default (disabled) state if database unavailable.
 */
export async function getAutonomyFlags(): Promise<AutonomyFlags> {
  try {
    const supabase = createClient();

    const [configResult, gatesResult] = await Promise.all([
      supabase
        .from('system_config')
        .select('key, value')
        .in('key', [
          'autonomy_enabled',
          'phase2_active',
          'phase2_dry_run',
          'phase2_require_confirmation',
          'autonomy_level',
          'phase2_max_auto_actions_per_hour',
          'phase2_self_pause_error_threshold',
          'phase2_self_pause_escalation_threshold',
        ]),
      supabase
        .from('governance_gates')
        .select('control_key, enabled')
        .eq('control_key', 'master_kill_switch')
        .single(),
    ]);

    if (configResult.error) {
      console.error('Failed to fetch autonomy flags:', configResult.error);
      return DEFAULT_FLAGS;
    }

    const config = Object.fromEntries(
      (configResult.data || []).map((r) => [r.key, r.value])
    );

    return {
      autonomy_enabled: config.autonomy_enabled === 'true',
      phase2_active: config.phase2_active === 'true',
      phase2_dry_run: config.phase2_dry_run !== 'false', // Default true
      phase2_require_confirmation: config.phase2_require_confirmation !== 'false',
      autonomy_level: (parseInt(config.autonomy_level || '0') as 0 | 1 | 2 | 3),
      master_killed: gatesResult.data?.enabled || false,
      max_auto_actions_per_hour: parseInt(config.phase2_max_auto_actions_per_hour || '10'),
      self_pause_error_threshold: parseInt(config.phase2_self_pause_error_threshold || '10'),
      self_pause_escalation_threshold: parseInt(config.phase2_self_pause_escalation_threshold || '20'),
    };
  } catch (err) {
    console.error('Error fetching autonomy flags:', err);
    return DEFAULT_FLAGS;
  }
}

/**
 * Get action thresholds from database.
 */
export async function getActionThresholds(actionType: string): Promise<ActionThreshold | null> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('autonomy_thresholds')
      .select('*')
      .eq('action_type', actionType)
      .single();

    if (error || !data) {
      return null;
    }

    return data as ActionThreshold;
  } catch (err) {
    console.error('Error fetching action thresholds:', err);
    return null;
  }
}

// ============================================================================
// AUTHORIZATION CHECKS
// ============================================================================

/**
 * Check if autonomous execution is allowed for a given action.
 * This is THE GATE that all autonomous actions must pass through.
 */
export async function canExecuteAutonomously(
  actionType: string
): Promise<AutonomyCheckResult> {
  const flags = await getAutonomyFlags();
  const requiredLevel = ACTION_AUTONOMY_REQUIREMENTS[actionType] ?? 3;

  // Check 1: Master autonomy flag
  if (!flags.autonomy_enabled) {
    return {
      allowed: false,
      reason: 'BLOCKED: autonomy_enabled = false',
      dry_run: false,
      requires_confirmation: false,
      autonomy_level_current: flags.autonomy_level,
      autonomy_level_required: requiredLevel,
    };
  }

  // Check 2: Phase 2 active
  if (!flags.phase2_active) {
    return {
      allowed: false,
      reason: 'BLOCKED: phase2_active = false',
      dry_run: false,
      requires_confirmation: false,
      autonomy_level_current: flags.autonomy_level,
      autonomy_level_required: requiredLevel,
    };
  }

  // Check 3: Kill switch
  if (flags.master_killed) {
    return {
      allowed: false,
      reason: 'BLOCKED: Master kill switch is active',
      dry_run: false,
      requires_confirmation: false,
      autonomy_level_current: flags.autonomy_level,
      autonomy_level_required: requiredLevel,
    };
  }

  // Check 4: Autonomy level
  if (flags.autonomy_level < requiredLevel) {
    return {
      allowed: false,
      reason: `BLOCKED: autonomy_level ${flags.autonomy_level} < required ${requiredLevel}`,
      dry_run: false,
      requires_confirmation: false,
      autonomy_level_current: flags.autonomy_level,
      autonomy_level_required: requiredLevel,
    };
  }

  // All checks passed - determine mode
  return {
    allowed: true,
    reason: flags.phase2_dry_run ? 'Allowed (DRY RUN mode)' : 'Allowed',
    dry_run: flags.phase2_dry_run,
    requires_confirmation: flags.phase2_require_confirmation,
    autonomy_level_current: flags.autonomy_level,
    autonomy_level_required: requiredLevel,
  };
}

/**
 * Quick check if Phase 2 autonomy is active at all.
 * Use this for fast-path rejection before expensive operations.
 */
export async function isPhase2Active(): Promise<boolean> {
  const flags = await getAutonomyFlags();
  return flags.autonomy_enabled && flags.phase2_active && !flags.master_killed;
}

/**
 * Check if we're in dry-run mode.
 */
export async function isDryRunMode(): Promise<boolean> {
  const flags = await getAutonomyFlags();
  return flags.phase2_dry_run;
}

// ============================================================================
// FLAG MODIFICATION (ADMIN ONLY)
// ============================================================================

/**
 * Enable Phase 2 autonomy.
 * CRITICAL: This should only be called by authorized admin actions.
 */
export async function enablePhase2(
  enabledBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Update flags
    const updates = [
      { key: 'autonomy_enabled', value: 'true' },
      { key: 'phase2_active', value: 'true' },
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('system_config')
        .upsert(update, { onConflict: 'key' });

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Log to audit
    await supabase.from('autonomy_audit_log').insert({
      event_type: 'phase2_enabled',
      actor: enabledBy,
      target_type: 'system',
      previous_state: { autonomy_enabled: false, phase2_active: false },
      new_state: { autonomy_enabled: true, phase2_active: true },
      reason,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Disable Phase 2 autonomy.
 * This immediately stops all autonomous actions.
 */
export async function disablePhase2(
  disabledBy: string,
  reason: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    // Get current state for audit
    const currentFlags = await getAutonomyFlags();

    // Disable flags
    const updates = [
      { key: 'autonomy_enabled', value: 'false' },
      { key: 'phase2_active', value: 'false' },
    ];

    for (const update of updates) {
      const { error } = await supabase
        .from('system_config')
        .upsert(update, { onConflict: 'key' });

      if (error) {
        return { success: false, error: error.message };
      }
    }

    // Log to audit
    await supabase.from('autonomy_audit_log').insert({
      event_type: 'phase2_disabled',
      actor: disabledBy,
      target_type: 'system',
      previous_state: {
        autonomy_enabled: currentFlags.autonomy_enabled,
        phase2_active: currentFlags.phase2_active,
      },
      new_state: { autonomy_enabled: false, phase2_active: false },
      reason,
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

/**
 * Set dry-run mode.
 */
export async function setDryRunMode(
  enabled: boolean,
  changedBy: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();

    const { error } = await supabase
      .from('system_config')
      .upsert({ key: 'phase2_dry_run', value: enabled ? 'true' : 'false' }, { onConflict: 'key' });

    if (error) {
      return { success: false, error: error.message };
    }

    // Log to audit
    await supabase.from('autonomy_audit_log').insert({
      event_type: 'flag_change',
      actor: changedBy,
      target_type: 'system',
      previous_state: { phase2_dry_run: !enabled },
      new_state: { phase2_dry_run: enabled },
      reason: enabled ? 'Enabled dry-run mode' : 'Disabled dry-run mode',
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ============================================================================
// SELF-PAUSE LOGIC
// ============================================================================

/**
 * Check if the system should self-pause due to anomalies.
 */
export async function shouldSelfPause(): Promise<{
  should_pause: boolean;
  reason: string;
  metrics: {
    errors_last_hour: number;
    escalations_last_hour: number;
    opt_outs_last_hour: number;
  };
}> {
  try {
    const supabase = createClient();
    const flags = await getAutonomyFlags();
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

    // Count errors
    const { count: errors } = await supabase
      .from('execution_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'failed')
      .gte('updated_at', oneHourAgo);

    // Count escalations
    const { count: escalations } = await supabase
      .from('autonomy_decisions')
      .select('*', { count: 'exact', head: true })
      .eq('decision_type', 'escalate')
      .gte('decided_at', oneHourAgo);

    // Count opt-outs
    const { count: optouts } = await supabase
      .from('opt_outs')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    const metrics = {
      errors_last_hour: errors || 0,
      escalations_last_hour: escalations || 0,
      opt_outs_last_hour: optouts || 0,
    };

    // Check thresholds
    if (metrics.errors_last_hour > flags.self_pause_error_threshold) {
      return {
        should_pause: true,
        reason: `High error rate: ${metrics.errors_last_hour} failures (threshold: ${flags.self_pause_error_threshold})`,
        metrics,
      };
    }

    if (metrics.escalations_last_hour > flags.self_pause_escalation_threshold) {
      return {
        should_pause: true,
        reason: `High escalation rate: ${metrics.escalations_last_hour} (threshold: ${flags.self_pause_escalation_threshold})`,
        metrics,
      };
    }

    // Opt-out threshold is fixed at 5 per hour
    if (metrics.opt_outs_last_hour > 5) {
      return {
        should_pause: true,
        reason: `High opt-out rate: ${metrics.opt_outs_last_hour} (threshold: 5)`,
        metrics,
      };
    }

    return {
      should_pause: false,
      reason: 'All metrics nominal',
      metrics,
    };
  } catch (err) {
    // On error, recommend pause
    return {
      should_pause: true,
      reason: `Error checking metrics: ${err instanceof Error ? err.message : 'Unknown'}`,
      metrics: { errors_last_hour: 0, escalations_last_hour: 0, opt_outs_last_hour: 0 },
    };
  }
}

/**
 * Execute self-pause if thresholds exceeded.
 */
export async function executeSelfPause(reason: string): Promise<void> {
  const supabase = createClient();

  // Disable Phase 2
  await disablePhase2('SYSTEM:self_pause', reason);

  // Log the self-pause event
  await supabase.from('autonomy_audit_log').insert({
    event_type: 'self_pause',
    actor: 'SYSTEM',
    target_type: 'system',
    reason,
    metadata: { triggered_at: new Date().toISOString() },
  });

  // Send Telegram alert (if configured)
  try {
    await fetch('/api/telegram/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'WARNING',
        message: `⚠️ PHASE 2 SELF-PAUSE: ${reason}`,
      }),
    });
  } catch {
    // Ignore notification errors
  }
}
