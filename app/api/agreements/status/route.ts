import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/agreements/status
 * Returns agreement pipeline counts by status.
 * Used by the Agreement Center dashboard.
 */
export async function GET() {
  try {
    const supabase = createClient()

    // Fetch all agreement packets (status field)
    const { data: packets, error } = await supabase
      .from('agreement_packets')
      .select('status, lead_id')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    const all = packets || []

    const counts: Record<string, number> = {
      draft: 0,
      sent: 0,
      viewed: 0,
      signed: 0,
      voided: 0,
      expired: 0,
    }

    for (const p of all) {
      const status = (p.status || 'draft').toLowerCase()
      counts[status] = (counts[status] || 0) + 1
    }

    // Unique leads with agreements
    const uniqueLeads = new Set(all.map((p) => p.lead_id).filter(Boolean))

    return NextResponse.json({
      success: true,
      total: all.length,
      unique_leads: uniqueLeads.size,
      counts,
      pipeline: [
        { stage: 'draft', label: 'Draft', count: counts.draft, color: '#6b7280' },
        { stage: 'sent', label: 'Sent', count: counts.sent, color: '#3b82f6' },
        { stage: 'viewed', label: 'Viewed', count: counts.viewed, color: '#f59e0b' },
        { stage: 'signed', label: 'Signed', count: counts.signed, color: '#22c55e' },
      ],
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch agreement status'
    console.error('[agreements/status] Error:', message)
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
