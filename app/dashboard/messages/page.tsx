'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/components/Toast';

// ============================================================================
// TYPES
// ============================================================================

interface Message {
  id: string;
  lead_id: string;
  direction: 'inbound' | 'outbound';
  body: string;
  from_number: string;
  to_number: string;
  status: string;
  created_at: string;
  read_at: string | null;
  intent?: string;
  sentiment?: string;
}

interface Lead {
  id: string;
  owner_name: string;
  property_address: string;
  excess_funds_amount: number;
  eleanor_score: number;
  status: string;
  phone?: string;
  phone_1?: string;
  phone_2?: string;
}

interface Conversation {
  lead_id: string;
  last_message: string;
  last_message_time: string;
  last_direction: string;
  unread_count: number;
  total_messages: number;
  phone: string;
  last_intent: string | null;
  lead: Lead | null;
}

// ============================================================================
// MESSAGE TEMPLATES
// ============================================================================

const QUICK_TEMPLATES = [
  {
    label: 'Initial Outreach',
    message: "Hi {name}! I'm reaching out about unclaimed funds from your former property. The county is holding ${amount} in YOUR name - no cost to claim it. Would you like details?",
  },
  {
    label: 'Follow Up',
    message: "Hi {name}, just following up on the unclaimed funds. This money is legally YOURS and there's absolutely no cost or risk to you. Can I explain the simple process?",
  },
  {
    label: 'Ready to Start',
    message: "Great news {name}! I can send you the paperwork right now. You'll review and sign digitally - completely free. Should I send it over?",
  },
  {
    label: 'Agreement Sent',
    message: "Hi {name}, I just sent the agreement to your email. No upfront fees, no cost to you - we only get paid when you receive your ${amount}. Any questions?",
  },
];

