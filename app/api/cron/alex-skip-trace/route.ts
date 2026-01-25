import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * ALEX Skip Trace Cron Job
 * Runs at 2:00 AM CT (08:00 UTC) Monday-Saturday
 * Finds phone numbers for leads missing phones
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    await sendTelegramMessage('📞 <b>ALEX starting skip trace...</b>\n\nFinding phone numbers for leads without contact info.');

    const supabase = getSupabase();
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Find leads without phone numbers, prioritizing high-value leads
    const { data: leads, error: leadsError } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, property_city, state, excess_funds_amount, eleanor_score')
      .is('phone', null)
      .is('phone_1', null)
      .is('phone_2', null)
      .or('skip_traced.is.null,skip_traced.eq.false')
      .neq('status', 'deleted')
      .neq('status', 'opted_out')
      .gte('excess_funds_amount', 5000)
      .order('excess_funds_amount', { ascending: false })
      .limit(25);

    if (leadsError) {
      throw new Error(`Failed to fetch leads: ${leadsError.message}`);
    }

    if (!leads || leads.length === 0) {
      await sendTelegramMessage('✅ <b>ALEX Skip Trace:</b> No leads need skip tracing.\n\nAll high-value leads have phone numbers!');
      return NextResponse.json({
        success: true,
        message: 'No leads to skip trace',
        phonesFound: 0
      });
    }

    let phonesFound = 0;
    let failed = 0;
    const results: { name: string; phone?: string; error?: string }[] = [];

    for (const lead of leads) {
      try {
        // Call skip trace endpoint for each lead
        const response = await fetch(`${baseUrl}/api/leads/${lead.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'skip-trace' })
        });

        const data = await response.json();

        if (response.ok && data.phone) {
          phonesFound++;
          results.push({ name: lead.owner_name, phone: data.phone });

          // Mark lead as skip traced
          await supabase
            .from('maxsam_leads')
            .update({
              skip_traced: true,
              skip_traced_at: new Date().toISOString(),
              skip_trace_success: true
            })
            .eq('id', lead.id);
        } else {
          failed++;
          results.push({ name: lead.owner_name, error: data.error || 'Not found' });

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
          name: lead.owner_name,
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      }
    }

    const duration = Math.round((Date.now() - startTime) / 1000);
    const foundList = results
      .filter(r => r.phone)
      .slice(0, 5)
      .map(r => `• ${r.name}: ${r.phone}`)
      .join('\n');

    await sendTelegramMessage(`✅ <b>ALEX: Skip trace complete</b>

<b>Phones Found:</b> ${phonesFound}
<b>Not Found:</b> ${failed}
<b>Duration:</b> ${duration}s

${phonesFound > 0 ? `<b>New Contacts:</b>\n${foundList}${results.filter(r => r.phone).length > 5 ? `\n... +${results.filter(r => r.phone).length - 5} more` : ''}` : 'No new phone numbers found.'}

Next: Eleanor scoring at 5 AM CT`);

    return NextResponse.json({
      success: true,
      leadsProcessed: leads.length,
      phonesFound,
      failed,
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Skip trace failed';
    await sendTelegramMessage(`❌ <b>ALEX Skip Trace FAILED</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
