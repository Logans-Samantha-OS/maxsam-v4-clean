'use client'

import { useState, useEffect, useCallback } from 'react'
import GovernanceCommandCenter from '@/components/governance/CommandCenter'

// ============================================================================
// TYPES
// ============================================================================

interface Pipeline {
  total_leads: number
  with_phone: number
  contacted: number
  responded: number
  agreement_sent: number
  signed: number
  pipeline_value: number
  potential_fee: number
}

interface TodayStats {
  sms_sent: number
  responses: number
}

interface RecentSms {
  id: string
  owner_name: string
  phone: string
  excess_amount: number
  eleanor_grade: string
  sent_at: string
  status: string
}

interface RecentReply {
  id: string
  owner_name: string
  phone: string
  message: string
  excess_amount: number
  received_at: string
}

interface OpsData {
  pipeline: Pipeline
  today: TodayStats
  recent_sms: RecentSms[]
  recent_replies: RecentReply[]
  workflows: { name: string; active: boolean }[]
  open_issues: { issue: string; severity: string; detail: string }[]
}

interface SmsStats {
  total: number
  delivered: number
  undelivered: number
  failed: number
  sent: number
  queued: number
  deliveryRate: number
}

interface FailedMessage {
  id: string
  to_number: string
  message: string
  status: string
  error_code: string | null
  error_message: string | null
  created_at: string
  lead_name: string | null
}

interface SilentLead {
  id: string
  owner_name: string
  phone: string
  excess_funds_amount: number
  last_contacted_at: string
  contact_count: number
}

interface LeadStats {
  total: number
  withPhone: number
  withoutPhone: number
  contacted: number
  notContacted: number
  byStatus: Record<string, number>
}

interface TopLead {
  id: string
  owner_name: string
  phone: string | null
  excess_funds_amount: number
  status: string
  eleanor_score: number | null
  eleanor_grade: string | null
}

// ============================================================================
// HELPERS
// ============================================================================

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`
  return `$${n.toLocaleString()}`
}

function fmtPhone(phone: string): string {
  const d = phone.replace(/\D/g, '')
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
  if (d.length === 11) return `+${d[0]} (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`
  return phone
}

function ago(dateStr: string): string {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  return `${days}d`
}

const STATUS_COLORS: Record<string, string> = {
  new: '#6b7280', enriched: '#8b5cf6', scored: '#3b82f6', contacted: '#f59e0b',
  engaged: '#10b981', responding: '#10b981', qualified: '#ffd700',
  agreement_sent: '#f97316', agreement_signed: '#22c55e', opted_out: '#ef4444',
  converted: '#22c55e', signed: '#22c55e',
}

// ============================================================================
// COLLAPSIBLE SECTION
// ============================================================================

function Section({ title, icon, children, defaultOpen = true }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/50 transition-colors"
      >
        <span className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
          <span>{icon}</span> {title}
        </span>
        <span className="text-zinc-500 text-xl transition-transform" style={{ transform: open ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          ▾
        </span>
      </button>
      {open && <div className="px-5 pb-5 space-y-4">{children}</div>}
    </section>
  )
}

// ============================================================================
// STAT CARD
// ============================================================================

function Stat({ label, value, color = 'cyan', sub }: {
  label: string; value: string | number; color?: string; sub?: string
}) {
  const colors: Record<string, { bg: string; border: string; text: string }> = {
    cyan: { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    green: { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/30', text: 'text-green-400' },
    red: { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', text: 'text-red-400' },
    yellow: { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    blue: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
    purple: { bg: 'from-purple-500/20 to-purple-600/10', border: 'border-purple-500/30', text: 'text-purple-400' },
  }
  const c = colors[color] || colors.cyan
  return (
    <div className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-xl p-3`}>
      <span className="text-zinc-400 text-xs">{label}</span>
      <p className={`text-xl font-bold ${c.text} mt-0.5`}>{value}</p>
      {sub && <p className="text-[10px] text-zinc-500 mt-0.5">{sub}</p>}
    </div>
  )
}

// ============================================================================
// MAIN
// ============================================================================