// ============================================================================
// CONVERSATION LIST ITEM
// ============================================================================

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const lead = conversation.lead;
  const hasUnread = conversation.unread_count > 0;

  return (
    <div
      onClick={onClick}
      className={`p-4 border-b border-zinc-800 cursor-pointer transition-colors hover:bg-zinc-800/50 ${
        isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : ''
      } ${hasUnread ? 'bg-yellow-500/5' : ''}`}
    >
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {hasUnread && (
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          )}
          <span className="font-medium text-white truncate max-w-[180px]">
            {lead?.owner_name || 'Unknown'}
          </span>
        </div>
        <span className="text-xs text-zinc-500">
          {new Date(conversation.last_message_time).toLocaleDateString()}
        </span>
      </div>

      <p className="text-sm text-zinc-400 truncate mb-2">
        {conversation.last_direction === 'outbound' ? '→ ' : '← '}
        {conversation.last_message}
      </p>

      <div className="flex items-center gap-2 text-xs">
        {lead?.excess_funds_amount && (
          <span className="px-2 py-0.5 bg-green-500/20 text-green-400 rounded">
            ${Math.round(lead.excess_funds_amount / 1000)}K
          </span>
        )}
        {lead?.eleanor_score && (
          <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded">
            Score: {lead.eleanor_score}
          </span>
        )}
        {conversation.last_intent && (
          <span className={`px-2 py-0.5 rounded ${
            conversation.last_intent === 'interested' ? 'bg-green-500/20 text-green-400' :
            conversation.last_intent === 'not_interested' ? 'bg-red-500/20 text-red-400' :
            'bg-zinc-700 text-zinc-400'
          }`}>
            {conversation.last_intent}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MESSAGE BUBBLE
// ============================================================================

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound';

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'} mb-3`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-2 ${
          isOutbound
            ? 'bg-cyan-500 text-white rounded-br-sm'
            : 'bg-zinc-800 text-white rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
        <div className={`flex items-center gap-2 mt-1 text-xs ${
          isOutbound ? 'text-cyan-200' : 'text-zinc-500'
        }`}>
          <span>
            {new Date(message.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {isOutbound && (
            <span>
              {message.status === 'sent' ? '✓' : message.status === 'delivered' ? '✓✓' : '...'}
            </span>
          )}
          {!isOutbound && message.intent && (
            <span className="px-1.5 py-0.5 bg-black/20 rounded text-xs">
              {message.intent}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Fetch all conversations
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch('/api/messages');
      const data = await res.json();

      if (data.success) {
        setConversations(data.conversations || []);
      }
    } catch (err) {
      console.error('Failed to fetch conversations:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch messages for a specific conversation
  const fetchMessages = useCallback(async (leadId: string) => {
    setLoadingMessages(true);
    try {
      const res = await fetch(`/api/messages?lead_id=${leadId}`);
      const data = await res.json();

      if (data.success) {
        setMessages(data.messages || []);

        // Mark messages as read
        await fetch('/api/messages', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id: leadId, mark_all_read: true }),
        });

        // Update unread count in conversation list
        setConversations(prev =>
          prev.map(c =>
            c.lead_id === leadId ? { ...c, unread_count: 0 } : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  // Load conversations on mount
  useEffect(() => {
    fetchConversations();

    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchConversations, 30000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle selecting a conversation
  const handleSelectConversation = async (conversation: Conversation) => {
    setSelectedConversation(conversation);
    await fetchMessages(conversation.lead_id);
  };

  // Send a message
  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedConversation) return;

    setSending(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedConversation.lead_id,
          message: inputMessage.trim(),
          to_number: selectedConversation.phone,
        }),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Message sent successfully');
        setInputMessage('');

        // Add the new message to the list
        if (data.message) {
          setMessages(prev => [...prev, data.message]);
        }

        // Update conversation list
        setConversations(prev =>
          prev.map(c =>
            c.lead_id === selectedConversation.lead_id
              ? {
                  ...c,
                  last_message: inputMessage.trim(),
                  last_message_time: new Date().toISOString(),
                  last_direction: 'outbound',
                  total_messages: c.total_messages + 1,
                }
              : c
          )
        );
      } else {
        addToast('error', data.error || 'Failed to send message');
      }
    } catch (err) {
      console.error('Failed to send message:', err);
      addToast('error', 'Network error while sending message');
    } finally {
      setSending(false);
    }
  };

  // Apply a template
  const applyTemplate = (template: typeof QUICK_TEMPLATES[0]) => {
    if (!selectedConversation?.lead) return;

    const lead = selectedConversation.lead;
    let message = template.message;

    // Replace placeholders
    message = message.replace('{name}', lead.owner_name?.split(' ')[0] || 'there');
    message = message.replace(
      '{amount}',
      lead.excess_funds_amount?.toLocaleString() || '0'
    );

    setInputMessage(message);
    setShowTemplates(false);
  };

  // Opt out a lead
  const handleOptOut = async () => {
    if (!selectedConversation) return;

    if (!confirm('Are you sure you want to opt out this lead? They will not receive any more messages.')) {
      return;
    }

    try {
      const res = await fetch(`/api/leads/${selectedConversation.lead_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'opted_out' }),
      });

      if (res.ok) {
        addToast('success', 'Lead opted out successfully');
        setConversations(prev =>
          prev.filter(c => c.lead_id !== selectedConversation.lead_id)
        );
        setSelectedConversation(null);
        setMessages([]);
      } else {
        addToast('error', 'Failed to opt out lead');
      }
    } catch {
      addToast('error', 'Network error');
    }
  };

  // Send agreement via BoldSign
  const [sendingAgreement, setSendingAgreement] = useState(false);

  const handleSendAgreement = async () => {
    if (!selectedConversation) return;

    setSendingAgreement(true);
    try {
      const res = await fetch('/api/boldsign/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: selectedConversation.lead_id }),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', 'Agreement sent via BoldSign!');

        // Update the lead status in conversation list
        setConversations(prev =>
          prev.map(c =>
            c.lead_id === selectedConversation.lead_id && c.lead
              ? { ...c, lead: { ...c.lead, status: 'agreement_sent' } }
              : c
          )
        );

        // Update selected conversation
        if (selectedConversation.lead) {
          setSelectedConversation({
            ...selectedConversation,
            lead: { ...selectedConversation.lead, status: 'agreement_sent' }
          });
        }
      } else {
        addToast('error', data.error || 'Failed to send agreement');
      }
    } catch {
      addToast('error', 'Network error while sending agreement');
    } finally {
      setSendingAgreement(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
      {/* Conversation List */}
      <div className="w-80 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>💬</span> Messages
            {conversations.reduce((sum, c) => sum + c.unread_count, 0) > 0 && (
              <span className="ml-auto px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
                {conversations.reduce((sum, c) => sum + c.unread_count, 0)}
              </span>
            )}
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="p-6 text-center text-zinc-500">
              <p className="text-4xl mb-2">📭</p>
              <p>No conversations yet</p>
              <p className="text-sm">Messages will appear here when leads respond</p>
            </div>
          ) : (
            conversations.map(conversation => (
              <ConversationItem
                key={conversation.lead_id}
                conversation={conversation}
                isSelected={selectedConversation?.lead_id === conversation.lead_id}
                onClick={() => handleSelectConversation(conversation)}
              />
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      <div className="flex-1 flex flex-col">
        {selectedConversation ? (
          <>
            {/* Thread Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900">
              <div>
                <h3 className="font-semibold text-white">
                  {selectedConversation.lead?.owner_name || 'Unknown'}
                </h3>
                <p className="text-sm text-zinc-500">
                  {selectedConversation.phone} • {selectedConversation.total_messages} messages
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSendAgreement}
                  disabled={sendingAgreement}
                  className="px-3 py-1.5 bg-purple-500 hover:bg-purple-400 text-white text-sm rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sendingAgreement ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Sending...
                    </span>
                  ) : (
                    '📄 Send Agreement'
                  )}
                </button>
                <button
                  onClick={handleOptOut}
                  className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                >
                  🚫 Opt Out
                </button>
              </div>
            </div>

            {/* Lead Info Bar */}
            {selectedConversation.lead && (
              <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">Property:</span>
                  <span className="text-white text-sm">
                    {selectedConversation.lead.property_address}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">Excess:</span>
                  <span className="text-green-400 text-sm font-medium">
                    ${selectedConversation.lead.excess_funds_amount?.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">Score:</span>
                  <span className="text-purple-400 text-sm font-medium">
                    {selectedConversation.lead.eleanor_score}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-sm">Status:</span>
                  <span className="text-cyan-400 text-sm capitalize">
                    {selectedConversation.lead.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full" />
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center text-zinc-500 py-8">
                  <p className="text-4xl mb-2">💬</p>
                  <p>No messages yet</p>
                  <p className="text-sm">Send the first message to start the conversation</p>
                </div>
              ) : (
                messages.map(message => (
                  <MessageBubble key={message.id} message={message} />
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Templates */}
            {showTemplates && (
              <div className="p-3 border-t border-zinc-800 bg-zinc-900">
                <div className="flex flex-wrap gap-2">
                  {QUICK_TEMPLATES.map((template, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyTemplate(template)}
                      className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white text-sm rounded-lg transition-colors"
                    >
                      {template.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-800 bg-zinc-900">
              <div className="flex items-end gap-3">
                <button
                  onClick={() => setShowTemplates(!showTemplates)}
                  className={`p-2 rounded-lg transition-colors ${
                    showTemplates ? 'bg-cyan-500 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                  title="Quick Templates"
                >
                  ⚡
                </button>
                <div className="flex-1">
                  <textarea
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-white placeholder-zinc-500 resize-none focus:outline-none focus:border-cyan-500"
                    rows={2}
                    disabled={sending}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || sending}
                  className={`px-6 py-3 rounded-lg font-semibold transition-colors ${
                    inputMessage.trim() && !sending
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                >
                  {sending ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                      Sending...
                    </span>
                  ) : (
                    'Send →'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-500">
            <div className="text-center">
              <p className="text-6xl mb-4">💬</p>
              <p className="text-xl">Select a conversation</p>
              <p className="text-sm">Choose a conversation from the left to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
