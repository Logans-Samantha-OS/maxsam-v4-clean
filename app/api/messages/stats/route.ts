import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/messages/stats - Dashboard stats: pipeline counts, daily stats, briefing
 */
export async function GET() {
  const supabase = await createClient()

  try {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayISO = todayStart.toISOString()

    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)
    const yesterdayISO = yesterdayStart.toISOString()

    // Run all queries in parallel
    const [
      sentTodayResult,
      repliesTodayResult,
      sentYesterdayResult,
      repliesYesterdayResult,
      pendingAgreementsResult,
      pipelineLeadsResult,
      // Pipeline stage counts
      allLeadsResult,
      enrichedResult,
      scoredResult,
      outreachResult,
      repliedResult,
      agreementResult,
      closedResult,
      // Top revenue plays
      topRevenueResult,
      // Today's queue
      todayQueueResult,
    ] = await Promise.all([
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

      // Messages sent yesterday
      supabase
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'outbound')
        .gte('created_at', yesterdayISO)
        .lt('created_at', todayISO),

      // Replies received yesterday
      supabase
        .from('sms_messages')
        .select('id', { count: 'exact', head: true })
        .eq('direction', 'inbound')
        .gte('created_at', yesterdayISO)
        .lt('created_at', todayISO),

      // Agreements pending signature
      supabase
        .from('agreement_packets')
        .select('id', { count: 'exact', head: true })
        .in('status', ['sent', 'pending', 'viewed']),

      // Pipeline value leads
      supabase
        .from('agreement_packets')
        .select('lead_id')
        .in('status', ['sent', 'pending', 'viewed', 'signed']),

      // Pipeline: Extracted (all leads)
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true }),

      // Pipeline: Enriched
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .or('status.in.(enriched,enriched_alive,enriched_deceased),enriched.eq.true'),

      // Pipeline: Scored (eleanor_score > 0)
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .gt('eleanor_score', 0),

      // Pipeline: Outreach (contacted or has outreach)
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.contacted,status.eq.ready_for_outreach,outreach_status.in.(contacted,initial_sent),contact_attempts.gt.0'),

      // Pipeline: Replied
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .or('last_response_at.not.is.null,response_count.gt.0'),

      // Pipeline: Agreement (sent or signed)
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .or('agreement_sent_at.not.is.null,agreement_signed_at.not.is.null'),

      // Pipeline: Closed (won deals)
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .or('status.eq.closed,status.eq.won,claim_filed.eq.true'),

      // Top 3 revenue plays (highest excess_funds with phone)
      supabase
        .from('maxsam_leads')
        .select('id, owner_name, excess_funds_amount, phone, phone_1, phone_2, eleanor_score, status, property_address')
        .gt('excess_funds_amount', 0)
        .or('phone.not.is.null,phone_1.not.is.null,phone_2.not.is.null')
        .not('status', 'in', '(opted_out,closed,won,deleted)')
        .order('excess_funds_amount', { ascending: false })
        .limit(3),

      // Today's queue (ready for outreach, not yet contacted today)
      supabase
        .from('maxsam_leads')
        .select('id', { count: 'exact', head: true })
        .in('status', ['ready_for_outreach', 'enriched_alive'])
        .or('phone.not.is.null,phone_1.not.is.null,phone_2.not.is.null')
        .not('status', 'eq', 'opted_out'),
    ])

    // Calculate pipeline value
    let pipelineValue = 0
    const pipelineIds = pipelineLeadsResult.data?.map(p => p.lead_id).filter(Boolean) || []
    if (pipelineIds.length > 0) {
      const { data: leads } = await supabase
        .from('maxsam_leads')
        .select('excess_funds_amount')
        .in('id', pipelineIds)

      pipelineValue = (leads || []).reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0)
    }

    // If no pipeline leads with agreements, use total excess funds for all outreach-ready leads
    if (pipelineValue === 0) {
      const { data: allOutreach } = await supabase
        .from('maxsam_leads')
        .select('excess_funds_amount')
        .gt('excess_funds_amount', 0)
        .not('status', 'in', '(opted_out,closed,won,deleted)')

      pipelineValue = (allOutreach || []).reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0)
    }

    return NextResponse.json({
      success: true,
      stats: {
        messages_sent_today: sentTodayResult.count || 0,
        replies_today: repliesTodayResult.count || 0,
        agreements_pending: pendingAgreementsResult.count || 0,
        pipeline_value: pipelineValue,
      },
      pipeline: {
        extracted: allLeadsResult.count || 0,
        enriched: enrichedResult.count || 0,
        scored: scoredResult.count || 0,
        outreach: outreachResult.count || 0,
        replied: repliedResult.count || 0,
        agreement: agreementResult.count || 0,
        closed: closedResult.count || 0,
      },
      briefing: {
        yesterday: {
          messages_sent: sentYesterdayResult.count || 0,
          replies_received: repliesYesterdayResult.count || 0,
        },
        today_queue: todayQueueResult.count || 0,
        top_revenue_plays: topRevenueResult.data || [],
      },
    })
  } catch (error: unknown) {
    console.error('[Messages Stats API] Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
