import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface ConversationMessage {
  id: string
  body: string
  direction: 'inbound' | 'outbound'
  created_at: string
  status?: string
  agent_name?: string
}

interface ConversationSummary {
  id: string
  lead_id: string
  owner_name: string
  phone: string
  last_message: string
  last_message_direction: string
  updated_at: string
  message_count: number
  unread_count: number
  status: string
  excess_funds_amount: number
  messages?: ConversationMessage[]
}

/**
 * GET /api/conversations - Fetch all conversations or a specific one
 *
 * Query params:
 * - lead_id: Get conversation for specific lead
 * - phone: Get conversation by phone number
 * - limit: Max conversations to return (default 50)
 * - include_messages: Include full message thread
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { searchParams } = new URL(req.url)
    const leadId = searchParams.get('lead_id')
    const phone = searchParams.get('phone')
    const limit = parseInt(searchParams.get('limit') || '50')
    const includeMessages = searchParams.get('include_messages') === 'true'

    // If requesting specific conversation
    if (leadId || phone) {
      return await getConversationThread(supabase, leadId, phone)
    }

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
          created_at,
          maxsam_leads(
            id,
            owner_name,
            excess_funds_amount,
            status,
            eleanor_score
          )
        `)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(limit)

      if (error) {
        console.error('[Conversations API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Transform to expected format
      const conversations: ConversationSummary[] = (data || []).map(conv => ({
        id: conv.id,
        lead_id: conv.lead_id,
        owner_name: conv.contact_name || conv.maxsam_leads?.owner_name || 'Unknown',
        phone: conv.contact_phone,
        last_message: conv.last_message_preview || '',
        last_message_direction: conv.last_message_direction || 'outbound',
        updated_at: conv.last_message_at || conv.created_at,
        message_count: 0,
        unread_count: conv.unread_count || 0,
        status: conv.maxsam_leads?.status || conv.status || 'unknown',
        excess_funds_amount: conv.maxsam_leads?.excess_funds_amount || 0
      }))

      return NextResponse.json({ success: true, conversations, count: conversations.length })
    }

    // Fallback: Build conversations from sms_messages
    return await buildConversationsFromMessages(supabase, limit)

  } catch (err) {
    console.error('[Conversations API] Error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/conversations - Send a reply in a conversation
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const body = await req.json()
    const { lead_id, message, phone: providedPhone } = body

    if (!lead_id || !message) {
      return NextResponse.json(
        { success: false, error: 'lead_id and message are required' },
        { status: 400 }
      )
    }

    // Get lead phone if not provided
    let targetPhone = providedPhone
    if (!targetPhone) {
      const { data: lead } = await supabase
        .from('maxsam_leads')
        .select('phone, phone_1, phone_2')
        .eq('id', lead_id)
        .single()

      targetPhone = lead?.phone || lead?.phone_1 || lead?.phone_2
    }

    if (!targetPhone) {
      return NextResponse.json(
        { success: false, error: 'No phone number found for lead' },
        { status: 400 }
      )
    }

    // Import and send SMS
    const { sendSMS } = await import('@/lib/twilio')
    const result = await sendSMS(targetPhone, message, lead_id)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      )
    }

    // Update last contact date
    await supabase
      .from('maxsam_leads')
      .update({
        last_contacted_at: new Date().toISOString(),
        last_contact_date: new Date().toISOString()
      })
      .eq('id', lead_id)

    // Update conversation if it exists
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: message.substring(0, 100),
        last_message_direction: 'outbound'
      })
      .eq('lead_id', lead_id)

    return NextResponse.json({
      success: true,
      message_sid: result.messageSid,
      sent_to: targetPhone
    })

  } catch (err) {
    console.error('[Conversations API] Send error:', err)
    return NextResponse.json(
      { success: false, error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

/**
 * Get full conversation thread for a lead
 */
async function getConversationThread(
  supabase: ReturnType<typeof createClient>,
  leadId: string | null,
  phone: string | null
) {
  const messages: ConversationMessage[] = []

  // Get from sms_messages
  let smsQuery = supabase
    .from('sms_messages')
    .select('*')
    .order('created_at', { ascending: true })
    .limit(200)

  if (leadId) {
    smsQuery = smsQuery.eq('lead_id', leadId)
  } else if (phone) {
    smsQuery = smsQuery.or(`from_number.eq.${phone},to_number.eq.${phone}`)
  }

  const { data: smsMessages } = await smsQuery

  for (const msg of smsMessages || []) {
    messages.push({
      id: msg.id,
      body: msg.body || msg.message || '',
      direction: msg.direction || 'outbound',
      created_at: msg.created_at,
      status: msg.status,
      agent_name: msg.agent_name
    })
  }

  // Also check communication_logs for older messages
  if (leadId) {
    const { data: commLogs } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('lead_id', leadId)
      .eq('type', 'sms')
      .order('created_at', { ascending: true })

    for (const log of commLogs || []) {
      // Avoid duplicates
      if (!messages.some(m => m.id === log.id)) {
        messages.push({
          id: log.id,
          body: log.content || log.body || '',
          direction: log.direction || 'outbound',
          created_at: log.created_at,
          status: log.status
        })
      }
    }
  }

  // Sort by date
  messages.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  // Get lead details
  let lead = null
  if (leadId) {
    const { data } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, phone, phone_1, phone_2, excess_funds_amount, eleanor_score, status, lead_class')
      .eq('id', leadId)
      .single()
    lead = data
  }

  return NextResponse.json({
    success: true,
    lead,
    messages,
    count: messages.length
  })
}

/**
 * Build conversation list from sms_messages when conversations table doesn't exist
 */
async function buildConversationsFromMessages(
  supabase: ReturnType<typeof createClient>,
  limit: number
) {
  // Get leads with recent activity
  const { data: leads } = await supabase
    .from('maxsam_leads')
    .select('id, owner_name, phone, phone_1, phone_2, status, excess_funds_amount, last_contacted_at')
    .or('phone.neq.null,phone_1.neq.null,phone_2.neq.null')
    .order('last_contacted_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  const conversations: ConversationSummary[] = []

  for (const lead of leads || []) {
    const phone = lead.phone || lead.phone_1 || lead.phone_2
    if (!phone) continue

    // Get message count and last message
    const { data: lastMsg } = await supabase
      .from('sms_messages')
      .select('body, message, direction, created_at')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    const { count: msgCount } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', lead.id)

    // Count today's inbound as "unread"
    const today = new Date().toISOString().split('T')[0]
    const { count: unreadCount } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('lead_id', lead.id)
      .eq('direction', 'inbound')
      .gte('created_at', today)

    conversations.push({
      id: lead.id,
      lead_id: lead.id,
      owner_name: lead.owner_name || 'Unknown',
      phone,
      last_message: lastMsg?.body || lastMsg?.message || '',
      last_message_direction: lastMsg?.direction || 'outbound',
      updated_at: lastMsg?.created_at || lead.last_contacted_at || '',
      message_count: msgCount || 0,
      unread_count: unreadCount || 0,
      status: lead.status || 'unknown',
      excess_funds_amount: lead.excess_funds_amount || 0
    })
  }

  // Sort by last message time
  conversations.sort((a, b) =>
    new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
  )

  return NextResponse.json({
    success: true,
    conversations,
    count: conversations.length
  })
}
