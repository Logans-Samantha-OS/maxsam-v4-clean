import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { runOutreachBatch } from '@/lib/sam-outreach';
import { isTwilioConfigured } from '@/lib/twilio';

/**
 * POST /api/cron/outreach - Run Sam AI outreach batch
 *
 * Called by Vercel Cron hourly between 9 AM - 8 PM
 * Or can be triggered manually
 */
export async function POST() {
  try {
    // Check if outreach is enabled
    const supabase = createClient();
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'outreach_enabled')
      .single();

    if (config?.value !== 'true') {
      return NextResponse.json({
        success: false,
        message: 'Outreach is disabled. Enable in settings.'
      });
    }

    // Check Twilio
    if (!isTwilioConfigured()) {
      return NextResponse.json({
        success: false,
        message: 'Twilio not configured'
      });
    }

    // Check time - only run during business hours (9 AM - 8 PM CT)
    const now = new Date();
    const hour = now.getHours(); // Assuming server is in CT

    if (hour < 9 || hour >= 20) {
      return NextResponse.json({
        success: true,
        message: 'Outside business hours (9 AM - 8 PM). Skipping outreach.',
        skipped: true
      });
    }

    // Get max daily SMS setting
    const { data: maxSmsConfig } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'max_daily_sms')
      .single();

    const maxDailySms = parseInt(maxSmsConfig?.value || '100');

    // Check how many we've sent today
    const today = new Date().toISOString().split('T')[0];
    const { count: sentToday } = await supabase
      .from('communication_logs')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'sms')
      .eq('direction', 'outbound')
      .gte('created_at', today);

    const remaining = maxDailySms - (sentToday || 0);

    if (remaining <= 0) {
      return NextResponse.json({
        success: true,
        message: 'Daily SMS limit reached',
        sent_today: sentToday,
        limit: maxDailySms
      });
    }

    // Run batch with remaining limit
    const batchSize = Math.min(20, remaining);
    const result = await runOutreachBatch(batchSize);

    return NextResponse.json({
      success: true,
      ...result,
      sent_today: (sentToday || 0) + result.successful,
      limit: maxDailySms
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
