/**
 * POST /api/os/approvals/[id]/reject - Reject a SaaS request
 *
 * Requires OS authority. Rejects a pending request.
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
    const { note } = body;

    const supabase = getSupabase();

    // Get the approval
    const { data: approval, error: fetchError } = await supabase
      .from('approvals')
      .select('*')
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
        status: 'rejected',
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
        status: 'rejected',
        resolved_at: now,
      })
      .eq('id', approval.request_id);

    // Log the rejection to activity
    await supabase.from('activity_log').insert({
      lead_id: approval.lead_id,
      activity_type: 'note',
      outcome: 'rejected',
      notes: note || `Request ${approval.request_id} rejected`,
      created_by: 'os-approvals',
    });

    const response: OSApprovalResponse = {
      ok: true,
      approval: {
        id: updatedApproval.id,
        status: 'rejected',
        decided_at: now,
      },
    };

    return NextResponse.json(response);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('OS reject error:', message);
    return NextResponse.json(
      { ok: false, error: message } as OSApprovalResponse,
      { status: 500 }
    );
  }
}
