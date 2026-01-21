'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

type MessageThread = {
  lead_id: string;
  owner_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
};

type SMSMessage = {
  id: string;
  lead_id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
};

export default function MessagingCenter() {
  const supabase = createClient();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch threads using the RPC
  const fetchThreads = useCallback(async () => {
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('get_message_threads');

    if (rpcError) {
      console.error('Failed to fetch threads:', rpcError);
      setError('Failed to load conversations');
      return;
    }

    setThreads(data ?? []);
    setLoading(false);
  }, [supabase]);

  // Fetch messages for selected thread
  const fetchMessages = useCallback(async (leadId: string) => {
    const { data, error: msgError } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (msgError) {
      console.error('Failed to fetch messages:', msgError);
      return;
    }

    setMessages(data ?? []);
  }, [supabase]);

  // Initial load
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Load messages when thread selected
  useEffect(() => {
    if (selectedThread) {
      fetchMessages(selectedThread);
    }
  }, [selectedThread, fetchMessages]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Realtime subscription for new messages
  useEffect(() => {
    if (!selectedThread) return;

    const channel = supabase
      .channel(`sms:${selectedThread}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sms_messages',
          filter: `lead_id=eq.${selectedThread}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as SMSMessage]);
          fetchThreads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedThread, supabase, fetchThreads]);

  // Send message via API (which handles Twilio + logging)
  const handleSend = async () => {
    if (!newMessage.trim() || !selectedThread || sending) return;

    setSending(true);
    setError(null);
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedThread,
          message: newMessage
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send message');
      }

      setNewMessage('');
      setTimeout(() => {
        fetchMessages(selectedThread);
        fetchThreads();
      }, 500);
    } catch (err) {
      console.error('Send error:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const selectedOwner = threads.find(t => t.lead_id === selectedThread)?.owner_name;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] bg-zinc-950 rounded-lg border border-zinc-800 overflow-hidden">
      {/* Thread List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-zinc-100">Conversations</h2>
          <p className="text-sm text-zinc-500">{threads.length} threads</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">
              No conversations yet
            </div>
          ) : (
            threads.map((thread) => (
              <button
                key={thread.lead_id}
                onClick={() => setSelectedThread(thread.lead_id)}
                className={`w-full p-4 text-left border-b border-zinc-800 transition hover:bg-zinc-900 ${
                  selectedThread === thread.lead_id ? 'bg-zinc-900 border-l-2 border-l-cyan-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-zinc-100 truncate">
                    {thread.owner_name || 'Unknown'}
                  </span>
                  <span className="text-xs text-zinc-500 ml-2 shrink-0">
                    {thread.last_message_at
                      ? new Date(thread.last_message_at).toLocaleDateString()
                      : ''}
                  </span>
                </div>
                <p className="text-sm text-zinc-400 truncate">
                  {thread.last_message || 'No messages'}
                </p>
                <span className="inline-block mt-1 text-xs text-zinc-600">
                  {thread.message_count} message{thread.message_count !== 1 ? 's' : ''}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Area */}
      <div className="flex-1 flex flex-col">
        {selectedThread ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-zinc-800 bg-zinc-900/50">
              <h3 className="font-semibold text-zinc-100">{selectedOwner || 'Unknown'}</h3>
              <p className="text-sm text-zinc-500">Lead ID: {selectedThread.slice(0, 8)}...</p>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg) => (
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
                    <p className="text-sm">{msg.message}</p>
                    <p className={`text-xs mt-1 ${
                      msg.direction === 'outbound' ? 'text-cyan-200' : 'text-zinc-500'
                    }`}>
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
              {error && (
                <p className="text-red-400 text-sm mb-2">{error}</p>
              )}
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
