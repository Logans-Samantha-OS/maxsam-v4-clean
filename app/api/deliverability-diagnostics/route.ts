import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const supabase = createClient()

    // ======================================================================
    // 1. SMS Delivery Stats — query sms_messages first, fallback sms_log_enhanced
    // ======================================================================
    let smsRows: Record<string, unknown>[] = []

    const { data: smsData, error: smsErr } = await supabase
      .from('sms_messages')
      .select('id, to_number, to_phone, from_number, from_phone, message, message_body, body, direction, status, error_code, error_message, lead_id, created_at')
      .order('created_at', { ascending: false })
      .limit(2000)

    if (!smsErr && smsData && smsData.length > 0) {
      smsRows = smsData
    } else {
      const { data: enhancedData } = await supabase
        .from('sms_log_enhanced')
        .select('id, to_number, to_phone, from_number, from_phone, message, message_body, body, direction, status, error_code, error_message, lead_id, created_at')
        .order('created_at', { ascending: false })
        .limit(2000)

      if (enhancedData && enhancedData.length > 0) {
        smsRows = enhancedData
      }
    }

    // Count outbound by status
    const outboundRows = smsRows.filter((r) => String(r.direction || '') !== 'inbound')
    const totalSent = outboundRows.length
    const delivered = outboundRows.filter((r) => String(r.status || '').toLowerCase() === 'delivered').length
    const undelivered = outboundRows.filter((r) => String(r.status || '').toLowerCase() === 'undelivered').length
    const failed = outboundRows.filter((r) => String(r.status || '').toLowerCase() === 'failed').length
    const sent = outboundRows.filter((r) => String(r.status || '').toLowerCase() === 'sent').length
    const queued = outboundRows.filter((r) => String(r.status || '').toLowerCase() === 'queued').length
    const deliveryRate = totalSent > 0 ? Math.round((delivered / totalSent) * 100) : 0

    const smsStats = { total: totalSent, delivered, undelivered, failed, sent, queued, deliveryRate }

    // Failed/undelivered messages
    const failedRows = outboundRows.filter((r) => {
      const s = String(r.status || '').toLowerCase()
      return s === 'failed' || s === 'undelivered'
    })

    // ======================================================================
    // 2. Leads data
    // ======================================================================
    const { data: leadsData } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, phone, phone_1, phone_2, primary_phone, excess_funds_amount, status, eleanor_score, eleanor_grade, last_contacted_at, first_contacted_at, contact_count')
      .limit(5000)

    const leads = leadsData || []

    // Build lead lookup by id
    const leadById = new Map(leads.map((l) => [l.id, l]))

    // Enrich failed messages with lead name
    const failedMessages = failedRows.slice(0, 50).map((row) => {
      const leadId = row.lead_id as string | null
      const lead = leadId ? leadById.get(leadId) : null
      return {
        id: String(row.id),
        to_number: String(row.to_number || row.to_phone || ''),
        message: String(row.message || row.message_body || row.body || ''),
        status: String(row.status || ''),
        error_code: row.error_code ? String(row.error_code) : null,
        error_message: row.error_message ? String(row.error_message) : null,
        created_at: String(row.created_at || ''),
        lead_name: lead?.owner_name || null,
      }
    })

    // ======================================================================
    // 3. Silent leads: contacted but never replied
    // ======================================================================
    const inboundPhones = new Set<string>()
    for (const row of smsRows) {
      if (String(row.direction || '') === 'inbound') {
        const ph = String(row.from_number || row.from_phone || '').replace(/\D/g, '').replace(/^1/, '')
        if (ph.length >= 10) inboundPhones.add(ph)
      }
    }

    const getPhone = (l: Record<string, unknown>) =>
      String(l.primary_phone || l.phone || l.phone_1 || l.phone_2 || '').replace(/\D/g, '').replace(/^1/, '')

    const silentLeads = leads
      .filter((l) => {
        const ph = getPhone(l)
        return (
          ph.length >= 10 &&
          l.last_contacted_at &&
          !inboundPhones.has(ph) &&
          l.status !== 'opted_out'
        )
      })
      .sort((a, b) => (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0))
      .slice(0, 30)
      .map((l) => ({
        id: l.id,
        owner_name: l.owner_name || 'Unknown',
        phone: getPhone(l),
        excess_funds_amount: Number(l.excess_funds_amount || 0),
        last_contacted_at: l.last_contacted_at || '',
        contact_count: Number(l.contact_count || 0),
      }))

    // ======================================================================
    // 4. Lead coverage stats
    // ======================================================================
    const withPhone = leads.filter((l) => getPhone(l).length >= 10).length
    const withoutPhone = leads.length - withPhone
    const contacted = leads.filter((l) => !!l.last_contacted_at || !!l.first_contacted_at).length
    const notContacted = Math.max(withPhone - contacted, 0)

    const byStatus: Record<string, number> = {}
    for (const l of leads) {
      const s = l.status || 'new'
      byStatus[s] = (byStatus[s] || 0) + 1
    }

    const leadStats = { total: leads.length, withPhone, withoutPhone, contacted, notContacted, byStatus }

    // ======================================================================
    // 5. Top 20 highest-value uncontacted leads
    // ======================================================================
    const topLeads = leads
      .filter((l) => !l.last_contacted_at && !l.first_contacted_at)
      .sort((a, b) => (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0))
      .slice(0, 20)
      .map((l) => ({
        id: l.id,
        owner_name: l.owner_name || 'Unknown',
        phone: getPhone(l) || null,
        excess_funds_amount: Number(l.excess_funds_amount || 0),
        status: l.status || 'new',
        eleanor_score: l.eleanor_score ?? null,
        eleanor_grade: l.eleanor_grade ?? null,
      }))

    return NextResponse.json({
      success: true,
      smsStats,
      failedMessages,
      silentLeads,
      leadStats,
      topLeads,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch diagnostics'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
