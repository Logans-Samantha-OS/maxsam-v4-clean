import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { skipTraceLeadById } from '@/lib/skip-tracing';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * POST /api/cron/alex-skip-trace-webhook - ALEX Skip Trace After PDF Import
 *
 * TRIGGER 1: Called 5 minutes after PDF upload completes
 * Purpose: Skip trace ONLY newly imported leads for immediate phone enrichment
 *
 * Body: { minutes_ago?: number, limit?: number }
 * - minutes_ago: How far back to look for new leads (default: 10)
 * - limit: Max leads to process (default: 25)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const supabase = createClient();

  // Parse request body
  let minutesAgo = 10;
  let limit = 25;

  try {
    const body = await request.json();
    if (body.minutes_ago && typeof body.minutes_ago === 'number') {
      minutesAgo = Math.min(body.minutes_ago, 60); // Max 60 minutes
    }
    if (body.limit && typeof body.limit === 'number') {
      limit = Math.min(body.limit, 50); // Max 50 per batch
    }
  } catch {
    // Use defaults
  }

  try {
    // Calculate cutoff time
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

    // Find newly imported leads that need skip tracing
    // Criteria:
    // 1. Created within the last N minutes
    // 2. No phone number
    // 3. Not already skip traced
    // 4. High priority (golden leads first, then by Eleanor score)
    const { data: leads, error: fetchError } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, eleanor_score, is_golden, excess_funds_amount')
      .gte('created_at', cutoffTime)
      .is('phone', null)
      .is('phone_1', null)
      .or('skip_traced.is.null,skip_traced.eq.false')
      .order('is_golden', { ascending: false })
      .order('eleanor_score', { ascending: false })
      .limit(limit);

    if (fetchError) {
      throw new Error(`Failed to fetch leads: ${fetchError.message}`);
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new leads need skip tracing',
        processed: 0,
        successful: 0,
        failed: 0,
        minutes_ago: minutesAgo
      });
    }

    await sendTelegramMessage(
      `📞 <b>ALEX: Post-Import Skip Trace</b>\n\n` +
      `Found ${leads.length} new leads from last ${minutesAgo} min\n` +
      `Starting phone enrichment...`
    );

    let successful = 0;
    let failed = 0;
    const results: { name: string; phone?: string; email?: string; error?: string }[] = [];

    for (const lead of leads) {
      try {
        const result = await skipTraceLeadById(lead.id);

        if (result.success && (result.phone || result.email)) {
          successful++;
          results.push({
            name: lead.owner_name || lead.id,
            phone: result.phone,
            email: result.email
          });

          // Mark lead as skip traced successfully
          await supabase
            .from('maxsam_leads')
            .update({
              skip_traced: true,
              skip_traced_at: new Date().toISOString(),
              skip_trace_success: true,
              status: 'enriched'
            })
            .eq('id', lead.id);
        } else {
          failed++;
          results.push({
            name: lead.owner_name || lead.id,
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
            .eq('id', lead.id);
        }

        // Rate limit - wait between requests
        await new Promise(resolve => setTimeout(resolve, 2000));

      } catch (err) {
        failed++;
        results.push({
          name: lead.owner_name || lead.id,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const foundList = results
      .filter(r => r.phone || r.email)
      .slice(0, 5)
      .map(r => `• ${r.name}: ${r.phone || r.email}`)
      .join('\n');

    await sendTelegramMessage(
      `✅ <b>ALEX: Post-Import Skip Trace Complete</b>\n\n` +
      `<b>Phones Found:</b> ${successful}/${leads.length}\n` +
      `<b>Not Found:</b> ${failed}\n` +
      `<b>Duration:</b> ${duration}s\n\n` +
      (successful > 0
        ? `<b>New Contacts:</b>\n${foundList}${results.filter(r => r.phone || r.email).length > 5 ? `\n... +${results.filter(r => r.phone || r.email).length - 5} more` : ''}`
        : 'No new phone numbers found.')
    );

    return NextResponse.json({
      success: true,
      trigger: 'post_import_webhook',
      minutes_ago: minutesAgo,
      processed: leads.length,
      successful,
      failed,
      contacts_found: successful,
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Skip trace failed';
    await sendTelegramMessage(`❌ <b>ALEX Post-Import Skip Trace FAILED</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/cron/alex-skip-trace-webhook - Get status of new leads needing skip trace
 */
export async function GET(request: NextRequest) {
  const supabase = createClient();
  const searchParams = request.nextUrl.searchParams;
  const minutesAgo = parseInt(searchParams.get('minutes_ago') || '10');

  try {
    const cutoffTime = new Date(Date.now() - minutesAgo * 60 * 1000).toISOString();

    // Count new leads needing skip trace
    const { count: needsSkipTrace } = await supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', cutoffTime)
      .is('phone', null)
      .is('phone_1', null)
      .or('skip_traced.is.null,skip_traced.eq.false');

    // Get top priority leads
    const { data: priorityLeads } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, eleanor_score, is_golden, excess_funds_amount, created_at')
      .gte('created_at', cutoffTime)
      .is('phone', null)
      .or('skip_traced.is.null,skip_traced.eq.false')
      .order('is_golden', { ascending: false })
      .order('eleanor_score', { ascending: false })
      .limit(10);

    return NextResponse.json({
      trigger: 'post_import_webhook',
      status: 'ready',
      minutes_ago: minutesAgo,
      cutoff_time: cutoffTime,
      needs_skip_trace: needsSkipTrace || 0,
      priority_leads: priorityLeads?.map(l => ({
        id: l.id,
        name: l.owner_name,
        score: l.eleanor_score,
        is_golden: l.is_golden,
        amount: l.excess_funds_amount,
        created_at: l.created_at
      })) || [],
      usage: 'POST with { minutes_ago?: number, limit?: number }'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
