/**
 * Agreement Packets API
 * POST /api/agreements - Create signing link and send via SMS
 * GET /api/agreements - List agreement packets
 *
 * Uses self-hosted e-signature system at /api/sign/generate.
 * Sends signing links via Twilio SMS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/twilio';
import crypto from 'crypto';

/**
 * Map selection_code to agreement_type for the self-hosted signing system
 */
function mapSelectionCode(code: number): 'excess_funds' | 'wholesale' | 'full_recovery' {
  switch (code) {
    case 1: return 'excess_funds';
    case 2: return 'wholesale';
    case 3: return 'full_recovery';
    default: return 'excess_funds';
  }
}

/**
 * Generate HMAC-signed token and signing URL
 * (Same logic as /api/sign/generate, inlined to avoid HTTP round-trip)
 */
function generateSigningUrl(leadId: string, type: string, secret: string, baseUrl: string): string {
  const expires = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const payload = `${leadId}:${type}:${expires}`;
  const hmac = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const token = Buffer.from(`${payload}:${hmac}`).toString('base64url');
  return `${baseUrl}/sign?token=${token}`;
}

/**
 * POST /api/agreements
 * Create a new agreement and send signing link via SMS
 *
 * Body:
 * - lead_id: UUID (required)
 * - selection_code: 1 | 2 | 3 (required) - 1=Excess, 2=Wholesale, 3=Both
 * - triggered_by: 'sms' | 'ui' | 'api' | 'workflow' (optional, default: 'api')
 * - send_immediately: boolean (optional, default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lead_id, selection_code, triggered_by, send_immediately } = body;

    // Validate required fields
    if (!lead_id) {
      return NextResponse.json(
        { success: false, error: 'lead_id is required' },
        { status: 400 }
      );
    }

    if (!selection_code || ![1, 2, 3].includes(selection_code)) {
      return NextResponse.json(
        { success: false, error: 'selection_code must be 1, 2, or 3' },
        { status: 400 }
      );
    }

    // Verify signing secret is configured
    const secret = process.env.SIGNING_SECRET;
    if (!secret) {
      return NextResponse.json(
        { success: false, error: 'Signing system not configured. Set SIGNING_SECRET.' },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    const supabase = createClient();

    // Fetch lead data
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json(
        { success: false, error: `Lead not found: ${lead_id}` },
        { status: 404 }
      );
    }

    // Validate lead has phone
    const phone = lead.phone || lead.phone_1 || lead.phone_2;
    if (!phone) {
      return NextResponse.json(
        { success: false, error: 'Lead does not have a phone number' },
        { status: 400 }
      );
    }

    // Map selection code to agreement type
    const agreementType = mapSelectionCode(selection_code);

    // Generate signing URL(s)
    let signingUrl: string;
    let excessFundsUrl: string | undefined;
    let wholesaleUrl: string | undefined;

    if (agreementType === 'full_recovery') {
      excessFundsUrl = generateSigningUrl(lead_id, 'excess_funds', secret, baseUrl);
      wholesaleUrl = generateSigningUrl(lead_id, 'wholesale', secret, baseUrl);
      signingUrl = excessFundsUrl; // Primary link for SMS
    } else {
      signingUrl = generateSigningUrl(lead_id, agreementType, secret, baseUrl);
    }

    // Extract first name for SMS
    let firstName = 'there';
    if (lead.owner_name) {
      const name = lead.owner_name.trim();
      if (name.includes(',')) {
        const parts = name.split(',');
        const first = (parts[1] || '').trim().split(/\s+/)[0];
        if (first) firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      } else {
        const first = name.split(/\s+/)[0];
        firstName = first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
      }
    }

    // Build SMS message with specificity
    const excessAmount = lead.excess_funds_amount || lead.excess_amount || 0;
    const amt = excessAmount > 0
      ? `$${Number(excessAmount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '';

    let smsMessage: string;
    if (agreementType === 'full_recovery') {
      smsMessage = `${firstName}, your recovery agreements for ${lead.property_address || 'your property'} are ready to sign.`;
      if (amt) smsMessage += ` Est. recovery: ${amt}.`;
      smsMessage += `\n\nExcess Funds Agreement: ${excessFundsUrl}`;
      smsMessage += `\n\nWholesale Agreement: ${wholesaleUrl}`;
      smsMessage += `\n\nSign on your phone in 60 seconds. No upfront cost.\n\n-Sam, MaxSam Recovery`;
    } else {
      const typeName = agreementType === 'excess_funds' ? 'Excess Funds Recovery' : 'Wholesale';
      smsMessage = `${firstName}, your ${typeName} Agreement for ${lead.property_address || 'your property'} is ready to sign.`;
      if (amt) smsMessage += ` Est. recovery: ${amt}.`;
      smsMessage += `\n\nSign on your phone in 60 seconds: ${signingUrl}`;
      smsMessage += `\n\nNo upfront cost — we only get paid when you do.\n\n-Sam, MaxSam Recovery`;
    }

    // Send SMS unless disabled
    let smsSent = false;
    if (send_immediately !== false) {
      const smsResult = await sendSMS(phone, smsMessage, lead_id);
      smsSent = smsResult.success;
      if (smsResult.success) {
        // Log to sms_messages so Messaging Center sees this
        try {
          await supabase.from('sms_messages').insert({
            lead_id,
            direction: 'outbound',
            message: smsMessage,
            to_number: phone,
            from_number: process.env.TWILIO_PHONE_NUMBER || '+18449632549',
            status: 'sent',
            created_at: new Date().toISOString(),
            twilio_sid: (smsResult as Record<string, unknown>).sid || (smsResult as Record<string, unknown>).messageSid || null,
          });
        } catch {
          console.warn('[Agreements] Could not log SMS to sms_messages');
        }
      } else {
        console.error('[Agreements] SMS send failed:', smsResult.error);
      }
    }

    // Update lead status to 'agreement_sent'
    await supabase
      .from('maxsam_leads')
      .update({
        status: 'agreement_sent',
        agreement_type: agreementType === 'full_recovery' ? 'both' : agreementType,
        updated_at: new Date().toISOString(),
      })
      .eq('id', lead_id);

    // Log to agreement_packets table if it exists
    try {
      await supabase.from('agreement_packets').insert({
        lead_id,
        selection_code,
        status: 'sent',
        signing_link: signingUrl,
        client_name: lead.owner_name,
        client_phone: phone,
        client_email: lead.email || null,
        triggered_by: triggered_by || 'api',
        sent_at: new Date().toISOString(),
      });
    } catch {
      // Table may not exist yet — non-critical
      console.warn('[Agreements] Could not log to agreement_packets table');
    }

    // Log agent action
    try {
      await supabase.from('agent_memories').insert({
        agent_name: 'SAM',
        action_type: 'agreement_sent',
        content: `Sent ${agreementType} agreement to ${lead.owner_name} (${phone})`,
        lead_id,
        created_at: new Date().toISOString(),
      });
    } catch {
      // Non-critical logging
    }

    return NextResponse.json({
      success: true,
      signing_url: signingUrl,
      excess_funds_url: excessFundsUrl,
      wholesale_url: wholesaleUrl,
      agreement_type: agreementType,
      sms_sent: smsSent,
      message: `Agreement sent to ${lead.owner_name}`,
    });

  } catch (error) {
    console.error('Agreement creation error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/agreements
 * List agreement packets with optional filters
 *
 * Query params:
 * - status: Filter by status
 * - lead_id: Filter by lead
 * - limit: Max results (default 50)
 * - offset: Pagination offset
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const lead_id = searchParams.get('lead_id');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const supabase = createClient();

    let query = supabase
      .from('agreement_packets')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    if (lead_id) {
      query = query.eq('lead_id', lead_id);
    }

    const { data: packets, error } = await query;

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      packets,
      count: packets?.length || 0,
    });

  } catch (error) {
    console.error('Agreement list error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
