/**
 * Single Agreement Packet API
 * GET /api/agreements/[id] - Get packet details
 * POST /api/agreements/[id] - Perform actions (resend, void)
 *
 * Uses self-hosted e-signature system. Sends via Twilio SMS.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/twilio';

/**
 * GET /api/agreements/[id]
 * Get agreement packet details with events
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = createClient();

    const { data: packet, error } = await supabase
      .from('agreement_packets')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !packet) {
      return NextResponse.json(
        { success: false, error: 'Packet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      packet,
    });

  } catch (error) {
    console.error('Agreement fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/agreements/[id]
 * Perform actions on an agreement packet
 *
 * Body:
 * - action: 'resend' | 'void'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    const supabase = createClient();

    // Fetch packet
    const { data: packet, error: fetchError } = await supabase
      .from('agreement_packets')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !packet) {
      return NextResponse.json(
        { success: false, error: 'Packet not found' },
        { status: 404 }
      );
    }

    switch (action) {
      case 'resend': {
        // Resend signing link via SMS
        if (!['sent', 'viewed'].includes(packet.status)) {
          return NextResponse.json(
            { success: false, error: `Cannot resend packet in status: ${packet.status}` },
            { status: 400 }
          );
        }

        if (!packet.signing_link) {
          return NextResponse.json(
            { success: false, error: 'No signing link found for this packet' },
            { status: 400 }
          );
        }

        if (!packet.client_phone) {
          return NextResponse.json(
            { success: false, error: 'No phone number on file for this packet' },
            { status: 400 }
          );
        }

        const firstName = packet.client_name?.split(/[,\s]+/)[0] || 'there';
        const smsMessage = `${firstName}, resending your agreement signing link. Sign on your phone in 60 seconds: ${packet.signing_link}\n\nNo upfront cost.\n\n-Sam, MaxSam Recovery`;

        const smsResult = await sendSMS(packet.client_phone, smsMessage, packet.lead_id);

        // Log event
        try {
          await supabase.from('agreement_events').insert({
            packet_id: id,
            event_type: 'sent',
            source: 'api',
            event_data: { action: 'resend', sms_sent: smsResult.success },
          });
        } catch {
          // Non-critical
        }

        return NextResponse.json({
          success: true,
          action: 'resend',
          sms_sent: smsResult.success,
        });
      }

      case 'void': {
        // Void/cancel the packet
        if (['signed', 'voided'].includes(packet.status)) {
          return NextResponse.json(
            { success: false, error: `Cannot void packet in status: ${packet.status}` },
            { status: 400 }
          );
        }

        // Try RPC first, fall back to direct update
        const { error: rpcError } = await supabase.rpc('update_agreement_status', {
          p_packet_id: id,
          p_new_status: 'voided',
          p_event_type: 'voided',
          p_event_data: { reason: body.reason || 'Manually voided via API' },
          p_source: 'api',
        });

        if (rpcError) {
          // Fallback: direct update
          await supabase
            .from('agreement_packets')
            .update({ status: 'voided' })
            .eq('id', id);
        }

        return NextResponse.json({
          success: true,
          action: 'void',
          message: 'Agreement packet voided',
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Agreement action error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
