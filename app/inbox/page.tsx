'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Lead {
  id: string
  owner_name: string
  phone: string | null
  status: string
  county: string | null
  excess_funds_amount: number | null
  case_number: string | null
  property_address: string | null
  expiry_date: string | null
  eleanor_score: number | null
  eleanor_grade: string | null
  is_golden_lead: boolean
  last_sms_sent: string | null
  last_sms_at: string | null
  sms_sent_count: number | null
  sms_opt_out: boolean
}

interface Message {
  lead_id: string
  direction: string
  content: string
  from_number: string | null
  to_number: string | null
  status: string | null
  created_at: string
}

type FilterType = 'all' | 'replied' | 'failed' | 'no_reply' | 'golden'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES = ['contacted', 'responded', 'negotiating', 'agreement_sent', 'signed', 'closed']

const FILTERS: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'replied', label: 'Replied' },
  { key: 'failed', label: 'Failed' },
  { key: 'no_reply', label: 'No Reply' },
  { key: 'golden', label: '\u2B50 Golden' },
]

const STATUS_BADGE: Record<string, string> = {
  contacted:      'bg-blue-500/20 text-blue-400 border border-blue-500/30',
  responded:      'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
  negotiating:    'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  agreement_sent: 'bg-purple-500/20 text-purple-400 border border-purple-500/30',
  signed:         'bg-teal-500/20 text-teal-400 border border-teal-500/30',
  closed:         'bg-green-400/20 text-green-300 border border-green-400/30',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

function fmtCurrency(amount: number | null): string {
  if (!amount) return '$0'
  return '$' + Math.round(amount).toLocaleString()
}

function deliveryIcon(status: string | null): string {
  if (!status) return '\u2022'
  const s = status.toLowerCase()
  if (s === 'delivered') return '\u2713\u2713'
  if (s === 'failed' || s === 'undelivered') return '\u2715'
  if (s === 'sent') return '\u2713'
  if (s === 'received') return '\u25CF'
  return '\u2022'
}

function deliveryColor(status: string | null): string {
  if (!status) return 'text-zinc-500'
  const s = status.toLowerCase()
  if (s === 'delivered') return 'text-emerald-400'
  if (s === 'failed' || s === 'undelivered') return 'text-red-400'
  if (s === 'sent') return 'text-zinc-400'
  return 'text-zinc-500'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InboxPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<FilterType>('all')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // ── Data fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Leads with SMS-relevant statuses
    const { data: leadsData } = await supabase
      .from('leads')
      .select('id, owner_name, phone, status, county, excess_funds_amount, case_number, property_address, expiry_date, eleanor_score, eleanor_grade, is_golden_lead, last_sms_sent, last_sms_at, sms_sent_count, sms_opt_out')
      .in('status', ACTIVE_STATUSES)
      .order('last_sms_sent', { ascending: false, nullsFirst: false })

    // 2. Messages — try `messages` table first, fall back to `sms_log_enhanced`
    let messagesResult: Message[] = []

    const { data: msgData, error: msgError } = await supabase
      .from('messages')
      .select('lead_id, direction, content, from_number, to_number, status, created_at')
      .eq('message_type', 'sms')
      .order('created_at', { ascending: true })
      .limit(5000)

    if (msgError || !msgData || msgData.length === 0) {
      const { data: fallbackData } = await supabase
        .from('sms_log_enhanced')
        .select('lead_id, direction, message_body, phone_from, phone_to, twilio_status, created_at')
        .order('created_at', { ascending: true })
        .limit(5000)

      if (fallbackData) {
        messagesResult = fallbackData.map((m: any) => ({
          lead_id: m.lead_id,
          direction: m.direction,
          content: m.message_body,
          from_number: m.phone_from,
          to_number: m.phone_to,
          status: m.twilio_status,
          created_at: m.created_at,
        }))
      }
    } else {
      messagesResult = msgData
    }

    setLeads(leadsData || [])
    setMessages(messagesResult)
    setLoading(false)
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-scroll chat to bottom on conversation change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [selectedLeadId, messages])

  // ── Derived data ───────────────────────────────────────────────────────

  const messagesByLead = useMemo(() => {
    const map = new Map<string, Message[]>()
    for (const msg of messages) {
      if (!msg.lead_id) continue
      if (!map.has(msg.lead_id)) map.set(msg.lead_id, [])
      map.get(msg.lead_id)!.push(msg)
    }
    return map
  }, [messages])

  const stats = useMemo(() => {
    const outbound = messages.filter(m => m.direction === 'outbound')
    return {
      totalSent: outbound.length,
      delivered: outbound.filter(m => m.status === 'delivered').length,
      failed: outbound.filter(m => m.status === 'failed' || m.status === 'undelivered').length,
      replies: messages.filter(m => m.direction === 'inbound').length,
    }
  }, [messages])

  const leadMeta = useMemo(() => {
    const meta = new Map<string, { hasReply: boolean; hasFailed: boolean; lastMsg: string | null; lastAt: string | null }>()
    for (const [leadId, msgs] of messagesByLead) {
      const hasReply = msgs.some(m => m.direction === 'inbound')
      const hasFailed = msgs.some(m => m.status === 'failed' || m.status === 'undelivered')
      const last = msgs[msgs.length - 1]
      meta.set(leadId, { hasReply, hasFailed, lastMsg: last?.content || null, lastAt: last?.created_at || null })
    }
    return meta
  }, [messagesByLead])

  // ── Filter + search ────────────────────────────────────────────────────

  const filteredLeads = useMemo(() => {
    let result = leads

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(l =>
        l.owner_name?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.county?.toLowerCase().includes(q)
      )
    }

    switch (activeFilter) {
      case 'replied':
        result = result.filter(l => leadMeta.get(l.id)?.hasReply)
        break
      case 'failed':
        result = result.filter(l => leadMeta.get(l.id)?.hasFailed)
        break
      case 'no_reply':
        result = result.filter(l => messagesByLead.has(l.id) && !leadMeta.get(l.id)?.hasReply)
        break
      case 'golden':
        result = result.filter(l => l.is_golden_lead)
        break
    }

    return result
  }, [leads, searchQuery, activeFilter, leadMeta, messagesByLead])

  const selectedLead = leads.find(l => l.id === selectedLeadId) || null
  const selectedMsgs = selectedLeadId ? messagesByLead.get(selectedLeadId) || [] : []

  // ── Actions ────────────────────────────────────────────────────────────

  const handleAction = async (type: 'agreement' | 'followup') => {
    if (!selectedLead) return
    setActionLoading(type)
    try {
      const url = type === 'agreement'
        ? 'https://skooki.app.n8n.cloud/webhook/send-agreement'
        : 'https://skooki.app.n8n.cloud/webhook/sam-initial-outreach'
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: selectedLead.id, name: selectedLead.owner_name }),
      })
    } catch (err) {
      console.error(`${type} action error:`, err)
    }
    setActionLoading(null)
  }

  // ── Loading state ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-zinc-700 border-t-amber-500 rounded-full animate-spin" />
          <span className="text-zinc-500 text-xs tracking-widest uppercase">Loading inbox...</span>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full font-mono text-sm">

      {/* ─── Stats Bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/70 shrink-0" style={{ background: '#0c0e14' }}>
        <StatPill label="SENT" value={stats.totalSent} color="text-zinc-300" />
        <StatPill label="DELIVERED" value={stats.delivered} color="text-emerald-400" />
        <StatPill label="FAILED" value={stats.failed} color="text-red-400" />
        <StatPill label="REPLIES" value={stats.replies} color="text-cyan-400" />
        <div className="ml-auto">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
          >
            <span className="text-base leading-none">{'\u21BB'}</span> Refresh
          </button>
        </div>
      </div>

      {/* ─── Main Split ────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Left Panel ─────────────────────────────────────────── */}
        <div className="w-[380px] flex flex-col border-r border-zinc-800/70 shrink-0">

          {/* Search */}
          <div className="p-3 border-b border-zinc-800/50">
            <input
              type="text"
              placeholder="Search name, phone, county..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 rounded bg-zinc-900/80 border border-zinc-800 text-zinc-200 text-xs placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1.5 px-3 py-2 border-b border-zinc-800/50 overflow-x-auto shrink-0">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`px-2.5 py-1 rounded text-[11px] whitespace-nowrap transition-colors ${
                  activeFilter === f.key
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-zinc-900/60 text-zinc-500 border border-zinc-800 hover:text-zinc-300 hover:border-zinc-600'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Lead Cards */}
          <div className="flex-1 overflow-y-auto">
            {filteredLeads.length === 0 ? (
              <div className="p-6 text-center text-zinc-600 text-xs">No leads match filters</div>
            ) : (
              filteredLeads.map(lead => {
                const meta = leadMeta.get(lead.id)
                const isSelected = lead.id === selectedLeadId
                return (
                  <button
                    key={lead.id}
                    onClick={() => setSelectedLeadId(lead.id)}
                    className={`w-full text-left px-4 py-3 border-b border-zinc-800/40 transition-colors ${
                      isSelected
                        ? 'bg-zinc-800/60 border-l-2 border-l-amber-500'
                        : 'hover:bg-zinc-900/60 border-l-2 border-l-transparent'
                    }`}
                  >
                    {/* Row 1: Name + indicators */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-zinc-100 truncate flex-1">{lead.owner_name}</span>
                      {meta?.hasReply && <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" title="Has reply" />}
                      {meta?.hasFailed && <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" title="Has failed delivery" />}
                      {lead.is_golden_lead && <span className="shrink-0" title="Golden lead">{'\u2B50'}</span>}
                    </div>

                    {/* Row 2: Amount + County + Status */}
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-amber-400/80 text-xs">{fmtCurrency(lead.excess_funds_amount)}</span>
                      {lead.county && <span className="text-zinc-500 text-[11px]">{lead.county}</span>}
                      <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[lead.status] || 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                        {lead.status.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Row 3: Last message preview + time */}
                    <div className="flex items-end gap-2">
                      <span className="text-zinc-500 text-[11px] truncate flex-1">
                        {meta?.lastMsg ? meta.lastMsg.slice(0, 80) : 'No messages'}
                      </span>
                      <span className="text-zinc-600 text-[10px] shrink-0">
                        {timeAgo(meta?.lastAt || lead.last_sms_sent)}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        {/* ── Right Panel ────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0">
          {selectedLead ? (
            <>
              {/* Header */}
              <div className="shrink-0 px-6 py-4 border-b border-zinc-800/70" style={{ background: '#0c0e14' }}>
                {/* Lead Name + Grade */}
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-lg font-bold text-zinc-100">{selectedLead.owner_name}</h2>
                  {selectedLead.eleanor_grade && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                      {selectedLead.eleanor_grade}
                    </span>
                  )}
                  {selectedLead.is_golden_lead && (
                    <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {'\u2B50'} Golden
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[selectedLead.status] || 'bg-zinc-800 text-zinc-500 border border-zinc-700'}`}>
                    {selectedLead.status.replace('_', ' ')}
                  </span>
                </div>

                {/* Details Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400 mb-3">
                  {selectedLead.phone && <span>{'\uD83D\uDCF1'} {selectedLead.phone}</span>}
                  {selectedLead.county && <span>{selectedLead.county}</span>}
                  <span className="text-amber-400/80">{fmtCurrency(selectedLead.excess_funds_amount)}</span>
                  {selectedLead.case_number && <span>Case# {selectedLead.case_number}</span>}
                  {selectedLead.property_address && <span className="truncate max-w-[280px]">{selectedLead.property_address}</span>}
                  {selectedLead.eleanor_score != null && <span>Score: {selectedLead.eleanor_score}</span>}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction('agreement')}
                    disabled={actionLoading === 'agreement'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-purple-500/15 text-purple-400 border border-purple-500/30 hover:bg-purple-500/25 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'agreement' ? 'Sending...' : '\uD83D\uDCC4 Send Agreement'}
                  </button>
                  <button
                    onClick={() => handleAction('followup')}
                    disabled={actionLoading === 'followup'}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/25 transition-colors disabled:opacity-50"
                  >
                    {actionLoading === 'followup' ? 'Sending...' : '\uD83D\uDCF1 Follow Up'}
                  </button>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {selectedMsgs.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <div className="text-zinc-600 text-2xl mb-2">{'\uD83D\uDCED'}</div>
                      <p className="text-zinc-500 text-xs">No messages found &mdash; may be in Twilio only</p>
                    </div>
                  </div>
                ) : (
                  selectedMsgs.map((msg, i) => {
                    const isOutbound = msg.direction === 'outbound'
                    return (
                      <div key={`${msg.created_at}-${i}`} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[70%] rounded-lg px-3.5 py-2.5 ${
                            isOutbound
                              ? 'bg-blue-600/20 border border-blue-500/30 text-zinc-200'
                              : 'bg-zinc-800/60 border border-zinc-700/50 text-zinc-300'
                          }`}
                        >
                          <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-zinc-500">
                              {new Date(msg.created_at).toLocaleString(undefined, {
                                month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
                              })}
                            </span>
                            {isOutbound && (
                              <span className={`text-xs ${deliveryColor(msg.status)}`} title={msg.status || ''}>
                                {deliveryIcon(msg.status)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>
            </>
          ) : (
            /* Empty state — no lead selected */
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-5xl mb-4 opacity-20">{'\uD83D\uDCE8'}</div>
                <p className="text-zinc-500 text-sm mb-1">Select a conversation</p>
                <p className="text-zinc-600 text-xs">Choose a lead from the left panel to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat Pill Sub-component
// ---------------------------------------------------------------------------

function StatPill({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-900/60 border border-zinc-800/60">
      <span className="text-[10px] text-zinc-500 tracking-wider uppercase">{label}</span>
      <span className={`text-sm font-bold tabular-nums ${color}`}>{value.toLocaleString()}</span>
    </div>
  )
}
