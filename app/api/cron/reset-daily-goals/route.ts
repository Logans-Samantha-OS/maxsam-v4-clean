/**
 * RESET DAILY GOALS CRON
 *
 * Resets all agent goal counters at midnight.
 * Called by Vercel Cron at 0 0 * * * (midnight UTC)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function POST() {
  try {
    const supabase = getSupabase();

    // Reset all goals where last_reset is before today
    const { data, error } = await supabase
      .from('agent_goals')
      .update({
        current_daily: 0,
        last_reset: new Date().toISOString().split('T')[0]
      })
      .lt('last_reset', new Date().toISOString().split('T')[0])
      .select('id');

    if (error) {
      console.error('Goal reset error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const resetCount = data?.length || 0;

    // Send Telegram notification
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (botToken && chatId && resetCount > 0) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: `🌅 <b>NEW DAY</b>\n\nReset ${resetCount} agent goals.\nAgents ready for today's work.`,
          parse_mode: 'HTML'
        })
      }).catch(() => { /* ignore */ });
    }

    return NextResponse.json({
      success: true,
      message: `Reset ${resetCount} goals`,
      reset_count: resetCount
    });

  } catch (error) {
    console.error('Goal reset cron error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Also support GET for Vercel Cron
export async function GET() {
  return POST();
}
