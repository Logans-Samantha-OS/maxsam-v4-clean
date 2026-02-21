import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type LeadRow = {
  id: string
  owner_name: string | null
  phone: string | null
  excess_funds_amount: number | null
  case_number: string | null
  property_address: string | null
  eleanor_score: number | null
  eleanor_grade: string | null
  status: string | null
}

type SmsRow = Record<string, unknown>

const WORKFLOWS = [
  { name: 'ALEX', id: 'bTpU1ybErJ4TFmkt', active: true, last_run: null as string | null },
  { name: 'ELEANOR', id: 'caLLOlDen0TpRXsy', active: true, last_run: null as string | null },
  { name: 'SAM', id: 't3cgqw7BvswrKIfu', active: true, last_run: null as string | null },
]

const OPEN_ISSUES = [
  { issue: 'A2P compliance follow-up', severity: 'high' as const, detail: 'Ensure CTA consent pages remain compliant.' },
  { issue: 'Outbound SMS lead_id null', severity: 'medium' as const, detail: 'Phone-based matching required for attribution.' },
]

const normalizePhone = (phone: unknown): string =>
  String(phone || '').replace(/^\+1/, '').replace(/\D/g, '')

function getSmsPhone(sms: SmsRow): string {
  const direction = String(sms.direction || '')
  const toPhone = sms.to_phone || sms.to_number
  const fromPhone = sms.from_phone || sms.from_number
  return normalizePhone(direction === 'inbound' ? fromPhone : toPhone)
}

function getSmsText(sms: SmsRow): string {
  return String(sms.message_body || sms.message || sms.body || '')
}

