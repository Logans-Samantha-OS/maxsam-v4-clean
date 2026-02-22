/**
 * CEO Dashboard API - READ-ONLY
 * Phase 12.1 → 13.1 Bridge
 *
 * Provides observability without mutation paths.
 * Logan can SEE everything, but cannot BYPASS the system.
 *
 * ❌ No controls
 * ❌ No mutation paths
 * ✅ Full visibility
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// SUPABASE CLIENT
// ============================================================================

function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Missing Supabase configuration');
  }

  return createClient(supabaseUrl, supabaseKey);
}

// ============================================================================
// GET - CEO DASHBOARD DATA (READ-ONLY)
// ============================================================================

export async function GET(_request: NextRequest) {
  try {
    const supabase = getSupabaseClient();

    // Parallel fetch all dashboard data
    const [
      n8nStatsResult,
      engagementStatsResult,
      recentAuditsResult,
      humanControlledResult,
      systemControlsResult,
    ] = await Promise.all([
      // N8N workflow stats
      supabase.rpc('get_n8n_dashboard_stats'),

      // Engagement state stats
      supabase.rpc('get_engagement_dashboard_stats'),

      // Recent workflow audits
      supabase.from('v_recent_workflow_audits').select('*').limit(10),

      // Human-controlled leads
      supabase.from('v_human_controlled_leads').select('*').limit(20),

      // System controls (read-only view)
      supabase
        .from('system_controls')
        .select('control_key, control_value, updated_at')
        .in('control_key', [
          'autonomy_level',
          'sam_enabled',
          'ralph_enabled',
          'sam_hours_start',
          'sam_hours_end',
          'golden_lead_auto_declare',
        ]),
    ]);

    // Build response
    const dashboard = {
      timestamp: new Date().toISOString(),
      readOnly: true, // Explicit marker

      // N8N Workflow Status
      n8n: n8nStatsResult.data?.[0] || {
        total_workflows: 0,
        active_workflows: 0,
        archived_count: 0,
        deployments_24h: 0,
        errors_24h: 0,
        last_deployment: null,
      },

      // Engagement Pipeline
      engagement: engagementStatsResult.data?.[0] || {
        total_leads: 0,
        not_contacted: 0,
        sam_active: 0,
        awaiting_response: 0,
        human_controlled: 0,
        closed: 0,
      },

      // Recent Audits (shows governance in action)
      recentAudits: (recentAuditsResult.data || []).map((audit) => ({
        id: audit.id,
        workflowId: audit.workflow_id,
        riskLevel: audit.risk_level,
        approvedBy: audit.approved_by,
        isDeployed: audit.is_deployed,
        createdAt: audit.created_at,
      })),

      // Human-Controlled Leads (visibility, not control)
      humanControlledLeads: (humanControlledResult.data || []).map((lead) => ({
        leadId: lead.lead_id,
        ownerName: lead.owner_name,
        excessAmount: lead.excess_amount,
        currentState: lead.current_state,
        humanActorId: lead.human_actor_id,
        updatedAt: lead.updated_at,
        // Note: No action buttons - this is visibility only
      })),

      // System Status (read-only)
      systemStatus: {
        autonomyLevel: getControlValue(systemControlsResult.data, 'autonomy_level', 0),
        samEnabled: getControlValue(systemControlsResult.data, 'sam_enabled', false),
        ralphEnabled: getControlValue(systemControlsResult.data, 'ralph_enabled', false),
        samHours: {
          start: getControlValue(systemControlsResult.data, 'sam_hours_start', 9),
          end: getControlValue(systemControlsResult.data, 'sam_hours_end', 18),
        },
        goldenLeadAutoDeclaration: getControlValue(
          systemControlsResult.data,
          'golden_lead_auto_declare',
          false
        ),
      },

      // Explicit restrictions
      restrictions: {
        canModifyWorkflows: false,
        canDeployWorkflows: false,
        canChangeControls: false,
        canTakeLeadActions: false,
        message: 'This dashboard is read-only. All changes require ORION approval through proper channels.',
      },
    };

    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('CEO Dashboard error:', error);
    return NextResponse.json(
      {
        error: 'Failed to load dashboard',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// BLOCK ALL MUTATIONS
// ============================================================================

export async function POST() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'CEO Dashboard is read-only. No mutations are permitted.',
    },
    { status: 405 }
  );
}

export async function PUT() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'CEO Dashboard is read-only. No mutations are permitted.',
    },
    { status: 405 }
  );
}

export async function DELETE() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'CEO Dashboard is read-only. No mutations are permitted.',
    },
    { status: 405 }
  );
}

export async function PATCH() {
  return NextResponse.json(
    {
      error: 'Method not allowed',
      message: 'CEO Dashboard is read-only. No mutations are permitted.',
    },
    { status: 405 }
  );
}

// ============================================================================
// HELPERS
// ============================================================================

function getControlValue(
  controls: { control_key: string; control_value: unknown }[] | null,
  key: string,
  defaultValue: unknown
): unknown {
  if (!controls) return defaultValue;

  const control = controls.find((c) => c.control_key === key);
  return control?.control_value ?? defaultValue;
}
