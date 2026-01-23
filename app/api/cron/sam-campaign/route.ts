import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSMS, normalizePhone, isTwilioConfigured } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * SAM Campaign Cron Job
 * Runs at 9 AM CT (15:00 UTC) Monday-Saturday
 * Automatically sends SMS to high-value leads
 */

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// SMS Templates by lead class
const TEMPLATES = {
    golden: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, this is Sam from MaxSam Real Estate.

GREAT NEWS! I found TWO opportunities for you at ${lead.property_address || 'your property'}:

1. ${formatAmount(lead.excess_funds_amount)} in unclaimed excess funds from your foreclosure
2. A potential property purchase offer

This is time-sensitive - funds may expire. Can we chat for 5 min today?

Reply YES for details or call me back.
-Sam

Text STOP to opt-out`,

    classA: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, this is Sam from MaxSam Real Estate.

URGENT: I found ${formatAmount(lead.excess_funds_amount)} in unclaimed funds from ${lead.property_address || 'your property'}.

These funds are from your foreclosure and may expire soon. Our team specializes in helping owners recover this money.

Reply YES to learn more, or I can call you directly.

-Sam
Text STOP to opt-out`,

    classB: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, this is Sam with MaxSam Real Estate.

I have important info about potential funds owed to you from ${lead.property_address || 'a recent property sale'}.

We may be able to help you recover ${formatAmount(lead.excess_funds_amount)} that you're entitled to.

Can we schedule a quick 10-min call? Reply YES and I'll send details.

-Sam
Text STOP to opt-out`
};

type Lead = {
    id: string;
    owner_name: string;
    property_address: string | null;
    excess_funds_amount: number;
    eleanor_score: number;
    golden_lead: boolean;
    is_golden_lead: boolean;
    phone: string | null;
    phone_1: string | null;
    phone_2: string | null;
    owner_phone: string | null;
    status: string;
    contact_attempts: number;
    outreach_count: number;
    opted_out: boolean;
    do_not_contact: boolean;
    sms_opt_out: boolean;
};

function getFirstName(name: string): string {
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
    return lead.phone || lead.phone_1 || lead.phone_2 || lead.owner_phone || null;
}

export async function GET(request: NextRequest) {
    // Verify cron secret if configured (Vercel cron protection)
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const supabase = getSupabase();

        // Check if Twilio is configured
        if (!isTwilioConfigured()) {
            await sendTelegramMessage('⚠️ SAM Campaign skipped: Twilio not configured');
            return NextResponse.json({
                error: 'Twilio not configured'
            }, { status: 500 });
        }

        // Get high-value leads: $10K+ excess funds, score >= 70, has phone, not maxed out
        const { data: leads, error: leadsError } = await supabase
            .from('maxsam_leads')
            .select('id, owner_name, property_address, excess_funds_amount, eleanor_score, golden_lead, is_golden_lead, phone, phone_1, phone_2, owner_phone, status, contact_attempts, outreach_count, opted_out, do_not_contact, sms_opt_out')
            .in('status', ['new', 'scored', 'ready_for_outreach', 'contacted'])
            .lt('contact_attempts', 5)
            .or('opted_out.is.null,opted_out.eq.false')
            .or('do_not_contact.is.null,do_not_contact.eq.false')
            .or('sms_opt_out.is.null,sms_opt_out.eq.false')
            .gte('excess_funds_amount', 10000)
            .gte('eleanor_score', 70)
            .order('eleanor_score', { ascending: false })
            .limit(20);

        if (leadsError) {
            await sendTelegramMessage(`⚠️ SAM Campaign error: ${leadsError.message}`);
            return NextResponse.json({ error: leadsError.message }, { status: 500 });
        }

        // Filter to only leads with phone numbers
        const leadsWithPhone = (leads || []).filter((lead: Lead) => getLeadPhone(lead));

        if (leadsWithPhone.length === 0) {
            await sendTelegramMessage(`📱 SAM Campaign: No eligible leads found at 9 AM.\n\nAll high-value leads either:\n• Already contacted 5x\n• No phone number\n• Opted out\n\nCheck skip trace candidates!`);
            return NextResponse.json({
                success: true,
                message: 'No eligible leads found',
                leads_checked: leads?.length || 0
            });
        }

        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[],
            sent: [] as { name: string; amount: number; class: string }[]
        };

        for (const lead of leadsWithPhone) {
            const phone = getLeadPhone(lead);
            if (!phone) continue;

            // Determine lead class and get appropriate template
            const isGolden = lead.golden_lead || lead.is_golden_lead;
            const leadClass = isGolden ? 'golden' :
                              lead.eleanor_score >= 75 ? 'classA' : 'classB';

            const template = TEMPLATES[leadClass as keyof typeof TEMPLATES];
            const message = template(lead);

            try {
                const smsResult = await sendSMS(phone, message, lead.id);

                if (smsResult.success) {
                    results.success++;
                    results.sent.push({
                        name: lead.owner_name,
                        amount: lead.excess_funds_amount,
                        class: leadClass.toUpperCase()
                    });

                    // Update lead in database
                    await supabase
                        .from('maxsam_leads')
                        .update({
                            contact_attempts: (lead.contact_attempts || 0) + 1,
                            outreach_count: (lead.outreach_count || 0) + 1,
                            last_contacted_at: new Date().toISOString(),
                            last_contact_date: new Date().toISOString(),
                            last_sms_at: new Date().toISOString(),
                            outreach_status: 'contacted',
                            status: lead.status === 'new' || lead.status === 'scored' ? 'contacted' : lead.status
                        })
                        .eq('id', lead.id);

                    // 1 second delay to avoid Twilio rate limiting
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    results.failed++;
                    results.errors.push(`${lead.owner_name}: ${smsResult.error}`);
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`${lead.owner_name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }

        // Send summary to Telegram
        const sentList = results.sent.slice(0, 5).map((l, i) =>
            `${i + 1}. ${l.name} - $${Math.round(l.amount / 1000)}K (${l.class})`
        ).join('\n');

        const summaryMessage = `🤖 <b>SAM CAMPAIGN COMPLETE</b>

<b>9 AM Auto-Outreach Results:</b>

✅ Sent: <b>${results.success}</b>
❌ Failed: <b>${results.failed}</b>

${results.sent.length > 0 ? `<b>Contacted:</b>\n${sentList}${results.sent.length > 5 ? `\n... +${results.sent.length - 5} more` : ''}` : 'No leads contacted'}

${results.errors.length > 0 ? `\n⚠️ Errors:\n${results.errors.slice(0, 3).join('\n')}` : ''}

Awaiting replies... 📱`;

        await sendTelegramMessage(summaryMessage);

        return NextResponse.json({
            success: true,
            message: `Campaign complete: ${results.success} sent, ${results.failed} failed`,
            results
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Campaign failed';
        await sendTelegramMessage(`⚠️ SAM Campaign crashed: ${message}`);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
