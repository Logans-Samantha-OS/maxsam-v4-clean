import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

async function getLeads(supabase: ReturnType<typeof createClient>) {
  const fromLeads = await supabase.from('leads').select('id, excess_funds_amount')
  if (!fromLeads.error) return fromLeads.data || []
  const fallback = await supabase.from('maxsam_leads').select('id, excess_funds_amount')
  return fallback.data || []
}

export async function GET() {
  try {
    const supabase = createClient()
    const leads = await getLeads(supabase)
    const today = new Date(new Date().setHours(0, 0, 0, 0)).toISOString()

    const pipelineValue = leads.reduce((sum, lead) => sum + Number(lead.excess_funds_amount || 0), 0)

    const { count: smsSent } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'outbound')
      .gte('created_at', today)

    const { count: responsesToday } = await supabase
      .from('sms_messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .gte('created_at', today)

    const { count: activeAgreements } = await supabase
      .from('agreement_packets')
      .select('*', { count: 'exact', head: true })
      .in('status', ['sent', 'viewed', 'pending'])

    return NextResponse.json({
      total_leads: leads.length,
      pipeline_value: pipelineValue,
      sms_sent_today: smsSent || 0,
      responses_today: responsesToday || 0,
      active_agreements: activeAgreements || 0,
      revenue_potential: pipelineValue * 0.25,
      totalLeads: leads.length,
      pipelineCents: Math.round(pipelineValue * 100),
      signedCents: 0,
      responseRate: 0,
      conversion: {},
      activitySummary: {},
      alerts: [],
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load dashboard stats'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
