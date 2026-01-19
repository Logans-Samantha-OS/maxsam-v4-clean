/**
 * Governance API - MaxSam V4 Agentic Control System
 *
 * GET:  Retrieve all gate states
 * POST: Update gate state (kill, revive, enable, disable)
 *
 * Key principle: Buttons grant/revoke authority. RALPH enforces execution.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logGateChange } from '@/lib/governance/gates';

// GET: Retrieve all gate states
export async function GET() {
  const supabase = createClient();

  const [governanceGates, workflowControls] = await Promise.all([
    supabase.from('governance_gates').select('*').order('control_key'),
    supabase.from('workflow_controls').select('*').order('workflow_name')
  ]);

  const masterKill = governanceGates.data?.find(c => c.control_key === 'master_kill_switch');

  return NextResponse.json({
    success: true,
    system_killed: masterKill?.enabled || false,
    governance_gates: governanceGates.data || [],
    workflow_controls: workflowControls.data || [],
    timestamp: new Date().toISOString()
  });
}

// POST: Update gate state
export async function POST(request: NextRequest) {
  const supabase = createClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { action, gate_type, gate_key, enabled, reason, triggered_by = 'ceo_dashboard' } = body;

  // ========================================================================
  // MASTER KILL SWITCH - Emergency shutdown
  // ========================================================================
  if (action === 'kill') {
    const { data: current } = await supabase
      .from('governance_gates')
      .select('enabled')
      .eq('control_key', 'master_kill_switch')
      .single();

    const { error: updateError } = await supabase
      .from('governance_gates')
      .update({
        enabled: true,
        disabled_by: triggered_by,
        disabled_at: new Date().toISOString(),
        disabled_reason: reason || 'Emergency kill switch activated'
      })
      .eq('control_key', 'master_kill_switch');

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to activate kill switch',
        details: updateError.message
      }, { status: 500 });
    }

    await logGateChange(
      'system',
      'master_kill_switch',
      'kill',
      current?.enabled || false,
      true,
      triggered_by,
      reason
    );

    return NextResponse.json({
      success: true,
      action: 'kill',
      message: 'SYSTEM KILLED: All execution halted',
      timestamp: new Date().toISOString()
    });
  }

  // ========================================================================
  // REVIVE SYSTEM - Deactivate kill switch
  // ========================================================================
  if (action === 'revive') {
    const { data: current } = await supabase
      .from('governance_gates')
      .select('enabled')
      .eq('control_key', 'master_kill_switch')
      .single();

    const { error: updateError } = await supabase
      .from('governance_gates')
      .update({
        enabled: false,
        disabled_by: null,
        disabled_at: null,
        disabled_reason: null
      })
      .eq('control_key', 'master_kill_switch');

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: 'Failed to revive system',
        details: updateError.message
      }, { status: 500 });
    }

    await logGateChange(
      'system',
      'master_kill_switch',
      'enable',
      current?.enabled || true,
      false,
      triggered_by,
      reason
    );

    return NextResponse.json({
      success: true,
      action: 'revive',
      message: 'System revived: Kill switch deactivated. Individual gates still apply.',
      timestamp: new Date().toISOString()
    });
  }

  // ========================================================================
  // UPDATE INDIVIDUAL SYSTEM GATE
  // ========================================================================
  if (gate_type === 'system') {
    if (!gate_key) {
      return NextResponse.json({ success: false, error: 'gate_key is required' }, { status: 400 });
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
    }

    const { data: current } = await supabase
      .from('governance_gates')
      .select('enabled')
      .eq('control_key', gate_key)
      .single();

    if (!current) {
      return NextResponse.json({ success: false, error: `Gate ${gate_key} not found` }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('governance_gates')
      .update({
        enabled,
        disabled_by: enabled ? null : triggered_by,
        disabled_at: enabled ? null : new Date().toISOString(),
        disabled_reason: enabled ? null : reason
      })
      .eq('control_key', gate_key);

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Failed to update gate ${gate_key}`,
        details: updateError.message
      }, { status: 500 });
    }

    await logGateChange(
      'system',
      gate_key,
      enabled ? 'enable' : 'disable',
      current.enabled,
      enabled,
      triggered_by,
      reason
    );

    return NextResponse.json({
      success: true,
      gate_type: 'system',
      gate_key,
      enabled,
      timestamp: new Date().toISOString()
    });
  }

  // ========================================================================
  // UPDATE N8N WORKFLOW GATE
  // ========================================================================
  if (gate_type === 'n8n') {
    if (!gate_key) {
      return NextResponse.json({ success: false, error: 'gate_key (n8n_workflow_id) is required' }, { status: 400 });
    }

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
    }

    const { data: current } = await supabase
      .from('workflow_controls')
      .select('enabled, workflow_name')
      .eq('n8n_workflow_id', gate_key)
      .single();

    if (!current) {
      return NextResponse.json({
        success: false,
        error: `N8N workflow ${gate_key} not found in workflow_controls`
      }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from('workflow_controls')
      .update({
        enabled,
        disabled_by: enabled ? null : triggered_by,
        disabled_at: enabled ? null : new Date().toISOString(),
        disabled_reason: enabled ? null : reason
      })
      .eq('n8n_workflow_id', gate_key);

    if (updateError) {
      return NextResponse.json({
        success: false,
        error: `Failed to update workflow ${gate_key}`,
        details: updateError.message
      }, { status: 500 });
    }

    await logGateChange(
      'n8n',
      gate_key,
      enabled ? 'enable' : 'disable',
      current.enabled,
      enabled,
      triggered_by,
      reason
    );

    return NextResponse.json({
      success: true,
      gate_type: 'n8n',
      gate_key,
      workflow_name: current.workflow_name,
      enabled,
      message: `N8N workflow ${current.workflow_name} gate ${enabled ? 'opened' : 'closed'}. Use n8n sync endpoint to propagate to n8n.`,
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({
    success: false,
    error: 'Invalid action or gate_type. Use action: "kill"|"revive" or gate_type: "system"|"n8n"'
  }, { status: 400 });
}
