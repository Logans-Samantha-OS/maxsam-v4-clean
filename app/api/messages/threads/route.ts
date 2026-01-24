import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/messages/threads - Get all message threads with lead info
 * Always uses manual query to ensure lead data (amount, score) is properly joined
 */
export async function GET() {
  const supabase = createClient()

  try {
    // Query messages directly - skip RPC to ensure we get proper lead data
    const { data: allMessages, error } = await supabase
      .from('sms_messages')
      .select('id, lead_id, message, direction, from_number, to_number, created_at')
      .order('created_at', { ascending: false })

    if (error) throw error

    // Group messages by lead_id
    const threadMap = new Map<string, {
      lead_id: string
      last_message: string
      last_message_at: string
      last_direction: string
      message_count: number
    }>()

    for (const msg of allMessages || []) {
      if (!msg.lead_id) continue

      const existing = threadMap.get(msg.lead_id)
      if (!existing) {
        threadMap.set(msg.lead_id, {
          lead_id: msg.lead_id,
          last_message: msg.message || '',
          last_message_at: msg.created_at,
          last_direction: msg.direction,
          message_count: 1,
        })
      } else {
        existing.message_count++
      }
    }

    // Get lead info for all threads
    const leadIds = Array.from(threadMap.keys())

    if (leadIds.length === 0) {
      return NextResponse.json({ threads: [] })
    }

    // Debug: Log lead IDs we're looking for
    console.log('[threads] Looking for lead IDs:', leadIds.slice(0, 5), '... total:', leadIds.length)

    const { data: leads, error: leadsError } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, phone, phone_1, phone_2, property_address, excess_funds_amount, eleanor_score, is_golden, status')
      .in('id', leadIds)

    if (leadsError) {
      console.error('[threads] Lead query error:', leadsError)
      throw leadsError
    }

    // Debug: Log what we got back
    console.log('[threads] Found leads:', leads?.length || 0)
    if (leads && leads.length > 0) {
      console.log('[threads] Sample lead:', leads[0].id, leads[0].owner_name, 'amount:', leads[0].excess_funds_amount, 'score:', leads[0].eleanor_score)
    }

    const leadMap = new Map(leads?.map(l => [l.id, l]) || [])

    // Build final threads list
    const threadsList = Array.from(threadMap.values())
      .map(thread => {
        const lead = leadMap.get(thread.lead_id)
        return {
          ...thread,
          owner_name: lead?.owner_name || 'Unknown',
          phone: lead?.phone || lead?.phone_1 || lead?.phone_2 || '',
          property_address: lead?.property_address || '',
          excess_funds_amount: lead?.excess_funds_amount || 0,
          eleanor_score: lead?.eleanor_score || 0,
          is_golden: lead?.is_golden || false,
          status: lead?.status || 'new',
        }
      })
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime())

    return NextResponse.json({ threads: threadsList })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Failed to fetch message threads:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
