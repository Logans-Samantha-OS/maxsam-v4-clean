import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ============================================================================
// GET /api/signing/reminders - Fetch packets due for reminder
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const now = new Date().toISOString()

    // Fetch packets where:
    // - Status is SENT or VIEWED (not yet signed)
    // - next_reminder_at is in the past
    // - reminder_count < 3 (haven't sent all reminders yet)
    // - NOT escalated
    const { data: packets, error } = await supabase
      .from('agreement_packets')
      .select(`
        id,
        lead_id,
        client_name,
        client_phone,
        client_email,
        property_address,
        signing_link,
        total_fee,
        status,
        reminder_count,
        sent_at,
        next_reminder_at
      `)
      .in('status', ['sent', 'viewed', 'SENT', 'VIEWED'])
      .lt('next_reminder_at', now)
      .lt('reminder_count', 3)
      .is('escalated_at', null)
      .order('next_reminder_at', { ascending: true })
      .limit(50)

    if (error) {
      console.error('[Reminders API] Query error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch reminders' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      packets: packets || [],
      count: packets?.length || 0,
    })

  } catch (error) {
    console.error('[Reminders API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reminders' },
      { status: 500 }
    )
  }
}

// ============================================================================
// POST /api/signing/reminders - Create a reminder (manual trigger)
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { packet_id } = body

    if (!packet_id) {
      return NextResponse.json(
        { error: 'packet_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get packet
    const { data: packet, error: fetchError } = await supabase
      .from('agreement_packets')
      .select('*')
      .eq('id', packet_id)
      .single()

    if (fetchError || !packet) {
      return NextResponse.json(
        { error: 'Packet not found' },
        { status: 404 }
      )
    }

    // Check if can send reminder
    if (['SIGNED', 'VOIDED', 'DECLINED', 'EXPIRED'].includes(packet.status?.toUpperCase())) {
      return NextResponse.json(
        { error: `Cannot send reminder - packet status is ${packet.status}` },
        { status: 400 }
      )
    }

    // Import twilio and send reminder
    const { sendSMS } = await import('@/lib/twilio')

    const reminderCount = (packet.reminder_count || 0) + 1
    const firstName = packet.client_name?.split(' ')[0] || 'there'

    let message: string
    if (reminderCount === 1) {
      message = `Hi ${firstName}! Just a friendly reminder - your agreement is ready to sign. Takes less than 60 seconds: ${packet.signing_link}`
    } else if (reminderCount === 2) {
      message = `Hi ${firstName}, we noticed you haven't signed yet. This agreement secures your claim. Sign now: ${packet.signing_link}`
    } else {
      message = `Final notice: Your agreement expires soon. This is your last reminder. Sign now: ${packet.signing_link}`
    }

    const smsResult = await sendSMS(packet.client_phone, message, packet.lead_id)

    // Update packet
    const nextReminderHours = reminderCount === 1 ? 24 : reminderCount === 2 ? 48 : null
    const nextReminderAt = nextReminderHours
      ? new Date(Date.now() + nextReminderHours * 60 * 60 * 1000).toISOString()
      : null

    await supabase
      .from('agreement_packets')
      .update({
        reminder_count: reminderCount,
        last_reminder_at: new Date().toISOString(),
        next_reminder_at: nextReminderAt,
      })
      .eq('id', packet_id)

    // Log event
    await supabase
      .from('agreement_events')
      .insert({
        packet_id,
        event_type: 'REMINDER_SENT',
        event_data: {
          reminder_number: reminderCount,
          sms_sent: smsResult.success,
          message_preview: message.slice(0, 100),
        },
      })

    return NextResponse.json({
      success: true,
      reminder_count: reminderCount,
      sms_sent: smsResult.success,
    })

  } catch (error) {
    console.error('[Reminders API] Error sending reminder:', error)
    return NextResponse.json(
      { error: 'Failed to send reminder' },
      { status: 500 }
    )
  }
}
