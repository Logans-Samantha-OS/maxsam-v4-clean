import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID || '8487686924';

async function sendTelegramAlert(message: string) {
  if (!TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message, parse_mode: 'HTML' }),
    });
  } catch (e) {
    console.error('Telegram error:', e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Extract event details from Boldsign webhook
    const eventType = body.event?.eventType || body.eventType || 'unknown';
    const documentId = body.document?.documentId || body.documentId;
    
    if (!documentId) {
      console.log('No document ID in webhook');
      return NextResponse.json({ received: true });
    }

    // Map Boldsign event types to our status
    const statusMap: Record<string, string> = {
      'Sent': 'sent',
      'Viewed': 'viewed',
      'Signed': 'signed',
      'Completed': 'completed',
      'Declined': 'declined',
      'Expired': 'expired',
      'Revoked': 'revoked',
    };

    const newStatus = statusMap[eventType] || eventType.toLowerCase();

    // Find and update the lead
    const { data: lead, error: findError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('boldsign_document_id', documentId)
      .single();

    if (findError || !lead) {
      console.log('Lead not found for document:', documentId);
      return NextResponse.json({ received: true, error: 'Lead not found' });
    }

    // Update lead status
    const updateData: Record<string, any> = {
      boldsign_status: newStatus,
    };

    if (newStatus === 'signed' || newStatus === 'completed') {
      updateData.contract_signed_at = new Date().toISOString();
      updateData.status = 'contract_signed';
    }

    await supabase
      .from('maxsam_leads')
      .update(updateData)
      .eq('id', lead.id);

    // Send appropriate Telegram alert
    const fee = (lead.excess_amount || 0) * ((lead.fee_percentage || 25) / 100);
    
    if (newStatus === 'viewed') {
      await sendTelegramAlert(
        `👁️ CONTRACT VIEWED!\n\n` +
        `👤 ${lead.owner_name}\n` +
        `📍 ${lead.property_address}\n` +
        `💰 $${lead.excess_amount?.toLocaleString()}\n\n` +
        `📖 They're reading it...`
      );
    } else if (newStatus === 'signed' || newStatus === 'completed') {
      await sendTelegramAlert(
        `🎉 CONTRACT SIGNED!\n\n` +
        `👤 ${lead.owner_name}\n` +
        `📍 ${lead.property_address}\n` +
        `💰 $${lead.excess_amount?.toLocaleString()}\n` +
        `💵 YOUR FEE: $${fee.toLocaleString()}\n\n` +
        `🚀 Ready for county submission!\n` +
        `💳 Send Stripe payment link after funds recovered!`
      );
    } else if (newStatus === 'declined') {
      await sendTelegramAlert(
        `❌ CONTRACT DECLINED\n\n` +
        `👤 ${lead.owner_name}\n` +
        `📍 ${lead.property_address}\n` +
        `💰 $${lead.excess_amount?.toLocaleString()}\n\n` +
        `😔 Follow up needed...`
      );
    }

    return NextResponse.json({ 
      received: true, 
      status: newStatus,
      leadId: lead.id 
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}

// GET handler for Boldsign verification
export async function GET(request: NextRequest) {
  return NextResponse.json({ 
    status: 'ok', 
    message: 'Boldsign webhook endpoint active',
    timestamp: new Date().toISOString()
  });
}
