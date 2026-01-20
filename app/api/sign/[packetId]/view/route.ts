import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { headers } from 'next/headers'

export const runtime = 'nodejs'

// ============================================================================
// POST /api/sign/[packetId]/view - Record when client views the agreement
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  try {
    const { packetId } = await params
    const supabase = await createClient()
    const headersList = await headers()

    // Get client IP and user agent for audit trail
    const clientIp = headersList.get('x-forwarded-for')?.split(',')[0]?.trim()
      || headersList.get('x-real-ip')
      || 'unknown'
    const userAgent = headersList.get('user-agent') || 'unknown'

    // Check if packet exists
    const { data: packet, error: fetchError } = await supabase
      .from('agreement_packets')
      .select('id, status, first_viewed_at')
      .eq('id', packetId)
      .single()

    if (fetchError || !packet) {
      return NextResponse.json(
        { error: 'Agreement not found' },
        { status: 404 }
      )
    }

    // Only update first_viewed_at if not already set
    if (!packet.first_viewed_at) {
      const { error: updateError } = await supabase
        .from('agreement_packets')
        .update({
          first_viewed_at: new Date().toISOString(),
          status: packet.status === 'SENT' ? 'VIEWED' : packet.status,
        })
        .eq('id', packetId)

      if (updateError) {
        console.error('[Sign View] Failed to update packet:', updateError)
      }
    }

    // Log view event (always, for audit trail)
    const { error: eventError } = await supabase
      .from('agreement_events')
      .insert({
        packet_id: packetId,
        event_type: 'VIEWED',
        event_data: {
          ip_address: clientIp,
          user_agent: userAgent,
          timestamp: new Date().toISOString(),
          is_first_view: !packet.first_viewed_at,
        },
      })

    if (eventError) {
      console.error('[Sign View] Failed to log event:', eventError)
      // Don't fail the request for event logging errors
    }

    return NextResponse.json({
      success: true,
      message: 'View recorded',
    })

  } catch (error) {
    console.error('[Sign View] Error recording view:', error)
    return NextResponse.json(
      { error: 'Failed to record view' },
      { status: 500 }
    )
  }
}
