'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import Link from 'next/link'

// ─── Types ──────────────────────────────────────────────────────────

type Lead = {
  id: string
  owner_name: string | null
  phone: string | null
  status: string | null
  county: string | null
  excess_funds_amount: number | null
  case_number: string | null
  property_address: string | null
  eleanor_score: number | null
  eleanor_grade: string | null
  is_golden_lead: boolean | null
  last_sms_sent: string | null
}

type Message = {
  id: string
  lead_id: string
  direction: 'inbound' | 'outbound'
  content: string
  from_number: string | null
  to_number: string | null
  status: string | null
  created_at: string
}

type LeadThread = {
  lead: Lead
  messages: Message[]
  lastMessageAt: string
  hasReply: boolean
  hasFailed: boolean
  lastPreview: string
}

type Filter = 'all' | 'replied' | 'failed' | 'no_reply' | 'golden'

type Stats = {
  totalSent: number
  delivered: number
  failed: number
  replies: number
}

// ─── Helpers ────────────────────────────────────────────────────────

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
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatMoney(amount: number | null): string {
  if (!amount) return '$0'
  return '$' + Math.round(amount).toLocaleString()
}

function statusColor(status: string | null): string {
  switch (status) {
    case 'contacted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
    case 'responded': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
    case 'negotiating': return 'bg-amber-500/20 text-amber-400 border-amber-500/30'
    case 'agreement_sent': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    case 'signed': return 'bg-teal-500/20 text-teal-400 border-teal-500/30'
    case 'closed': return 'bg-green-500/20 text-green-300 border-green-500/30'
    default: return 'bg-zinc-700/30 text-zinc-400 border-zinc-600/30'
  }
}

function deliveryIcon(status: string | null): string {
  if (!status) return '?'
  const s = status.toLowerCase()
  if (s === 'delivered' || s === 'received') return '✓✓'
  if (s === 'sent') return '✓'
  if (s === 'failed' || s === 'undelivered') return '✕'
  return '·'
}

function deliveryColor(status: string | null): string {
  if (!status) return 'text-zinc-500'
  const s = status.toLowerCase()
  if (s === 'delivered' || s === 'received') return 'text-emerald-400'
  if (s === 'sent') return 'text-zinc-400'
  if (s === 'failed' || s === 'undelivered') return 'text-red-400'
  return 'text-zinc-500'
}

// ─── Main Component ─────────────────────────────────────────────────

