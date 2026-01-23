'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

type Message = {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  message: string;
  from_number: string;
  to_number: string;
  status: string;
  created_at: string;
  read_at: string | null;
  intent?: string | null;
  sentiment?: string | null;
  channel?: string;
};

type Lead = {
  id: string;
  owner_name: string;
  property_address: string;
  excess_funds_amount: number;
  eleanor_score: number;
  status: string;
  phone?: string | null;
  phone_1?: string | null;
  phone_2?: string | null;
};

type Conversation = {
  lead_id: string;
  last_message: string;
  last_message_time: string;
  last_direction: string;
  unread_count: number;
  total_messages: number;
  phone: string;
  last_intent: string | null;
  lead: Lead | null;
};

export default function MessagingCenter() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalUnread, setTotalUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      if (!res.ok) throw new Error('Failed to fetch conversations');
      const data = await res.json();
      setConversations(data.conversations || []);
      setTotalUnread(data.total_unread || 0);
      setError(null);
    } catch (err) {
      console.error('Fetch conversations error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load conversations');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch messages for a specific lead
  const fetchMessages = useCallback(async (leadId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?lead_id=${leadId}`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const data = await res.json();
      setMessages(data.messages || []);
      setSelectedLead(data.lead || null);

      // Mark messages as read
      await fetch('/api/messages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, mark_all_read: true })
      });

      // Update unread count locally
      setConversations(prev => {
        const conv = prev.find(c => c.lead_id === leadId);
        if (conv && conv.unread_count > 0) {
          setTotalUnread(t => Math.max(0, t - conv.unread_count));
        }
        return prev.map(c =>
          c.lead_id === leadId ? { ...c, unread_count: 0 } : c
        );
      });

    } catch (err) {
      console.error('Fetch messages error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchConversations();
  }, [fetchConversations]);

  // Load messages when lead selected
  useEffect(() => {
    if (selectedLeadId) {
      fetchMessages(selectedLeadId);
    }
  }, [selectedLeadId, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Poll for new messages every 15 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchConversations();
      if (selectedLeadId) {
        fetchMessages(selectedLeadId);
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations, fetchMessages, selectedLeadId]);

  // Send message
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedLeadId || sending) return;

    setSending(true);
    setError(null);
    try {
      // Get phone from conversation or lead (conversation has the phone from sms_messages)
      const selectedConv = conversations.find(c => c.lead_id === selectedLeadId);
      const toNumber = selectedConv?.phone || selectedLead?.phone || selectedLead?.phone_1 || selectedLead?.phone_2;

      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          message: newMessage,
          to_number: toNumber
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send message');
      }

      setNewMessage('');

      // Refresh messages
      setTimeout(() => {
        fetchMessages(selectedLeadId);
        fetchConversations();
      }, 500);

    } catch (err) {
      console.error('Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Conversation List - Left Sidebar */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-100">Conversations</h2>
            {totalUnread > 0 && (
              <span className="px-2 py-1 text-xs font-bold bg-cyan-500 text-white rounded-full">
                {totalUnread}
              </span>
            )}
          </div>
          <p className="text-sm text-zinc-500">{conversations.length} threads</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">
              No conversations yet
            </div>
          ) : (
            conversations.map((conv) => (
              <button
                key={conv.lead_id}
                onClick={() => setSelectedLeadId(conv.lead_id)}
                className={`w-full p-4 text-left border-b border-zinc-800 transition hover:bg-zinc-900 ${
                  selectedLeadId === conv.lead_id ? 'bg-zinc-900 border-l-2 border-l-cyan-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-zinc-100 truncate">
                      {conv.lead?.owner_name || 'Unknown'}
                    </span>
                    {conv.unread_count > 0 && (
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-cyan-500 text-white rounded-full">
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500 ml-2 shrink-0">
                    {formatTime(conv.last_message_time)}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 truncate">
                  {conv.last_direction === 'outbound' && <span className="text-zinc-500">You: </span>}
                  {conv.last_message || 'No messages'}
                </p>
                {conv.lead && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
                      ${conv.lead.excess_funds_amount?.toLocaleString() || 0}
                    </span>
                    {conv.lead.eleanor_score > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
                        Score: {conv.lead.eleanor_score}
                      </span>
                    )}
                  </div>
                )}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Area - Right Panel */}
      <div className="flex-1 flex flex-col">
        {error && (
          <div className="p-3 bg-red-900/50 border-b border-red-500 text-red-200 text-sm">
            {error}
            <button onClick={() => setError(null)} className="ml-4 underline">Dismiss</button>
          </div>
        )}

        {selectedLeadId ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
              <h3 className="font-semibold text-zinc-100">{selectedLead?.owner_name || 'Unknown'}</h3>
              <p className="text-sm text-zinc-500">
                {selectedLead?.property_address || `Lead ID: ${selectedLeadId.slice(0, 8)}...`}
              </p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500"></div>
                </div>
              ) : messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  No messages yet. Send the first message!
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.direction === 'outbound'
                          ? 'bg-cyan-600 text-white'
                          : 'bg-zinc-800 text-zinc-100'
                      }`}
                    >
                      <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                      <p className={`text-xs mt-1 ${
                        msg.direction === 'outbound' ? 'text-cyan-200' : 'text-zinc-500'
                      }`}>
                        {new Date(msg.created_at).toLocaleTimeString()}
                        {msg.direction === 'outbound' && msg.status && (
                          <span className="ml-2 capitalize">{msg.status}</span>
                        )}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder="Type a message..."
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  disabled={sending}
                />
                <button
                  onClick={handleSend}
                  disabled={sending || !newMessage.trim()}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            Select a conversation to view messages
          </div>
        )}
      </div>
    </div>
  );
}
