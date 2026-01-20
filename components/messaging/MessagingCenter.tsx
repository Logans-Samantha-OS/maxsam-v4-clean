'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string
  lead_id: string
  direction: 'inbound' | 'outbound' | 'system'
  message: string
  from_number: string
  to_number: string
  status: string
  created_at: string
  read_at: string | null
  intent?: 'AFFIRMATIVE' | 'NEGATIVE' | 'QUESTION' | 'CONFUSED' | 'HOSTILE' | 'OUT_OF_SCOPE' | null
  sentiment?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | null
  next_action?: string | null
  // New unified timeline fields
  channel?: 'sms' | 'email' | 'agreement' | 'system'
  agreement_packet_id?: string
  agreement_event_type?: string
  metadata?: Record<string, unknown>
}

interface Lead {
  id: string
  owner_name: string
  property_address: string
  city?: string
  state?: string
  excess_funds_amount: number
  eleanor_score: number
  deal_grade?: string
  status: string
  phone?: string
  phone_1?: string
  phone_2?: string
}

interface Conversation {
  lead_id: string
  last_message: string
  last_message_time: string
  last_direction: string
  unread_count: number
  total_messages: number
  phone: string
  lead: Lead | null
  last_intent?: string | null
}

// ============================================================================
// INTENT BADGE
// ============================================================================

function IntentBadge({ intent, size = 'sm' }: { intent?: string | null; size?: 'sm' | 'xs' }) {
  if (!intent) return <span className="text-zinc-600 text-[10px]">—</span>

  const config: Record<string, { bg: string; text: string; label: string }> = {
    AFFIRMATIVE: { bg: 'bg-green-500/20', text: 'text-green-400', label: 'YES' },
    NEGATIVE: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'NO' },
    QUESTION: { bg: 'bg-blue-500/20', text: 'text-blue-400', label: '?' },
    CONFUSED: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', label: '??' },
    HOSTILE: { bg: 'bg-red-600/30', text: 'text-red-300', label: '!!' },
    OUT_OF_SCOPE: { bg: 'bg-zinc-500/20', text: 'text-zinc-400', label: '—' },
  }

  const c = config[intent] || config.OUT_OF_SCOPE
  const sizeClass = size === 'xs' ? 'text-[9px] px-1 py-0.5' : 'text-[10px] px-1.5 py-0.5'

  return (
    <span className={`${c.bg} ${c.text} ${sizeClass} rounded font-medium`}>
      {c.label}
    </span>
  )
}

// ============================================================================
// CONVERSATION LIST ITEM
// ============================================================================

