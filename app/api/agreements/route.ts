/**
 * Agreement Packets API
 * POST /api/agreements - Create and send a new agreement packet
 * GET /api/agreements - List agreement packets
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSigningPacket, sendSigningLink } from '@/lib/jotform-sign';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/agreements
 * Create a new agreement packet and send signing link
 *
 * Body:
 * - lead_id: UUID (required)
 * - selection_code: 1 | 2 | 3 (required) - 1=Excess, 2=Wholesale, 3=Both
 * - triggered_by: 'sms' | 'ui' | 'api' | 'workflow' (optional, default: 'api')
 * - source_message_sid: string (optional, Twilio SID if SMS triggered)
 * - send_immediately: boolean (optional, default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { lead_id, selection_code, triggered_by, source_message_sid, send_immediately } = body;

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

    // Create signing packet
    const result = await createSigningPacket({
      leadId: lead_id,
      clientName: lead.owner_name || 'Property Owner',
      clientEmail: lead.email,
      clientPhone: phone,
      propertyAddress: lead.property_address,
      caseNumber: lead.case_number,
      selectionCode: selection_code,
      excessFundsAmount: lead.excess_funds_amount,
      estimatedEquity: lead.estimated_equity,
      triggeredBy: triggered_by || 'api',
      sourceMessageSid: source_message_sid,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    // Send signing link immediately unless disabled
    let sendResult = { smsSent: false, emailSent: false };
    if (send_immediately !== false && result.packetId) {
      sendResult = await sendSigningLink(result.packetId);
    }

    return NextResponse.json({
      success: true,
      packet_id: result.packetId,
      signing_link: result.signingLink,
      provider_document_id: result.providerDocumentId,
      sms_sent: sendResult.smsSent,
      email_sent: sendResult.emailSent,
      message: `Agreement packet created for ${lead.owner_name}`,
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
      .select(`
        *,
        agreement_documents(*)
      `)
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
