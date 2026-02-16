/**
 * Agreement SMS Handler
 * Processes inbound SMS for agreement selection (1/2/3)
 *
 * Flow:
 * 1. Client receives initial outreach asking for interest
 * 2. Client replies YES → Sam asks which service (1/2/3)
 * 3. Client replies 1, 2, or 3 → Agreement is generated and sent
 */

import { createClient } from './supabase/server';
import { normalizePhone } from './twilio';
import crypto from 'crypto';

interface AgreementSelectionResult {
  handled: boolean;
  response: string;
  action: string;
  packetId?: string;
}

/**
 * Check if message is an agreement selection (1, 2, or 3)
 */
export function isAgreementSelection(message: string): 1 | 2 | 3 | null {
  const trimmed = message.trim();

  // Exact matches
  if (trimmed === '1') return 1;
  if (trimmed === '2') return 2;
  if (trimmed === '3') return 3;

  // Natural language matches
  const lower = trimmed.toLowerCase();

  // "1" patterns
  if (
    lower.includes('excess funds') ||
    lower.includes('excess only') ||
    lower === 'one' ||
    lower === 'first' ||
    lower === 'option 1' ||
    lower === 'option one'
  ) {
    return 1;
  }

  // "2" patterns
  if (
    lower.includes('wholesale') ||
    lower.includes('assignment') ||
    lower === 'two' ||
    lower === 'second' ||
    lower === 'option 2' ||
    lower === 'option two'
  ) {
    return 2;
  }

  // "3" patterns
  if (
    lower.includes('both') ||
    lower.includes('dual') ||
    lower.includes('all') ||
    lower === 'three' ||
    lower === 'third' ||
    lower === 'option 3' ||
    lower === 'option three'
  ) {
    return 3;
  }

  return null;
}

/**
 * Process an inbound SMS that might be an agreement selection
 */