export async function GET() {
  try {
    const supabase = createClient()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalLeadsRes,
      withPhoneRes,
      contactedRes,
      smsSentTodayRes,
      repliesTodayRes,
      valueDataRes,
      leadsRes,
      recentSmsRes,
      recentRepliesRes,
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('leads').select('*', { count: 'exact', head: true }).not('phone', 'is', null).neq('phone', ''),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabase.from('sms_messages').select('*', { count: 'exact', head: true }).eq('direction', 'outbound').gte('created_at', todayStart.toISOString()),
      supabase.from('sms_messages').select('*', { count: 'exact', head: true }).eq('direction', 'inbound').gte('created_at', todayStart.toISOString()),
      supabase.from('leads').select('excess_funds_amount'),
      supabase.from('leads').select('id, owner_name, phone, excess_funds_amount, case_number, property_address, eleanor_score, eleanor_grade, status'),
      supabase.from('sms_messages').select('*').eq('direction', 'outbound').order('created_at', { ascending: false }).limit(50),
      supabase.from('sms_messages').select('*').eq('direction', 'inbound').order('created_at', { ascending: false }).limit(50),
    ])

    const anyError = totalLeadsRes.error || withPhoneRes.error || contactedRes.error || smsSentTodayRes.error || repliesTodayRes.error || valueDataRes.error || leadsRes.error || recentSmsRes.error || recentRepliesRes.error

    if (anyError) {
      const message = totalLeadsRes.error?.message || withPhoneRes.error?.message || contactedRes.error?.message || smsSentTodayRes.error?.message || repliesTodayRes.error?.message || valueDataRes.error?.message || leadsRes.error?.message || recentSmsRes.error?.message || recentRepliesRes.error?.message || 'Failed to fetch ops data'
      return NextResponse.json({
        pipeline: { total_leads: 0, with_phone: 0, contacted: 0, responded: 0, agreement_sent: 0, signed: 0, golden_leads: 0, pipeline_value: 0, potential_fee: 0 },
        today: { sms_sent: 0, sms_value: 0, responses: 0, agreements_sent: 0, agreements_signed: 0 },
        recent_sms: [], recent_replies: [], workflows: WORKFLOWS, open_issues: OPEN_ISSUES, warning: message,
      })
    }

    const leads = (leadsRes.data || []) as LeadRow[]
    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const leadByPhone = new Map<string, LeadRow>()
    for (const lead of leads) {
      const phone = normalizePhone(lead.phone)
      if (phone) leadByPhone.set(phone, lead)
    }

    const resolveLead = (sms: SmsRow): LeadRow | null => {
      const leadId = sms.lead_id ? String(sms.lead_id) : ''
      if (leadId && leadById.has(leadId)) return leadById.get(leadId) || null
      const phone = getSmsPhone(sms)
      return leadByPhone.get(phone) || null
    }

    const pipelineValue = (valueDataRes.data || []).reduce((sum, row) => sum + Number((row as { excess_funds_amount?: number | null }).excess_funds_amount || 0), 0)

    const recentSms = (recentSmsRes.data || []).slice(0, 20).map((row) => {
      const sms = row as SmsRow
      const lead = resolveLead(sms)
      return {
        id: String(sms.id || ''),
        lead_id: lead?.id || (sms.lead_id ? String(sms.lead_id) : null),
        owner_name: lead?.owner_name || 'Unknown',
        phone: String(sms.to_phone || sms.to_number || lead?.phone || ''),
        excess_amount: Number(lead?.excess_funds_amount || 0),
        case_number: lead?.case_number || '',
        eleanor_grade: lead?.eleanor_grade || 'N/A',
        eleanor_score: Number(lead?.eleanor_score || 0),
        sent_at: String(sms.created_at || ''),
        status: String(sms.status || 'sent'),
      }
    })

    const recentReplies = (recentRepliesRes.data || []).slice(0, 20).map((row) => {
      const sms = row as SmsRow
      const lead = resolveLead(sms)
      return {
        id: String(sms.id || ''),
        lead_id: lead?.id || (sms.lead_id ? String(sms.lead_id) : null),
        owner_name: lead?.owner_name || 'Unknown',
        phone: String(sms.from_phone || sms.from_number || lead?.phone || ''),
        message: getSmsText(sms),
        intent: lead?.status || 'unknown',
        excess_amount: Number(lead?.excess_funds_amount || 0),
        received_at: String(sms.created_at || ''),
      }
    })

    return NextResponse.json({
      pipeline: {
        total_leads: totalLeadsRes.count || 0,
        with_phone: withPhoneRes.count || 0,
        contacted: contactedRes.count || 0,
        responded: leads.filter((lead) => lead.status === 'responded' || lead.status === 'responding' || lead.status === 'engaged').length,
        agreement_sent: leads.filter((lead) => lead.status === 'agreement_sent' || lead.status === 'contract_sent').length,
        signed: leads.filter((lead) => lead.status === 'signed' || lead.status === 'agreement_signed').length,
        golden_leads: leads.filter((lead) => String(lead.status || '').toLowerCase().includes('golden')).length,
        pipeline_value: pipelineValue,
        potential_fee: pipelineValue * 0.25,
      },
      today: {
        sms_sent: smsSentTodayRes.count || 0,
        sms_value: recentSms.reduce((sum, item) => sum + item.excess_amount, 0),
        responses: repliesTodayRes.count || 0,
        agreements_sent: 0,
        agreements_signed: 0,
      },
      recent_sms: recentSms,
      recent_replies: recentReplies,
      workflows: WORKFLOWS,
      open_issues: OPEN_ISSUES,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load ops dashboard data'
    return NextResponse.json({
      pipeline: { total_leads: 0, with_phone: 0, contacted: 0, responded: 0, agreement_sent: 0, signed: 0, golden_leads: 0, pipeline_value: 0, potential_fee: 0 },
      today: { sms_sent: 0, sms_value: 0, responses: 0, agreements_sent: 0, agreements_signed: 0 },
      recent_sms: [], recent_replies: [], workflows: WORKFLOWS, open_issues: OPEN_ISSUES, warning: message,
    })
  }
}
