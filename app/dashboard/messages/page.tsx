'use client'

import { useEffect, useMemo, useState } from 'react'

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
  from_phone: string
  to_phone: string
  status: string
  created_at: string
}

function statusClass(status: string): string {
  const value = status.toLowerCase()
  if (value.includes('deliver')) return 'bg-emerald-400'
  if (value.includes('fail') || value.includes('undeliver')) return 'bg-red-400'
  return 'bg-amber-400'
}

export default function MessagesDashboardPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selectedPhone, setSelectedPhone] = useState<string>('')
  const [messages, setMessages] = useState<Message[]>([])

  useEffect(() => {
    const loadConversations = async () => {
      const response = await fetch('/api/conversations')
      const body = await response.json()
      if (body.success) {
        setConversations(body.conversations)
        if (!selectedPhone && body.conversations.length > 0) setSelectedPhone(body.conversations[0].phone)
      }
    }

    loadConversations()
    const interval = setInterval(loadConversations, 30000)
    return () => clearInterval(interval)
  }, [selectedPhone])

  useEffect(() => {
    if (!selectedPhone) return
    const loadThread = async () => {
      const response = await fetch(`/api/messages?phone=${selectedPhone}`)
      const body = await response.json()
      if (body.success) setMessages(body.messages)
    }
    loadThread()
  }, [selectedPhone])

  const selectedConversation = useMemo(
    () => conversations.find((conversation) => conversation.phone === selectedPhone) || null,
    [conversations, selectedPhone]
  )

  return (
    <div className="h-[calc(100vh-120px)] bg-gray-900 text-white rounded-lg border border-gray-700 overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-3 h-full">
        <aside className="border-r border-gray-700 overflow-y-auto">
          <div className="p-3 border-b border-gray-700 font-semibold">Conversations</div>
          {conversations.map((conversation) => (
            <button
              key={conversation.phone}
              onClick={() => setSelectedPhone(conversation.phone)}
              className={`w-full text-left p-3 border-b border-gray-800 hover:bg-gray-800 ${selectedPhone === conversation.phone ? 'bg-gray-800' : ''}`}
            >
              <div className="flex justify-between">
                <span className="font-medium">{conversation.owner_name}</span>
                <span className="text-xs text-gray-400">{new Date(conversation.last_message_at).toLocaleDateString()}</span>
              </div>
              <p className="text-sm text-gray-400 truncate">{conversation.last_message}</p>
              <div className="text-xs text-gray-500 mt-1">{conversation.phone} • {conversation.message_count} msgs</div>
            </button>
          ))}
        </aside>

        <section className="md:col-span-2 flex flex-col h-full">
          {selectedConversation ? (
            <>
              <div className="p-4 border-b border-gray-700 bg-gray-800">
                <h2 className="font-semibold">{selectedConversation.owner_name}</h2>
                <div className="text-sm text-gray-400">
                  {selectedConversation.phone} • Case {selectedConversation.case_number || 'N/A'} • ${Math.round(selectedConversation.excess_funds_amount).toLocaleString()} • {selectedConversation.eleanor_grade} / {selectedConversation.eleanor_score}
                </div>
                <div className="flex gap-2 mt-3">
                  {['Send Agreement', 'Opt Out', 'Needs Follow-Up', 'Verify Records'].map((action) => (
                    <button key={action} className="text-xs px-2 py-1 rounded bg-gray-700 hover:bg-gray-600">{action}</button>
                  ))}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${message.direction === 'outbound' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-100'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${statusClass(message.status)}`} />
                        <span className="text-[10px] opacity-80">{message.status}</span>
                      </div>
                      <p>{message.message}</p>
                      <p className="text-[10px] mt-1 opacity-70">{new Date(message.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-6 text-gray-400">Select a conversation.</div>
          )}
        </section>
      </div>
    </div>
  )
}
