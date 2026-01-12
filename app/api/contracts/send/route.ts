import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Only create Supabase client if environment variables are available
const getSupabaseClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase credentials not available');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
};

const BOLDSIGN_API_KEY = process.env.BOLDSIGN_API_KEY || 'M2M5ODA3NzEtOGNjNS00MGNiLWIxYTEtYzkwYmUxMDRlMTg5';
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
    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ error: 'Database not available' }, { status: 500 });
    }

    const body = await request.json();
    const { leadId, contractType, feePercentage, purchasePrice, earnestMoney, inspectionDays, closingDays } = body;

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Create contract document via Boldsign
    const signerEmail = lead.email || `sms-signer-${lead.id}@maxsam-recovery.com`;
    
    const documentPayload = {
      title: contractType === 'recovery' 
        ? `Excess Funds Recovery Agreement - ${lead.owner_name}`
        : `Wholesale Purchase Agreement - ${lead.property_address}`,
      message: contractType === 'recovery'
        ? `Dear ${lead.owner_name}, please review and sign this agreement for the recovery of excess funds from your property at ${lead.property_address}. Your potential recovery amount is $${lead.excess_amount?.toLocaleString()}.`
        : `Dear ${lead.owner_name}, please review and sign this purchase agreement for the property at ${lead.property_address}.`,
      signers: [
        {
          name: lead.owner_name,
          emailAddress: signerEmail,
          signerType: 'Signer',
          formFields: [
            {
              fieldType: 'Signature',
              pageNumber: 1,
              bounds: { x: 100, y: 600, width: 200, height: 50 },
              isRequired: true
            },
            {
              fieldType: 'DateSigned',
              pageNumber: 1,
              bounds: { x: 350, y: 600, width: 150, height: 30 },
              isRequired: true
            }
          ]
        }
      ],
      enableSigningOrder: false,
      expiryDays: 30,
      reminderSettings: {
        enableAutoReminder: true,
        reminderDays: 3,
        reminderCount: 3
      }
    };

    const boldsignResponse = await fetch('https://api.boldsign.com/v1/document/send', {
      method: 'POST',
      headers: {
        'X-API-KEY': BOLDSIGN_API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(documentPayload),
    });

    if (!boldsignResponse.ok) {
      const errorText = await boldsignResponse.text();
      console.error('Boldsign error:', errorText);
      return NextResponse.json({ error: 'Failed to send contract', details: errorText }, { status: 500 });
    }

    const boldsignData = await boldsignResponse.json();
    const documentId = boldsignData.documentId;

    // Update lead with contract info
    const updateData: Record<string, any> = {
      boldsign_document_id: documentId,
      boldsign_status: 'sent',
      contract_sent_at: new Date().toISOString(),
      contract_type: contractType,
      fee_percentage: feePercentage || 25,
      ready_for_contract: false,
    };

    if (contractType === 'wholesale') {
      updateData.purchase_price = purchasePrice;
      updateData.earnest_money = earnestMoney;
      updateData.inspection_days = inspectionDays;
      updateData.closing_days = closingDays;
    }

    await supabase
      .from('maxsam_leads')
      .update(updateData)
      .eq('id', leadId);

    // Send Telegram alert
    const fee = (lead.excess_amount || 0) * ((feePercentage || 25) / 100);
    await sendTelegramAlert(
      `📝 CONTRACT SENT!\n\n` +
      `👤 ${lead.owner_name}\n` +
      `📍 ${lead.property_address}\n` +
      `💰 $${lead.excess_amount?.toLocaleString()}\n` +
      `📋 Type: ${contractType?.toUpperCase()}\n` +
      `💵 Fee: $${fee.toLocaleString()} (${feePercentage}%)\n\n` +
      `⏳ Awaiting signature...`
    );

    return NextResponse.json({
      success: true,
      documentId,
      signerEmail,
      message: 'Contract sent successfully',
    });

  } catch (error) {
    console.error('Contract send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const documentId = searchParams.get('documentId');

  if (!documentId) {
    return NextResponse.json({ error: 'Document ID required' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.boldsign.com/v1/document/properties?documentId=${documentId}`, {
      headers: { 'X-API-KEY': BOLDSIGN_API_KEY },
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
