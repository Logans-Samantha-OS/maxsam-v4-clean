import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// POST - Send SMS to multiple leads
export async function POST(request: NextRequest) {
    try {
        const supabase = getSupabase();
        const { lead_ids } = await request.json();

        if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
            return NextResponse.json({ error: 'lead_ids array required' }, { status: 400 });
        }

        // Get all leads
        const { data: leads, error: leadsError } = await supabase
            .from('maxsam_leads')
            .select('id, owner_name, phone_1, phone_2, sms_count')
            .in('id', lead_ids);

        if (leadsError) {
            return NextResponse.json({ error: leadsError.message }, { status: 500 });
        }

        const webhookUrl = 'https://n8n.srv758673.hstgr.cloud/webhook/sam-initial-outreach';
        const results = { success: 0, failed: 0, noPhone: 0, errors: [] as string[] };

        // Process each lead
        for (const lead of leads || []) {
            const phone = lead.phone_1 || lead.phone_2;

            if (!phone) {
                results.noPhone++;
                continue;
            }

            try {
                const response = await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        lead_id: lead.id,
                        owner_name: lead.owner_name,
                        phone: phone
                    })
                });

                if (response.ok) {
                    results.success++;

                    // Update lead
                    await supabase
                        .from('maxsam_leads')
                        .update({
                            sms_count: (lead.sms_count || 0) + 1,
                            last_contacted_at: new Date().toISOString(),
                            status: lead.sms_count === 0 ? 'contacted' : undefined
                        })
                        .eq('id', lead.id);
                } else {
                    results.failed++;
                }
            } catch (e) {
                results.failed++;
                results.errors.push(`${lead.owner_name}: ${e}`);
            }
        }

        return NextResponse.json({
            success: true,
            message: `Sent ${results.success} SMS, ${results.failed} failed, ${results.noPhone} had no phone`,
            results
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send bulk SMS';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
