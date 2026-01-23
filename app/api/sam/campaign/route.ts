import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSMS, normalizePhone as twilioNormalizePhone, isTwilioConfigured } from '@/lib/twilio';

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

1️⃣ ${formatAmount(lead.excess_funds_amount)} in unclaimed excess funds from your foreclosure
2️⃣ A potential property purchase offer

This is time-sensitive - funds may expire. Can we chat for 5 min today?

Reply YES for details or call me back.
-Sam

Text STOP to opt-out`,

    classB: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, this is Sam with MaxSam Real Estate.

I have important info about potential funds owed to you from ${lead.property_address || 'a recent property sale'}.

We may be able to help you recover ${formatAmount(lead.excess_funds_amount)} that you're entitled to.

Can we schedule a quick 10-min call? Reply YES and I'll send details.

-Sam
Text STOP to opt-out`,

    classA: (lead: Lead) => `Hi ${getFirstName(lead.owner_name)}, this is Sam from MaxSam Real Estate.

URGENT: I found ${formatAmount(lead.excess_funds_amount)} in unclaimed funds from ${lead.property_address || 'your property'}.

These funds are from your foreclosure and may expire soon. Our team specializes in helping owners recover this money.

Reply YES to learn more, or I can call you directly.

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
    // Handle "Last, First" format
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


// POST - Run SMS campaign by class
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const body = await request.json();

        const {
            target_class = 'all', // 'golden', 'classA', 'classB', 'high_value', 'all'
            limit = 50,
            dry_run = false,
            min_score = 0,
            max_score = 100,
            min_amount = 0, // Minimum excess funds amount
            require_amount = false // If true, only send to leads with excess_funds_amount > 0
        } = body;

        // Build query for eligible leads
        let query = supabase
            .from('maxsam_leads')
            .select('id, owner_name, property_address, excess_funds_amount, eleanor_score, golden_lead, is_golden_lead, phone, phone_1, phone_2, owner_phone, status, contact_attempts, outreach_count, opted_out, do_not_contact, sms_opt_out')
            .in('status', ['new', 'scored', 'ready_for_outreach', 'contacted'])
            .lt('contact_attempts', 5)
            .or('opted_out.is.null,opted_out.eq.false')
            .or('do_not_contact.is.null,do_not_contact.eq.false')
            .or('sms_opt_out.is.null,sms_opt_out.eq.false')
            .gte('eleanor_score', min_score)
            .lte('eleanor_score', max_score)
            .order('eleanor_score', { ascending: false })
            .limit(limit);

        // Filter by minimum amount if specified
        if (min_amount > 0) {
            query = query.gte('excess_funds_amount', min_amount);
        }

        if (require_amount) {
            query = query.gt('excess_funds_amount', 0);
        }

        // Filter by target class
        if (target_class === 'golden') {
            query = query.or('golden_lead.eq.true,is_golden_lead.eq.true');
        } else if (target_class === 'classA') {
            query = query.gte('eleanor_score', 75);
        } else if (target_class === 'classB') {
            query = query.gte('eleanor_score', 60).lt('eleanor_score', 75);
        } else if (target_class === 'high_value') {
            // High value: has excess funds > $10K and score >= 70
            query = query.gte('excess_funds_amount', 10000).gte('eleanor_score', 70);
        }

        const { data: leads, error: leadsError } = await query;

        if (leadsError) {
            return NextResponse.json({ error: leadsError.message }, { status: 500 });
        }

        // Filter to only leads with phone numbers
        const leadsWithPhone = (leads || []).filter((lead: Lead) => getLeadPhone(lead));

        if (dry_run) {
            return NextResponse.json({
                success: true,
                dry_run: true,
                target_class,
                total_matched: leads?.length || 0,
                with_phone: leadsWithPhone.length,
                leads: leadsWithPhone.map((l: Lead) => ({
                    id: l.id,
                    name: l.owner_name,
                    score: l.eleanor_score,
                    amount: l.excess_funds_amount,
                    phone: getLeadPhone(l),
                    is_golden: l.golden_lead || l.is_golden_lead,
                    class: l.golden_lead || l.is_golden_lead ? 'GOLDEN' :
                           l.eleanor_score >= 75 ? 'A' :
                           l.eleanor_score >= 60 ? 'B' : 'C'
                }))
            });
        }

        // Check if Twilio is configured
        if (!isTwilioConfigured()) {
            return NextResponse.json({
                error: 'Twilio not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER'
            }, { status: 500 });
        }

        const results = {
            success: 0,
            failed: 0,
            noPhone: 0,
            skipped: 0,
            errors: [] as string[],
            sent: [] as { id: string; name: string; phone: string; class: string; sid?: string }[]
        };

        for (const lead of leadsWithPhone) {
            const phone = getLeadPhone(lead);
            if (!phone) {
                results.noPhone++;
                continue;
            }

            // Determine lead class and get appropriate template
            const isGolden = lead.golden_lead || lead.is_golden_lead;
            const leadClass = isGolden ? 'golden' :
                              lead.eleanor_score >= 75 ? 'classA' : 'classB';

            const template = TEMPLATES[leadClass as keyof typeof TEMPLATES];
            const message = template(lead);

            try {
                // Send SMS directly via Twilio (includes opt-out check and logging)
                const smsResult = await sendSMS(phone, message, lead.id);

                if (smsResult.success) {
                    results.success++;
                    results.sent.push({
                        id: lead.id,
                        name: lead.owner_name,
                        phone: twilioNormalizePhone(phone),
                        class: leadClass.toUpperCase(),
                        sid: smsResult.sid
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

                    // Small delay to avoid Twilio rate limiting (1 SMS/sec is safe)
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    if (smsResult.error?.includes('opted out')) {
                        results.skipped++;
                    } else {
                        results.failed++;
                    }
                    results.errors.push(`${lead.owner_name}: ${smsResult.error}`);
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`${lead.owner_name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
            }
        }

        return NextResponse.json({
            success: true,
            target_class,
            message: `Campaign complete: ${results.success} sent, ${results.failed} failed, ${results.noPhone} no phone`,
            results
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to run campaign';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

// GET - Preview campaign targets
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const targetClass = searchParams.get('target_class') || 'all';
    const limit = parseInt(searchParams.get('limit') || '50');

    // Redirect to POST with dry_run
    const req = new NextRequest(request.url, {
        method: 'POST',
        body: JSON.stringify({ target_class: targetClass, limit, dry_run: true })
    });

    return POST(req);
}
