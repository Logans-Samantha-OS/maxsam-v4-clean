'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type MessageThread = {
  lead_id: string;
  owner_name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  message_count: number;
  excess_funds_amount?: number;
  eleanor_score?: number;
};

type SMSMessage = {
  id: string;
  lead_id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
  from_number?: string;
  to_number?: string;
  status?: string;
};

export default function MessagingCenter() {
  const supabase = createClientComponentClient();
  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<SMSMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch threads using the RPC - with fallback to direct query
  const fetchThreads = useCallback(async () => {
    setError(null);
    
    // Try RPC first
    const { data: rpcData, error: rpcError } = await supabase.rpc('get_message_threads');
    
    if (!rpcError && rpcData && rpcData.length > 0) {
      setThreads(rpcData);
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }
    
    // Fallback: Direct query if RPC returns empty or errors
    console.log('RPC returned empty, trying direct query...');
    
    const { data: directData, error: directError } = await supabase
      .from('sms_messages')
      .select('lead_id, message, direction, created_at')
      .not('lead_id', 'is', null)
      .order('created_at', { ascending: false });
    
    if (directError) {
      console.error('Direct query failed:', directError);
      
      // Ultimate fallback: Try outreach_log
      const { data: outreachData } = await supabase
        .from('outreach_log')
        .select('*')
        .eq('channel', 'sms')
        .order('sent_at', { ascending: false })
        .limit(50);
      
      if (outreachData && outreachData.length > 0) {
        // Group by lead_id
        const threadMap = new Map<string, MessageThread>();
        for (const row of outreachData) {
          const leadId = row.lead_id?.toString();
          if (!leadId) continue;
          
          if (!threadMap.has(leadId)) {
            threadMap.set(leadId, {
              lead_id: leadId,
              owner_name: row.owner_name || 'Unknown',
              last_message: row.message_content,
              last_message_at: row.sent_at,
              message_count: 1,
            });
          } else {
            const existing = threadMap.get(leadId)!;
            existing.message_count++;
          }
        }
        setThreads(Array.from(threadMap.values()));
      }
      
      setLoading(false);
      setLastRefresh(new Date());
      return;
    }
    
    // Group messages by lead_id
    if (directData) {
      const threadMap = new Map<string, MessageThread>();
      
      for (const msg of directData) {
        const leadId = msg.lead_id;
        if (!leadId) continue;
        
        if (!threadMap.has(leadId)) {
          threadMap.set(leadId, {
            lead_id: leadId,
            owner_name: null, // Will be enriched below
            last_message: msg.message,
            last_message_at: msg.created_at,
            message_count: 1,
          });
        } else {
          threadMap.get(leadId)!.message_count++;
        }
      }
      
      // Enrich with lead names
      const leadIds = Array.from(threadMap.keys());
      if (leadIds.length > 0) {
        const { data: leads } = await supabase
          .from('maxsam_leads')
          .select('id, owner_name, excess_funds_amount, eleanor_score')
          .in('id', leadIds);
        
        if (leads) {
          for (const lead of leads) {
            const thread = threadMap.get(lead.id);
            if (thread) {
              thread.owner_name = lead.owner_name;
              thread.excess_funds_amount = lead.excess_funds_amount;
              thread.eleanor_score = lead.eleanor_score;
            }
          }
        }
        
        // Also check golden_leads
        const { data: goldenLeads } = await supabase
          .from('golden_leads')
          .select('id, owner_name, excess_funds_amount, priority_score')
          .in('id', leadIds);
        
        if (goldenLeads) {
          for (const lead of goldenLeads) {
            const thread = threadMap.get(lead.id);
            if (thread && !thread.owner_name) {
              thread.owner_name = lead.owner_name;
              thread.excess_funds_amount = lead.excess_funds_amount;
              thread.eleanor_score = lead.priority_score;
            }
          }
        }
      }
      
      setThreads(Array.from(threadMap.values()));
    }
    
    setLoading(false);
    setLastRefresh(new Date());
  }, [supabase]);

  // Fetch messages for selected thread
  const fetchMessages = useCallback(async (leadId: string) => {
    // Get from sms_messages
    const { data: smsData, error: smsError } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: true });

    if (smsError) {
      console.error('Failed to fetch from sms_messages:', smsError);
    }

    // Also get from outreach_log as fallback
    const { data: outreachData } = await supabase
      .from('outreach_log')
      .select('*')
      .eq('lead_id', leadId)
      .eq('channel', 'sms')
      .order('sent_at', { ascending: true });

    // Merge and dedupe
    const allMessages: SMSMessage[] = [];
    const seen = new Set<string>();

    // Add sms_messages first
    if (smsData) {
      for (const msg of smsData) {
        const key = `${msg.message}-${msg.created_at}`;
        if (!seen.has(key)) {
          seen.add(key);
          allMessages.push(msg);
        }
      }
    }

    // Add outreach_log messages that aren't in sms_messages
    if (outreachData) {
      for (const row of outreachData) {
        const key = `${row.message_content}-${row.sent_at}`;
        if (!seen.has(key)) {
          seen.add(key);
          allMessages.push({
            id: row.id || `outreach-${row.sent_at}`,
            lead_id: leadId,
            message: row.message_content,
            direction: 'outbound',
            created_at: row.sent_at,
            status: row.status,
          });
        }
      }
    }

    // Sort by created_at
    allMessages.sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    setMessages(allMessages);
  }, [supabase]);

  // Initial load
  useEffect(() => {
    fetchThreads();
  }, [fetchThreads]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchThreads();
      if (selectedThread) {
        fetchMessages(selectedThread);
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchThreads, fetchMessages, selectedThread]);

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

  // Send message via API
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

  // Manual refresh
  const handleRefresh = () => {
    fetchThreads();
    if (selectedThread) {
      fetchMessages(selectedThread);
    }
  };

  const selectedOwner = threads.find(t => t.lead_id === selectedThread)?.owner_name;
  const selectedAmount = threads.find(t => t.lead_id === selectedThread)?.excess_funds_amount;

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
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Conversations</h2>
              <p className="text-sm text-zinc-500">{threads.length} threads</p>
            </div>
            <button
              onClick={handleRefresh}
              className="p-2 text-zinc-400 hover:text-cyan-400 transition"
              title="Refresh"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-zinc-600 mt-1">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {threads.length === 0 ? (
            <div className="p-4 text-center text-zinc-500">
              <p>No conversations yet</p>
              <p className="text-xs mt-2">SMS messages will appear here after campaigns run</p>
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
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-zinc-600">
                    {thread.message_count} msg{thread.message_count !== 1 ? 's' : ''}
                  </span>
                  {thread.excess_funds_amount && (
                    <span className="text-xs text-emerald-500 font-medium">
                      ${thread.excess_funds_amount.toLocaleString()}
                    </span>
                  )}
                  {thread.eleanor_score && thread.eleanor_score >= 70 && (
                    <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">
                      Score: {thread.eleanor_score}
                    </span>
                  )}
                </div>
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
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-zinc-100">{selectedOwner || 'Unknown'}</h3>
                  <p className="text-sm text-zinc-500">Lead ID: {selectedThread.slice(0, 8)}...</p>
                </div>
                {selectedAmount && (
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Excess Funds</p>
                    <p className="text-lg font-bold text-emerald-400">${selectedAmount.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-zinc-500 mt-8">
                  No messages in this conversation yet
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
                      <div className={`flex items-center gap-2 mt-1 text-xs ${
                        msg.direction === 'outbound' ? 'text-cyan-200' : 'text-zinc-500'
                      }`}>
                        <span>{new Date(msg.created_at).toLocaleString()}</span>
                        {msg.status && (
                          <span className="opacity-75">• {msg.status}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
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
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white rounded-lg transition font-medium"
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
            <svg className="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <p>Select a conversation to view messages</p>
          </div>
        )}
      </div>
    </div>
  );
}
