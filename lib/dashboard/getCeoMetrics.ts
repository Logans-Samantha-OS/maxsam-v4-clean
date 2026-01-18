// ADD: lib/dashboard/getCeoMetrics.ts
import { createClient } from '@/lib/supabase/server'

export async function getCeoMetrics() {
  const supabase = createClient()

  const [
    leadsRes,
    messagesRes,
    contractsRes,
    activityRes
  ] = await Promise.all([
    supabase.from('leads').select('id, status, score, amount'),
    supabase.from('messages').select('id, direction, created_at'),
    supabase.from('contracts').select('id, signed_value, status'),
    supabase
      .from('activity_events')
      .select('id, type, created_at')
      .order('created_at', { ascending: false })
      .limit(10)
  ])

  const leads = leadsRes.data ?? []
  const contracts = contractsRes.data ?? []
  const messages = messagesRes.data ?? []

  const pipelineValue = leads.reduce(
    (sum, l) => sum + (l.amount ?? 0),
    0
  )

  const signedValue = contracts
    .filter(c => c.status === 'signed')
    .reduce((sum, c) => sum + (c.signed_value ?? 0), 0)

  const contacted = leads.filter(l => l.status === 'contacted').length
  const responded = messages.filter(m => m.direction === 'inbound').length

  return {
    totals: {
      leads: leads.length,
      pipelineValue,
      signedValue,
      responseRate:
        contacted === 0 ? 0 : Math.round((responded / contacted) * 100)
    },
    activity: activityRes.data ?? [],
    funnel: {
      new: leads.filter(l => l.status === 'new').length,
      contacted,
      responded,
      signed: contracts.filter(c => c.status === 'signed').length
    }
  }
}
