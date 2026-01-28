/**
 * Twilio Incoming SMS Webhook Handler
 * Receives SMS replies and processes them
 * 
 * POST /api/twilio/incoming
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/twilio';
import { sendTelegramMessage } from '@/lib/telegram';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Opt-out keywords (TCPA compliance)
const OPT_OUT_KEYWORDS = ['stop', 'unsubscribe', 'cancel', 'end', 'quit'];
const OPT_IN_KEYWORDS = ['start', 'yes', 'unstop'];

export async function POST(request: NextRequest) {
  try {
    // Parse Twilio webhook payload (x-www-form-urlencoded)
    const formData = await request.formData();
    
    const from = formData.get('From') as string;
    const to = formData.get('To') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;
    
    if (!from || !body) {
      return new NextResponse(
        '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    const normalizedPhone = normalizePhone(from);
    const messageBody = body.trim().toLowerCase();

    // Check for opt-out
    if (OPT_OUT_KEYWORDS.includes(messageBody)) {
      await supabase.from('opt_outs').upsert({
        phone: normalizedPhone,
        source: 'sms_reply',
        opted_out_at: new Date().toISOString()
      });

      // Update any leads with this phone
      await supabase
        .from('maxsam_leads')
        .update({ 
          opted_out: true, 
          sms_opt_out: true,
          do_not_contact: true 
        })
        .or(`phone.eq.${normalizedPhone},phone_1.eq.${normalizedPhone},phone_2.eq.${normalizedPhone}`);

      // Notify via Telegram
      await sendTelegramMessage(`🛑 <b>OPT-OUT RECEIVED</b>\n\nPhone: ${from}\nMessage: "${body}"\n\nLead marked as do-not-contact.`);

      // TwiML response confirming opt-out
      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been unsubscribed and will not receive further messages from MaxSam. Reply START to resubscribe.</Message>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Check for opt-in (resubscribe)
    if (OPT_IN_KEYWORDS.includes(messageBody)) {
      await supabase
        .from('opt_outs')
        .delete()
        .eq('phone', normalizedPhone);

      await supabase
        .from('maxsam_leads')
        .update({ 
          opted_out: false, 
          sms_opt_out: false,
          do_not_contact: false 
        })
        .or(`phone.eq.${normalizedPhone},phone_1.eq.${normalizedPhone},phone_2.eq.${normalizedPhone}`);

      await sendTelegramMessage(`✅ <b>OPT-IN RECEIVED</b>\n\nPhone: ${from}\nMessage: "${body}"\n\nLead resubscribed.`);

      return new NextResponse(
        `<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>You have been resubscribed. We'll be in touch soon!</Message>
        </Response>`,
        { headers: { 'Content-Type': 'text/xml' } }
      );
    }

    // Find the lead associated with this phone number
    const { data: lead } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, excess_funds_amount, status')
      .or(`phone.eq.${normalizedPhone},phone_1.eq.${normalizedPhone},phone_2.eq.${normalizedPhone}`)
      .single();

    // Log the incoming message
    await supabase.from('communication_logs').insert({
      lead_id: lead?.id || null,
      type: 'sms',
      direction: 'inbound',
      from_number: from,
      to_number: to,
      content: body,
      twilio_sid: messageSid,
      status: 'received',
      created_at: new Date().toISOString()
    });

    // Update lead status if found
    if (lead) {
      await supabase
        .from('maxsam_leads')
        .update({
          status: 'in_conversation',
          last_response_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', lead.id);
    }

    // Send Telegram notification
    const leadInfo = lead 
      ? `\n\n<b>Lead:</b> ${lead.owner_name}\n<b>Property:</b> ${lead.property_address || 'N/A'}\n<b>Amount:</b> $${lead.excess_funds_amount?.toLocaleString() || 'N/A'}`
      : '\n\n⚠️ No matching lead found';

    await sendTelegramMessage(
      `📱 <b>INCOMING SMS</b>\n\n<b>From:</b> ${from}\n<b>Message:</b> "${body}"${leadInfo}\n\n💬 Reply needed!`
    );

    // Return empty TwiML (no auto-reply - Sam will handle manually or via AI)
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );

  } catch (error) {
    console.error('Twilio incoming webhook error:', error);
    
    // Always return valid TwiML even on error
    return new NextResponse(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { headers: { 'Content-Type': 'text/xml' } }
    );
  }
}

// Twilio may also send GET requests for validation
export async function GET() {
  return NextResponse.json({ status: 'Twilio webhook endpoint active' });
}