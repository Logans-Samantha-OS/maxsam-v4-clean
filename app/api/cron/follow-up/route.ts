/**
 * Follow-up Sequences Cron Job
 * Runs at 10 AM CT (16:00 UTC) Monday-Saturday
 * Sends scheduled follow-up messages to leads based on their follow-up stage
 *
 * Follow-up schedule:
 * - Stage 0 → Stage 1: Day 1 after initial contact
 * - Stage 1 → Stage 2: Day 3 (2 days later)
 * - Stage 2 → Stage 3: Day 7 (4 days later)
 * - Stage 3 → Stage 4: Day 14 (7 days later)
 * - Stage 4: No more automatic follow-ups
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSMS, isTwilioConfigured } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';
import { isPaused } from '@/lib/ops/checkPause';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// Follow-up message templates by stage
const FOLLOW_UP_TEMPLATES = {
  1: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, just following up on my message about the ${formatAmount(lead.excess_funds_amount)} owed to you from ${lead.property_address || 'your property'}.

This money is legally yours. Would you like to learn how to claim it?

Reply YES or call me back.
-Sam

Text STOP to opt-out`,

  2: (lead: Lead) => `${getFirstName(lead.owner_name)}, quick reminder: there's still ${formatAmount(lead.excess_funds_amount)} waiting for you from your previous property sale.

I can help you recover this money. It's a simple process.

Interested? Reply YES.
-Sam

Text STOP to opt-out`,

  3: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, I've tried reaching you a few times about unclaimed funds.

${formatAmount(lead.excess_funds_amount)} from ${lead.property_address || 'your property'} - this could expire.

Last chance to connect. Reply YES or STOP.
-Sam`,

  4: (lead: Lead) => `${getFirstName(lead.owner_name)}, final follow-up about your ${formatAmount(lead.excess_funds_amount)} in unclaimed funds.

If interested, reply YES. Otherwise, I won't contact you again about this.

-Sam
STOP to opt-out`,
};

type Lead = {
  id: string;
  owner_name: string;
  property_address: string | null;
  excess_funds_amount: number;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  follow_up_stage: number;
  next_follow_up_date: string | null;
  contact_attempts: number;
  opted_out: boolean;
  do_not_contact: boolean;
  sms_opt_out: boolean;
};

function getFirstName(name: string | null): string {
  if (!name) return 'there';
  const parts = name.split(/[,\s]+/);
  if (name.includes(',') && parts.length >= 2) {
    return parts[1].charAt(0).toUpperCase() + parts[1].slice(1).toLowerCase();
  }
  return parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
}

function formatAmount(amount: number | null): string {
  if (!amount || amount === 0) return 'potential funds';
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return `$${amount.toLocaleString()}`;
}

function getLeadPhone(lead: Lead): string | null {
  return lead.phone || lead.phone_1 || lead.phone_2 || null;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // System-wide pause check
  if (await isPaused()) {
    return NextResponse.json({ success: false, error: 'System is paused', paused: true }, { status: 503 });
  }

  try {
    const supabase = getSupabase();

    if (!isTwilioConfigured()) {
      await sendTelegramMessage('⚠️ Follow-up cron skipped: Twilio not configured');
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    // Get leads that are due for follow-up
    const now = new Date().toISOString();
    const { data: leads, error: leadsError } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, excess_funds_amount, phone, phone_1, phone_2, follow_up_stage, next_follow_up_date, contact_attempts, opted_out, do_not_contact, sms_opt_out')
      .lte('next_follow_up_date', now)
      .lt('follow_up_stage', 4) // Max 4 follow-ups
      .lt('contact_attempts', 5)
      .in('status', ['contacted', 'scored'])
      .or('opted_out.is.null,opted_out.eq.false')
      .or('do_not_contact.is.null,do_not_contact.eq.false')
      .or('sms_opt_out.is.null,sms_opt_out.eq.false')
      .order('excess_funds_amount', { ascending: false })
      .limit(15);

    if (leadsError) {
      await sendTelegramMessage(`⚠️ Follow-up error: ${leadsError.message}`);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const leadsWithPhone = (leads || []).filter(lead => getLeadPhone(lead as Lead));

    if (leadsWithPhone.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No follow-ups due',
        leads_checked: leads?.length || 0
      });
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
      sent: [] as { name: string; stage: number; amount: number }[]
    };

    for (const lead of leadsWithPhone) {
      const typedLead = lead as Lead;
      const phone = getLeadPhone(typedLead);
      if (!phone) continue;

      const stage = (typedLead.follow_up_stage || 0) + 1;
      const template = FOLLOW_UP_TEMPLATES[stage as keyof typeof FOLLOW_UP_TEMPLATES];

      if (!template) continue;

      const message = template(typedLead);

      try {
        const smsResult = await sendSMS(phone, message, typedLead.id);

        if (smsResult.success) {
          results.success++;
          results.sent.push({
            name: typedLead.owner_name,
            stage,
            amount: typedLead.excess_funds_amount
          });

          // Calculate next follow-up date
          const nextFollowUp = calculateNextFollowUp(stage);

          // Update lead
          await supabase
            .from('maxsam_leads')
            .update({
              follow_up_stage: stage,
              next_follow_up_date: nextFollowUp,
              contact_attempts: (typedLead.contact_attempts || 0) + 1,
              last_contacted_at: new Date().toISOString(),
              last_contact_date: new Date().toISOString()
            })
            .eq('id', typedLead.id);

          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          results.failed++;
          results.errors.push(`${typedLead.owner_name}: ${smsResult.error}`);
        }
      } catch (e) {
        results.failed++;
        results.errors.push(`${typedLead.owner_name}: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }

    // Send summary
    const sentList = results.sent
      .slice(0, 5)
      .map((l, i) => `${i + 1}. ${l.name} - Stage ${l.stage} ($${Math.round(l.amount / 1000)}K)`)
      .join('\n');

    await sendTelegramMessage(`📞 <b>FOLLOW-UP CAMPAIGN COMPLETE</b>

✅ Sent: <b>${results.success}</b>
❌ Failed: <b>${results.failed}</b>

${results.sent.length > 0 ? `<b>Follow-ups sent:</b>\n${sentList}` : 'No follow-ups sent'}

${results.errors.length > 0 ? `\n⚠️ Errors:\n${results.errors.slice(0, 3).join('\n')}` : ''}`);

    return NextResponse.json({
      success: true,
      message: `Follow-up complete: ${results.success} sent, ${results.failed} failed`,
      results
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Follow-up failed';
    await sendTelegramMessage(`⚠️ Follow-up cron crashed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function calculateNextFollowUp(currentStage: number): string | null {
  const now = new Date();

  switch (currentStage) {
    case 1:
      // Next follow-up in 2 days (day 3)
      now.setDate(now.getDate() + 2);
      break;
    case 2:
      // Next follow-up in 4 days (day 7)
      now.setDate(now.getDate() + 4);
      break;
    case 3:
      // Next follow-up in 7 days (day 14)
      now.setDate(now.getDate() + 7);
      break;
    case 4:
      // No more follow-ups
      return null;
    default:
      now.setDate(now.getDate() + 1);
  }

  return now.toISOString();
}
