import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * Flag Golden Leads Cron Job
 * Runs at 6:00 AM CT (12:00 UTC) Monday-Saturday
 * Marks leads with score 80+ and phone as golden
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
    await sendTelegramMessage('⭐ <b>Flagging golden leads...</b>\n\nIdentifying high-value prospects ready for outreach.');

    const supabase = getSupabase();

    // First, get count of leads that will be flagged
    const { data: toFlag, error: countError } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, excess_funds_amount, eleanor_score, phone, phone_1, phone_2')
      .gte('eleanor_score', 80)
      .or('is_golden_lead.is.null,is_golden_lead.eq.false')
      .neq('status', 'deleted')
      .neq('status', 'opted_out');

    if (countError) {
      throw new Error(`Failed to query leads: ${countError.message}`);
    }

    // Filter to only those with phone numbers
    const leadsWithPhone = (toFlag || []).filter(l =>
      l.phone || l.phone_1 || l.phone_2
    );

    if (leadsWithPhone.length === 0) {
      await sendTelegramMessage('✅ <b>Golden Leads:</b> No new golden leads to flag.\n\nAll high-score leads with phones are already golden!');
      return NextResponse.json({
        success: true,
        flagged: 0,
        message: 'No new golden leads to flag'
      });
    }

    // Flag the leads as golden
    const leadIds = leadsWithPhone.map(l => l.id);

    const { error: updateError } = await supabase
      .from('maxsam_leads')
      .update({
        is_golden_lead: true,
        is_golden: true,
        golden_discovered_at: new Date().toISOString(),
        golden_reason: 'Eleanor score 80+ with verified phone number'
      })
      .in('id', leadIds);

    if (updateError) {
      throw new Error(`Failed to flag leads: ${updateError.message}`);
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Calculate total value
    const totalValue = leadsWithPhone.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0);
    const potentialFee = totalValue * 0.25;

    // Top golden leads
    const topGolden = leadsWithPhone
      .sort((a, b) => (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0))
      .slice(0, 5)
      .map(l => `• ${l.owner_name}: $${Math.round((l.excess_funds_amount || 0) / 1000)}K (Score: ${l.eleanor_score})`)
      .join('\n');

    await sendTelegramMessage(`✅ <b>${leadsWithPhone.length} golden leads flagged!</b>

<b>Total Value:</b> $${Math.round(totalValue / 1000)}K
<b>Potential Fee (25%):</b> $${Math.round(potentialFee / 1000)}K
<b>Duration:</b> ${duration}s

<b>Top Golden Leads:</b>
${topGolden}

<b>Overnight Pipeline Complete!</b>
Morning brief at 8 AM CT
SAM outreach at 9 AM CT`);

    return NextResponse.json({
      success: true,
      flagged: leadsWithPhone.length,
      totalValue,
      potentialFee,
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Golden flagging failed';
    await sendTelegramMessage(`❌ <b>Golden Lead Flagging FAILED</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
