/**
 * Governance Gates - MaxSam V4 Agentic Control System
 *
 * This module provides gate checking utilities for the governance layer.
 * All execution paths (ORION, RALPH, SAM, n8n) must check gates before proceeding.
 *
 * Key principle: Buttons NEVER execute workflows. They only grant/revoke authority.
 * RALPH enforces ALL execution through these gates.
 */

import { createClient } from '@/lib/supabase/server';

export interface GateCheckResult {
  allowed: boolean;
  reason: string;
  gate_key: string;
  checked_at: string;
}

export interface BlockedResponse {
  success: false;
  blocked: true;
  gate: string;
  reason: string;
  timestamp: string;
}

/**
 * Master kill switch - if ON (enabled=true), entire system is KILLED (disabled)
 * CRITICAL: master_kill_switch = true means SYSTEM IS KILLED
 *           master_kill_switch = false means system is OPERATIONAL
 */
export async function checkMasterGate(): Promise<GateCheckResult> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from('governance_gates')
    .select('enabled')
    .eq('control_key', 'master_kill_switch')
    .single();

  if (error || !data) {
    return {
      allowed: false,
      reason: 'Master gate check failed: database error',
      gate_key: 'master_kill_switch',
      checked_at: new Date().toISOString()
    };
  }

  // CRITICAL: master_kill_switch = true means SYSTEM IS KILLED (disabled)
  // master_kill_switch = false means system is OPERATIONAL
  return {
    allowed: !data.enabled,
    reason: data.enabled ? 'SYSTEM KILLED: Master kill switch is active' : 'Master gate open',
    gate_key: 'master_kill_switch',
    checked_at: new Date().toISOString()
  };
}

/**
 * Check individual workflow/feature gate
 */
export async function checkWorkflowGate(gate_key: string): Promise<GateCheckResult> {
  // Always check master first
  const masterCheck = await checkMasterGate();
  if (!masterCheck.allowed) {
    return masterCheck;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('governance_gates')
    .select('enabled, disabled_reason')
    .eq('control_key', gate_key)
    .single();

  if (error || !data) {
    return {
      allowed: false,
      reason: `Gate check failed for ${gate_key}: not found or database error`,
      gate_key,
      checked_at: new Date().toISOString()
    };
  }

  return {
    allowed: data.enabled,
    reason: data.enabled
      ? `Gate ${gate_key} is open`
      : `Gate ${gate_key} is closed: ${data.disabled_reason || 'disabled'}`,
    gate_key,
    checked_at: new Date().toISOString()
  };
}

/**
 * Check agent-specific gate (ORION, RALPH, SAM, ALEX)
 */
export async function checkAgentGate(agent: 'orion' | 'ralph' | 'sam' | 'alex'): Promise<GateCheckResult> {
  const gateMap: Record<string, string> = {
    orion: 'gate_orion_scoring',
    ralph: 'gate_ralph_execution',
    sam: 'gate_sam_outreach',
    alex: 'gate_alex_skip_trace'
  };

  return checkWorkflowGate(gateMap[agent]);
}

/**
 * Check n8n workflow gate
 */
export async function checkN8nWorkflowGate(n8n_workflow_id: string): Promise<GateCheckResult> {
  // Always check master first
  const masterCheck = await checkMasterGate();
  if (!masterCheck.allowed) {
    return masterCheck;
  }

  const supabase = createClient();

  const { data, error } = await supabase
    .from('workflow_controls')
    .select('enabled, workflow_name, disabled_reason')
    .eq('n8n_workflow_id', n8n_workflow_id)
    .single();

  if (error || !data) {
    return {
      allowed: false,
      reason: `N8N workflow ${n8n_workflow_id} not registered in workflow_controls`,
      gate_key: `n8n:${n8n_workflow_id}`,
      checked_at: new Date().toISOString()
    };
  }

  return {
    allowed: data.enabled,
    reason: data.enabled
      ? `N8N workflow ${data.workflow_name} is enabled`
      : `N8N workflow ${data.workflow_name} is disabled: ${data.disabled_reason || 'disabled'}`,
    gate_key: `n8n:${n8n_workflow_id}`,
    checked_at: new Date().toISOString()
  };
}

/**
 * Create blocked response for API routes
 */
export function createBlockedResponse(gateResult: GateCheckResult): BlockedResponse {
  return {
    success: false,
    blocked: true,
    gate: gateResult.gate_key,
    reason: gateResult.reason,
    timestamp: gateResult.checked_at
  };
}

/**
 * Log gate state change to audit log
 */
export async function logGateChange(
  gate_type: 'system' | 'workflow' | 'n8n',
  gate_key: string,
  action: 'enable' | 'disable' | 'kill',
  previous_state: boolean,
  new_state: boolean,
  triggered_by: string,
  reason?: string
): Promise<void> {
  const supabase = createClient();

  await supabase.from('gate_audit_log').insert({
    gate_type,
    gate_key,
    action,
    previous_state,
    new_state,
    triggered_by,
    reason,
    metadata: { timestamp: new Date().toISOString() }
  });
}

/**
 * Get all gate states for dashboard display
 */
export async function getAllGateStates(): Promise<{
  system_killed: boolean;
  governance_gates: Array<{
    control_key: string;
    enabled: boolean;
    disabled_by: string | null;
    disabled_at: string | null;
    disabled_reason: string | null;
  }>;
  workflow_controls: Array<{
    n8n_workflow_id: string;
    workflow_name: string;
    enabled: boolean;
    n8n_active_state: boolean | null;
    last_synced_at: string | null;
  }>;
}> {
  const supabase = createClient();

  const [governanceGates, workflowControls] = await Promise.all([
    supabase.from('governance_gates').select('*').order('control_key'),
    supabase.from('workflow_controls').select('*').order('workflow_name')
  ]);

  const masterKill = governanceGates.data?.find(c => c.control_key === 'master_kill_switch');

  return {
    system_killed: masterKill?.enabled || false,
    governance_gates: governanceGates.data || [],
    workflow_controls: workflowControls.data || []
  };
}
