/**
 * BoldSign Send Agreement API
 * POST /api/boldsign/send
 *
 * Sends a recovery agreement to a lead via BoldSign
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendRecoveryAgreement, isBoldSignConfigured } from '@/lib/boldsign';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id } = body;

    if (!lead_id) {
      return NextResponse.json({
        success: false,
        error: 'lead_id is required'
      }, { status: 400 });
    }

    // Check BoldSign configuration
    if (!isBoldSignConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'BoldSign is not configured. Please set BOLDSIGN_API_KEY environment variable.'
      }, { status: 500 });
    }

    const supabase = getSupabase();

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({
        success: false,
        error: `Lead not found: ${leadError?.message || 'No data'}`
      }, { status: 404 });
    }

    // Send agreement via BoldSign
    const result = await sendRecoveryAgreement({
      id: lead.id,
      owner_name: lead.owner_name,
      email: lead.email,
      primary_email: lead.primary_email,
      property_address: lead.property_address,
      excess_funds_amount: lead.excess_funds_amount,
    });

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 400 });
    }

    // Store document in Supabase
    const { error: insertError } = await supabase
      .from('maxsam_boldsign_documents')
      .insert({
        lead_id: lead_id,
        document_id: result.documentId,
        template_id: process.env.BOLDSIGN_RECOVERY_TEMPLATE_ID || 'MzExMjVjOTgtMDNkOC00YWY1LWIzOGUtMGNmZThlMDRmYTNj',
        signer_email: lead.email || lead.primary_email,
        signer_name: lead.owner_name,
        status: 'sent',
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to store BoldSign document:', insertError);
      // Don't fail - the document was sent successfully
    }

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({
        status: 'agreement_sent',
        updated_at: new Date().toISOString()
      })
      .eq('id', lead_id);

    // Log status change
    await supabase.from('status_history').insert({
      lead_id: lead_id,
      old_status: lead.status,
      new_status: 'agreement_sent',
      changed_by: 'boldsign_api',
      reason: 'Recovery agreement sent via BoldSign'
    });

    // Send Telegram notification
    try {
      const telegramToken = process.env.TELEGRAM_BOT_TOKEN;
      const chatId = process.env.TELEGRAM_CHAT_ID;

      if (telegramToken && chatId) {
        await fetch(`https://api.telegram.org/bot${telegramToken}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: `📄 <b>Agreement Sent via BoldSign!</b>\n\n<b>Lead:</b> ${lead.owner_name}\n<b>Email:</b> ${lead.email || lead.primary_email}\n<b>Property:</b> ${lead.property_address}\n<b>Amount:</b> $${(lead.excess_funds_amount || 0).toLocaleString()}\n\nDocument ID: ${result.documentId}`,
            parse_mode: 'HTML'
          })
        });
      }
    } catch (e) {
      console.error('Telegram notification failed:', e);
    }

    return NextResponse.json({
      success: true,
      documentId: result.documentId,
      message: 'Agreement sent via BoldSign'
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('BoldSign send error:', message);
    return NextResponse.json({
      success: false,
      error: message
    }, { status: 500 });
  }
}
