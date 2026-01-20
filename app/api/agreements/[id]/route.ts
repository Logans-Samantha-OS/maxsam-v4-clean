/**
 * Single Agreement Packet API
 * GET /api/agreements/[id] - Get packet details
 * POST /api/agreements/[id] - Perform actions (resend, remind, void)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendSigningLink, sendReminder } from '@/lib/jotform-sign';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/agreements/[id]
 * Get agreement packet details with documents and events
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
      .select(`
        *,
        agreement_documents(*),
        agreement_events(*)
      `)
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
 * - action: 'resend' | 'remind' | 'void'
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
        // Resend signing link
        if (!['sent', 'viewed'].includes(packet.status)) {
          return NextResponse.json(
            { success: false, error: `Cannot resend packet in status: ${packet.status}` },
            { status: 400 }
          );
        }

        const result = await sendSigningLink(id);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 500 }
          );
        }

        // Log event
        await supabase.from('agreement_events').insert({
          packet_id: id,
          event_type: 'sent',
          source: 'api',
          event_data: { action: 'resend', sms_sent: result.smsSent, email_sent: result.emailSent },
        });

        return NextResponse.json({
          success: true,
          action: 'resend',
          sms_sent: result.smsSent,
          email_sent: result.emailSent,
        });
      }

      case 'remind': {
        // Send reminder
        const result = await sendReminder(id);

        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error },
            { status: 400 }
          );
        }

        return NextResponse.json({
          success: true,
          action: 'remind',
          reminder_count: packet.reminder_count + 1,
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

        await supabase.rpc('update_agreement_status', {
          p_packet_id: id,
          p_new_status: 'voided',
          p_event_type: 'voided',
          p_event_data: { reason: body.reason || 'Manually voided via API' },
          p_source: 'api',
        });

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
