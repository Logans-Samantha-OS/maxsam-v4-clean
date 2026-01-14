import { supabase } from '@/lib/supabase'

export default async function ExecutiveDashboard() {
  const { data: kpi } = await supabase
    .from('v_exec_kpi_snapshot')
    .select('*')
    .single()

  const { data: outcomes } = await supabase
    .from('v_exec_outcome_performance')
    .select('*')

  const { data: profitSeries } = await supabase
    .from('v_exec_profit_timeseries')
    .select('*')

  const { data: agentAttribution } = await supabase
    .from('v_exec_agent_attribution')
    .select('*')

  const { data: lossAnalysis } = await supabase
    .from('v_exec_loss_analysis')
    .select('*')

  return (
    <div style={{ padding: 32 }}>
      <h1>Executive Dashboard</h1>

      <h2>KPI Snapshot</h2>
      <pre>{JSON.stringify(kpi, null, 2)}</pre>

      <h2>Outcome Performance</h2>
      <pre>{JSON.stringify(outcomes, null, 2)}</pre>

      <h2>Profit Timeline</h2>
      <pre>{JSON.stringify(profitSeries, null, 2)}</pre>

      <h2>Agent Attribution</h2>
      <pre>{JSON.stringify(agentAttribution, null, 2)}</pre>

      <h2>Loss Analysis</h2>
      <pre>{JSON.stringify(lossAnalysis, null, 2)}</pre>
    </div>
  )
}
