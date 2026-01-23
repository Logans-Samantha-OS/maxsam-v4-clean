/**
 * POST /api/signing/create
 * Create a new agreement packet (provider-agnostic)
 *
 * Request body:
 * - lead_id: UUID (required)
 * - selection_code: 1 | 2 | 3 (required)
 * - client_name: string (required)
 * - client_email: string (optional)
 * - client_phone: string (required)
 * - property_address: string (optional)
 * - case_number: string (optional)
 * - excess_funds_amount: number (optional)
 * - estimated_equity: number (optional)
 * - triggered_by: 'sms' | 'ui' | 'api' | 'workflow' (optional)
 * - source_message_sid: string (optional)
 *
 * Response:
 * - success: boolean
 * - packet_id: string
 * - status: string
 * - signing_link: string
 * - error: string (if failed)
 *
 * Idempotency:
 * - If a packet already exists for lead_id + selection_code in non-terminal state,
 *   returns existing packet instead of creating duplicate
 */

import { NextRequest, NextResponse } from 'next/server';
import { createPacket } from '@/lib/signing';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      lead_id,
      selection_code,
      client_name,
      client_email,
      client_phone,
      property_address,
      case_number,
      excess_funds_amount,
      estimated_equity,
      triggered_by,
      source_message_sid,
    } = body;

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

    if (!client_phone) {
      return NextResponse.json(
        { success: false, error: 'client_phone is required' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    // Idempotency check: look for existing non-terminal packet
    const { data: existingPacket } = await supabase
      .from('agreement_packets')
      .select('id, status, signing_link')
      .eq('lead_id', lead_id)
      .eq('selection_code', selection_code)
      .in('status', ['created', 'ready_to_send', 'sent', 'viewed', 'partially_signed'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingPacket) {
      // Return existing packet (idempotent)
      return NextResponse.json({
        success: true,
        packet_id: existingPacket.id,
        status: existingPacket.status?.toUpperCase(),
        signing_link: existingPacket.signing_link,
        idempotent: true,
        message: 'Existing packet returned (idempotent)',
      });
    }

    // If no client_name provided, try to get from lead
    let finalClientName = client_name;

    if (!finalClientName) {
      const { data: lead } = await supabase
        .from('maxsam_leads')
        .select('owner_name')
        .eq('id', lead_id)
        .single();

      finalClientName = lead?.owner_name || 'Property Owner';
    }

    // Create packet
    const result = await createPacket({
      leadId: lead_id,
      selectionCode: selection_code,
      clientName: finalClientName,
      clientEmail: client_email,
      clientPhone: client_phone,
      propertyAddress: property_address,
      caseNumber: case_number,
      excessFundsAmount: excess_funds_amount,
      estimatedEquity: estimated_equity,
      triggeredBy: triggered_by || 'api',
      sourceMessageSid: source_message_sid,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      packet_id: result.packetId,
      status: result.status,
      signing_link: result.signingLink,
    });

  } catch (error) {
    console.error('Signing create error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
