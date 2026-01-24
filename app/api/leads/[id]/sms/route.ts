import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// POST - Send SMS to single lead via N8N webhook
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = createClient();
        const body = await request.json().catch(() => ({}));
        const customMessage = body.message;

        // Get lead info
        const { data: lead, error: leadError } = await supabase
            .from('maxsam_leads')
            .select('id, owner_name, phone, phone_1, phone_2, sms_count, excess_funds_amount')
            .eq('id', id)
            .single();

        if (leadError || !lead) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
        }

        const phone = lead.phone || lead.phone_1 || lead.phone_2;
        if (!phone) {
            return NextResponse.json({ error: 'No phone number for this lead' }, { status: 400 });
        }

        // Format phone number
        const formattedPhone = phone.startsWith('+')
            ? phone
            : phone.startsWith('1')
                ? `+${phone}`
                : `+1${phone.replace(/\D/g, '')}`;

        // Determine message to send
        const messageToSend = customMessage || `Hi ${lead.owner_name || 'there'}! This is Sam from MaxSam Recovery Services. We found excess funds from your property that you may be entitled to. Would you like more information?`;

        // Call N8N webhook
        const webhookUrl = 'https://skooki.app.n8n.cloud/webhook/sam-initial-outreach';
        const webhookResponse = await fetch(webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                lead_id: lead.id,
                owner_name: lead.owner_name,
                phone: formattedPhone,
                message: messageToSend,
                source: 'dashboard'
            })
        });

        if (!webhookResponse.ok) {
            console.warn('N8N webhook failed, continuing to log message');
        }

        // Log the outbound message to sms_messages table
        const { data: newMessage, error: insertError } = await supabase
            .from('sms_messages')
            .insert({
                lead_id: id,
                direction: 'outbound',
                message: messageToSend,
                from_number: process.env.TWILIO_PHONE_NUMBER || '+18449632549',
                to_number: formattedPhone,
                status: 'sent',
                created_at: new Date().toISOString()
            })
            .select()
            .single();

        if (insertError) {
            console.error('Failed to log outbound message:', insertError);
        }

        // Update lead - increment sms_count and set last_contacted_at
        const { error: updateError } = await supabase
            .from('maxsam_leads')
            .update({
                sms_count: (lead.sms_count || 0) + 1,
                last_contacted_at: new Date().toISOString(),
                last_contact_at: new Date().toISOString(),
                contact_count: (lead.sms_count || 0) + 1,
                status: lead.sms_count === 0 ? 'contacted' : undefined
            })
            .eq('id', id);

        if (updateError) {
            console.error('Failed to update lead after SMS:', updateError);
        }

        return NextResponse.json({
            success: true,
            message: newMessage || { id: 'sent', message: messageToSend, to_number: formattedPhone },
            lead_id: id
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to send SMS';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
