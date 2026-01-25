import { NextRequest, NextResponse } from 'next/server';
import { processInboundSMS } from '@/lib/sam-outreach';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * POST /api/twilio/inbound-sms - Handle incoming SMS from Twilio
 * Stores messages in sms_messages table for display in Messages page
 */
export async function POST(request: NextRequest) {
  try {
    // Twilio sends form data
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;

    if (!from || !body) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    console.log(`Inbound SMS from ${from}: ${body}`);

    const supabase = getSupabase();

    // Normalize phone number
    const digits = from.replace(/\D/g, '');
    const formattedPhone = digits.length === 10 ? `+1${digits}` :
      digits.length === 11 && digits.startsWith('1') ? `+${digits}` :
      `+${digits}`;

    // Find the lead by phone number
    const { data: lead } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, status')
      .or(`phone.eq.${formattedPhone},phone_1.eq.${formattedPhone},phone_2.eq.${formattedPhone}`)
      .single();

    // Store inbound message in sms_messages table
    if (lead) {
      await supabase.from('sms_messages').insert({
        lead_id: lead.id,
        direction: 'inbound',
        body: body,
        from_number: formattedPhone,
        to_number: process.env.TWILIO_PHONE_NUMBER,
        status: 'received',
        message_sid: messageSid,
        received_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      });
    }

    // Process the message (handles opt-outs, qualifications, etc.)
    const result = await processInboundSMS(from, body);

    // Update the message with intent/sentiment if processed
    if (lead && result.action !== 'unknown' && messageSid) {
      await supabase.from('sms_messages')
        .update({
          agent_name: result.action === 'qualified' ? 'SAM' :
                      result.action === 'opted_out' ? 'SYSTEM' : null
        })
        .eq('message_sid', messageSid);
    }

    // Return TwiML response
    if (result.response) {
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${escapeXml(result.response)}</Message>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Empty response for unknown messages
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error: unknown) {
    console.error('Twilio inbound SMS error:', error);
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

/**
 * Escape XML special characters
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
