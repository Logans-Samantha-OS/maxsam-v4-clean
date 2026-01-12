import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
}

// POST - Send SMS to single lead via N8N webhook
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = getSupabase();

        // Get lead info
        const { data: lead, error: leadError } = await supabase
            .from('maxsam_leads')
            .select('id, owner_name, phone_1, phone_2, sms_count')
            .eq('id', id)
            .single();

        if (leadError || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const phone = lead.phone_1 || lead.phone_2;
        if (!phone) {
            return NextResponse.json({ error: 'No phone number for this lead' }, { status: 400 });
        }

        // Call N8N webhook
        const webhookUrl = 'https://n8n.srv758673.hstgr.cloud/webhook/sam-initial-outreach';
        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_id: lead.id,
                owner_name: lead.owner_name,
                phone: phone
            })
        });

        if (!webhookResponse.ok) {
            return NextResponse.json({ error: 'Failed to trigger SMS webhook' }, { status: 500 });
        }

        // Update lead - increment sms_count and set last_contacted_at
        const { error: updateError } = await supabase
            .from('maxsam_leads')
            .update({
                sms_count: (lead.sms_count || 0) + 1,
                last_contacted_at: new Date().toISOString(),
                status: lead.sms_count === 0 ? 'contacted' : undefined // Only update status on first contact
            })
            .eq('id', id);

        if (updateError) {
            console.error('Failed to update lead after SMS:', updateError);
        }

        return NextResponse.json({
            success: true,
            message: `SMS sent to ${lead.owner_name}`,
            lead_id: id
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send SMS';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
