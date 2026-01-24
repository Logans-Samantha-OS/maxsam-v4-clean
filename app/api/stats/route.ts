import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = createClient()

    // Get all leads with relevant columns
    const { data: leadsData, error: leadsError } = await supabase
      .from('maxsam_leads')
      .select('id, excess_funds_amount, eleanor_score, is_golden, status, last_contact_at, created_at')
      .neq('status', 'deleted')

    if (leadsError) throw leadsError

    const leads = leadsData || []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Calculate stats
    const totalLeads = leads.length
    const goldenLeads = leads.filter(l => l.is_golden).length
    const pipelineValue = leads.reduce((sum, lead) => sum + (lead.excess_funds_amount || 0), 0)
    const projectedRevenue = pipelineValue * 0.25 // 25% fee

    // Status breakdown
    const statusCounts: Record<string, number> = {}
    leads.forEach(lead => {
      const status = lead.status || 'new'
      statusCounts[status] = (statusCounts[status] || 0) + 1
    })

    // Contacted today
    const contactedToday = leads.filter(l => {
      if (!l.last_contact_at) return false
      const contactDate = new Date(l.last_contact_at)
      return contactDate >= today
    }).length

    // Leads created today
    const leadsToday = leads.filter(l => {
      if (!l.created_at) return false
      const createDate = new Date(l.created_at)
      return createDate >= today
    }).length

    // Score distribution
    const highScoreLeads = leads.filter(l => (l.eleanor_score || 0) >= 80).length
    const mediumScoreLeads = leads.filter(l => (l.eleanor_score || 0) >= 50 && (l.eleanor_score || 0) < 80).length
    const lowScoreLeads = leads.filter(l => (l.eleanor_score || 0) < 50).length

    // Average score
    const avgScore = leads.length > 0
      ? Math.round(leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / leads.length)
      : 0

    // Get message counts
    const { count: totalMessages } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })

    const { count: messagesInbound } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')

    const { count: messagesOutbound } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound')

    return NextResponse.json({
      totalLeads,
      goldenLeads,
      pipelineValue,
      projectedRevenue,
      contactedToday,
      leadsToday,
      avgScore,
      statusCounts,
      scoreDistribution: {
        high: highScoreLeads,
        medium: mediumScoreLeads,
        low: lowScoreLeads,
      },
      messages: {
        total: totalMessages || 0,
        inbound: messagesInbound || 0,
        outbound: messagesOutbound || 0,
      },
    })

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Stats API error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