export default function InboxPage() {
  const [threads, setThreads] = useState<LeadThread[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [stats, setStats] = useState<Stats>({ totalSent: 0, delivered: 0, failed: 0, replies: 0 })
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // ─── Data Loading ───────────────────────────────────────────────

  const loadData = useCallback(async () => {
    try {
      // Fetch leads that have been contacted
      const { data: leads, error: leadsError } = await supabase
        .from('leads')
        .select('id, owner_name, phone, status, county, excess_funds_amount, case_number, property_address, eleanor_score, eleanor_grade, is_golden_lead, last_sms_sent')
        .in('status', ['contacted', 'responded', 'negotiating', 'agreement_sent', 'signed', 'closed', 'enriched', 'pending'])
        .order('last_sms_sent', { ascending: false, nullsFirst: false })

      if (leadsError) {
        console.error('Leads fetch error:', leadsError)
      }

      const leadsData = leads || []

      // Try messages table first
      let messagesData: Message[] = []
      const { data: msgs, error: msgsError } = await supabase
        .from('messages')
        .select('id, lead_id, direction, content, from_number, to_number, status, created_at')
        .eq('message_type', 'sms')
        .order('created_at', { ascending: true })

      if (msgsError || !msgs || msgs.length === 0) {
        // Fallback to sms_log_enhanced
        const { data: fallback } = await supabase
          .from('sms_log_enhanced')
          .select('id, lead_id, direction, message_body, phone_from, phone_to, twilio_status, created_at')
          .order('created_at', { ascending: true })

        if (fallback) {
          messagesData = fallback.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            lead_id: String(row.lead_id || ''),
            direction: (row.direction as 'inbound' | 'outbound') || 'outbound',
            content: String(row.message_body || ''),
            from_number: row.phone_from as string | null,
            to_number: row.phone_to as string | null,
            status: row.twilio_status as string | null,
            created_at: String(row.created_at || ''),
          }))
        }
      } else {
        messagesData = msgs as Message[]
      }

      // Also try sms_messages table if we got nothing so far
      if (messagesData.length === 0) {
        const { data: smsMessages } = await supabase
          .from('sms_messages')
          .select('id, lead_id, direction, message, from_number, to_number, status, created_at')
          .order('created_at', { ascending: true })

        if (smsMessages) {
          messagesData = smsMessages.map((row: Record<string, unknown>) => ({
            id: String(row.id),
            lead_id: String(row.lead_id || ''),
            direction: (row.direction as 'inbound' | 'outbound') || 'outbound',
            content: String(row.message || ''),
            from_number: row.from_number as string | null,
            to_number: row.to_number as string | null,
            status: row.status as string | null,
            created_at: String(row.created_at || ''),
          }))
        }
      }

      // Group messages by lead_id
      const messagesByLead = new Map<string, Message[]>()
      for (const msg of messagesData) {
        if (!msg.lead_id) continue
        const existing = messagesByLead.get(msg.lead_id) || []
        existing.push(msg)
        messagesByLead.set(msg.lead_id, existing)
      }

      // Compute stats
      const outbound = messagesData.filter(m => m.direction === 'outbound')
      const newStats: Stats = {
        totalSent: outbound.length,
        delivered: outbound.filter(m => m.status?.toLowerCase() === 'delivered').length,
        failed: outbound.filter(m => {
          const s = m.status?.toLowerCase() || ''
          return s === 'failed' || s === 'undelivered'
        }).length,
        replies: messagesData.filter(m => m.direction === 'inbound').length,
      }
      setStats(newStats)

      // Build threads — include leads with messages, and leads without messages if they have contacted status
      const threadMap = new Map<string, LeadThread>()

      for (const lead of leadsData) {
        const msgs = messagesByLead.get(lead.id) || []
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : null
        const hasReply = msgs.some(m => m.direction === 'inbound')
        const hasFailed = msgs.some(m => {
          const s = m.status?.toLowerCase() || ''
          return s === 'failed' || s === 'undelivered'
        })

        threadMap.set(lead.id, {
          lead,
          messages: msgs,
          lastMessageAt: lastMsg?.created_at || lead.last_sms_sent || '',
          hasReply,
          hasFailed,
          lastPreview: lastMsg?.content || '',
        })
      }

      // Also add threads for messages whose lead_id is not in our leads query
      for (const [leadId, msgs] of messagesByLead) {
        if (threadMap.has(leadId)) continue
        const lastMsg = msgs[msgs.length - 1]
        threadMap.set(leadId, {
          lead: {
            id: leadId,
            owner_name: null,
            phone: lastMsg.to_number || lastMsg.from_number,
            status: null,
            county: null,
            excess_funds_amount: null,
            case_number: null,
            property_address: null,
            eleanor_score: null,
            eleanor_grade: null,
            is_golden_lead: null,
            last_sms_sent: null,
          },
          messages: msgs,
          lastMessageAt: lastMsg.created_at,
          hasReply: msgs.some(m => m.direction === 'inbound'),
          hasFailed: msgs.some(m => {
            const s = m.status?.toLowerCase() || ''
            return s === 'failed' || s === 'undelivered'
          }),
          lastPreview: lastMsg.content,
        })
      }

      // Sort by last message time
      const sorted = Array.from(threadMap.values())
        .filter(t => t.messages.length > 0 || t.lead.last_sms_sent)
        .sort((a, b) => {
          const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0
          const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0
          return tb - ta
        })

      setThreads(sorted)

      // Auto-select first if none selected
      if (!selectedLeadId && sorted.length > 0) {
        setSelectedLeadId(sorted[0].lead.id)
      }
    } catch (err) {
      console.error('Failed to load inbox data:', err)
    } finally {
      setLoading(false)
    }
  }, [selectedLeadId])

  useEffect(() => {
    loadData()
    const interval = setInterval(loadData, 30000)
    return () => clearInterval(interval)
  }, [loadData])

  // Scroll to bottom when selecting a new lead
  useEffect(() => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }, [selectedLeadId])

  // ─── Filtered threads ───────────────────────────────────────────

  const filteredThreads = useMemo(() => {
    let result = threads

    // Apply filter
    switch (filter) {
      case 'replied':
        result = result.filter(t => t.hasReply)
        break
      case 'failed':
        result = result.filter(t => t.hasFailed)
        break
      case 'no_reply':
        result = result.filter(t => !t.hasReply && t.messages.length > 0)
        break
      case 'golden':
        result = result.filter(t => t.lead.is_golden_lead)
        break
    }

    // Apply search
    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(t => {
        const name = (t.lead.owner_name || '').toLowerCase()
        const phone = (t.lead.phone || '').toLowerCase()
        const county = (t.lead.county || '').toLowerCase()
        return name.includes(q) || phone.includes(q) || county.includes(q)
      })
    }

    return result
  }, [threads, filter, search])

  const selectedThread = useMemo(
    () => threads.find(t => t.lead.id === selectedLeadId) || null,
    [threads, selectedLeadId]
  )

  // ─── Actions ────────────────────────────────────────────────────

  const handleSendAgreement = async () => {
    if (!selectedThread) return
    setActionLoading('agreement')
    try {
      await fetch('https://skooki.app.n8n.cloud/webhook/send-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedThread.lead.id,
          name: selectedThread.lead.owner_name,
        }),
      })
    } catch (err) {
      console.error('Send agreement error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleFollowUp = async () => {
    if (!selectedThread) return
    setActionLoading('followup')
    try {
      await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedThread.lead.id,
          name: selectedThread.lead.owner_name,
        }),
      })
    } catch (err) {
      console.error('Follow up error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#0a0c10] text-zinc-400" style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}>
        <div className="text-center space-y-3">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500 mx-auto" />
          <p className="text-sm">Loading SMS Inbox...</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="h-screen flex flex-col bg-[#0a0c10] text-zinc-200 overflow-hidden"
      style={{ fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace" }}
    >
      {/* ─── Stats Bar ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800/60 bg-[#0c0e14]">
        <div className="flex items-center gap-6">
          <Link href="/dashboard" className="text-sm font-bold text-amber-500 hover:text-amber-400 transition-colors">
            MAXSAM
          </Link>
          <span className="text-xs text-zinc-500">SMS INBOX</span>
        </div>

        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500">SENT</span>
            <span className="text-zinc-200 font-bold">{stats.totalSent}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-500">DELIVERED</span>
            <span className="text-emerald-400 font-bold">{stats.delivered}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-zinc-500">FAILED</span>
            <span className="text-red-400 font-bold">{stats.failed}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-zinc-500">REPLIES</span>
            <span className="text-blue-400 font-bold">{stats.replies}</span>
          </div>
        </div>

        <button
          onClick={() => { setLoading(true); loadData() }}
          className="text-xs px-3 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 transition-colors"
        >
          REFRESH
        </button>
      </div>

      {/* ─── Main Two-Panel Layout ───────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ─── Left Panel: Lead List ───────────────────────────────── */}
        <div className="w-[380px] flex-shrink-0 border-r border-zinc-800/60 flex flex-col bg-[#0b0d12]">

          {/* Search */}
          <div className="p-3 border-b border-zinc-800/40">
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, phone, county..."
              className="w-full bg-zinc-900/60 border border-zinc-700/50 rounded px-3 py-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/50"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-1 px-3 py-2 border-b border-zinc-800/40">
            {(['all', 'replied', 'failed', 'no_reply', 'golden'] as Filter[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[10px] px-2 py-1 rounded transition-colors ${
                  filter === f
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                }`}
              >
                {f === 'golden' ? '★ Golden' : f === 'no_reply' ? 'No Reply' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>

          {/* Lead Cards */}
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.length === 0 ? (
              <div className="p-6 text-center text-zinc-600 text-xs">
                No conversations match filters
              </div>
            ) : (
              filteredThreads.map(thread => (
                <button
                  key={thread.lead.id}
                  onClick={() => setSelectedLeadId(thread.lead.id)}
                  className={`w-full text-left px-3 py-3 border-b border-zinc-800/30 transition-colors ${
                    selectedLeadId === thread.lead.id
                      ? 'bg-zinc-800/50 border-l-2 border-l-amber-500'
                      : 'hover:bg-zinc-800/30 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Status dot */}
                      {thread.hasReply && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" title="Has reply" />
                      )}
                      {thread.hasFailed && !thread.hasReply && (
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Delivery failed" />
                      )}
                      {!thread.hasReply && !thread.hasFailed && (
                        <span className="w-2 h-2 rounded-full bg-zinc-600 flex-shrink-0" />
                      )}
                      <span className="text-xs font-medium text-zinc-200 truncate">
                        {thread.lead.owner_name || 'Unknown'}
                      </span>
                      {thread.lead.is_golden_lead && (
                        <span className="text-amber-400 text-[10px] flex-shrink-0" title="Golden Lead">★</span>
                      )}
                    </div>
                    <span className="text-[10px] text-zinc-600 flex-shrink-0">
                      {thread.lastMessageAt ? timeAgo(thread.lastMessageAt) : ''}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-amber-500/70">
                      {formatMoney(thread.lead.excess_funds_amount)}
                    </span>
                    {thread.lead.county && (
                      <span className="text-[10px] text-zinc-600">{thread.lead.county}</span>
                    )}
                    {thread.lead.status && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded border ${statusColor(thread.lead.status)}`}>
                        {thread.lead.status}
                      </span>
                    )}
                  </div>

                  {thread.lastPreview && (
                    <p className="text-[11px] text-zinc-500 mt-1 truncate leading-relaxed">
                      {thread.lastPreview.slice(0, 80)}
                    </p>
                  )}
                </button>
              ))
            )}
          </div>

          <div className="px-3 py-2 border-t border-zinc-800/40 text-[10px] text-zinc-600">
            {filteredThreads.length} conversation{filteredThreads.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* ─── Right Panel: Conversation ───────────────────────────── */}
        <div className="flex-1 flex flex-col bg-[#0a0c10]">
          {selectedThread ? (
            <>
              {/* Header */}
              <div className="px-4 py-3 border-b border-zinc-800/60 bg-[#0c0e14]">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <h2 className="text-sm font-bold text-zinc-100">
                        {selectedThread.lead.owner_name || 'Unknown'}
                      </h2>
                      {selectedThread.lead.is_golden_lead && (
                        <span className="text-amber-400 text-xs">★ GOLDEN</span>
                      )}
                      {selectedThread.lead.eleanor_grade && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          {selectedThread.lead.eleanor_grade}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                      {selectedThread.lead.phone && <span>{selectedThread.lead.phone}</span>}
                      {selectedThread.lead.excess_funds_amount && (
                        <span className="text-amber-500">{formatMoney(selectedThread.lead.excess_funds_amount)}</span>
                      )}
                      {selectedThread.lead.case_number && <span>Case #{selectedThread.lead.case_number}</span>}
                    </div>
                    {selectedThread.lead.property_address && (
                      <div className="text-[10px] text-zinc-600">{selectedThread.lead.property_address}</div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={handleSendAgreement}
                      disabled={actionLoading === 'agreement'}
                      className="text-[11px] px-3 py-1.5 rounded border border-purple-500/30 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'agreement' ? 'Sending...' : 'Send Agreement'}
                    </button>
                    <button
                      onClick={handleFollowUp}
                      disabled={actionLoading === 'followup'}
                      className="text-[11px] px-3 py-1.5 rounded border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors disabled:opacity-50"
                    >
                      {actionLoading === 'followup' ? 'Sending...' : 'Follow Up'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {selectedThread.messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center space-y-2">
                      <p className="text-zinc-600 text-xs">No messages found</p>
                      <p className="text-zinc-700 text-[10px]">Messages may be in Twilio only</p>
                    </div>
                  </div>
                ) : (
                  selectedThread.messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[70%] rounded-lg px-3 py-2 ${
                          msg.direction === 'outbound'
                            ? 'bg-blue-600/20 border border-blue-500/20 text-zinc-200'
                            : 'bg-zinc-800/60 border border-zinc-700/30 text-zinc-200'
                        }`}
                      >
                        <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] text-zinc-500">
                            {new Date(msg.created_at).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                            })}
                          </span>
                          {msg.direction === 'outbound' && (
                            <span className={`text-[10px] ${deliveryColor(msg.status)}`}>
                              {deliveryIcon(msg.status)}
                              {msg.status && (
                                <span className="ml-1 opacity-70">{msg.status}</span>
                              )}
                            </span>
                          )}
                          {msg.direction === 'inbound' && (
                            <span className="text-[10px] text-emerald-500/70">inbound</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-zinc-600 text-sm">Select a conversation</p>
                <p className="text-zinc-700 text-xs">Click a lead from the left panel to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
