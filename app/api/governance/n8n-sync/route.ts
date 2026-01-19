/**
 * N8N Sync API - MaxSam V4 Governance Layer
 *
 * GET:  Sync workflow states from n8n to Supabase
 * POST: Push gate state to n8n (enable/disable workflow)
 *
 * This endpoint bridges the governance layer with n8n automation.
 * Gate states in Supabase are the source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const N8N_URL = process.env.N8N_URL || 'https://skooki.app.n8n.cloud';
const N8N_API_KEY = process.env.N8N_API_KEY;

async function n8nRequest(endpoint: string, method = 'GET', body?: unknown) {
  if (!N8N_API_KEY) {
    throw new Error('N8N_API_KEY not configured');
  }

  const response = await fetch(`${N8N_URL}/api/v1/${endpoint}`, {
    method,
    headers: {
      'X-N8N-API-KEY': N8N_API_KEY,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`N8N API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

// GET: Sync workflow states from n8n to Supabase
export async function GET() {
  const supabase = createClient();

  try {
    const n8nWorkflows = await n8nRequest('workflows');

    let synced = 0;
    let errors: string[] = [];

    for (const workflow of n8nWorkflows.data || []) {
      const { error } = await supabase
        .from('workflow_controls')
        .upsert(
          {
            n8n_workflow_id: workflow.id,
            workflow_name: workflow.name,
            n8n_active_state: workflow.active,
            last_synced_at: new Date().toISOString()
          },
          { onConflict: 'n8n_workflow_id' }
        );

      if (error) {
        errors.push(`Failed to sync ${workflow.name}: ${error.message}`);
      } else {
        synced++;
      }
    }

    return NextResponse.json({
      success: true,
      synced,
      total: n8nWorkflows.data?.length || 0,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        n8n_available: false,
        message: 'N8N sync failed. Ensure N8N_API_KEY is configured.',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

// POST: Push gate state to n8n (enable/disable workflow)
export async function POST(request: NextRequest) {
  const supabase = createClient();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { workflow_id, enabled } = body;

  if (!workflow_id) {
    return NextResponse.json({ success: false, error: 'workflow_id is required' }, { status: 400 });
  }

  if (typeof enabled !== 'boolean') {
    return NextResponse.json({ success: false, error: 'enabled must be a boolean' }, { status: 400 });
  }

  try {
    // First check if our gate allows this
    const { data: gateState } = await supabase
      .from('workflow_controls')
      .select('enabled, workflow_name')
      .eq('n8n_workflow_id', workflow_id)
      .single();

    // If trying to enable in n8n but gate is closed, deny
    if (!gateState?.enabled && enabled) {
      return NextResponse.json(
        {
          success: false,
          error: 'Cannot enable n8n workflow: Gate is closed in Supabase',
          gate_state: gateState?.enabled,
          requested_state: enabled,
          message: 'Open the gate first via /api/governance before syncing to n8n'
        },
        { status: 403 }
      );
    }

    // Activate or deactivate in n8n
    const endpoint = enabled
      ? `workflows/${workflow_id}/activate`
      : `workflows/${workflow_id}/deactivate`;

    await n8nRequest(endpoint, 'POST');

    // Update sync state in Supabase
    await supabase
      .from('workflow_controls')
      .update({
        n8n_active_state: enabled,
        last_synced_at: new Date().toISOString()
      })
      .eq('n8n_workflow_id', workflow_id);

    return NextResponse.json({
      success: true,
      workflow_id,
      workflow_name: gateState?.workflow_name,
      n8n_active: enabled,
      message: `N8N workflow ${enabled ? 'activated' : 'deactivated'} successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        degraded: true,
        message: 'N8N sync failed but gate state preserved in Supabase. The n8n workflow state may be out of sync.',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
