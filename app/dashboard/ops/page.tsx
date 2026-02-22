'use client'

import { useEffect, useMemo, useState } from 'react'

type OpsData = {
  pipeline: {
    total_leads: number
    with_phone: number
    contacted: number
    responded: number
    agreement_sent: number
    signed: number
    golden_leads: number
    pipeline_value: number
    potential_fee: number
  }
  today: {
    sms_sent: number
    sms_value: number
    responses: number
    agreements_sent: number
    agreements_signed: number
  }
  recent_sms: Array<{
    id: string
    lead_id: string | null
    owner_name: string
    phone: string
    excess_amount: number
    case_number: string
    eleanor_grade: string
    eleanor_score: number
    sent_at: string
    status: string
  }>
  recent_replies: Array<{
    id: string
    lead_id: string | null
    owner_name: string
    phone: string
    message: string
    intent: string
    excess_amount: number
    received_at: string
  }>
  workflows: Array<{ name: string; id: string; active: boolean; last_run: string | null }>
  open_issues: Array<{ issue: string; severity: 'high' | 'medium' | 'low'; detail: string }>
}

const tabs = ['overview', 'sms', 'replies', 'workflows', 'issues'] as const
type Tab = (typeof tabs)[number]

const statusDot = (status: string) => {
  const value = status.toLowerCase()
  if (value.includes('deliver')) return 'bg-emerald-400'
  if (value.includes('fail') || value.includes('undeliver')) return 'bg-red-400'
  return 'bg-amber-400'
}

