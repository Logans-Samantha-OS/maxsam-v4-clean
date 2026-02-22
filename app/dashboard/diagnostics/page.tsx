'use client'

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// TYPES
// ============================================================================

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

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

const STATUS_COLORS: Record<string, string> = {
  new: '#6b7280',
  enriched: '#8b5cf6',
  scored: '#3b82f6',
  contacted: '#f59e0b',
  engaged: '#10b981',
  responding: '#10b981',
  qualified: '#ffd700',
  agreement_sent: '#f97316',
  agreement_signed: '#22c55e',
  opted_out: '#ef4444',
  converted: '#22c55e',
  signed: '#22c55e',
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function DiagnosticsPage() {
  const [loading, setLoading] = useState(true)
  const [smsStats, setSmsStats] = useState<SmsStats>({ total: 0, delivered: 0, undelivered: 0, failed: 0, sent: 0, queued: 0, deliveryRate: 0 })
  const [failedMessages, setFailedMessages] = useState<FailedMessage[]>([])
  const [silentLeads, setSilentLeads] = useState<SilentLead[]>([])
  const [leadStats, setLeadStats] = useState<LeadStats>({ total: 0, withPhone: 0, withoutPhone: 0, contacted: 0, notContacted: 0, byStatus: {} })
  const [topLeads, setTopLeads] = useState<TopLead[]>([])

  // Batch trigger state
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResult, setBatchResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Test SMS state
  const [testPhone, setTestPhone] = useState('')
  const [testMessage, setTestMessage] = useState('')
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const fetchDiagnostics = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/deliverability-diagnostics')
      const data = await res.json()
      if (data.success) {
        setSmsStats(data.smsStats)
        setFailedMessages(data.failedMessages)
        setSilentLeads(data.silentLeads)
        setLeadStats(data.leadStats)
        setTopLeads(data.topLeads)
      }
    } catch (err) {
      console.error('Diagnostics fetch error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDiagnostics()
  }, [fetchDiagnostics])

  const sendBatch = async () => {
    setBatchLoading(true)
    setBatchResult(null)
    try {
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', source: 'diagnostics' }),
      })
      if (res.ok) {
        setBatchResult({ type: 'success', message: 'Batch outreach triggered successfully' })
      } else {
        const data = await res.json().catch(() => ({}))
        setBatchResult({ type: 'error', message: data.message || `HTTP ${res.status}` })
      }
    } catch {
      setBatchResult({ type: 'error', message: 'Network error triggering batch' })
    } finally {
      setBatchLoading(false)
    }
  }

  const sendTestSms = async () => {
    if (!testPhone.trim() || !testMessage.trim()) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/sms/send-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: testPhone.trim(), message: testMessage.trim() }),
      })
      const data = await res.json()
      if (data.success) {
        setTestResult({ type: 'success', message: `Sent! SID: ${data.sid}` })
        setTestPhone('')
        setTestMessage('')
      } else {
        setTestResult({ type: 'error', message: data.error || 'Failed to send' })
      }
    } catch {
      setTestResult({ type: 'error', message: 'Network error sending test SMS' })
    } finally {
      setTestLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-zinc-400 flex items-center gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
          Loading diagnostics...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <span className="text-cyan-400">🔬</span> Deliverability Diagnostics
          </h1>
          <p className="text-sm text-zinc-400">SMS delivery health, lead coverage, and outreach tools</p>
        </div>
        <button
          onClick={fetchDiagnostics}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium text-zinc-200 flex items-center gap-2"
        >
          <span>↻</span> Refresh
        </button>
      </div>

      {/* ================================================================== */}
      {/* SMS DELIVERY STATS */}
      {/* ================================================================== */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">SMS Delivery Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total Sent" value={smsStats.total} color="cyan" />
          <StatCard label="Delivered" value={smsStats.delivered} color="green" />
          <StatCard label="Undelivered" value={smsStats.undelivered} color="yellow" />
          <StatCard label="Failed" value={smsStats.failed} color="red" />
          <StatCard label="Sent (pending)" value={smsStats.sent} color="blue" />
          <StatCard
            label="Delivery Rate"
            value={`${smsStats.deliveryRate}%`}
            color={smsStats.deliveryRate >= 90 ? 'green' : smsStats.deliveryRate >= 70 ? 'yellow' : 'red'}
          />
        </div>
      </section>

      {/* ================================================================== */}
      {/* FAILED MESSAGES */}
      {/* ================================================================== */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">
          Failed / Undelivered Messages ({failedMessages.length})
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {failedMessages.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No failed messages found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">To</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Lead</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Error Code</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Error</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Message</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">When</th>
                  </tr>
                </thead>
                <tbody>
                  {failedMessages.map((msg) => (
                    <tr key={msg.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 text-sm text-zinc-300">{formatPhone(msg.to_number)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-300">{msg.lead_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-400">
                          {msg.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono text-red-400">{msg.error_code || '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400 max-w-[200px] truncate">{msg.error_message || '—'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400 max-w-[200px] truncate">{msg.message}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500">{timeAgo(msg.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* SILENT LEADS (contacted, never replied) */}
      {/* ================================================================== */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">
          Silent Leads — Contacted But Never Replied ({silentLeads.length})
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {silentLeads.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">No silent leads found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Excess Funds</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Last Contacted</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Attempts</th>
                  </tr>
                </thead>
                <tbody>
                  {silentLeads.map((lead) => (
                    <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 text-sm text-zinc-200 font-medium">{lead.owner_name}</td>
                      <td className="px-4 py-3 text-sm text-cyan-400">{formatPhone(lead.phone)}</td>
                      <td className="px-4 py-3 text-sm text-green-400 font-semibold">{formatCurrency(lead.excess_funds_amount)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-500">{timeAgo(lead.last_contacted_at)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-400">{lead.contact_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* LEAD COVERAGE STATS */}
      {/* ================================================================== */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">Lead Coverage</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
          <StatCard label="With Phone" value={leadStats.withPhone} color="green" subtext={`of ${leadStats.total}`} />
          <StatCard label="Without Phone" value={leadStats.withoutPhone} color="red" subtext={`of ${leadStats.total}`} />
          <StatCard label="Contacted" value={leadStats.contacted} color="cyan" subtext={`of ${leadStats.withPhone} with phone`} />
          <StatCard label="Not Contacted" value={leadStats.notContacted} color="yellow" subtext={`of ${leadStats.withPhone} with phone`} />
        </div>

        {/* Status breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-3 uppercase tracking-wider">Status Breakdown</h3>
          <div className="space-y-2">
            {Object.entries(leadStats.byStatus)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = leadStats.total > 0 ? Math.round((count / leadStats.total) * 100) : 0
                const color = STATUS_COLORS[status] || '#6b7280'
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="text-sm text-zinc-400 w-40 truncate capitalize">{status.replace(/_/g, ' ')}</span>
                    <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden">
                      <div
                        className="h-full rounded transition-all duration-500 flex items-center px-2"
                        style={{ width: `${Math.max(pct, count > 0 ? 3 : 0)}%`, background: color + '80' }}
                      >
                        {pct >= 5 && <span className="text-xs text-white font-medium">{count}</span>}
                      </div>
                    </div>
                    <span className="text-xs text-zinc-500 w-16 text-right">{count} ({pct}%)</span>
                  </div>
                )
              })}
          </div>
        </div>
      </section>

      {/* ================================================================== */}
      {/* TOP 20 UNCONTACTED LEADS */}
      {/* ================================================================== */}
      <section>
        <h2 className="text-lg font-semibold text-zinc-200 mb-3">
          Top 20 Highest-Value Uncontacted Leads
        </h2>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          {topLeads.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">All leads have been contacted</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Excess Funds</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Eleanor</th>
                  </tr>
                </thead>
                <tbody>
                  {topLeads.map((lead, i) => (
                    <tr key={lead.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                      <td className="px-4 py-3 text-sm text-zinc-500">{i + 1}</td>
                      <td className="px-4 py-3 text-sm text-zinc-200 font-medium">{lead.owner_name || 'Unknown'}</td>
                      <td className="px-4 py-3 text-sm text-cyan-400">
                        {lead.phone ? formatPhone(lead.phone) : <span className="text-red-400">No phone</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-green-400 font-bold">{formatCurrency(lead.excess_funds_amount)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="text-xs px-2 py-1 rounded-full capitalize"
                          style={{
                            background: (STATUS_COLORS[lead.status] || '#6b7280') + '20',
                            color: STATUS_COLORS[lead.status] || '#6b7280',
                          }}
                        >
                          {lead.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-300">
                        {lead.eleanor_score !== null ? `${lead.eleanor_score} (${lead.eleanor_grade || '?'})` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ================================================================== */}
      {/* ACTIONS: Send Batch + Test SMS */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Send Next Batch */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">Send Next Batch</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Triggers the SAM initial outreach workflow via n8n webhook.
          </p>
          <button
            onClick={sendBatch}
            disabled={batchLoading}
            className="w-full py-3 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white"
          >
            {batchLoading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </span>
            ) : (
              'Send Next Batch'
            )}
          </button>
          {batchResult && (
            <div
              className={`mt-3 px-3 py-2 rounded text-sm ${
                batchResult.type === 'success'
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : 'bg-red-500/20 text-red-400 border border-red-500/30'
              }`}
            >
              {batchResult.message}
            </div>
          )}
        </section>

        {/* Send Test SMS */}
        <section className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-zinc-200 mb-2">Send Test SMS</h2>
          <p className="text-sm text-zinc-400 mb-4">
            Send a test message from +1 (844) 963-2549 to any number.
          </p>
          <div className="space-y-3">
            <input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="Phone number (e.g. 2145551234)"
              className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-cyan-500"
            />
            <textarea
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              placeholder="Type your test message..."
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 text-zinc-200 focus:outline-none focus:border-cyan-500 resize-none"
            />
            <button
              onClick={sendTestSms}
              disabled={testLoading || !testPhone.trim() || !testMessage.trim()}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              {testLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sending...
                </span>
              ) : (
                'Send Test SMS'
              )}
            </button>
            {testResult && (
              <div
                className={`px-3 py-2 rounded text-sm ${
                  testResult.type === 'success'
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                    : 'bg-red-500/20 text-red-400 border border-red-500/30'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({ label, value, color, subtext }: { label: string; value: string | number; color: string; subtext?: string }) {
  const colorMap: Record<string, { bg: string; border: string; text: string }> = {
    cyan: { bg: 'from-cyan-500/20 to-cyan-600/10', border: 'border-cyan-500/30', text: 'text-cyan-400' },
    green: { bg: 'from-green-500/20 to-green-600/10', border: 'border-green-500/30', text: 'text-green-400' },
    red: { bg: 'from-red-500/20 to-red-600/10', border: 'border-red-500/30', text: 'text-red-400' },
    yellow: { bg: 'from-yellow-500/20 to-yellow-600/10', border: 'border-yellow-500/30', text: 'text-yellow-400' },
    blue: { bg: 'from-blue-500/20 to-blue-600/10', border: 'border-blue-500/30', text: 'text-blue-400' },
  }
  const c = colorMap[color] || colorMap.cyan
  return (
    <div className={`bg-gradient-to-br ${c.bg} border ${c.border} rounded-xl p-4`}>
      <span className="text-zinc-400 text-xs">{label}</span>
      <p className={`text-2xl font-bold ${c.text} mt-1`}>{value}</p>
      {subtext && <p className="text-[10px] text-zinc-500 mt-0.5">{subtext}</p>}
    </div>
  )
}
