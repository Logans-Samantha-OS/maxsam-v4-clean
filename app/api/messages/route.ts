import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/messages - Get all conversations grouped by lead/phone
 * Query params:
 *   - lead_id: Filter by specific lead
 *   - unread_only: Only return unread messages
 */
export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const unreadOnly = searchParams.get('unread_only') === 'true'

  try {
    if (leadId) {
      // Get messages for a specific lead/conversation
      const { data: messages, error } = await supabase
        .from('sms_messages')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true })

      if (error) throw error

      // Get lead info
      const { data: lead } = await supabase
        .from('maxsam_leads')
        .select('id, owner_name, property_address, city, state, excess_funds_amount, eleanor_score, deal_grade, status, phone, phone_1, phone_2')
        .eq('id', leadId)
        .single()

      return NextResponse.json({
        success: true,
        messages: messages || [],
        lead
      })
    }

    // Get all conversations grouped by lead
    let query = supabase
      .from('sms_messages')
      .select(`
        id,
        lead_id,
        direction,
        body,
        from_number,
        to_number,
        status,
        created_at,
        read_at,
        intent,
        sentiment,
        next_action
      `)
      .order('created_at', { ascending: false })

    if (unreadOnly) {
      query = query.is('read_at', null).eq('direction', 'inbound')
    }

    const { data: allMessages, error } = await query

    if (error) throw error

    // Group messages by lead_id and get conversation summaries
    const conversationMap = new Map<string, {
      lead_id: string
      last_message: string
      last_message_time: string
      last_direction: string
      unread_count: number
      total_messages: number
      phone: string
      last_intent: string | null
    }>()

    for (const msg of allMessages || []) {
      if (!msg.lead_id) continue

      const existing = conversationMap.get(msg.lead_id)
      const isUnread = msg.direction === 'inbound' && !msg.read_at

      if (!existing) {
        conversationMap.set(msg.lead_id, {
          lead_id: msg.lead_id,
          last_message: msg.body || '',
          last_message_time: msg.created_at,
          last_direction: msg.direction,
          unread_count: isUnread ? 1 : 0,
          total_messages: 1,
          phone: msg.direction === 'inbound' ? msg.from_number : msg.to_number,
          last_intent: msg.direction === 'inbound' ? (msg.intent || null) : null
        })
      } else {
        existing.total_messages++
        if (isUnread) existing.unread_count++
        // Update last_intent if this is an inbound with intent
        if (msg.direction === 'inbound' && msg.intent && !existing.last_intent) {
          existing.last_intent = msg.intent
        }
      }
    }

    // Get lead info for all conversations
    const leadIds = Array.from(conversationMap.keys())

    if (leadIds.length === 0) {
      return NextResponse.json({
        success: true,
        conversations: [],
        total_unread: 0
      })
    }

    const { data: leads } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, excess_funds_amount, eleanor_score, status')
      .in('id', leadIds)

    const leadMap = new Map(leads?.map(l => [l.id, l]) || [])

    // Build final conversation list
    const conversations = Array.from(conversationMap.values()).map(conv => ({
      ...conv,
      lead: leadMap.get(conv.lead_id) || null
    }))

    // Sort by last message time
    conversations.sort((a, b) =>
      new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
    )

    const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

    return NextResponse.json({
      success: true,
      conversations,
      total_unread: totalUnread
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/messages - Send a new message via Twilio
 */
export async function POST(request: NextRequest) {
  const supabase = createClient()

  try {
    const body = await request.json()
    const { lead_id, message, to_number } = body

    if (!lead_id || !message) {
      return NextResponse.json(
        { error: 'lead_id and message are required' },
        { status: 400 }
      )
    }

    // Get lead info
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, phone, phone_1, phone_2, contact_attempts')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const phoneToUse = to_number || lead.phone || lead.phone_1 || lead.phone_2
    if (!phoneToUse) {
      return NextResponse.json({ error: 'No phone number available' }, { status: 400 })
    }

    // Import Twilio functions
    const { sendSMS, normalizePhone } = await import('@/lib/twilio')

    // Normalize phone number
    const formattedPhone = normalizePhone(phoneToUse)

    // Send via Twilio directly
    const twilioResult = await sendSMS(formattedPhone, message, lead_id)

    if (!twilioResult.success) {
      return NextResponse.json({
        error: twilioResult.error || 'Failed to send SMS'
      }, { status: 400 })
    }

    // Log the outbound message
    const { data: newMessage, error: insertError } = await supabase
      .from('sms_messages')
      .insert({
        lead_id,
        direction: 'outbound',
        body: message,
        from_number: process.env.TWILIO_PHONE_NUMBER || '+18449632549',
        to_number: formattedPhone,
        status: 'sent',
        message_sid: twilioResult.sid,
        sent_at: new Date().toISOString(),
        agent_name: 'SAM',
        created_at: new Date().toISOString()
      })
      .select()
      .single()

    if (insertError) {
      console.error('Failed to log message:', insertError)
    }

    // Update lead contact info
    await supabase
      .from('maxsam_leads')
      .update({
        contact_attempts: (lead.contact_attempts || 0) + 1,
        last_contact_date: new Date().toISOString()
      })
      .eq('id', lead_id)

    return NextResponse.json({
      success: true,
      message: newMessage || {
        id: twilioResult.sid,
        body: message,
        to_number: formattedPhone,
        direction: 'outbound',
        status: 'sent',
        created_at: new Date().toISOString()
      }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    console.error('Send message error:', errorMessage)
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

/**
 * PATCH /api/messages - Mark messages as read
 */
export async function PATCH(request: NextRequest) {
  const supabase = createClient()

  try {
    const body = await request.json()
    const { message_ids, lead_id, mark_all_read } = body

    if (mark_all_read && lead_id) {
      // Mark all messages for a lead as read
      const { error } = await supabase
        .from('sms_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('lead_id', lead_id)
        .eq('direction', 'inbound')
        .is('read_at', null)

      if (error) throw error

      return NextResponse.json({ success: true, marked: 'all' })
    }

    if (message_ids && Array.isArray(message_ids)) {
      // Mark specific messages as read
      const { error } = await supabase
        .from('sms_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', message_ids)

      if (error) throw error

      return NextResponse.json({ success: true, marked: message_ids.length })
    }

    return NextResponse.json({ error: 'No messages specified' }, { status: 400 })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
