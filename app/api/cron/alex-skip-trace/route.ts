import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { findLeadsNeedingSkipTrace, skipTraceLeadById } from '@/lib/skip-tracing';
import { sendTelegramMessage } from '@/lib/telegram';
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware';

/**
 * GET /api/cron/alex-skip-trace - ALEX Skip Trace Cron Job
 *
 * Runs at 2:00 AM CT (08:00 UTC) Monday-Saturday via Vercel Cron
 * Finds phone numbers for leads missing contact info
 *
 * Also serves as status check endpoint when no cron secret is provided.
 */
export async function GET(request: NextRequest) {
  // If cron secret is provided and matches, run the skip trace
  const authHeader = request.headers.get('authorization');
  const hasCronAuth = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;

  // If no cron auth, return status instead
  if (!hasCronAuth && process.env.CRON_SECRET) {
    return getSkipTraceStatus();
  }

  // Run the skip trace job
  return runSkipTrace(25); // Default limit for cron
}

/**
 * POST /api/cron/alex-skip-trace - Manual Skip Trace Trigger
 *
 * Triggered manually from Command Center.
 * Accepts optional limit in request body.
 */
export async function POST(request: Request) {
  // GATE ENFORCEMENT - ALEX SKIP TRACING
  const blocked = await enforceGates({ agent: 'alex', gate: 'gate_alex_skip_trace' });
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 });
  }

  // Check for optional limit in request body
  let limit = 20; // Default batch size for manual trigger
  try {
    const body = await request.json();
    if (body.limit && typeof body.limit === 'number') {
      limit = Math.min(body.limit, 50); // Max 50 per batch
    }
  } catch {
    // No body or invalid JSON, use default limit
  }

  return runSkipTrace(limit);
}

/**
 * Core skip trace logic - shared by GET (cron) and POST (manual)
 */
async function runSkipTrace(limit: number) {
  const startTime = Date.now();

  try {
    await sendTelegramMessage('📞 <b>ALEX starting skip trace...</b>\n\nFinding phone numbers for leads without contact info.');

    // Find leads that need skip tracing (prioritized by Eleanor score)
    const leadIds = await findLeadsNeedingSkipTrace(limit);

    if (leadIds.length === 0) {
      await sendTelegramMessage('✅ <b>ALEX Skip Trace:</b> No leads need skip tracing.\n\nAll high-value leads have phone numbers!');
      return NextResponse.json({
        success: true,
        message: 'No leads need skip tracing',
        processed: 0,
        successful: 0,
        failed: 0
      });
    }

    const supabase = createClient();
    let successful = 0;
    let failed = 0;
    const results: { name: string; phone?: string; email?: string; error?: string }[] = [];

    for (const leadId of leadIds) {
      try {
        // Get lead info for logging
        const { data: lead } = await supabase
          .from('maxsam_leads')
          .select('owner_name, eleanor_score')
          .eq('id', leadId)
          .single();

        const result = await skipTraceLeadById(leadId);

        if (result.success && (result.phone || result.email)) {
          successful++;
          results.push({
            name: lead?.owner_name || leadId,
            phone: result.phone,
            email: result.email
          });

          // Mark lead as skip traced successfully
          await supabase
            .from('maxsam_leads')
            .update({
              skip_traced: true,
              skip_traced_at: new Date().toISOString(),
              skip_trace_success: true
            })
            .eq('id', leadId);
        } else {
          failed++;
          results.push({
            name: lead?.owner_name || leadId,
            error: result.error || 'Not found'
          });

          // Mark as attempted
          await supabase
            .from('maxsam_leads')
            .update({
              skip_traced: true,
              skip_traced_at: new Date().toISOString(),
              skip_trace_success: false
            })
            .eq('id', leadId);
        }

        // Rate limit - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        failed++;
        results.push({
          name: leadId,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    // Log batch result
    await supabase.from('status_history').insert({
      lead_id: leadIds[0],
      old_status: 'skip_trace_batch',
      new_status: 'skip_trace_complete',
      changed_by: 'alex_cron',
      reason: `Batch skip trace: ${successful} successful, ${failed} failed`
    });

    const duration = Math.round((Date.now() - startTime) / 1000);
    const foundList = results
      .filter(r => r.phone || r.email)
      .slice(0, 5)
      .map(r => `• ${r.name}: ${r.phone || r.email}`)
      .join('\n');

    await sendTelegramMessage(`✅ <b>ALEX: Skip trace complete</b>

<b>Phones Found:</b> ${successful}
<b>Not Found:</b> ${failed}
<b>Duration:</b> ${duration}s

${successful > 0 ? `<b>New Contacts:</b>\n${foundList}${results.filter(r => r.phone || r.email).length > 5 ? `\n... +${results.filter(r => r.phone || r.email).length - 5} more` : ''}` : 'No new phone numbers found.'}

Next: Eleanor scoring at 5 AM CT`);

    return NextResponse.json({
      success: true,
      processed: leadIds.length,
      successful,
      failed,
      contacts_found: successful,
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Skip trace failed';
    await sendTelegramMessage(`❌ <b>ALEX Skip Trace FAILED</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Get skip trace status - how many leads need it, recent activity
 */
async function getSkipTraceStatus() {
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
