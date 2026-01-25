import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findLeadsNeedingSkipTrace, skipTraceLeadById } from '@/lib/skip-tracing';
import { notifyLeadsImported } from '@/lib/telegram';
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware';

/**
 * POST /api/cron/alex-skip-trace - ALEX Skip Trace Batch Job
 *
 * Finds high-priority leads missing phone numbers and skip traces them.
 * Called by Vercel Cron or triggered manually from Command Center.
 *
 * Priority order:
 * 1. High Eleanor score (most valuable leads first)
 * 2. No phone, phone_1, or phone_2
 * 3. Not closed or dead status
 */
export async function POST(request: Request) {
  // GATE ENFORCEMENT - ALEX SKIP TRACING
  const blocked = await enforceGates({ agent: 'alex', gate: 'gate_alex_skip_trace' });
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 });
  }

  try {
    const supabase = createClient();

    // Check for optional limit in request body
    let limit = 20; // Default batch size
    try {
      const body = await request.json();
      if (body.limit && typeof body.limit === 'number') {
        limit = Math.min(body.limit, 50); // Max 50 per batch
      }
    } catch {
      // No body or invalid JSON, use default limit
    }

    // Find leads that need skip tracing (prioritized by Eleanor score)
    const leadIds = await findLeadsNeedingSkipTrace(limit);

    if (leadIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads need skip tracing',
        processed: 0,
        successful: 0,
        failed: 0
      });
    }

    // Process each lead
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];
    const foundContacts: string[] = [];

    for (const leadId of leadIds) {
      const result = await skipTraceLeadById(leadId);

      if (result.success) {
        successful++;
        if (result.phone || result.email) {
          // Get lead name for notification
          const { data: lead } = await supabase
            .from('maxsam_leads')
            .select('owner_name, eleanor_score')
            .eq('id', leadId)
            .single();

          const leadInfo = lead?.owner_name || leadId;
          foundContacts.push(`${leadInfo} (${result.phone || result.email})`);
        }
      } else {
        failed++;
        errors.push(`${leadId}: ${result.error}`);
      }

      // Delay between API calls to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Log batch result
    await supabase.from('status_history').insert({
      lead_id: leadIds[0], // Log against first lead
      old_status: 'skip_trace_batch',
      new_status: 'skip_trace_complete',
      changed_by: 'alex_cron',
      reason: `Batch skip trace: ${successful} successful, ${failed} failed`
    });

    // Notify Logan if contacts were found
    if (foundContacts.length > 0) {
      await notifyLeadsImported(
        foundContacts.length,
        `ALEX Skip Trace Found ${foundContacts.length} contacts:\n${foundContacts.slice(0, 5).join('\n')}${foundContacts.length > 5 ? `\n...and ${foundContacts.length - 5} more` : ''}`
      );
    }

    return NextResponse.json({
      success: true,
      processed: leadIds.length,
      successful,
      failed,
      contacts_found: foundContacts.length,
      errors: errors.length > 0 ? errors.slice(0, 10) : undefined // Return first 10 errors max
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('ALEX skip trace error:', errorMessage);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/cron/alex-skip-trace - Check skip trace status
 *
 * Returns count of leads needing skip trace and recent results.
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Count leads needing skip trace
    const { count: needsSkipTrace } = await supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .is('phone', null)
      .is('phone_1', null)
      .is('phone_2', null)
      .not('status', 'in', '("closed","dead")');

    // Get recent skip trace activity
    const { data: recentActivity } = await supabase
      .from('status_history')
      .select('created_at, reason')
      .eq('changed_by', 'skip_trace')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get leads with highest Eleanor scores that need skip tracing
    const { data: priorityLeads } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, eleanor_score, excess_funds_amount')
      .is('phone', null)
      .is('phone_1', null)
      .is('phone_2', null)
      .not('status', 'in', '("closed","dead")')
      .order('eleanor_score', { ascending: false })
      .limit(5);

    return NextResponse.json({
      needs_skip_trace: needsSkipTrace || 0,
      priority_leads: priorityLeads?.map(l => ({
        id: l.id,
        name: l.owner_name,
        score: l.eleanor_score,
        amount: l.excess_funds_amount
      })) || [],
      recent_activity: recentActivity || []
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
