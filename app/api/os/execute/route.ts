/**
 * POST /api/os/execute - OS Execution Endpoint
 *
 * Direct execution of actions on leads. Requires OS authority.
 * - Validates lead exists
 * - Logs execution event to activity_log
 * - Updates lead status based on action type
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireOSAuthority } from '@/lib/auth/authority-guard';
import { OSExecuteRequest, OSExecuteResponse, ACTION_STATUS_MAP, LeadInternal } from '@/types/os';
import { ActionType } from '@/types/shared';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

const VALID_ACTION_TYPES: ActionType[] = [
  'send_sms',
  'send_followup',
  'call_now',
  'skip_trace',
  'score_lead',
  'generate_contract',
  'send_contract',
  'escalate_human',
];

/**
 * Map action types to activity_log activity_type
 */
const ACTION_TO_ACTIVITY_TYPE: Record<ActionType, string> = {
  send_sms: 'sms',
  send_followup: 'sms',
  call_now: 'call',
  skip_trace: 'note',
  score_lead: 'note',
  generate_contract: 'note',
  send_contract: 'email',
  escalate_human: 'note',
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Check OS authority
  const authError = requireOSAuthority(request);
  if (authError) return authError;

  try {
    const body = await request.json() as OSExecuteRequest;
    const { leadId, actionType } = body;

    // Validate input
    if (!leadId || typeof leadId !== 'string') {
      return NextResponse.json(
        { ok: false, error: 'leadId is required and must be a string' },
        { status: 400 }
      );
    }

    if (!actionType || !VALID_ACTION_TYPES.includes(actionType as ActionType)) {
      return NextResponse.json(
        { ok: false, error: `Invalid actionType. Must be one of: ${VALID_ACTION_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Validate lead exists
    const { data: existingLead, error: fetchError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (fetchError || !existingLead) {
      return NextResponse.json(
        { ok: false, error: `Lead not found: ${leadId}` },
        { status: 404 }
      );
    }

    // Determine new status based on action
    const typedAction = actionType as ActionType;
    const newStatus = ACTION_STATUS_MAP[typedAction] || existingLead.status;

    // Update lead status and contact tracking
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: new Date().toISOString(),
    };

    // Increment contact attempts for contact actions
    if (['send_sms', 'send_followup', 'call_now'].includes(typedAction)) {
      updatePayload.contact_attempts = (existingLead.contact_attempts || 0) + 1;
      updatePayload.last_contact_date = new Date().toISOString();
    }

    const { data: updatedLead, error: updateError } = await supabase
      .from('maxsam_leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update lead:', updateError);
      return NextResponse.json(
        { ok: false, error: 'Failed to update lead' },
        { status: 500 }
      );
    }

    // Log to activity_log
    const activityType = ACTION_TO_ACTIVITY_TYPE[typedAction];
    const { data: activityEvent, error: logError } = await supabase
      .from('activity_log')
      .insert({
        lead_id: leadId,
        activity_type: activityType,
        outcome: 'executed',
        notes: `OS executed: ${typedAction}`,
        created_by: 'os-execute',
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log activity:', logError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      ok: true,
      updatedLead: updatedLead as LeadInternal,
      eventId: activityEvent?.id || undefined,
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('OS execute error:', message);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