export default function UnifiedDashboard() {
  const [loading, setLoading] = useState(true)

  // Ops data
  const [ops, setOps] = useState<OpsData | null>(null)

  // Diagnostics data
  const [smsStats, setSmsStats] = useState<SmsStats>({ total: 0, delivered: 0, undelivered: 0, failed: 0, sent: 0, queued: 0, deliveryRate: 0 })
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([])
  const [silentLeads, setSilentLeads] = useState<SilentLead[]>([])
  const [leadStats, setLeadStats] = useState<LeadStats>({ total: 0, withPhone: 0, withoutPhone: 0, contacted: 0, notContacted: 0, byStatus: {} })
  const [topLeads, setTopLeads] = useState<TopLead[]>([])

  // Actions
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    const [opsRes, diagRes] = await Promise.all([
      fetch('/api/ops-dashboard').then(r => r.json()).catch(() => null),
      fetch('/api/deliverability-diagnostics').then(r => r.json()).catch(() => null),
    ])
    if (opsRes) setOps(opsRes)
    if (diagRes?.success) {
      setSmsStats(diagRes.smsStats)
      setFailedMessages(diagRes.failedMessages)
      setSilentLeads(diagRes.silentLeads)
      setLeadStats(diagRes.leadStats)
      setTopLeads(diagRes.topLeads)
    }
    setLoading(false)
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const sendBatch = async () => {
    setBatchLoading(true); setBatchResult(null)
    try {
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', source: 'dashboard' }),
      })
      setBatchResult(res.ok ? { type: 'success', msg: 'Batch triggered' } : { type: 'error', msg: `HTTP ${res.status}` })
    } catch { setBatchResult({ type: 'error', msg: 'Network error' }) }
    finally { setBatchLoading(false) }
  }

  const sendTest = async () => {
    if (!testPhone.trim() || !testMsg.trim()) return
    setTestLoading(true); setTestResult(null)
    try {
      const res = await fetch('/api/sms/send-test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim(), message: testMsg.trim() }),
      })
      const data = await res.json()
      if (data.success) { setTestResult({ type: 'success', msg: `Sent! SID: ${data.sid}` }); setTestPhone(''); setTestMsg('') }
      else setTestResult({ type: 'error', msg: data.error || 'Failed' })
    } catch { setTestResult({ type: 'error', msg: 'Network error' }) }
    finally { setTestLoading(false) }
  }

  const p = ops?.pipeline || { total_leads: 0, with_phone: 0, contacted: 0, responded: 0, agreement_sent: 0, signed: 0, pipeline_value: 0, potential_fee: 0 }
  const today = ops?.today || { sms_sent: 0, responses: 0 }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-zinc-400 flex items-center gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
          Loading dashboard...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-100">MaxSam Dashboard</h1>
        <button onClick={fetchAll} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-200 flex items-center gap-2">
          <span>↻</span> Refresh
        </button>
      </div>

      {/* ================================================================ */}
      {/* 1. PIPELINE OVERVIEW */}
      {/* ================================================================ */}
      <Section title="Pipeline Overview" icon="📊">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
          <Stat label="Total Leads" value={p.total_leads} />
          <Stat label="With Phone" value={p.with_phone} color="green" />
          <Stat label="Contacted" value={p.contacted} color="yellow" />
          <Stat label="Responded" value={p.responded} color="purple" />
          <Stat label="Agreement Sent" value={p.agreement_sent} color="blue" />
          <Stat label="Signed" value={p.signed} color="green" />
          <Stat label="Pipeline Value" value={fmt$(p.pipeline_value)} color="green" />
          <Stat label="Potential Fee" value={fmt$(p.potential_fee)} color="cyan" sub="25% of pipeline" />
        </div>

        {/* Funnel bars */}
        <div className="space-y-2 mt-2">
          {[
            { label: 'Total Leads', val: p.total_leads, color: 'bg-cyan-500' },
            { label: 'With Phone', val: p.with_phone, color: 'bg-blue-500' },
            { label: 'Contacted', val: p.contacted, color: 'bg-yellow-500' },
            { label: 'Responded', val: p.responded, color: 'bg-purple-500' },
            { label: 'Agreement Sent', val: p.agreement_sent, color: 'bg-orange-500' },
            { label: 'Signed', val: p.signed, color: 'bg-green-500' },
          ].map(s => {
            const pct = p.total_leads > 0 ? Math.round((s.val / p.total_leads) * 100) : 0
            return (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-28">{s.label}</span>
                <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                  <div className={`h-full ${s.color} rounded transition-all duration-500 flex items-center px-2`}
                    style={{ width: `${Math.max(pct, s.val > 0 ? 2 : 0)}%` }}>
                    {pct >= 5 && <span className="text-[10px] text-white font-medium">{s.val}</span>}
                  </div>
                </div>
                <span className="text-xs text-zinc-500 w-14 text-right">{s.val} ({pct}%)</span>
              </div>
            )
          })}
        </div>

        {/* Today's activity */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          <Stat label="SMS Sent Today" value={today.sms_sent} color="blue" />
          <Stat label="Replies Today" value={today.responses} color="green" />
        </div>

        {/* Top 20 uncontacted */}
        {topLeads.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2 mt-2">Top 20 Uncontacted by Value</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">#</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Name</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Phone</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Amount</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Eleanor</th>
                  </tr>
                </thead>
                <tbody>
                  {topLeads.map((l, i) => (
                    <tr key={l.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-xs text-zinc-500">{i + 1}</td>
                      <td className="px-3 py-2 text-sm text-zinc-200">{l.owner_name}</td>
                      <td className="px-3 py-2 text-sm text-cyan-400">{l.phone ? fmtPhone(l.phone) : <span className="text-red-400">—</span>}</td>
                      <td className="px-3 py-2 text-sm text-green-400 font-semibold">{fmt$(l.excess_funds_amount)}</td>
                      <td className="px-3 py-2 text-sm text-zinc-300">{l.eleanor_score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      {/* ================================================================ */}
      {/* 2. SMS DIAGNOSTICS */}
      {/* ================================================================ */}
      <Section title="SMS Diagnostics" icon="📱">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <Stat label="Total Sent" value={smsStats.total} />
          <Stat label="Delivered" value={smsStats.delivered} color="green" />
          <Stat label="Undelivered" value={smsStats.undelivered} color="yellow" />
          <Stat label="Failed" value={smsStats.failed} color="red" />
          <Stat label="Pending" value={smsStats.sent} color="blue" />
          <Stat label="Delivery Rate" value={`${smsStats.deliveryRate}%`} color={smsStats.deliveryRate >= 90 ? 'green' : smsStats.deliveryRate >= 70 ? 'yellow' : 'red'} />
        </div>

        {/* Failed messages */}
        {failedMessages.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Failed / Undelivered ({failedMessages.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">To</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Lead</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Status</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Error</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Code</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">When</th>
                  </tr>
                </thead>
                <tbody>
                  {failedMessages.map(m => (
                    <tr key={m.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-sm text-zinc-300">{fmtPhone(m.to_number)}</td>
                      <td className="px-3 py-2 text-sm text-zinc-300">{m.lead_name || '—'}</td>
                      <td className="px-3 py-2"><span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400">{m.status}</span></td>
                      <td className="px-3 py-2 text-xs text-zinc-400 max-w-[180px] truncate">{m.error_message || '—'}</td>
                      <td className="px-3 py-2 text-xs font-mono text-red-400">{m.error_code || '—'}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{ago(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Silent leads */}
        {silentLeads.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Silent Leads — Never Replied ({silentLeads.length})</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Name</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Phone</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Amount</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Last Contacted</th>
                    <th className="px-3 py-2 text-left text-xs text-zinc-500">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {silentLeads.map(l => (
                    <tr key={l.id} className="border-b border-zinc-800/40 hover:bg-zinc-800/30">
                      <td className="px-3 py-2 text-sm text-zinc-200">{l.owner_name}</td>
                      <td className="px-3 py-2 text-sm text-cyan-400">{fmtPhone(l.phone)}</td>
                      <td className="px-3 py-2 text-sm text-green-400 font-semibold">{fmt$(l.excess_funds_amount)}</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{ago(l.last_contacted_at)}</td>
                      <td className="px-3 py-2 text-sm text-zinc-400">{l.contact_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Send batch + test SMS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-2">Send Next Batch</h3>
            <button onClick={sendBatch} disabled={batchLoading}
              className="w-full py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white disabled:opacity-50">
              {batchLoading ? 'Sending...' : 'Send Next Batch'}
            </button>
            {batchResult && <p className={`mt-2 text-xs ${batchResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{batchResult.msg}</p>}
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-zinc-200 mb-2">Send Test SMS</h3>
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="Phone (e.g. 2145551234)"
              className="w-full rounded px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 text-zinc-200 mb-2 focus:outline-none focus:border-cyan-500" />
            <textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Message..." rows={2}
              className="w-full rounded px-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 text-zinc-200 mb-2 resize-none focus:outline-none focus:border-cyan-500" />
            <button onClick={sendTest} disabled={testLoading || !testPhone.trim() || !testMsg.trim()}
              className="w-full py-2 rounded-lg text-sm font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50">
              {testLoading ? 'Sending...' : 'Send Test SMS'}
            </button>
            {testResult && <p className={`mt-2 text-xs ${testResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>{testResult.msg}</p>}
          </div>
        </div>
      </Section>

      {/* ================================================================ */}
      {/* 3. LEAD COVERAGE */}
      {/* ================================================================ */}
      <Section title="Lead Coverage" icon="📋">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="With Phone" value={leadStats.withPhone} color="green" sub={`of ${leadStats.total}`} />
          <Stat label="Without Phone" value={leadStats.withoutPhone} color="red" sub={`of ${leadStats.total}`} />
          <Stat label="Contacted" value={leadStats.contacted} color="cyan" sub={`of ${leadStats.withPhone} w/ phone`} />
          <Stat label="Not Contacted" value={leadStats.notContacted} color="yellow" sub={`of ${leadStats.withPhone} w/ phone`} />
        </div>

        {/* Status breakdown */}
        <div className="space-y-1.5">
          <h3 className="text-sm font-semibold text-zinc-300">Status Breakdown</h3>
          {Object.entries(leadStats.byStatus).sort(([, a], [, b]) => b - a).map(([status, count]) => {
            const pct = leadStats.total > 0 ? Math.round((count / leadStats.total) * 100) : 0
            const color = STATUS_COLORS[status] || '#6b7280'
            return (
              <div key={status} className="flex items-center gap-3">
                <span className="text-xs text-zinc-400 w-32 truncate capitalize">{status.replace(/_/g, ' ')}</span>
                <div className="flex-1 h-5 bg-zinc-800 rounded overflow-hidden">
                  <div className="h-full rounded transition-all duration-500 flex items-center px-2"
                    style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%`, background: color + '80' }}>
                    {pct >= 5 && <span className="text-[10px] text-white font-medium">{count}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-zinc-500 w-14 text-right">{count} ({pct}%)</span>
              </div>
            )
          })}
        </div>
      </Section>

      {/* ================================================================ */}
      {/* 4. RECENT ACTIVITY */}
      {/* ================================================================ */}
      <Section title="Recent Activity" icon="⚡" defaultOpen={false}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Recent outbound */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Recent SMS Sent ({ops?.recent_sms?.length || 0})</h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {(ops?.recent_sms || []).map(s => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-zinc-800/50 rounded text-sm">
                  <div>
                    <span className="text-zinc-200">{s.owner_name}</span>
                    <span className="text-zinc-500 ml-2 text-xs">{fmtPhone(s.phone)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-green-400 text-xs font-medium">{fmt$(s.excess_amount)}</span>
                    <span className={`w-2 h-2 rounded-full ${s.status === 'delivered' ? 'bg-green-500' : s.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    <span className="text-zinc-500 text-xs">{ago(s.sent_at)}</span>
                  </div>
                </div>
              ))}
              {(!ops?.recent_sms || ops.recent_sms.length === 0) && <p className="text-zinc-500 text-sm text-center py-4">No recent SMS</p>}
            </div>
          </div>

          {/* Recent inbound */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Recent Replies ({ops?.recent_replies?.length || 0})</h3>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {(ops?.recent_replies || []).map(r => (
                <div key={r.id} className="p-2 bg-zinc-800/50 rounded text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-200">{r.owner_name}</span>
                    <span className="text-green-400 text-xs font-medium">{fmt$(r.excess_amount)}</span>
                  </div>
                  <p className="text-zinc-400 text-xs mt-1 truncate">{r.message}</p>
                  <span className="text-zinc-600 text-[10px]">{ago(r.received_at)}</span>
                </div>
              ))}
              {(!ops?.recent_replies || ops.recent_replies.length === 0) && <p className="text-zinc-500 text-sm text-center py-4">No replies yet</p>}
            </div>
          </div>
        </div>

        {/* Open issues */}
        {ops?.open_issues && ops.open_issues.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Open Issues</h3>
            <div className="space-y-1.5">
              {ops.open_issues.map((issue, i) => (
                <div key={i} className="flex items-center gap-3 p-2 bg-zinc-800/50 rounded text-sm">
                  <span className={`w-2 h-2 rounded-full ${issue.severity === 'high' ? 'bg-red-500' : issue.severity === 'medium' ? 'bg-yellow-500' : 'bg-blue-500'}`} />
                  <span className="text-zinc-200">{issue.issue}</span>
                  <span className="text-zinc-500 text-xs ml-auto">{issue.detail}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ================================================================ */}
      {/* 5. SYSTEM HEALTH */}
      {/* ================================================================ */}
      <Section title="System Health" icon="🛡️" defaultOpen={false}>
        <GovernanceCommandCenter />
      </Section>
    </div>
  )
}
