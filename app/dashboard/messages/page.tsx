'use client'

import { useEffect, useMemo, useState, useRef, useCallback } from 'react'

type Conversation = {
  phone: string
  lead_id: string | null
  owner_name: string
  excess_funds_amount: number
  case_number: string
  property_address: string
  eleanor_score: number
  eleanor_grade: string
  lead_status: string
  last_message: string
  last_direction: string
  last_message_at: string
  message_count: number
}

type Message = {
  id: string
  lead_id: string | null
  message: string
  direction: 'inbound' | 'outbound'
  from_number: string
  to_number: string
  status: string
  created_at: string
}

const STATUS_COLORS: Record<string, string> = {
  delivered: '#10b981',
  sent: '#fbbf24',
  failed: '#ef4444',
  undelivered: '#ef4444',
  pending: '#6b7280',
  queued: '#6b7280',
}

const GRADE_COLORS: Record<string, string> = {
  'A+': '#ffd700',
  A: '#ffd700',
  B: '#10b981',
  C: '#fbbf24',
  D: '#ef4444',
  'N/A': '#6b7280',
}

const LEAD_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  new: { label: 'New', color: '#6b7280' },
  contacted: { label: 'Contacted', color: '#3b82f6' },
  responding: { label: 'Responding', color: '#10b981' },
  qualified: { label: 'Qualified', color: '#ffd700' },
  agreement_sent: { label: 'Agreement Sent', color: '#f59e0b' },
  agreement_signed: { label: 'Signed', color: '#22c55e' },
  needs_follow_up: { label: 'Follow Up', color: '#f97316' },
  opted_out: { label: 'Opted Out', color: '#ef4444' },
  unknown: { label: 'Unknown', color: '#6b7280' },
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

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export default function MessagingCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])
  const [draftMessage, setDraftMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDirection, setFilterDirection] = useState<'all' | 'inbound' | 'outbound'>('all')
  const [loading, setLoading] = useState(true)
  const [threadLoading, setThreadLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const loadConversations = useCallback(async () => {
    try {
      const response = await fetch('/api/conversations')
      const body = await response.json()
      if (body.success) {
        setConversations(body.conversations)
        if (!selectedPhone && body.conversations.length > 0) {
          setSelectedPhone(body.conversations[0].phone)
        }
      }
    } finally {
      setLoading(false)
    }
  }, [selectedPhone])

  const loadThread = useCallback(async (phone: string) => {
    setThreadLoading(true)
    try {
      const response = await fetch(`/api/messages?phone=${phone}`)
      const body = await response.json()
      if (body.success) setMessages(body.messages)
    } finally {
      setThreadLoading(false)
    }
  }, [])

  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 30000)
    return () => clearInterval(interval)
  }, [loadConversations])

  useEffect(() => {
    if (!selectedPhone) return
    loadThread(selectedPhone)
    const interval = setInterval(() => loadThread(selectedPhone), 15000)
    return () => clearInterval(interval)
  }, [selectedPhone, loadThread])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const selectedConversation = useMemo(
    () => conversations.find((c) => c.phone === selectedPhone) || null,
    [conversations, selectedPhone]
  )

  const filteredConversations = useMemo(() => {
    let filtered = conversations
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.owner_name.toLowerCase().includes(q) ||
          c.phone.includes(q) ||
          c.case_number?.toLowerCase().includes(q) ||
          c.property_address?.toLowerCase().includes(q)
      )
    }
    if (filterDirection !== 'all') {
      filtered = filtered.filter((c) => c.last_direction === filterDirection)
    }
    return filtered
  }, [conversations, searchQuery, filterDirection])

  const stats = useMemo(() => {
    const total = conversations.length
    const inbound = conversations.filter((c) => c.last_direction === 'inbound').length
    const needsReply = conversations.filter(
      (c) => c.last_direction === 'inbound' && !['opted_out'].includes(c.lead_status)
    ).length
    return { total, inbound, needsReply }
  }, [conversations])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  const sendMessage = async () => {
    if (!selectedConversation || !draftMessage.trim() || sending) return
    setSending(true)
    const msgText = draftMessage.trim()

    // Optimistic update: show message immediately
    const optimisticMsg: Message = {
      id: `temp-${Date.now()}`,
      lead_id: selectedConversation.lead_id,
      message: msgText,
      direction: 'outbound',
      from_number: '+18449632549',
      to_number: selectedConversation.phone,
      status: 'sending',
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimisticMsg])
    setDraftMessage('')

    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to_number: selectedConversation.phone,
          message: msgText,
          lead_id: selectedConversation.lead_id,
        }),
      })
      const body = await response.json()
      if (body.success) {
        showToast('SMS sent', 'success')
        await loadThread(selectedConversation.phone)
        await loadConversations()
      } else {
        showToast(body.error || 'Failed to send', 'error')
        // Remove optimistic message on failure
        setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
        setDraftMessage(msgText)
      }
    } catch {
      showToast('Network error sending SMS', 'error')
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id))
      setDraftMessage(msgText)
    } finally {
      setSending(false)
    }
  }

  const handleAction = async (action: string) => {
    if (!selectedConversation) return
    setActionLoading(action)
    try {
      if (action === 'send_agreement') {
        await fetch('/api/agreements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: selectedConversation.lead_id,
            selection_code: 1,
            triggered_by: 'ui',
          }),
        })
      } else if (action === 'opt_out') {
        await fetch('/api/messages/opt-out', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: selectedConversation.phone }),
        })
      } else if (action === 'needs_follow_up' || action === 'verify_records') {
        if (selectedConversation.lead_id) {
          await fetch('/api/leads/set-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lead_id: selectedConversation.lead_id,
              status: action,
            }),
          })
        }
      }
      await loadConversations()
    } finally {
      setActionLoading(null)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const syncTwilio = async () => {
    if (syncing) return
    setSyncing(true)
    try {
      const response = await fetch('/api/sms/sync-twilio', { method: 'POST' })
      const body = await response.json()
      if (body.success) {
        showToast(`Synced ${body.inserted} new messages (${body.skipped} already existed)`, 'success')
        await loadConversations()
        if (selectedPhone) await loadThread(selectedPhone)
      } else {
        showToast(body.error || 'Sync failed', 'error')
      }
    } catch {
      showToast('Network error during sync', 'error')
    } finally {
      setSyncing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#ffd700', borderTopColor: 'transparent' }} />
          <p style={{ color: '#a0a0b0' }}>Loading conversations...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col rounded-lg overflow-hidden border relative" style={{ background: '#0d0f14', borderColor: '#1a1d28' }}>
      {/* Toast */}
      {toast && (
        <div
          className="absolute top-3 right-3 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg animate-in fade-in"
          style={{
            background: toast.type === 'success' ? '#065f46' : '#7f1d1d',
            color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
          }}
        >
          {toast.message}
        </div>
      )}
      {/* Stats Bar */}
      <div className="flex items-center gap-6 px-5 py-3 border-b" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
        <h1 className="text-lg font-semibold" style={{ color: '#ffd700' }}>Messaging Center</h1>
        <button
          onClick={syncTwilio}
          disabled={syncing}
          className="text-xs px-3 py-1.5 rounded transition-colors disabled:opacity-50"
          style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
        >
          {syncing ? 'Syncing...' : 'Sync Twilio'}
        </button>
        <div className="flex gap-4 ml-auto text-sm">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
            <span style={{ color: '#a0a0b0' }}>{stats.total} conversations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }} />
            <span style={{ color: '#a0a0b0' }}>{stats.inbound} inbound</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#ffd700' }} />
            <span style={{ color: '#a0a0b0' }}>{stats.needsReply} needs reply</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left Panel: Conversation List */}
        <aside className="flex flex-col border-r" style={{ width: '380px', borderColor: '#1a1d28', background: '#0a0c10' }}>
          {/* Search + Filter */}
          <div className="p-3 space-y-2 border-b" style={{ borderColor: '#1a1d28' }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search name, phone, case..."
              className="w-full rounded px-3 py-2 text-sm focus:outline-none"
              style={{ background: '#151820', border: '1px solid #1a1d28', color: '#e0e0e8' }}
            />
            <div className="flex gap-1">
              {(['all', 'inbound', 'outbound'] as const).map((dir) => (
                <button
                  key={dir}
                  onClick={() => setFilterDirection(dir)}
                  className="flex-1 text-xs py-1 rounded capitalize"
                  style={{
                    background: filterDirection === dir ? '#ffd70020' : '#151820',
                    color: filterDirection === dir ? '#ffd700' : '#6b7280',
                    border: `1px solid ${filterDirection === dir ? '#ffd70040' : '#1a1d28'}`,
                  }}
                >
                  {dir}
                </button>
              ))}
            </div>
          </div>

          {/* Conversation Cards */}
          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 && (
              <div className="p-4 text-center text-sm" style={{ color: '#6b7280' }}>No conversations found</div>
            )}
            {filteredConversations.map((conv) => {
              const isActive = selectedPhone === conv.phone
              const isInbound = conv.last_direction === 'inbound'
              const statusInfo = LEAD_STATUS_LABELS[conv.lead_status] || LEAD_STATUS_LABELS.unknown
              return (
                <button
                  key={conv.phone}
                  onClick={() => setSelectedPhone(conv.phone)}
                  className="w-full text-left p-3 border-b transition-colors"
                  style={{
                    borderColor: '#1a1d28',
                    background: isActive ? '#151820' : 'transparent',
                    borderLeft: isActive ? '3px solid #ffd700' : '3px solid transparent',
                  }}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      {isInbound && (
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: '#10b981' }} />
                      )}
                      <span className="font-medium text-sm truncate" style={{ color: '#e0e0e8' }}>
                        {conv.owner_name}
                      </span>
                    </div>
                    <span className="text-[10px] flex-shrink-0 ml-2" style={{ color: '#6b7280' }}>
                      {timeAgo(conv.last_message_at)}
                    </span>
                  </div>
                  <p className="text-xs truncate mb-1.5" style={{ color: '#808090' }}>
                    {conv.last_direction === 'outbound' ? 'You: ' : ''}{conv.last_message}
                  </p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px]" style={{ color: '#6b7280' }}>{formatPhone(conv.phone)}</span>
                    {conv.excess_funds_amount > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: '#ffd70015', color: '#ffd700' }}>
                        {formatCurrency(conv.excess_funds_amount)}
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: GRADE_COLORS[conv.eleanor_grade] + '15', color: GRADE_COLORS[conv.eleanor_grade] || '#6b7280' }}>
                      {conv.eleanor_grade}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: statusInfo.color + '15', color: statusInfo.color }}>
                      {statusInfo.label}
                    </span>
                    <span className="text-[10px] ml-auto" style={{ color: '#6b7280' }}>{conv.message_count} msgs</span>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Main Panel: Thread + Details */}
        {selectedConversation ? (
          <div className="flex flex-1 min-w-0">
            {/* Chat Thread */}
            <section className="flex-1 flex flex-col min-w-0">
              {/* Thread Header */}
              <div className="px-4 py-3 border-b flex items-center gap-4" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
                <div className="flex-1 min-w-0">
                  <h2 className="font-semibold text-sm" style={{ color: '#e0e0e8' }}>
                    {selectedConversation.owner_name}
                  </h2>
                  <div className="text-xs" style={{ color: '#6b7280' }}>
                    {formatPhone(selectedConversation.phone)}
                    {selectedConversation.case_number && ` \u2022 Case ${selectedConversation.case_number}`}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['send_agreement', 'needs_follow_up', 'opt_out'] as const).map((action) => {
                    const labels: Record<string, string> = {
                      send_agreement: 'Send Agreement',
                      needs_follow_up: 'Follow Up',
                      opt_out: 'Opt Out',
                    }
                    const colors: Record<string, string> = {
                      send_agreement: '#ffd700',
                      needs_follow_up: '#f59e0b',
                      opt_out: '#ef4444',
                    }
                    return (
                      <button
                        key={action}
                        onClick={() => handleAction(action)}
                        disabled={actionLoading === action}
                        className="text-xs px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
                        style={{
                          background: colors[action] + '15',
                          color: colors[action],
                          border: `1px solid ${colors[action]}30`,
                        }}
                      >
                        {actionLoading === action ? '...' : labels[action]}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ background: '#0a0c10' }}>
                {threadLoading && messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: '#ffd700', borderTopColor: 'transparent' }} />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <p className="text-sm" style={{ color: '#6b7280' }}>No messages yet</p>
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isOutbound = msg.direction === 'outbound'
                    const statusColor = STATUS_COLORS[msg.status?.toLowerCase()] || '#6b7280'
                    return (
                      <div key={msg.id} className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className="max-w-[75%] rounded-lg px-3 py-2"
                          style={{
                            background: isOutbound ? '#1a2332' : '#151820',
                            border: `1px solid ${isOutbound ? '#1e3a5f' : '#1a1d28'}`,
                          }}
                        >
                          <p className="text-sm whitespace-pre-wrap" style={{ color: '#e0e0e8' }}>{msg.message}</p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                            <span className="text-[10px] uppercase" style={{ color: statusColor }}>{msg.status}</span>
                            <span className="text-[10px]" style={{ color: '#4a4a5a' }}>
                              {new Date(msg.created_at).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Compose */}
              <div className="border-t p-3 flex gap-2" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
                <input
                  value={draftMessage}
                  onChange={(e) => setDraftMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type a message... (Enter to send)"
                  className="flex-1 rounded px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: '#0a0c10',
                    border: '1px solid #1a1d28',
                    color: '#e0e0e8',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!draftMessage.trim() || sending}
                  className="px-4 py-2 rounded text-sm font-medium transition-colors disabled:opacity-40"
                  style={{
                    background: '#ffd700',
                    color: '#0a0c10',
                  }}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </section>

            {/* Right Panel: Lead Details */}
            <aside className="border-l flex flex-col overflow-y-auto" style={{ width: '280px', borderColor: '#1a1d28', background: '#10131a' }}>
              <div className="p-4 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffd700' }}>Lead Details</h3>

                <div className="space-y-3">
                  <DetailRow label="Name" value={selectedConversation.owner_name} />
                  <DetailRow label="Phone" value={formatPhone(selectedConversation.phone)} />
                  <DetailRow label="Case #" value={selectedConversation.case_number || 'N/A'} />
                  <DetailRow label="Property" value={selectedConversation.property_address || 'N/A'} />
                  <DetailRow
                    label="Excess Funds"
                    value={selectedConversation.excess_funds_amount > 0 ? formatCurrency(selectedConversation.excess_funds_amount) : 'N/A'}
                    valueColor="#ffd700"
                  />
                  <DetailRow
                    label="Eleanor Score"
                    value={`${selectedConversation.eleanor_score} (${selectedConversation.eleanor_grade})`}
                    valueColor={GRADE_COLORS[selectedConversation.eleanor_grade] || '#6b7280'}
                  />
                  <DetailRow
                    label="Status"
                    value={(LEAD_STATUS_LABELS[selectedConversation.lead_status] || LEAD_STATUS_LABELS.unknown).label}
                    valueColor={(LEAD_STATUS_LABELS[selectedConversation.lead_status] || LEAD_STATUS_LABELS.unknown).color}
                  />
                  <DetailRow label="Messages" value={String(selectedConversation.message_count)} />
                </div>

                {selectedConversation.lead_id && (
                  <a
                    href={`/dashboard/leads?id=${selectedConversation.lead_id}`}
                    className="block text-center text-xs py-2 rounded transition-colors"
                    style={{ background: '#ffd70015', color: '#ffd700', border: '1px solid #ffd70030' }}
                  >
                    View Full Lead Profile
                  </a>
                )}
              </div>
            </aside>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ background: '#0a0c10' }}>
            <div className="text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-sm" style={{ color: '#6b7280' }}>Select a conversation to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#6b7280' }}>{label}</div>
      <div className="text-sm" style={{ color: valueColor || '#e0e0e8' }}>{value}</div>
    </div>
  )
}
