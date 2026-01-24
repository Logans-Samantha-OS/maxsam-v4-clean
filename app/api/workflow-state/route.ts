/**
 * WORKFLOW STATE API
 *
 * Used by N8N workflows to check and save state.
 * Prevents duplicate actions (e.g., SMS twice in 24hrs).
 *
 * GET /api/workflow-state?lead_id=X&workflow=Y&hours=24
 * POST /api/workflow-state - Save workflow completion
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkWorkflowState,
  saveWorkflowState,
  startWorkflow,
  getWorkflowHistory,
  getWorkflowStats
} from '@/lib/workflow-state';

/**
 * GET - Check if workflow ran recently
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const leadId = searchParams.get('lead_id');
    const workflow = searchParams.get('workflow');
    const hours = Number(searchParams.get('hours') || '24');
    const action = searchParams.get('action');

    // Action: get stats
    if (action === 'stats') {
      const stats = await getWorkflowStats(hours);
      return NextResponse.json(stats);
    }

    // Action: get history for a lead
    if (action === 'history' && leadId) {
      const history = await getWorkflowHistory(leadId);
      return NextResponse.json({ lead_id: leadId, history });
    }

    // Default: check if workflow ran
    if (!leadId || !workflow) {
      return NextResponse.json(
        { error: 'Missing lead_id or workflow parameter' },
        { status: 400 }
      );
    }

    const result = await checkWorkflowState(workflow, leadId, hours);
    return NextResponse.json(result);

  } catch (error) {
    console.error('Workflow state check error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST - Save workflow state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { workflow_name, lead_id, state, status, action } = body;

    // Action: start a new workflow run
    if (action === 'start') {
      if (!workflow_name) {
        return NextResponse.json(
          { error: 'Missing workflow_name' },
          { status: 400 }
        );
      }

      const workflowId = await startWorkflow(workflow_name, lead_id, body.run_id);
      return NextResponse.json({
        success: true,
        workflow_id: workflowId,
        message: 'Workflow started'
      });
    }

    // Default: save workflow completion
    if (!workflow_name || !lead_id) {
      return NextResponse.json(
        { error: 'Missing workflow_name or lead_id' },
        { status: 400 }
      );
    }

    await saveWorkflowState(
      workflow_name,
      lead_id,
      state || {},
      status || 'completed'
    );

    return NextResponse.json({
      success: true,
      message: 'Workflow state saved'
    });

  } catch (error) {
    console.error('Workflow state save error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
