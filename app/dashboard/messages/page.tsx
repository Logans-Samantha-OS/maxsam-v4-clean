'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface MessageThread {
  lead_id: string
  owner_name: string
  phone: string
  property_address: string
  excess_funds_amount: number
  eleanor_score: number
  is_golden: boolean
  status: string
  message_count: number
  last_message: string
  last_message_at: string
  last_direction: string
}

interface Message {
  id: string
  lead_id: string
  message: string
  direction: 'inbound' | 'outbound'
  to_number: string
  from_number: string
  status: string
  intent: string
  created_at: string
}

interface LeadDetails {
  id: string
  owner_name: string
  phone: string
  phone_1: string
  phone_2: string
  email: string
  property_address: string
  city: string
  county: string
  state: string
  excess_funds_amount: number
  eleanor_score: number
  deal_grade: string
  is_golden: boolean
  status: string
  contact_attempts: number
  last_contact_at: string
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<MessageThread[]>([])
  const [selectedLead, setSelectedLead] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [leadDetails, setLeadDetails] = useState<LeadDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [search, setSearch] = useState('')

  const fetchThreads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/messages/threads')
      if (!res.ok) throw new Error('Failed to fetch threads')
      const data = await res.json()
      setThreads(data.threads || [])
    } catch (err) {
      console.error('Failed to fetch threads:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchMessages = useCallback(async (leadId: string) => {
    setMessagesLoading(true)
    try {
      const [messagesRes, leadRes] = await Promise.all([
        fetch(`/api/messages?lead_id=${leadId}`),
        fetch(`/api/leads/${leadId}`),
      ])

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json()
        setMessages(messagesData.messages || [])
      }

      if (leadRes.ok) {
        const leadData = await leadRes.json()
        setLeadDetails(leadData)
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err)
    } finally {
      setMessagesLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchThreads()
  }, [fetchThreads])

  useEffect(() => {
    if (selectedLead) {
      fetchMessages(selectedLead)
    }
  }, [selectedLead, fetchMessages])

  // Check URL for lead parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const leadId = params.get('lead')
    if (leadId) {
      setSelectedLead(leadId)
    }
  }, [])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedLead || !leadDetails) return

    setSending(true)
    try {
      const res = await fetch(`/api/leads/${selectedLead}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      })

      if (!res.ok) throw new Error('Failed to send message')

      setNewMessage('')
      fetchMessages(selectedLead)
      fetchThreads()
    } catch (err) {
      console.error('Failed to send message:', err)
    } finally {
      setSending(false)
    }
  }

  const handleMarkOptedOut = async () => {
    if (!selectedLead) return

    try {
      const res = await fetch(`/api/leads/${selectedLead}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'opted_out', do_not_contact: true }),
      })

      if (!res.ok) throw new Error('Failed to update lead')

      fetchMessages(selectedLead)
      fetchThreads()
    } catch (err) {
      console.error('Failed to mark opted out:', err)
    }
  }

  const handleSendAgreement = async (type: 'excess_funds' | 'distressed_property' | 'both') => {
    if (!selectedLead) return

    try {
      const res = await fetch(`/api/leads/${selectedLead}/agreement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })

      if (!res.ok) throw new Error('Failed to send agreement')

      fetchMessages(selectedLead)
    } catch (err) {
      console.error('Failed to send agreement:', err)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(amount || 0)
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const filteredThreads = threads.filter(t =>
    !search ||
    t.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) ||
    t.property_address?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Thread List */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
        {/* Search */}
        <div className="p-3 border-b border-zinc-800">
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border-zinc-700"
          />
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-zinc-400">Loading...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-zinc-400">No conversations</div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.lead_id}
                onClick={() => setSelectedLead(thread.lead_id)}
                className={`p-3 border-b border-zinc-800 cursor-pointer hover:bg-zinc-800/50 transition-colors ${
                  selectedLead === thread.lead_id ? 'bg-zinc-800' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="font-medium text-zinc-100 truncate">
                        {thread.owner_name || 'Unknown'}
                      </span>
                      {thread.is_golden && <span className="text-yellow-400">⭐</span>}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {formatPhone(thread.phone)}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500">
                    {formatTime(thread.last_message_at)}
                  </div>
                </div>
                <div className="mt-1 text-sm text-zinc-400 truncate">
                  {thread.last_direction === 'outbound' && (
                    <span className="text-zinc-500">You: </span>
                  )}
                  {thread.last_message}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-green-400">
                    {formatCurrency(thread.excess_funds_amount)}
                  </span>
                  <span className={`text-xs ${getScoreColor(thread.eleanor_score)}`}>
                    Score: {thread.eleanor_score}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation View */}
      <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
        {!selectedLead ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400">
            Select a conversation to view messages
          </div>
        ) : messagesLoading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400">
            Loading messages...
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            {leadDetails && (
              <div className="p-4 border-b border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-zinc-100">
                        {leadDetails.owner_name}
                      </h2>
                      {leadDetails.is_golden && <span className="text-yellow-400">⭐</span>}
                      {leadDetails.status && (
                        <Badge variant={leadDetails.status === 'opted_out' ? 'destructive' : 'secondary'}>
                          {leadDetails.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400">
                      {formatPhone(leadDetails.phone || leadDetails.phone_1 || leadDetails.phone_2)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSendAgreement('excess_funds')}
                    >
                      Send Agreement
                    </Button>
                    {leadDetails.status !== 'opted_out' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleMarkOptedOut}
                      >
                        Mark Opted Out
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center text-zinc-400 py-8">
                  No messages yet
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg p-3 ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-100'
                      }`}
                    >
                      <div className="text-sm">{msg.message}</div>
                      <div className={`text-xs mt-1 ${
                        msg.direction === 'outbound' ? 'text-blue-200' : 'text-zinc-500'
                      }`}>
                        {new Date(msg.created_at).toLocaleString()}
                        {msg.intent && (
                          <span className="ml-2">
                            · Intent: {msg.intent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Reply Buttons */}
            <div className="px-4 py-2 border-t border-zinc-800">
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewMessage("Hi! Just following up on the excess funds we found. Would you like help recovering them?")}
                >
                  Follow Up
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewMessage("Great! I'll send over the agreement for you to review. It only takes a few minutes to complete.")}
                >
                  Send Agreement
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setNewMessage("No problem! Let me know if you have any questions. We're here to help.")}
                >
                  Friendly Close
                </Button>
              </div>
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-zinc-800">
              <div className="flex gap-2">
                <Input
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  disabled={sending || leadDetails?.status === 'opted_out'}
                  className="bg-zinc-950 border-zinc-700"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim() || leadDetails?.status === 'opted_out'}
                >
                  {sending ? 'Sending...' : 'Send'}
                </Button>
              </div>
              {leadDetails?.status === 'opted_out' && (
                <p className="text-xs text-red-400 mt-2">
                  This lead has opted out of messages
                </p>
              )}
            </div>
          </>
        )}
      </div>

      {/* Lead Details Sidebar */}
      {selectedLead && leadDetails && (
        <div className="w-72 flex-shrink-0 bg-zinc-900 rounded-lg border border-zinc-800 p-4 overflow-y-auto">
          <h3 className="font-bold text-zinc-100 mb-4">Lead Details</h3>

          <div className="space-y-4">
            {/* Excess Funds */}
            <div>
              <div className="text-xs text-zinc-400">Excess Funds</div>
              <div className="text-xl font-bold text-green-400">
                {formatCurrency(leadDetails.excess_funds_amount)}
              </div>
            </div>

            {/* Eleanor Score */}
            <div>
              <div className="text-xs text-zinc-400">Eleanor Score</div>
              <div className={`text-xl font-bold ${getScoreColor(leadDetails.eleanor_score)}`}>
                {leadDetails.eleanor_score || 0}
                {leadDetails.deal_grade && (
                  <span className="text-sm text-zinc-500 ml-2">
                    ({leadDetails.deal_grade})
                  </span>
                )}
              </div>
            </div>

            {/* Property */}
            <div>
              <div className="text-xs text-zinc-400">Property</div>
              <div className="text-sm text-zinc-200">
                {leadDetails.property_address}
              </div>
              <div className="text-xs text-zinc-500">
                {leadDetails.city}, {leadDetails.county} County, {leadDetails.state}
              </div>
            </div>

            {/* Contact Info */}
            <div>
              <div className="text-xs text-zinc-400">Contact</div>
              {leadDetails.phone && (
                <div className="text-sm text-zinc-200">
                  <a href={`tel:${leadDetails.phone}`} className="hover:text-yellow-400">
                    {formatPhone(leadDetails.phone)}
                  </a>
                </div>
              )}
              {leadDetails.phone_1 && leadDetails.phone_1 !== leadDetails.phone && (
                <div className="text-sm text-zinc-400">
                  <a href={`tel:${leadDetails.phone_1}`} className="hover:text-yellow-400">
                    {formatPhone(leadDetails.phone_1)}
                  </a>
                </div>
              )}
              {leadDetails.email && (
                <div className="text-sm text-zinc-400">
                  {leadDetails.email}
                </div>
              )}
            </div>

            {/* Contact Attempts */}
            <div>
              <div className="text-xs text-zinc-400">Contact Attempts</div>
              <div className="text-sm text-zinc-200">
                {leadDetails.contact_attempts || 0} attempts
              </div>
              {leadDetails.last_contact_at && (
                <div className="text-xs text-zinc-500">
                  Last: {new Date(leadDetails.last_contact_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => window.location.href = `/leads/${selectedLead}`}
              >
                View Full Profile
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => handleSendAgreement('excess_funds')}
              >
                Send Excess Funds Agreement
              </Button>
              {leadDetails.is_golden && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => handleSendAgreement('both')}
                >
                  Send Both Agreements
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