function ConversationItem({
  conversation,
  selected,
  onClick
}: {
  conversation: Conversation
  selected: boolean
  onClick: () => void
}) {
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    } else if (diffDays === 1) {
      return 'Yesterday'
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const truncate = (str: string, len: number) =>
    str.length > len ? str.substring(0, len) + '...' : str

  return (
    <button
      onClick={onClick}
      className={`w-full p-4 text-left transition-colors border-b border-zinc-800 ${
        selected
          ? 'bg-blue-900/30 border-l-2 border-l-blue-500'
          : 'hover:bg-zinc-800/50'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white truncate">
              {conversation.lead?.owner_name || 'Unknown'}
            </span>
            {conversation.unread_count > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-500 text-white rounded-full">
                {conversation.unread_count}
              </span>
            )}
            <IntentBadge intent={conversation.last_intent} size="xs" />
          </div>
          <div className="text-xs text-zinc-500 truncate">
            {conversation.phone}
          </div>
        </div>
        <div className="text-[10px] text-zinc-500 whitespace-nowrap">
          {formatTime(conversation.last_message_time)}
        </div>
      </div>
      <div className="mt-1 flex items-center gap-1">
        {conversation.last_direction === 'outbound' && (
          <span className="text-zinc-500 text-xs">You:</span>
        )}
        <span
          className={`text-sm truncate ${
            conversation.unread_count > 0 ? 'text-white font-medium' : 'text-zinc-400'
          }`}
        >
          {truncate(conversation.last_message, 50)}
        </span>
      </div>
      {conversation.lead && (
        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
            ${conversation.lead.excess_funds_amount?.toLocaleString() || 0}
          </span>
          {conversation.lead.eleanor_score > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
              Score: {conversation.lead.eleanor_score}
            </span>
          )}
        </div>
      )}
    </button>
  )
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  const isSystem = message.direction === 'system'
  const isAgreement = message.channel === 'agreement'
  const time = new Date(message.created_at).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })

  // Handle agreement events with special styling
  if (isAgreement || isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <div className="max-w-[85%]">
          <div className={`rounded-xl px-4 py-3 ${
            message.agreement_event_type === 'signed'
              ? 'bg-green-900/30 border border-green-500/30'
              : message.agreement_event_type === 'sent'
              ? 'bg-blue-900/30 border border-blue-500/30'
              : message.agreement_event_type === 'viewed'
              ? 'bg-yellow-900/30 border border-yellow-500/30'
              : 'bg-zinc-800/50 border border-zinc-700'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">
                {message.agreement_event_type === 'signed' ? '✅' :
                 message.agreement_event_type === 'sent' ? '📝' :
                 message.agreement_event_type === 'viewed' ? '👁️' :
                 '📋'}
              </span>
              <span className={`text-sm font-medium ${
                message.agreement_event_type === 'signed' ? 'text-green-400' :
                message.agreement_event_type === 'sent' ? 'text-blue-400' :
                message.agreement_event_type === 'viewed' ? 'text-yellow-400' :
                'text-zinc-300'
              }`}>
                {message.message}
              </span>
            </div>
            <div className="text-[10px] text-zinc-500 text-center">
              {time}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className="max-w-[70%]">
        {/* Intent badge for inbound messages */}
        {!isOutbound && message.intent && (
          <div className="mb-1 flex items-center gap-1">
            <IntentBadge intent={message.intent} size="xs" />
            {message.next_action && message.next_action !== 'WAIT' && (
              <span className="text-[9px] text-zinc-500">
                → {message.next_action.replace(/_/g, ' ')}
              </span>
            )}
          </div>
        )}
        <div
          className={`rounded-2xl px-4 py-2 ${
            isOutbound
              ? 'bg-blue-600 text-white rounded-br-md'
              : 'bg-zinc-700 text-white rounded-bl-md'
          }`}
        >
          <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>
          <div
            className={`text-[10px] mt-1 ${
              isOutbound ? 'text-blue-200' : 'text-zinc-400'
            }`}
          >
            {message.channel === 'email' && <span className="mr-1">📧</span>}
            {time}
            {isOutbound && (
              <span className="ml-2">
                {message.status === 'delivered' ? 'Delivered' : message.status === 'sent' ? 'Sent' : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// LEAD INFO SIDEBAR
// ============================================================================

function LeadInfoSidebar({ lead }: { lead: Lead | null }) {
  if (!lead) {
    return (
      <div className="p-4 text-center text-zinc-500">
        Select a conversation to view lead info
      </div>
    )
  }

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val)

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-blue-500/20 text-blue-400',
      contacted: 'bg-yellow-500/20 text-yellow-400',
      qualified: 'bg-green-500/20 text-green-400',
      negotiating: 'bg-orange-500/20 text-orange-400',
      contract_sent: 'bg-purple-500/20 text-purple-400',
      closed: 'bg-emerald-500/20 text-emerald-400',
      dead: 'bg-red-500/20 text-red-400'
    }
    return colors[status] || 'bg-zinc-500/20 text-zinc-400'
  }

  const getGradeColor = (grade: string) => {
    const colors: Record<string, string> = {
      A: 'text-red-400',
      B: 'text-orange-400',
      C: 'text-blue-400',
      D: 'text-zinc-400'
    }
    return colors[grade] || 'text-zinc-400'
  }

  return (
    <div className="p-4 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{lead.owner_name}</h3>
        <p className="text-sm text-zinc-400">
          {lead.property_address}
          {lead.city && `, ${lead.city}`}
          {lead.state && `, ${lead.state}`}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="p-3 rounded-lg bg-zinc-800">
          <div className="text-xs text-zinc-500">Excess Funds</div>
          <div className="text-lg font-bold text-green-400">
            {formatCurrency(lead.excess_funds_amount || 0)}
          </div>
        </div>
        <div className="p-3 rounded-lg bg-zinc-800">
          <div className="text-xs text-zinc-500">Eleanor Score</div>
          <div className="text-lg font-bold text-purple-400">
            {lead.eleanor_score || 0}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className={`text-xs px-2 py-1 rounded ${getStatusColor(lead.status)}`}>
          {lead.status?.replace('_', ' ').toUpperCase() || 'NEW'}
        </span>
        {lead.deal_grade && (
          <span className={`text-xs font-bold ${getGradeColor(lead.deal_grade)}`}>
            Grade {lead.deal_grade}
          </span>
        )}
      </div>

      <div className="pt-3 border-t border-zinc-700">
        <div className="text-xs text-zinc-500 mb-2">Phone Numbers</div>
        <div className="space-y-1">
          {lead.phone && (
            <div className="text-sm text-white font-mono">{lead.phone}</div>
          )}
          {lead.phone_1 && lead.phone_1 !== lead.phone && (
            <div className="text-sm text-zinc-400 font-mono">{lead.phone_1}</div>
          )}
          {lead.phone_2 && lead.phone_2 !== lead.phone && lead.phone_2 !== lead.phone_1 && (
            <div className="text-sm text-zinc-400 font-mono">{lead.phone_2}</div>
          )}
        </div>
      </div>

      <a
        href={`/leads?id=${lead.id}`}
        className="block w-full text-center py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
      >
        View Full Lead Profile
      </a>
    </div>
  )
}

// ============================================================================
// MESSAGE COMPOSER
// ============================================================================

function MessageComposer({
  onSend,
  sending,
  disabled
}: {
  onSend: (message: string) => void
  sending: boolean
  disabled: boolean
}) {
  const [message, setMessage] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSend = () => {
    if (message.trim() && !sending && !disabled) {
      onSend(message.trim())
      setMessage('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [message])

  return (
    <div className="p-4 border-t border-zinc-800 bg-zinc-900">
      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? 'Select a conversation...' : 'Type your message...'}
          disabled={disabled || sending}
          rows={1}
          className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-blue-500 disabled:opacity-50"
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sending || disabled}
          className={`px-6 py-3 rounded-xl font-semibold text-sm transition-colors ${
            message.trim() && !sending && !disabled
              ? 'bg-blue-600 hover:bg-blue-500 text-white'
              : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
          }`}
        >
          {sending ? '...' : 'Send'}
        </button>
      </div>
      <div className="mt-2 text-[10px] text-zinc-600">
        Press Enter to send, Shift+Enter for new line
      </div>
    </div>
  )
}

// ============================================================================
// MAIN MESSAGING CENTER
// ============================================================================

export default function MessagingCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [totalUnread, setTotalUnread] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const selectedConversationRef = useRef<string | null>(null)

  // Keep ref in sync
  useEffect(() => {
    selectedConversationRef.current = selectedConversation
  }, [selectedConversation])

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages')
      if (!res.ok) throw new Error('Failed to fetch conversations')
      const data = await res.json()
      setConversations(data.conversations || [])
      setTotalUnread(data.total_unread || 0)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch messages for selected conversation - no conversations dependency
  const fetchMessages = useCallback(async (leadId: string, markAsRead = true) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/messages?lead_id=${leadId}`)
      if (!res.ok) throw new Error('Failed to fetch messages')
      const data = await res.json()
      setMessages(data.messages || [])
      setSelectedLead(data.lead || null)

      // Mark messages as read
      if (markAsRead) {
        await fetch('/api/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId, mark_all_read: true })
        })

        // Update unread count in conversations list
        setConversations((prev) => {
          const conv = prev.find((c) => c.lead_id === leadId)
          const unreadToRemove = conv?.unread_count || 0
          if (unreadToRemove > 0) {
            setTotalUnread((t) => Math.max(0, t - unreadToRemove))
          }
          return prev.map((c) =>
            c.lead_id === leadId ? { ...c, unread_count: 0 } : c
          )
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Poll for new messages every 10 seconds - use refs to avoid dependency cycles
  useEffect(() => {
    const interval = setInterval(async () => {
      await fetchConversations()
      // Only fetch messages if we have a selected conversation
      if (selectedConversationRef.current) {
        // Don't mark as read during polling, just refresh
        const res = await fetch(`/api/messages?lead_id=${selectedConversationRef.current}`)
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages || [])
        }
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [fetchConversations])

  // Load messages when conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation, true)
    }
  }, [selectedConversation, fetchMessages])

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Send message
  const handleSendMessage = async (messageText: string) => {
    if (!selectedConversation || !selectedLead) return

    setSending(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedConversation,
          message: messageText,
          to_number: selectedLead.phone || selectedLead.phone_1 || selectedLead.phone_2
        })
      })

      if (!res.ok) throw new Error('Failed to send message')

      const data = await res.json()

      // Add message to list optimistically
      setMessages((prev) => [
        ...prev,
        {
          id: data.message?.id || `temp-${Date.now()}`,
          lead_id: selectedConversation,
          direction: 'outbound',
          message: messageText,
          from_number: '+18449632549',
          to_number: selectedLead.phone || '',
          status: 'sent',
          created_at: new Date().toISOString(),
          read_at: null
        }
      ])

      // Update conversation list
      setConversations((prev) =>
        prev.map((c) =>
          c.lead_id === selectedConversation
            ? {
                ...c,
                last_message: messageText,
                last_message_time: new Date().toISOString(),
                last_direction: 'outbound',
                total_messages: c.total_messages + 1
              }
            : c
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send')
    } finally {
      setSending(false)
    }
  }

  // Filter conversations by search
  const filteredConversations = conversations.filter((c) => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      c.lead?.owner_name?.toLowerCase().includes(query) ||
      c.phone?.includes(query) ||
      c.last_message?.toLowerCase().includes(query)
    )
  })

  if (loading) {
    return (
      <div className="h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-zinc-500 border-t-blue-500 rounded-full mx-auto mb-4" />
          <p className="text-zinc-400">Loading messages...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-64px)] flex">
      {/* Conversations List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col bg-zinc-950">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-white">Messages</h1>
            {totalUnread > 0 && (
              <span className="px-2 py-1 text-xs font-bold bg-blue-500 text-white rounded-full">
                {totalUnread} unread
              </span>
            )}
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              {searchQuery ? 'No matching conversations' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <ConversationItem
                key={conv.lead_id}
                conversation={conv}
                selected={selectedConversation === conv.lead_id}
                onClick={() => setSelectedConversation(conv.lead_id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col bg-zinc-900">
        {error && (
          <div className="p-3 bg-red-900/50 border-b border-red-500 text-red-200 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">
              Dismiss
            </button>
          </div>
        )}

        {!selectedConversation ? (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <div className="text-4xl mb-4">...</div>
              <p>Select a conversation to view messages</p>
            </div>
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-white">
                    {selectedLead?.owner_name || 'Loading...'}
                  </h2>
                  <p className="text-sm text-zinc-400">
                    {selectedLead?.phone || selectedLead?.phone_1 || ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">
                    {messages.length} messages
                  </span>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-6 h-6 border-2 border-zinc-500 border-t-blue-500 rounded-full" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  No messages yet. Send the first message!
                </div>
              ) : (
                <>
                  {messages.map((msg) => (
                    <MessageBubble key={msg.id} message={msg} />
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Composer */}
            <MessageComposer
              onSend={handleSendMessage}
              sending={sending}
              disabled={!selectedConversation || loadingMessages}
            />
          </>
        )}
      </div>

      {/* Lead Info Sidebar */}
      <div className="w-72 border-l border-zinc-800 bg-zinc-950 overflow-y-auto">
        <div className="p-4 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-400">Lead Info</h3>
        </div>
        <LeadInfoSidebar lead={selectedLead} />
      </div>
    </div>
  )
}
