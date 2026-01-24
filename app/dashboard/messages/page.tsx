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
  case_number: string
  cause_number: string
  sale_date: string
  bedrooms: number
  bathrooms: number
  zestimate: number
  claim_deadline: string
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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount || 0)
  }

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    if (cleaned.length === 11 && cleaned.startsWith('1')) {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const formatTime = (dateStr: string) => {
    if (!dateStr) return ''
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

  // Get first name from full name
  const getFirstName = (fullName: string | null) => {
    if (!fullName) return 'there'
    const parts = fullName.trim().split(' ')
    return parts[0] || 'there'
  }

  // Generate weaponized message templates using lead data
  const getWeaponizedTemplates = () => {
    if (!leadDetails) return []

    const firstName = getFirstName(leadDetails.owner_name)
    const amount = formatCurrency(leadDetails.excess_funds_amount)
    const address = leadDetails.property_address || 'your former property'
    const caseNum = leadDetails.case_number || leadDetails.cause_number || ''

    return [
      {
        label: 'Initial Outreach',
        message: `Hi ${firstName}! This is Sam from MaxSam Recovery Services. I found ${amount} in excess funds from ${address} that belongs to you. Would you like help recovering it? It's free to check eligibility.`
      },
      {
        label: 'Follow Up',
        message: `Hi ${firstName}, just following up about the ${amount} in excess funds from ${address}. These funds expire if not claimed - happy to help you recover what's yours. Interested?`
      },
      {
        label: 'Urgency',
        message: `${firstName}, quick reminder - the ${amount} from your property at ${address} won't be available forever. I can help you claim it before the deadline. Want me to send the paperwork?`
      },
      {
        label: 'Send Agreement',
        message: `Great news ${firstName}! I'll send over the agreement now for the ${amount} recovery. It only takes a few minutes to complete - you'll receive a link shortly.`
      },
      {
        label: 'Friendly Close',
        message: `No problem ${firstName}! If you ever want to explore recovering the ${amount}, just reply here. We're always happy to help. Have a great day!`
      },
    ]
  }

  const filteredThreads = threads.filter(t =>
    !search ||
    t.owner_name?.toLowerCase().includes(search.toLowerCase()) ||
    t.phone?.includes(search) ||
    t.property_address?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="flex h-[calc(100vh-120px)] gap-4">
      {/* Thread List - Left Sidebar */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
        {/* Search */}
        <div className="p-3 border-b border-zinc-800">
          <Input
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-zinc-950 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
          />
        </div>

        {/* Thread List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-zinc-400">Loading conversations...</div>
          ) : filteredThreads.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">
              <p>No conversations yet</p>
              <p className="text-xs mt-2">Send a message to a lead to start a conversation</p>
            </div>
          ) : (
            filteredThreads.map((thread) => (
              <div
                key={thread.lead_id}
                onClick={() => setSelectedLead(thread.lead_id)}
                className={`p-3 border-b border-zinc-800 cursor-pointer transition-colors ${
                  selectedLead === thread.lead_id
                    ? 'bg-zinc-800 border-l-2 border-l-blue-500'
                    : 'hover:bg-zinc-800/50'
                }`}
              >
                {/* Name & Time Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-white truncate">
                        {thread.owner_name || 'Unknown'}
                      </span>
                      {thread.is_golden && <span className="text-yellow-400 text-sm">⭐</span>}
                    </div>
                  </div>
                  <div className="text-xs text-zinc-500 flex-shrink-0">
                    {formatTime(thread.last_message_at)}
                  </div>
                </div>

                {/* Amount & Score Row */}
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-sm font-medium text-emerald-400">
                    {formatCurrency(thread.excess_funds_amount)}
                  </span>
                  <span className="text-sm font-medium text-purple-400">
                    Score: {thread.eleanor_score || 0}
                  </span>
                </div>

                {/* Last Message Preview */}
                <div className="mt-1.5 text-sm text-zinc-400 truncate">
                  {thread.last_direction === 'outbound' && (
                    <span className="text-zinc-500">You: </span>
                  )}
                  {thread.last_message || 'No messages yet'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Conversation View - Center */}
      <div className="flex-1 flex flex-col bg-zinc-900 rounded-lg border border-zinc-800">
        {!selectedLead ? (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <div className="text-4xl mb-4">💬</div>
            <p>Select a conversation to view messages</p>
          </div>
        ) : messagesLoading ? (
          <div className="flex-1 flex items-center justify-center text-zinc-400">
            Loading messages...
          </div>
        ) : (
          <>
            {/* Conversation Header */}
            {leadDetails && (
              <div className="p-4 border-b border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">
                        {leadDetails.owner_name}
                      </h2>
                      {leadDetails.is_golden && <span className="text-yellow-400">⭐</span>}
                      {leadDetails.status && (
                        <Badge
                          variant={leadDetails.status === 'opted_out' ? 'destructive' : 'secondary'}
                          className="text-xs"
                        >
                          {leadDetails.status}
                        </Badge>
                      )}
                    </div>
                    <div className="text-sm text-zinc-400 mt-0.5">
                      {formatPhone(leadDetails.phone || leadDetails.phone_1 || leadDetails.phone_2)}
                      {leadDetails.property_address && (
                        <span className="ml-2 text-zinc-500">• {leadDetails.property_address}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleSendAgreement('excess_funds')}
                    >
                      Send Agreement
                    </Button>
                    {leadDetails.status !== 'opted_out' && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="bg-red-600 hover:bg-red-700"
                        onClick={handleMarkOptedOut}
                      >
                        Opt Out
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-zinc-950/30">
              {messages.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">
                  <p>No messages yet</p>
                  <p className="text-sm mt-2">Use the quick actions below to start the conversation</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[75%] rounded-lg p-3 ${
                        msg.direction === 'outbound'
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-100'
                      }`}
                    >
                      <div className="text-sm whitespace-pre-wrap">{msg.message}</div>
                      <div className={`text-xs mt-1.5 ${
                        msg.direction === 'outbound' ? 'text-blue-200' : 'text-zinc-500'
                      }`}>
                        {new Date(msg.created_at).toLocaleString()}
                        {msg.intent && (
                          <span className="ml-2 px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">
                            {msg.intent}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Quick Reply Buttons - WEAPONIZED */}
            <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/50">
              <div className="text-xs text-zinc-500 mb-2">Quick Actions (personalized for {getFirstName(leadDetails?.owner_name || null)})</div>
              <div className="flex gap-2 flex-wrap">
                {getWeaponizedTemplates().map((template, idx) => (
                  <Button
                    key={idx}
                    size="sm"
                    className="bg-zinc-800 border border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:text-white hover:border-zinc-500"
                    onClick={() => setNewMessage(template.message)}
                  >
                    {template.label}
                  </Button>
                ))}
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
                  className="bg-zinc-950 border-zinc-700 text-zinc-200 placeholder:text-zinc-500"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={sending || !newMessage.trim() || leadDetails?.status === 'opted_out'}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6"
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

      {/* Lead Details Sidebar - Right */}
      {selectedLead && leadDetails && (
        <div className="w-72 flex-shrink-0 bg-zinc-900 rounded-lg border border-zinc-800 p-4 overflow-y-auto">
          <h3 className="font-bold text-white mb-4">Lead Details</h3>

          <div className="space-y-4">
            {/* Excess Funds - Primary */}
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Excess Funds</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">
                {formatCurrency(leadDetails.excess_funds_amount)}
              </div>
            </div>

            {/* Eleanor Score */}
            <div className="p-3 bg-zinc-950 rounded-lg border border-zinc-800">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">Eleanor Score</div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-2xl font-bold text-purple-400">
                  {leadDetails.eleanor_score || 0}
                </span>
                {leadDetails.deal_grade && (
                  <span className="text-sm text-zinc-400">
                    Grade: {leadDetails.deal_grade}
                  </span>
                )}
              </div>
            </div>

            {/* Property Info */}
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Property</div>
              <div className="text-sm text-zinc-200">
                {leadDetails.property_address || 'No address'}
              </div>
              {(leadDetails.city || leadDetails.county) && (
                <div className="text-xs text-zinc-500 mt-0.5">
                  {[leadDetails.city, leadDetails.county && `${leadDetails.county} County`, leadDetails.state]
                    .filter(Boolean)
                    .join(', ')}
                </div>
              )}
              {(leadDetails.bedrooms || leadDetails.bathrooms) && (
                <div className="text-xs text-zinc-400 mt-1">
                  {leadDetails.bedrooms && `${leadDetails.bedrooms} bed`}
                  {leadDetails.bedrooms && leadDetails.bathrooms && ' / '}
                  {leadDetails.bathrooms && `${leadDetails.bathrooms} bath`}
                </div>
              )}
              {leadDetails.zestimate && (
                <div className="text-xs text-emerald-400 mt-1">
                  Zestimate: {formatCurrency(leadDetails.zestimate)}
                </div>
              )}
            </div>

            {/* Case Info */}
            {(leadDetails.case_number || leadDetails.cause_number) && (
              <div>
                <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Case Info</div>
                <div className="text-sm text-zinc-300 font-mono">
                  {leadDetails.case_number || leadDetails.cause_number}
                </div>
                {leadDetails.sale_date && (
                  <div className="text-xs text-zinc-500 mt-0.5">
                    Sale: {new Date(leadDetails.sale_date).toLocaleDateString()}
                  </div>
                )}
              </div>
            )}

            {/* Contact Info */}
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Contact</div>
              {(leadDetails.phone || leadDetails.phone_1 || leadDetails.phone_2) && (
                <div className="space-y-1">
                  {leadDetails.phone && (
                    <a
                      href={`tel:${leadDetails.phone}`}
                      className="block text-sm text-zinc-200 hover:text-emerald-400 transition-colors"
                    >
                      📱 {formatPhone(leadDetails.phone)}
                    </a>
                  )}
                  {leadDetails.phone_1 && leadDetails.phone_1 !== leadDetails.phone && (
                    <a
                      href={`tel:${leadDetails.phone_1}`}
                      className="block text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
                    >
                      📞 {formatPhone(leadDetails.phone_1)}
                    </a>
                  )}
                  {leadDetails.phone_2 && leadDetails.phone_2 !== leadDetails.phone && leadDetails.phone_2 !== leadDetails.phone_1 && (
                    <a
                      href={`tel:${leadDetails.phone_2}`}
                      className="block text-sm text-zinc-400 hover:text-emerald-400 transition-colors"
                    >
                      📞 {formatPhone(leadDetails.phone_2)}
                    </a>
                  )}
                </div>
              )}
              {leadDetails.email && (
                <a
                  href={`mailto:${leadDetails.email}`}
                  className="block text-sm text-zinc-400 hover:text-emerald-400 mt-1 transition-colors"
                >
                  ✉️ {leadDetails.email}
                </a>
              )}
            </div>

            {/* Contact History */}
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Contact History</div>
              <div className="text-sm text-zinc-300">
                {leadDetails.contact_attempts || 0} attempts
              </div>
              {leadDetails.last_contact_at && (
                <div className="text-xs text-zinc-500 mt-0.5">
                  Last: {new Date(leadDetails.last_contact_at).toLocaleDateString()}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-zinc-800 space-y-2">
              <Button
                size="sm"
                className="w-full bg-zinc-800 border border-zinc-600 text-zinc-200 hover:bg-zinc-700 hover:text-white"
                onClick={() => window.location.href = `/dashboard/leads?id=${selectedLead}`}
              >
                View Full Profile
              </Button>
              <Button
                size="sm"
                className="w-full bg-emerald-700 hover:bg-emerald-600 text-white"
                onClick={() => handleSendAgreement('excess_funds')}
              >
                Send Excess Funds Agreement
              </Button>
              {leadDetails.is_golden && (
                <Button
                  size="sm"
                  className="w-full bg-yellow-600 hover:bg-yellow-500 text-white"
                  onClick={() => handleSendAgreement('both')}
                >
                  ⭐ Send Both Agreements
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