export async function processAgreementSelection(
  from: string,
  body: string,
  messageSid?: string
): Promise<AgreementSelectionResult> {
  const selection = isAgreementSelection(body);

  if (!selection) {
    return {
      handled: false,
      response: '',
      action: 'not_selection',
    };
  }

  const supabase = createClient();
  const normalizedPhone = normalizePhone(from);

  // Find the lead by phone number
  const { data: lead, error: leadError } = await supabase
    .from('maxsam_leads')
    .select('*')
    .or(`phone.eq.${normalizedPhone},phone_1.eq.${normalizedPhone},phone_2.eq.${normalizedPhone}`)
    .in('status', ['new', 'scored', 'contacted', 'qualified', 'agreement_pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (leadError || !lead) {
    console.warn(`No lead found for phone: ${normalizedPhone}`);
    return {
      handled: true,
      response: "Sorry, I couldn't find your account. Please reply with your name and property address so we can assist you.",
      action: 'no_lead_found',
    };
  }

  // Check if there's already an active agreement packet
  const { data: existingPacket } = await supabase
    .from('agreement_packets')
    .select('*')
    .eq('lead_id', lead.id)
    .in('status', ['created', 'sent', 'viewed', 'partial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (existingPacket) {
    // Already has an active packet - resend the link
    return {
      handled: true,
      response: `You already have an agreement waiting! Here's your signing link: ${existingPacket.signing_link}`,
      action: 'resent_existing',
      packetId: existingPacket.id,
    };
  }

  // Create signing URL using self-hosted system
  try {
    const secret = process.env.SIGNING_SECRET;
    if (!secret) {
      console.error('SIGNING_SECRET not configured');
      return {
        handled: true,
        response: "I'm having trouble preparing your agreement. A team member will reach out shortly.",
        action: 'creation_failed',
      };
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Map selection to agreement type
    const agreementType = selection === 1 ? 'excess_funds'
      : selection === 2 ? 'wholesale'
      : 'full_recovery';

    // Generate HMAC-signed token and URL
    function makeSigningUrl(type: string): string {
      const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      const payload = `${lead.id}:${type}:${expires}`;
      const hmac = crypto.createHmac('sha256', secret!).update(payload).digest('hex');
      const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
      return `${baseUrl}/sign?token=${token}`;
    }

    let signingLink: string;
    if (agreementType === 'full_recovery') {
      signingLink = makeSigningUrl('excess_funds');
      // Second URL for wholesale will be in follow-up
    } else {
      signingLink = makeSigningUrl(agreementType);
    }

    // Log to agreement_packets
    let packetId: string | undefined;
    try {
      const { data: packet } = await supabase.from('agreement_packets').insert({
        lead_id: lead.id,
        selection_code: selection,
        status: 'sent',
        signing_link: signingLink,
        client_name: lead.owner_name,
        client_phone: normalizedPhone,
        client_email: lead.email || null,
        triggered_by: 'sms',
        sent_at: new Date().toISOString(),
      }).select('id').single();
      packetId = packet?.id;
    } catch {
      // Non-critical — table may not exist
    }

    // Update lead status
    await supabase
      .from('maxsam_leads')
      .update({
        status: 'agreement_sent',
        agreement_type: agreementType === 'full_recovery' ? 'both' : agreementType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead.id);

    // Build response based on selection
    const selectionName =
      selection === 1 ? 'Excess Funds Recovery'
      : selection === 2 ? 'Wholesale/Assignment'
      : 'Combined Excess Funds + Wholesale';

    const firstName = lead.owner_name?.split(' ')[0] || 'there';

    // Log communication
    await supabase.from('communication_logs').insert({
      lead_id: lead.id,
      type: 'sms',
      direction: 'inbound',
      from_number: normalizedPhone,
      to_number: process.env.TWILIO_PHONE_NUMBER,
      content: body,
      status: 'received',
      sentiment: 'positive',
      created_at: new Date().toISOString(),
    });

    // Notify via Telegram
    await notifyAgreementCreated(lead, selection, packetId || lead.id);

    return {
      handled: true,
      response: `Perfect, ${firstName}! Your ${selectionName} Agreement is ready. Sign on your phone in 60 seconds: ${signingLink}`,
      action: `agreement_sent_${selection}`,
      packetId,
    };

  } catch (error) {
    console.error('Agreement selection error:', error);
    return {
      handled: true,
      response: "Something went wrong preparing your agreement. We'll have someone call you shortly.",
      action: 'error',
    };
  }
}

/**
 * Get the agreement selection prompt message
 * This is sent after a lead says "YES" to interest
 */
export function getAgreementSelectionPrompt(lead: {
  owner_name?: string | null;
  excess_funds_amount?: number | null;
  estimated_equity?: number | null;
}): string {
  const firstName = lead.owner_name?.split(' ')[0] || 'there';
  const excessAmount = lead.excess_funds_amount || 0;
  const equity = lead.estimated_equity || excessAmount * 0.5;

  const hasExcess = excessAmount > 0;
  const hasEquity = equity > 5000;

  // If only one option makes sense, simplify
  if (hasExcess && !hasEquity) {
    return `Great news, ${firstName}! To get started on your $${excessAmount.toLocaleString()} recovery, reply "1" and I'll send your agreement to sign.`;
  }

  if (!hasExcess && hasEquity) {
    return `Great news, ${firstName}! To discuss our cash offer for your property, reply "2" and I'll send our agreement.`;
  }

  // Full menu for dual opportunities
  return `Excellent, ${firstName}! Which service would you like?

Reply with a number:
1️⃣ Excess Funds Recovery ($${excessAmount.toLocaleString()} available)
2️⃣ Property Purchase (cash offer)
3️⃣ BOTH services (maximize your recovery!)

Just text 1, 2, or 3 and I'll send your agreement right away.`;
}

/**
 * Notify via Telegram when agreement is created
 */
async function notifyAgreementCreated(
  lead: { id: string; owner_name?: string | null; property_address?: string | null; excess_funds_amount?: number | null; phone?: string | null },
  selection: 1 | 2 | 3,
  packetId: string
): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) return;

  const selectionName =
    selection === 1 ? '📋 Excess Funds'
    : selection === 2 ? '🏠 Wholesale'
    : '⭐ DUAL DEAL';

  const message = `📝 AGREEMENT SENT!

${selectionName} Agreement

👤 ${lead.owner_name}
🏠 ${lead.property_address}
💰 $${(lead.excess_funds_amount || 0).toLocaleString()}
📱 ${lead.phone}

Packet ID: ${packetId}

Waiting for signature...`;

  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    });
  } catch (error) {
    console.error('Telegram notification failed:', error);
  }
}
