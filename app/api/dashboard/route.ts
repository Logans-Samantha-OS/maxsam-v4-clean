import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
  // Aggregate only — no mutations
  const { data: leads } = await supabase.from('leads').select('*')

  const totalLeads = leads?.length ?? 0
  const pipelineCents = leads?.reduce((s, l) => s + (l.amount_cents ?? 0), 0) ?? 0

  return NextResponse.json({
    totalLeads,
    pipelineCents,
    signedCents: 0,
    responseRate: 0,
    conversion: {},
    activitySummary: {},
    alerts: []
  })
}
