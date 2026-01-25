import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * Eleanor Score All Cron Job
 * Runs at 5:00 AM CT (11:00 UTC) Monday-Saturday
 * Scores all unscored leads with Eleanor AI
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
    await sendTelegramMessage('🧠 <b>ELEANOR starting lead scoring...</b>\n\nAnalyzing all unscored leads.');

    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Call the existing score-all endpoint
    const response = await fetch(`${baseUrl}/api/eleanor/score-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Scoring failed');
    }

    const duration = Math.round((Date.now() - startTime) / 1000);

    // Build score distribution message
    const scoreBreakdown = data.scoreDistribution || {};
    const distributionMsg = Object.entries(scoreBreakdown)
      .map(([grade, count]) => `• Grade ${grade}: ${count}`)
      .join('\n');

    await sendTelegramMessage(`✅ <b>ELEANOR: Scoring complete</b>

<b>Leads Scored:</b> ${data.scored || 0}
<b>Already Scored:</b> ${data.alreadyScored || 0}
<b>Duration:</b> ${duration}s

${distributionMsg ? `<b>Score Distribution:</b>\n${distributionMsg}` : ''}

<b>Top Prospects:</b>
${data.topLeads?.slice(0, 3).map((l: { name: string; score: number; amount: number }) =>
  `• ${l.name}: ${l.score} pts ($${Math.round(l.amount / 1000)}K)`
).join('\n') || 'None'}

Next: Flag golden leads at 6 AM CT`);

    return NextResponse.json({
      success: true,
      scored: data.scored || 0,
      alreadyScored: data.alreadyScored || 0,
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scoring failed';
    await sendTelegramMessage(`❌ <b>ELEANOR Scoring FAILED</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
