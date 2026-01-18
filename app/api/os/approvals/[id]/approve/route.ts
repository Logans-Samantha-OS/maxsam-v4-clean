/**
 * POST /api/os/approvals/[id]/approve - Approve a SaaS request
 *
 * Requires OS authority. Approves a pending request.
 * Optionally creates a queued action for Ralph.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOSAuthority } from '@/lib/auth/authority-guard';
import { OSApprovalDecisionRequest, OSApprovalResponse } from '@/types/os';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const authError = requireOSAuthority(request);
  if (authError) return authError;

  try {
    const { id: approvalId } = await params;
    const body = await request.json().catch(() => ({})) as OSApprovalDecisionRequest;
    const { note, createQueuedAction } = body;

    const supabase = getSupabase();

    // Get the approval and linked request
    const { data: approval, error: fetchError } = await supabase
      .from('approvals')
      .select('*, saas_requests(*)')
      .eq('id', approvalId)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { ok: false, error: `Approval not found: ${approvalId}` } as OSApprovalResponse,
        { status: 404 }
      );
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { ok: false, error: `Approval already ${approval.status}` } as OSApprovalResponse,
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Update approval status
    const { data: updatedApproval, error: updateError } = await supabase
      .from('approvals')
      .update({
        status: 'approved',
        decided_at: now,
        decided_by: 'os-operator',
      })
      .eq('id', approvalId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update approval:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update approval' } as OSApprovalResponse,
        { status: 500 }
      );
    }

    // Update linked request status
    await supabase
      .from('saas_requests')
      .update({
        status: 'approved',
        resolved_at: now,
      })
      .eq('id', approval.request_id);

    // Log the approval to activity
    await supabase.from('activity_log').insert({
      lead_id: approval.lead_id,
      activity_type: 'note',
      outcome: 'approved',
      notes: note || `Request ${approval.request_id} approved`,
      created_by: 'os-approvals',
    });

    // Optionally create a queued action (but do NOT auto-execute)
    let queuedActionId: string | undefined;
    if (createQueuedAction && approval.saas_requests) {
      const requestType = approval.saas_requests.request_type;

      // Map request types to action types
      const requestToAction: Record<string, string> = {
        contact_request: 'send_sms',
        contract_request: 'generate_contract',
        info_request: 'score_lead',
        escalation_request: 'escalate_human',
      };

      const actionType = requestToAction[requestType] || 'escalate_human';

      // Try to insert into execution_queue if it exists
      const { data: queuedAction, error: queueError } = await supabase
        .from('execution_queue')
        .insert({
          lead_id: approval.lead_id,
          action_type: actionType,
          actor_type: 'ralph',
          status: 'pending',
          priority: 50,
          metadata: { from_approval: approvalId },
        })
        .select()
        .single();

      if (!queueError && queuedAction) {
        queuedActionId = queuedAction.id;
      }
    }

    const response: OSApprovalResponse = {
      ok: true,
      approval: {
        id: updatedApproval.id,
        status: 'approved',
        decided_at: now,
      },
      queuedActionId,
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('OS approve error:', message);
    return NextResponse.json(
      { ok: false, error: message } as OSApprovalResponse,
      { status: 500 }
    );
  }
}
