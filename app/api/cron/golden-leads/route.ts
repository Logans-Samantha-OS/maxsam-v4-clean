/**
 * Golden Lead Fast-Track Cron Job
 * Runs at 9:30 AM CT (15:30 UTC) Monday-Saturday
 *
 * Golden leads get priority treatment:
 * 1. Immediate notification to Logan with call prompt
 * 2. SMS sent with higher urgency messaging
 * 3. If ElevenLabs configured, can trigger voice call
 *
 * Golden leads are identified by:
 * - is_golden_lead = true OR golden_lead = true
 * - Typically $50K+ excess funds with high score
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSMS, isTwilioConfigured } from '@/lib/twilio';
import { sendTelegramMessage, notifyGoldenLeadDeclared } from '@/lib/telegram';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

type GoldenLead = {
  id: string;
  owner_name: string;
  property_address: string | null;
  excess_funds_amount: number;
  eleanor_score: number;
  golden_score: number | null;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  status: string;
  contact_attempts: number;
  is_super_golden: boolean | null;
  excess_funds_expiry_date: string | null;
  days_until_expiration: number | null;
  opted_out: boolean | null;
  do_not_contact: boolean | null;
  sms_opt_out: boolean | null;
};

// Golden lead SMS template - more urgent and personalized
const GOLDEN_TEMPLATE = (lead: GoldenLead) => {
  const firstName = getFirstName(lead.owner_name);
  const amount = formatAmount(lead.excess_funds_amount);
  const address = lead.property_address || 'your property';
  const urgency = lead.days_until_expiration && lead.days_until_expiration <= 30
    ? `⚠️ URGENT: These funds may expire in ${lead.days_until_expiration} days!`
    : '';

  return `Hi ${firstName}, this is Sam from MaxSam Real Estate.

I found ${amount} in CONFIRMED unclaimed funds from ${address}.

${urgency}

This is real money that belongs to YOU. I'd love to help you claim it - we have a 100% success rate.

Can we talk for 5 minutes? Reply YES and I'll call you right now, or call me back at this number.

-Sam

STOP to opt-out`;
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
  if (!amount || amount === 0) return 'significant funds';
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K+`;
  }
  return `$${amount.toLocaleString()}`;
}

function getLeadPhone(lead: GoldenLead): string | null {
  return lead.phone || lead.phone_1 || lead.phone_2 || null;
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();

    if (!isTwilioConfigured()) {
      await sendTelegramMessage('⚠️ Golden Lead cron skipped: Twilio not configured');
      return NextResponse.json({ error: 'Twilio not configured' }, { status: 500 });
    }

    // Get golden leads that need outreach
    // Priority: super_golden first, then by expiry date, then by amount
    const { data: goldenLeads, error: leadsError } = await supabase
      .from('maxsam_leads')
      .select(`
        id, owner_name, property_address, excess_funds_amount, eleanor_score,
        golden_score, phone, phone_1, phone_2, status, contact_attempts,
        is_super_golden, excess_funds_expiry_date, days_until_expiration,
        opted_out, do_not_contact, sms_opt_out
      `)
      .or('is_golden_lead.eq.true,golden_lead.eq.true,is_super_golden.eq.true')
      .in('status', ['new', 'scored', 'ready_for_outreach'])
      .lt('contact_attempts', 3) // Golden leads get less attempts but higher quality
      .or('opted_out.is.null,opted_out.eq.false')
      .or('do_not_contact.is.null,do_not_contact.eq.false')
      .or('sms_opt_out.is.null,sms_opt_out.eq.false')
      .order('is_super_golden', { ascending: false, nullsFirst: false })
      .order('excess_funds_expiry_date', { ascending: true, nullsFirst: false })
      .order('excess_funds_amount', { ascending: false })
      .limit(5); // Only process top 5 golden leads at a time

    if (leadsError) {
      await sendTelegramMessage(`⚠️ Golden Lead error: ${leadsError.message}`);
      return NextResponse.json({ error: leadsError.message }, { status: 500 });
    }

    const leadsWithPhone = (goldenLeads || []).filter(lead =>
      getLeadPhone(lead as GoldenLead)
    ) as GoldenLead[];

    if (leadsWithPhone.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No golden leads ready for outreach',
        leads_checked: goldenLeads?.length || 0
      });
    }

    const results = {
      success: 0,
      failed: 0,
      notified: 0,
      errors: [] as string[],
      processed: [] as { name: string; amount: number; phone: string }[]
    };

    for (const lead of leadsWithPhone) {
      const phone = getLeadPhone(lead);
      if (!phone) continue;

      // First: Send priority notification to Logan
      await notifyGoldenLeadDeclared({
        owner_name: lead.owner_name || 'Unknown',
        jurisdiction: 'Dallas County',
        deal_type: 'excess_only',
        excess_funds_amount: lead.excess_funds_amount,
        excess_funds_expiration: lead.excess_funds_expiry_date || undefined,
        priority_score: lead.golden_score || lead.eleanor_score || 0,
        estimated_total_upside: lead.excess_funds_amount * 0.25, // Our 25% fee
        property_address: lead.property_address || undefined,
        phone_primary: phone,
        declared_by: 'GOLDEN_LEAD_CRON',
        declaration_reason: lead.is_super_golden
          ? 'Super Golden Lead - Highest priority'
          : `Golden Lead - ${formatAmount(lead.excess_funds_amount)} excess funds`
      });
      results.notified++;

      // Then: Send SMS
      const message = GOLDEN_TEMPLATE(lead);

      try {
        const smsResult = await sendSMS(phone, message, lead.id);

        if (smsResult.success) {
          results.success++;
          results.processed.push({
            name: lead.owner_name || 'Unknown',
            amount: lead.excess_funds_amount,
            phone
          });

          // Update lead
          await supabase
            .from('maxsam_leads')
            .update({
              contact_attempts: (lead.contact_attempts || 0) + 1,
              last_contacted_at: new Date().toISOString(),
              last_contact_date: new Date().toISOString(),
              last_sms_at: new Date().toISOString(),
              status: 'contacted',
              outreach_status: 'golden_contacted'
            })
            .eq('id', lead.id);

          // Log the golden lead contact
          await supabase.from('status_history').insert({
            lead_id: lead.id,
            old_status: lead.status,
            new_status: 'contacted',
            changed_by: 'golden_lead_cron',
            reason: `Golden Lead fast-track: SMS sent to ${phone}`
          });

          // 2 second delay for golden leads (more careful rate limiting)
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          results.failed++;
          results.errors.push(`${lead.owner_name}: ${smsResult.error}`);
        }
      } catch (e) {
        results.failed++;
        results.errors.push(`${lead.owner_name}: ${e instanceof Error ? e.message : 'Unknown'}`);
      }
    }

    // Summary notification
    const processedList = results.processed
      .map((l, i) => `${i + 1}. ${l.name} - $${Math.round(l.amount / 1000)}K`)
      .join('\n');

    await sendTelegramMessage(`🥇 <b>GOLDEN LEAD FAST-TRACK COMPLETE</b>

📱 SMS Sent: <b>${results.success}</b>
🔔 Notifications: <b>${results.notified}</b>
❌ Failed: <b>${results.failed}</b>

${results.processed.length > 0 ? `<b>Contacted:</b>\n${processedList}` : 'No leads contacted'}

${results.errors.length > 0 ? `\n⚠️ Errors:\n${results.errors.join('\n')}` : ''}

These are your TOP priorities! 💰`);

    return NextResponse.json({
      success: true,
      message: `Golden leads processed: ${results.success} contacted, ${results.notified} notifications sent`,
      results
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Golden lead cron failed';
    await sendTelegramMessage(`⚠️ Golden Lead cron crashed: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
