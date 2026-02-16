import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/messages/stats - Get daily messaging stats for morning report
 * Returns: messages_sent_today, replies_today, agreements_pending, pipeline_value
 */
export async function GET() {
  const supabase = await createClient()

  try {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    // Run all queries in parallel
    const [sentResult, repliesResult, pendingResult, pipelineResult] = await Promise.all([
      // Messages sent today
      supabase
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .gte('created_at', todayISO),

      // Replies received today
      supabase
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .gte('created_at', todayISO),

      // Agreements pending signature
      supabase
        .from('agreement_packets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['sent', 'pending', 'viewed']),

      // Pipeline value (sum of excess_funds for leads with sent/pending agreements)
      supabase
        .from('agreement_packets')
        .select('lead_id')
        .in('status', ['sent', 'pending', 'viewed', 'signed']),
    ])

    // Get pipeline value from leads
    let pipelineValue = 0
    const leadIds = pipelineResult.data?.map(p => p.lead_id).filter(Boolean) || []
    if (leadIds.length > 0) {
      const { data: leads } = await supabase
        .from('maxsam_leads')
        .select('excess_funds_amount')
        .in('id', leadIds)

      pipelineValue = (leads || []).reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0)
    }

    return NextResponse.json({
      success: true,
      stats: {
        messages_sent_today: sentResult.count || 0,
        replies_today: repliesResult.count || 0,
        agreements_pending: pendingResult.count || 0,
        pipeline_value: pipelineValue,
      },
    })
  } catch (error: unknown) {
    console.error('[Messages Stats API] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
