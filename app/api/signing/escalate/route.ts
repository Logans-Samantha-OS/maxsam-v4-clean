import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ============================================================================
// POST /api/signing/escalate - Mark packet as escalated
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
    const now = new Date().toISOString()

    // Update packet
    const { error } = await supabase
      .from('agreement_packets')
      .update({
        escalated_at: now,
        updated_at: now,
      })
      .eq('id', packet_id)

    if (error) {
      console.error('[Escalate API] Update error:', error)
      return NextResponse.json(
        { error: 'Failed to mark as escalated' },
        { status: 500 }
      )
    }

    // Log event
    await supabase
      .from('agreement_events')
      .insert({
        packet_id,
        event_type: 'ESCALATED',
        event_data: {
          reason: 'No response after 3 reminders',
          escalated_at: now,
        },
      })

    return NextResponse.json({
      success: true,
      escalated_at: now,
    })

  } catch (error) {
    console.error('[Escalate API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to escalate' },
      { status: 500 }
    )
  }
}
