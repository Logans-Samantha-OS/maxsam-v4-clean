import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/conversations - Fetch all conversations
 *
 * NOTE: This endpoint is deprecated. Use /api/messages instead.
 * Kept for backwards compatibility.
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()

    // First check if new conversations table exists
    const { error: tableCheckError } = await supabase
      .from('conversations')
      .select('id')
      .limit(1)

    if (!tableCheckError) {
      // New unified conversations table exists
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          lead_id,
          contact_name,
          contact_phone,
          contact_email,
          status,
          unread_count,
          last_message_at,
          last_message_preview,
          last_message_direction,
          created_at
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false })

      if (error) {
        console.error('[Conversations API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Transform to expected format
      const conversations = (data || []).map(conv => ({
        id: conv.id,
        lead_id: conv.lead_id,
        phone: conv.contact_phone,
        last_message: conv.last_message_preview,
        updated_at: conv.last_message_at,
        messages: [], // Would need separate query
      }))

      return NextResponse.json({ conversations })
    }

    // Fallback to grouping sms_messages
    const { data: messages, error } = await supabase
      .from('sms_messages')
      .select('id, lead_id, message, direction, created_at, from_number, to_number')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[Conversations API] Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Group by lead_id
    const grouped = new Map<string, {
      id: string
      lead_id: string
      phone: string
      last_message: string
      updated_at: string
      messages: Array<{
        id: string
        body: string
        direction: string
        created_at: string
      }>
    }>()

    for (const msg of messages || []) {
      if (!msg.lead_id) continue

      const existing = grouped.get(msg.lead_id)
      const msgObj = {
        id: msg.id,
        body: msg.message,
        direction: msg.direction,
        created_at: msg.created_at,
      }

      if (existing) {
        existing.messages.push(msgObj)
      } else {
        grouped.set(msg.lead_id, {
          id: msg.lead_id, // Using lead_id as conversation id
          lead_id: msg.lead_id,
          phone: msg.direction === 'inbound' ? msg.from_number : msg.to_number,
          last_message: msg.message,
          updated_at: msg.created_at,
          messages: [msgObj],
        })
      }
    }

    const conversations = Array.from(grouped.values())

    return NextResponse.json({ conversations })
  } catch (err) {
    console.error('[Conversations API] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
