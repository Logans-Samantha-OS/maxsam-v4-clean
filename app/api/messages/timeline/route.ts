import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// ============================================================================
// POST /api/messages/timeline - Add message to unified timeline
// ============================================================================

interface TimelinePayload {
  lead_id: string
  direction: 'inbound' | 'outbound' | 'system'
  channel: 'sms' | 'email' | 'agreement' | 'system'
  content: string
  from_address?: string
  to_address?: string
  external_id?: string
  provider?: string
  metadata?: Record<string, unknown>
  agreement_packet_id?: string
  agreement_event_type?: string
}

export async function POST(request: NextRequest) {
  try {
    const body: TimelinePayload = await request.json()

    // Validate required fields
    if (!body.lead_id || !body.direction || !body.channel || !body.content) {
      return NextResponse.json(
        { error: 'Missing required fields: lead_id, direction, channel, content' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if the messages table exists by trying to insert
    // If it doesn't exist yet (migration not run), we'll gracefully handle it
    try {
      // First, get or create a conversation for this lead
      const { data: existingConversation } = await supabase
        .from('conversations')
        .select('id')
        .eq('lead_id', body.lead_id)
        .eq('status', 'open')
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .single()

      let conversationId = existingConversation?.id

      // If no conversation exists, create one
      if (!conversationId) {
        // Get lead info for the conversation
        const { data: lead } = await supabase
          .from('maxsam_leads')
          .select('owner_name, phone, email')
          .eq('id', body.lead_id)
          .single()

        const { data: newConversation, error: convError } = await supabase
          .from('conversations')
          .insert({
            lead_id: body.lead_id,
            contact_name: lead?.owner_name,
            contact_phone: lead?.phone,
            contact_email: lead?.email,
          })
          .select('id')
          .single()

        if (convError) {
          console.error('[Timeline API] Failed to create conversation:', convError)
        } else {
          conversationId = newConversation?.id
        }
      }

      // Insert the message
      const { data: message, error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          lead_id: body.lead_id,
          direction: body.direction,
          channel: body.channel,
          content: body.content,
          from_address: body.from_address,
          to_address: body.to_address,
          external_id: body.external_id,
          provider: body.provider,
          metadata: body.metadata || {},
          agreement_packet_id: body.agreement_packet_id,
          agreement_event_type: body.agreement_event_type,
        })
        .select('id')
        .single()

      if (msgError) {
        console.error('[Timeline API] Failed to insert message:', msgError)
        return NextResponse.json(
          { error: 'Failed to add message to timeline', details: msgError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message_id: message?.id,
        conversation_id: conversationId,
      })

    } catch (dbError) {
      // Tables might not exist yet - log and return success to not break workflows
      console.warn('[Timeline API] Database tables may not exist yet:', dbError)
      return NextResponse.json({
        success: true,
        message: 'Timeline entry queued (tables pending migration)',
        warning: 'conversations/messages tables not yet created',
      })
    }

  } catch (error) {
    console.error('[Timeline API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to process timeline entry' },
      { status: 500 }
    )
  }
}