export default function OpsDashboardPage() {
  const [tab, setTab] = useState<Tab>('overview')
  const [data, setData] = useState<OpsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [smsFilter, setSmsFilter] = useState<'all' | 'replied' | 'failed' | 'pending'>('all')
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/ops-dashboard', { cache: 'no-store' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Failed to load ops dashboard')
        setData(body)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load ops dashboard')
      }
    }

    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])

  const repliedPhones = useMemo(() => new Set((data?.recent_replies || []).map((r) => r.phone)), [data])

  const filteredSms = useMemo(() => {
    if (!data) return []
    if (smsFilter === 'replied') return data.recent_sms.filter((sms) => repliedPhones.has(sms.phone))
    if (smsFilter === 'failed') return data.recent_sms.filter((sms) => sms.status.toLowerCase().includes('fail') || sms.status.toLowerCase().includes('undeliver'))
    if (smsFilter === 'pending') return data.recent_sms.filter((sms) => !(sms.status.toLowerCase().includes('deliver') || sms.status.toLowerCase().includes('fail') || sms.status.toLowerCase().includes('undeliver')))
    return data.recent_sms
  }, [data, repliedPhones, smsFilter])

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Live Ops Dashboard</h1>
        <p className="text-sm text-gray-400">Auto-refreshing every 30 seconds</p>
      </div>

      <div className="flex gap-2 border-b border-gray-700 pb-3">
        {tabs.map((item) => (
          <button
            key={item}
            onClick={() => setTab(item)}
            className={`px-3 py-1.5 rounded text-sm capitalize ${tab === item ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {error && <div className="rounded border border-red-700 bg-red-900/30 p-3 text-sm">{error}</div>}
      {!data && !error && <div className="text-gray-400">Loading...</div>}

      {data && tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <Card label="Pipeline Value" value={`$${Math.round(data.pipeline.pipeline_value).toLocaleString()}`} />
            <Card label="Total Leads" value={data.pipeline.total_leads} />
            <Card label="Contacted" value={data.pipeline.contacted} />
            <Card label="SMS Sent Today" value={data.today.sms_sent} />
            <Card label="Replies" value={data.today.responses} />
          </div>
          <div className="rounded bg-gray-800 border border-gray-700 p-4">
            <h2 className="font-medium mb-3">Pipeline Funnel</h2>
            <Funnel label="Extracted" value={data.pipeline.total_leads} max={data.pipeline.total_leads} />
            <Funnel label="Scored" value={data.pipeline.with_phone} max={data.pipeline.total_leads} />
            <Funnel label="Outreach" value={data.pipeline.contacted} max={data.pipeline.total_leads} />
            <Funnel label="Replied" value={data.pipeline.responded} max={data.pipeline.total_leads} />
            <Funnel label="Agreement" value={data.pipeline.agreement_sent} max={data.pipeline.total_leads} />
            <Funnel label="Closed" value={data.pipeline.signed} max={data.pipeline.total_leads} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <StatusCard name="ALEX" status="active" />
            <StatusCard name="ELEANOR" status="active" />
            <StatusCard name="SAM" status="active" />
          </div>
        </div>
      )}

      {data && tab === 'sms' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            {(['all', 'replied', 'failed', 'pending'] as const).map((filter) => (
              <button key={filter} className={`px-3 py-1 rounded text-xs ${smsFilter === filter ? 'bg-gray-700' : 'bg-gray-800 text-gray-300'}`} onClick={() => setSmsFilter(filter)}>
                {filter}
              </button>
            ))}
          </div>
          {filteredSms.map((sms) => {
            const replies = data.recent_replies.filter((reply) => reply.phone === sms.phone)
            const isOpen = expanded[sms.id]
            return (
              <div key={sms.id} className="rounded border border-gray-700 bg-gray-800 p-3">
                <button className="w-full text-left" onClick={() => setExpanded((prev) => ({ ...prev, [sms.id]: !prev[sms.id] }))}>
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium">{sms.owner_name}</div>
                      <div className="text-xs text-gray-400">{sms.phone} • Case {sms.case_number || 'N/A'} • {sms.eleanor_grade}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400">${Math.round(sms.excess_amount).toLocaleString()}</div>
                      <div className="text-xs text-gray-400 flex items-center justify-end gap-1"><span className={`w-2 h-2 rounded-full ${statusDot(sms.status)}`} />{sms.status}</div>
                    </div>
                  </div>
                </button>
                {isOpen && (
                  <div className="mt-3 border-t border-gray-700 pt-3 space-y-2">
                    <div className="text-sm bg-blue-900/40 p-2 rounded">Outbound: {sms.sent_at}</div>
                    {replies.map((reply) => (
                      <div key={reply.id} className="text-sm bg-gray-700 p-2 rounded">Inbound: {reply.message}</div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {data && tab === 'replies' && (
        <div className="space-y-2">
          {data.recent_replies.map((reply) => (
            <div key={reply.id} className="rounded border border-gray-700 bg-gray-800 p-3">
              <div className="flex justify-between">
                <div>
                  <div className="font-medium">{reply.owner_name}</div>
                  <div className="text-xs text-gray-400">{reply.phone} • ${Math.round(reply.excess_amount).toLocaleString()}</div>
                </div>
                <div className="text-xs text-gray-400">{new Date(reply.received_at).toLocaleString()}</div>
              </div>
              <p className="mt-2 text-sm">{reply.message}</p>
              <div className="flex gap-2 mt-3">
                {['Send Agreement', 'Opt Out', 'Needs Follow-Up', 'Verify Records'].map((action) => (
                  <button key={action} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">{action}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {data && tab === 'workflows' && (
        <div className="space-y-2">
          {data.workflows.map((workflow) => (
            <div key={workflow.id} className="rounded border border-gray-700 bg-gray-800 p-3 flex justify-between">
              <div>
                <div className="font-medium">{workflow.name}</div>
                <div className="text-xs text-gray-400">{workflow.id}</div>
              </div>
              <div className={workflow.active ? 'text-emerald-400' : 'text-red-400'}>{workflow.active ? 'Active' : 'Inactive'}</div>
            </div>
          ))}
        </div>
      )}

      {data && tab === 'issues' && (
        <div className="space-y-2">
          {data.open_issues.map((issue) => (
            <div key={issue.issue} className="rounded border border-gray-700 bg-gray-800 p-3">
              <div className="flex justify-between">
                <div className="font-medium">{issue.issue}</div>
                <span className="text-xs uppercase">{issue.severity}</span>
              </div>
              <p className="text-sm text-gray-400 mt-1">{issue.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Card({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded bg-gray-800 border border-gray-700 p-4"><div className="text-xs text-gray-400">{label}</div><div className="text-xl font-semibold mt-1">{value}</div></div>
}

function Funnel({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = max > 0 ? Math.max(4, Math.round((value / max) * 100)) : 0
  return <div className="mb-2"><div className="flex justify-between text-xs text-gray-400"><span>{label}</span><span>{value}</span></div><div className="h-2 bg-gray-700 rounded"><div className="h-2 bg-blue-500 rounded" style={{ width: `${pct}%` }} /></div></div>
}

function StatusCard({ name, status }: { name: string; status: 'active' | 'inactive' }) {
  return <div className="rounded border border-gray-700 bg-gray-800 p-3 flex justify-between"><span>{name}</span><span className={status === 'active' ? 'text-emerald-400' : 'text-red-400'}>{status}</span></div>
}
