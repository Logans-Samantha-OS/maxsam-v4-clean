import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ============================================================================
// POST /api/signing/reminder-sent - Update packet after reminder sent
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { packet_id, reminder_count } = body

    if (!packet_id) {
      return NextResponse.json(
        { error: 'packet_id is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const now = new Date().toISOString()

    // Calculate next reminder time based on count
    // +24h after first reminder, +48h after second (total 72h from send)
    const nextReminderHours = reminder_count < 3 ? (reminder_count === 1 ? 24 : 48) : null
    const nextReminderAt = nextReminderHours
      ? new Date(Date.now() + nextReminderHours * 60 * 60 * 1000).toISOString()
      : null

    // Update packet
    const { error } = await supabase
      .from('agreement_packets')
      .update({
        reminder_count: reminder_count,
        last_reminder_at: now,
        next_reminder_at: nextReminderAt,
        updated_at: now,
      })
      .eq('id', packet_id)

    if (error) {
      console.error('[Reminder Sent API] Update error:', error)
      return NextResponse.json(
        { error: 'Failed to update packet' },
        { status: 500 }
      )
    }

    // Log event
    await supabase
      .from('agreement_events')
      .insert({
        packet_id,
        event_type: 'REMINDER_SENT',
        event_data: {
          reminder_number: reminder_count,
          next_reminder_at: nextReminderAt,
        },
      })

    return NextResponse.json({
      success: true,
      reminder_count,
      next_reminder_at: nextReminderAt,
    })

  } catch (error) {
    console.error('[Reminder Sent API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to update reminder status' },
      { status: 500 }
    )
  }
}
