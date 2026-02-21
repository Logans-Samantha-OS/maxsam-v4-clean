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

const WORKFLOWS = [
  { name: 'ALEX', id: 'bTpU1ybErJ4TFmkt', active: true, last_run: null as string | null },
  { name: 'ELEANOR', id: 'caLLOlDen0TpRXsy', active: true, last_run: null as string | null },
  { name: 'SAM', id: 't3cgqw7BvswrKIfu', active: true, last_run: null as string | null },
  { name: 'Reply Handler', id: 'fyHUiY70JUwxhPW5', active: true, last_run: null as string | null },
]

const OPEN_ISSUES = [
  { issue: 'A2P 10DLC campaign compliance follow-up', severity: 'high' as const, detail: 'Ensure opt-in language and public pages remain in sync.' },
  { issue: 'Outbound records often have null lead_id', severity: 'medium' as const, detail: 'Phone-based matching is required for accurate attribution.' },
  { issue: 'Agreement workflow verification pending', severity: 'low' as const, detail: 'Run end-to-end validation for signed packet transitions.' },
]

const normalizePhone = (phone: unknown): string => String(phone || '').replace(/^\+1/, '').replace(/\D/g, '')

export async function GET() {
  try {
    const supabase = createClient()

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const [
      totalLeadsRes,
      withPhoneRes,
      contactedRes,
      leadsValueRes,
      smsSentTodayRes,
      repliesTodayRes,
      leadsRes,
      recentSmsRes,
      recentRepliesRes,
    ] = await Promise.all([
      supabase.from('leads').select('*', { count: 'exact', head: true }),
      supabase.from('leads').select('*', { count: 'exact', head: true }).not('phone', 'is', null).neq('phone', ''),
      supabase.from('leads').select('*', { count: 'exact', head: true }).eq('status', 'contacted'),
      supabase.from('leads').select('excess_funds_amount'),
      supabase.from('sms_messages').select('*', { count: 'exact', head: true }).eq('direction', 'outbound').gte('created_at', todayStart.toISOString()),
      supabase.from('sms_messages').select('*', { count: 'exact', head: true }).eq('direction', 'inbound').gte('created_at', todayStart.toISOString()),
      supabase.from('leads').select('id, owner_name, phone, excess_funds_amount, case_number, property_address, eleanor_score, eleanor_grade, status'),
      supabase.from('sms_messages').select('*').eq('direction', 'outbound').order('created_at', { ascending: false }).limit(50),
      supabase.from('sms_messages').select('*').eq('direction', 'inbound').order('created_at', { ascending: false }).limit(50),
    ])

    if (totalLeadsRes.error || withPhoneRes.error || contactedRes.error || leadsValueRes.error || smsSentTodayRes.error || repliesTodayRes.error || leadsRes.error || recentSmsRes.error || recentRepliesRes.error) {
      const errorMessage = totalLeadsRes.error?.message || withPhoneRes.error?.message || contactedRes.error?.message || leadsValueRes.error?.message || smsSentTodayRes.error?.message || repliesTodayRes.error?.message || leadsRes.error?.message || recentSmsRes.error?.message || recentRepliesRes.error?.message || 'Failed to fetch dashboard data'
      return NextResponse.json({
        pipeline: {
          total_leads: 0,
          with_phone: 0,
          contacted: 0,
          responded: 0,
          agreement_sent: 0,
          signed: 0,
          golden_leads: 0,
          pipeline_value: 0,
          potential_fee: 0,
        },
        today: {
          sms_sent: 0,
          sms_value: 0,
          responses: 0,
          agreements_sent: 0,
          agreements_signed: 0,
        },
        recent_sms: [],
        recent_replies: [],
        workflows: WORKFLOWS,
        open_issues: OPEN_ISSUES,
        warning: errorMessage,
      })
    }

    const leads = (leadsRes.data || []) as LeadRow[]
    const leadById = new Map(leads.map((lead) => [lead.id, lead]))
    const leadByPhone = new Map<string, LeadRow>()
    for (const lead of leads) {
      const normalized = normalizePhone(lead.phone)
      if (normalized) leadByPhone.set(normalized, lead)
    }

    const resolveLead = (sms: Record<string, unknown>): LeadRow | null => {
      const byId = sms.lead_id ? leadById.get(String(sms.lead_id)) : undefined
      if (byId) return byId
      const phone = sms.direction === 'inbound'
        ? normalizePhone(sms.from_phone || sms.from_number)
        : normalizePhone(sms.to_phone || sms.to_number)
      return leadByPhone.get(phone) || null
    }

    const pipelineValue = (leadsValueRes.data || []).reduce((sum, row) => sum + Number((row as { excess_funds_amount?: number | null }).excess_funds_amount || 0), 0)

    const recentSms = (recentSmsRes.data || []).slice(0, 20).map((row) => {
      const sms = row as Record<string, unknown>
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
      const sms = row as Record<string, unknown>
      const lead = resolveLead(sms)
      return {
        id: String(sms.id || ''),
        lead_id: lead?.id || (sms.lead_id ? String(sms.lead_id) : null),
        owner_name: lead?.owner_name || 'Unknown',
        phone: String(sms.from_phone || sms.from_number || lead?.phone || ''),
        message: String(sms.message_body || sms.message || sms.body || ''),
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
        responded: leads.filter((lead) => lead.status === 'responded' || lead.status === 'engaged').length,
        agreement_sent: leads.filter((lead) => lead.status === 'agreement_sent').length,
        signed: leads.filter((lead) => lead.status === 'signed').length,
        golden_leads: leads.filter((lead) => String(lead.status || '').toLowerCase().includes('golden')).length,
        pipeline_value: pipelineValue,
        potential_fee: pipelineValue * 0.25,
      },
      today: {
        sms_sent: smsSentTodayRes.count || 0,
        sms_value: recentSms.reduce((sum, sms) => sum + sms.excess_amount, 0),
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
      pipeline: {
        total_leads: 0,
        with_phone: 0,
        contacted: 0,
        responded: 0,
        agreement_sent: 0,
        signed: 0,
        golden_leads: 0,
        pipeline_value: 0,
        potential_fee: 0,
      },
      today: {
        sms_sent: 0,
        sms_value: 0,
        responses: 0,
        agreements_sent: 0,
        agreements_signed: 0,
      },
      recent_sms: [],
      recent_replies: [],
      workflows: WORKFLOWS,
      open_issues: OPEN_ISSUES,
      warning: message,
    })
  }
}
