import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/messages - Get all conversations grouped by lead/phone
 * Query params:
 *   - lead_id: Filter by specific lead
 *   - unread_only: Only return unread messages
 *   - use_legacy: Force using sms_messages table (for backwards compat)
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead_id')
  const unreadOnly = searchParams.get('unread_only') === 'true'
  const useLegacy = searchParams.get('use_legacy') === 'true'

  try {
    // Check if new unified tables exist
    const useUnifiedTables = !useLegacy && await checkUnifiedTablesExist(supabase)

    if (leadId) {
      // Get messages for a specific lead/conversation
      return await getConversationMessages(supabase, leadId, useUnifiedTables)
    }

    // Get all conversations
    return await getConversationsList(supabase, unreadOnly, useUnifiedTables)

  } catch (error: unknown) {
    console.error('[Messages API] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * POST /api/messages - Send a new message
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient()

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
      .select('id, owner_name, phone, phone_1, phone_2, email')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
    }

    const phoneToUse = to_number || lead.phone || lead.phone_1 || lead.phone_2
    if (!phoneToUse) {
      return NextResponse.json({ error: 'No phone number available' }, { status: 400 })
    }

    // Format phone number
    const formattedPhone = phoneToUse.startsWith('+')
      ? phoneToUse
      : phoneToUse.startsWith('1')
        ? `+${phoneToUse}`
        : `+1${phoneToUse.replace(/\D/g, '')}`

    // Send via Twilio through N8N webhook
    const n8nResponse = await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id,
        phone: formattedPhone,
        owner_name: lead.owner_name,
        message,
        source: 'messaging_center'
      })
    })

    if (!n8nResponse.ok) {
      console.warn('N8N webhook failed, message may not be sent')
    }

    const now = new Date().toISOString()
    const fromNumber = process.env.TWILIO_PHONE_NUMBER || '+18449632549'

    // Log to sms_messages (legacy)
    const { data: smsMessage } = await supabase
      .from('sms_messages')
      .insert({
        lead_id,
        direction: 'outbound',
        message,
        from_number: fromNumber,
        to_number: formattedPhone,
        status: 'sent',
        created_at: now
      })
      .select()
      .single()

    // Also log to unified messages table if it exists
    try {
      const useUnified = await checkUnifiedTablesExist(supabase)
      if (useUnified) {
        // Get or create conversation
        let conversationId: string | null = null

        const { data: existingConv } = await supabase
          .from('conversations')
          .select('id')
          .eq('lead_id', lead_id)
          .eq('status', 'open')
          .order('last_message_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .single()

        if (existingConv) {
          conversationId = existingConv.id
        } else {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({
              lead_id,
              contact_name: lead.owner_name,
              contact_phone: lead.phone,
              contact_email: lead.email,
            })
            .select('id')
            .single()
          conversationId = newConv?.id || null
        }

        await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId,
            lead_id,
            direction: 'outbound',
            channel: 'sms',
            content: message,
            from_address: fromNumber,
            to_address: formattedPhone,
            status: 'sent',
            provider: 'twilio',
            external_id: smsMessage?.id,
          })
      }
    } catch (e) {
      // Unified tables might not exist yet - that's ok
      console.log('[Messages API] Could not log to unified tables:', e)
    }

    // Update lead contact info
    await supabase
      .from('maxsam_leads')
      .update({
        contact_count: ((lead as Record<string, unknown>).contact_count as number || 0) + 1,
        last_contact_date: now
      })
      .eq('id', lead_id)

    return NextResponse.json({
      success: true,
      message: smsMessage || { id: 'sent', message, to_number: formattedPhone }
    })

  } catch (error: unknown) {
    console.error('[Messages API] Send error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/**
 * PATCH /api/messages - Mark messages as read
 */
export async function PATCH(request: NextRequest) {
  const supabase = await createClient()

  try {
    const body = await request.json()
    const { message_ids, lead_id, mark_all_read, conversation_id } = body
    const now = new Date().toISOString()

    // If conversation_id provided, use unified tables
    if (conversation_id) {
      await supabase
        .from('messages')
        .update({ read_at: now, status: 'read', updated_at: now })
        .eq('conversation_id', conversation_id)
        .eq('direction', 'inbound')
        .is('read_at', null)

      await supabase
        .from('conversations')
        .update({ unread_count: 0, updated_at: now })
        .eq('id', conversation_id)

      return NextResponse.json({ success: true, marked: 'all' })
    }

    if (mark_all_read && lead_id) {
      // Mark all messages for a lead as read (legacy)
      const { error } = await supabase
        .from('sms_messages')
        .update({ read_at: now })
        .eq('lead_id', lead_id)
        .eq('direction', 'inbound')
        .is('read_at', null)

      if (error) throw error

      // Also update unified tables if they exist
      try {
        await supabase
          .from('messages')
          .update({ read_at: now, status: 'read', updated_at: now })
          .eq('lead_id', lead_id)
          .eq('direction', 'inbound')
          .is('read_at', null)

        await supabase
          .from('conversations')
          .update({ unread_count: 0, updated_at: now })
          .eq('lead_id', lead_id)
      } catch {
        // Unified tables might not exist
      }

      return NextResponse.json({ success: true, marked: 'all' })
    }

    if (message_ids && Array.isArray(message_ids)) {
      // Mark specific messages as read
      const { error } = await supabase
        .from('sms_messages')
        .update({ read_at: now })
        .in('id', message_ids)

      if (error) throw error

      return NextResponse.json({ success: true, marked: message_ids.length })
    }

    return NextResponse.json({ error: 'No messages specified' }, { status: 400 })

  } catch (error: unknown) {
    console.error('[Messages API] Patch error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkUnifiedTablesExist(supabase: any): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('conversations')
      .select('id')
      .limit(1)

    return !error
  } catch {
    return false
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getConversationMessages(
  supabase: any,
  leadId: string,
  useUnified: boolean
) {
  if (useUnified) {
    // Use unified messages table - includes SMS, email, and agreement events
    const { data: messages, error } = await supabase
      .from('messages')
      .select(`
        id,
        lead_id,
        conversation_id,
        direction,
        channel,
        content,
        from_address,
        to_address,
        status,
        read_at,
        intent,
        sentiment,
        agreement_packet_id,
        agreement_event_type,
        metadata,
        created_at
      `)
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true })

    // Gracefully handle errors - return empty array instead of throwing
    if (error) {
      console.error('[Messages API] Unified messages query error:', error.message)
      return NextResponse.json({
        success: true,
        messages: [],
        lead: null,
        source: 'unified',
        warning: 'Could not fetch messages'
      })
    }

    // Get lead info
    const { data: lead } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, city, state, excess_funds_amount, eleanor_score, deal_grade, status, phone, phone_1, phone_2, email')
      .eq('id', leadId)
      .single()

    // Transform to expected format for UI
    const transformedMessages = (messages || []).map(msg => ({
      id: msg.id,
      lead_id: msg.lead_id,
      direction: msg.direction,
      message: msg.content,
      from_number: msg.from_address,
      to_number: msg.to_address,
      status: msg.status,
      created_at: msg.created_at,
      read_at: msg.read_at,
      intent: msg.intent,
      sentiment: msg.sentiment,
      // New fields for timeline
      channel: msg.channel,
      agreement_packet_id: msg.agreement_packet_id,
      agreement_event_type: msg.agreement_event_type,
      metadata: msg.metadata,
    }))

    return NextResponse.json({
      success: true,
      messages: transformedMessages,
      lead,
      source: 'unified'
    })
  }

  // Fallback to legacy sms_messages table
  const { data: messages, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  // Gracefully handle errors - return empty array instead of throwing
  if (error) {
    console.error('[Messages API] Legacy sms_messages query error:', error.message)
    return NextResponse.json({
      success: true,
      messages: [],
      lead: null,
      source: 'legacy',
      warning: 'Could not fetch messages'
    })
  }

  // Get lead info
  const { data: lead } = await supabase
    .from('maxsam_leads')
    .select('id, owner_name, property_address, city, state, excess_funds_amount, eleanor_score, deal_grade, status, phone, phone_1, phone_2')
    .eq('id', leadId)
    .single()

  // Add channel field for consistency
  const transformedMessages = (messages || []).map(msg => ({
    ...msg,
    channel: 'sms',
  }))

  return NextResponse.json({
    success: true,
    messages: transformedMessages,
    lead,
    source: 'legacy'
  })
}

async function getConversationsList(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  unreadOnly: boolean,
  useUnified: boolean
) {
  if (useUnified) {
    // Use unified conversations table
    let query = supabase
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
      .eq('status', 'open')
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (unreadOnly) {
      query = query.gt('unread_count', 0)
    }

    const { data: conversations, error } = await query

    // Gracefully handle errors - return empty array instead of throwing
    if (error) {
      console.error('[Messages API] Unified conversations query error:', error.message)
      return NextResponse.json({
        success: true,
        conversations: [],
        total_unread: 0,
        source: 'unified',
        warning: 'Could not fetch conversations'
      })
    }

    // Get lead info for all conversations
    const leadIds = (conversations || []).map(c => c.lead_id).filter(Boolean)

    let leads: Record<string, unknown>[] = []
    if (leadIds.length > 0) {
      const { data } = await supabase
        .from('maxsam_leads')
        .select('id, owner_name, property_address, excess_funds_amount, eleanor_score, status')
        .in('id', leadIds)
      leads = data || []
    }

    const leadMap = new Map(leads.map(l => [l.id, l]))

    // Transform to expected format
    const result = (conversations || []).map(conv => ({
      lead_id: conv.lead_id,
      conversation_id: conv.id,
      last_message: conv.last_message_preview || '',
      last_message_time: conv.last_message_at,
      last_direction: conv.last_message_direction,
      unread_count: conv.unread_count || 0,
      total_messages: 0, // Would need separate query
      phone: conv.contact_phone,
      last_intent: null,
      lead: leadMap.get(conv.lead_id) || null
    }))

    const totalUnread = result.reduce((sum, c) => sum + c.unread_count, 0)

    return NextResponse.json({
      success: true,
      conversations: result,
      total_unread: totalUnread,
      source: 'unified'
    })
  }

  // Fallback to legacy - group sms_messages by lead
  let query = supabase
    .from('sms_messages')
    .select(`
      id,
      lead_id,
      direction,
      message,
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

  // Gracefully handle errors - return empty array instead of throwing
  if (error) {
    console.error('[Messages API] Legacy sms_messages list error:', error.message)
    return NextResponse.json({
      success: true,
      conversations: [],
      total_unread: 0,
      source: 'legacy',
      warning: 'Could not fetch conversations'
    })
  }

  // Group messages by lead_id
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
        last_message: msg.message || '',
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
      if (msg.direction === 'inbound' && msg.intent && !existing.last_intent) {
        existing.last_intent = msg.intent
      }
    }
  }

  // Get lead info
  const leadIds = Array.from(conversationMap.keys())

  if (leadIds.length === 0) {
    return NextResponse.json({
      success: true,
      conversations: [],
      total_unread: 0,
      source: 'legacy'
    })
  }

  const { data: leads } = await supabase
    .from('maxsam_leads')
    .select('id, owner_name, property_address, excess_funds_amount, eleanor_score, status')
    .in('id', leadIds)

  const leadMap = new Map(leads?.map(l => [l.id, l]) || [])

  // Build final list
  const conversations = Array.from(conversationMap.values()).map(conv => ({
    ...conv,
    lead: leadMap.get(conv.lead_id) || null
  }))

  conversations.sort((a, b) =>
    new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime()
  )

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0)

  return NextResponse.json({
    success: true,
    conversations,
    total_unread: totalUnread,
    source: 'legacy'
  })
}
