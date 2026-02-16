'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/components/Toast';
import { createClient } from '@/lib/supabase/client';

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
  channel?: string;
  agreement_packet_id?: string;
  agreement_event_type?: string;
  metadata?: Record<string, unknown>;
}

interface Lead {
  id: string;
  owner_name: string;
  property_address: string;
  excess_funds_amount: number;
  eleanor_score: number;
  deal_grade: string | null;
  status: string;
  phone?: string;
  phone_1?: string;
  phone_2?: string;
  last_contact_date?: string | null;
  contact_attempts?: number;
  agreement_status?: string | null;
  agreement_sent_at?: string | null;
  agreement_signed_at?: string | null;
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

interface DailyStats {
  messages_sent_today: number;
  replies_today: number;
  agreements_pending: number;
  pipeline_value: number;
}

type FilterTab = 'all' | 'needs_followup' | 'agreement_sent' | 'agreement_signed' | 'no_response';

// ============================================================================
// HELPERS
// ============================================================================

function getEleanorGrade(score: number | null | undefined): string {
  if (!score) return 'D';
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

function getGradeColor(grade: string): string {
  if (grade === 'A+' || grade === 'A') return 'text-green-400';
  if (grade === 'B') return 'text-yellow-400';
  if (grade === 'C') return 'text-orange-400';
  return 'text-red-400';
}

function getAgreementBadge(lead: Lead | null): { label: string; className: string } {
  if (!lead) return { label: 'No Agreement', className: 'bg-zinc-700 text-zinc-400' };

  const status = lead.agreement_status;
  if (status === 'signed' || status === 'completed') {
    return { label: 'Signed', className: 'bg-green-500/20 text-green-400 border border-green-500/30' };
  }
  if (status === 'sent' || status === 'pending' || status === 'viewed') {
    return { label: 'Sent', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' };
  }
  return { label: 'No Agreement', className: 'bg-zinc-700/50 text-zinc-500' };
}

function getDeliveryIcon(status: string): { icon: string; label: string; className: string } {
  switch (status) {
    case 'delivered':
      return { icon: '\\u2713\\u2713', label: 'Delivered', className: 'text-cyan-300' };
    case 'sent':
      return { icon: '\\u2713', label: 'Sent', className: 'text-cyan-200' };
    case 'failed':
      return { icon: '!', label: 'Failed', className: 'text-red-400' };
    case 'queued':
    case 'sending':
      return { icon: '...', label: 'Sending', className: 'text-zinc-400' };
    default:
      return { icon: '\\u2713', label: status, className: 'text-cyan-200' };
  }
}

function timeAgo(dateStr: string | null | undefined): string {
  if (!dateStr) return 'Never';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getNextFollowUp(lead: Lead | null): string | null {
  if (!lead?.last_contact_date) return null;
  const last = new Date(lead.last_contact_date);
  const attempts = lead.contact_attempts || 0;
  // Schedule follow-up: 2 days after first, 3 days after second, 5 days after third+
  const daysToAdd = attempts <= 1 ? 2 : attempts <= 2 ? 3 : 5;
  const followUp = new Date(last);
  followUp.setDate(followUp.getDate() + daysToAdd);
  return followUp.toISOString();
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
// FILTER TABS
// ============================================================================

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'needs_followup', label: 'Needs Follow-Up' },
  { key: 'agreement_sent', label: 'Agreement Sent' },
  { key: 'agreement_signed', label: 'Agreement Signed' },
  { key: 'no_response', label: 'No Response' },
];

// ============================================================================
// MORNING REPORT BAR
// ============================================================================

function MorningReportBar({ stats }: { stats: DailyStats | null }) {
  if (!stats) return null;

  return (
    <div className="px-4 py-2.5 bg-gradient-to-r from-cyan-500/10 via-purple-500/10 to-green-500/10 border-b border-zinc-800 flex items-center gap-6 text-sm">
      <span className="text-zinc-400 font-medium">Today:</span>
      <span className="text-cyan-400">
        <span className="font-semibold">{stats.messages_sent_today}</span> sent
      </span>
      <span className="text-zinc-600">|</span>
      <span className="text-green-400">
        <span className="font-semibold">{stats.replies_today}</span> replies
      </span>
      <span className="text-zinc-600">|</span>
      <span className="text-yellow-400">
        <span className="font-semibold">{stats.agreements_pending}</span> agreements pending
      </span>
      <span className="text-zinc-600">|</span>
      <span className="text-purple-400">
        <span className="font-semibold">${(stats.pipeline_value / 1000).toFixed(0)}K</span> pipeline
      </span>
    </div>
  );
}

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
  onClick: () => void | Promise<void>;
}) {
  const lead = conversation.lead;
  const hasUnread = conversation.unread_count > 0;
  const agreementBadge = getAgreementBadge(lead);
  const grade = lead?.deal_grade || getEleanorGrade(lead?.eleanor_score);
  const gradeColor = getGradeColor(grade);
  const followUp = getNextFollowUp(lead);
  const isOverdue = followUp ? new Date(followUp) < new Date() : false;

  return (
    <div
      onClick={onClick}
      className={`p-3 border-b border-zinc-800 cursor-pointer transition-colors hover:bg-zinc-800/50 ${
        isSelected ? 'bg-cyan-500/10 border-l-2 border-l-cyan-500' : ''
      } ${hasUnread ? 'bg-yellow-500/5' : ''}`}
    >
      {/* Row 1: Name + Date */}
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-2">
          {hasUnread && (
            <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse flex-shrink-0" />
          )}
          <span className="font-medium text-white truncate max-w-[140px]">
            {lead?.owner_name || 'Unknown'}
          </span>
          {/* Eleanor Grade Badge */}
          <span className={`text-xs font-bold ${gradeColor}`}>
            {grade}
          </span>
        </div>
        <span className="text-xs text-zinc-500 flex-shrink-0">
          {new Date(conversation.last_message_time).toLocaleDateString()}
        </span>
      </div>

      {/* Row 2: Last message preview */}
      <p className="text-sm text-zinc-400 truncate mb-2">
        {conversation.last_direction === 'outbound' ? '\u2192 ' : '\u2190 '}
        {conversation.last_message}
      </p>

      {/* Row 3: Badges row */}
      <div className="flex items-center gap-1.5 text-xs flex-wrap">
        {lead?.excess_funds_amount ? (
          <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">
            ${Math.round(lead.excess_funds_amount / 1000)}K
          </span>
        ) : null}
        <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded">
          {lead?.eleanor_score || 0}
        </span>
        {/* Agreement Status Badge */}
        <span className={`px-1.5 py-0.5 rounded ${agreementBadge.className}`}>
          {agreementBadge.label}
        </span>
        {conversation.last_intent && (
          <span className={`px-1.5 py-0.5 rounded ${
            conversation.last_intent === 'interested' ? 'bg-green-500/20 text-green-400' :
            conversation.last_intent === 'not_interested' ? 'bg-red-500/20 text-red-400' :
            'bg-zinc-700 text-zinc-400'
          }`}>
            {conversation.last_intent}
          </span>
        )}
      </div>

      {/* Row 4: Activity & Follow-up */}
      <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
        <span>Last: {timeAgo(lead?.last_contact_date || conversation.last_message_time)}</span>
        {followUp && (
          <span className={isOverdue ? 'text-red-400 font-medium' : 'text-zinc-500'}>
            {isOverdue ? 'Overdue' : `F/U: ${new Date(followUp).toLocaleDateString()}`}
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
  const isAgreementEvent = message.channel === 'agreement' || message.agreement_event_type;
  const delivery = getDeliveryIcon(message.status);

  // Agreement event inline indicator
  if (isAgreementEvent) {
    const eventType = message.agreement_event_type || 'sent';
    const isSigned = eventType === 'signed' || eventType === 'completed';

    return (
      <div className="flex justify-center my-3">
        <div className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 ${
          isSigned
            ? 'bg-green-500/10 border-green-500/30 text-green-400'
            : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
        }`}>
          <span>{isSigned ? '\u2705' : '\uD83D\uDCC4'}</span>
          <span>
            {isSigned
              ? `Agreement SIGNED [${new Date(message.created_at).toLocaleString()}]`
              : `Agreement sent [Excess Funds] - Pending signature`
            }
          </span>
        </div>
      </div>
    );
  }

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
          {/* Delivery status for outbound messages */}
          {isOutbound && (
            <span className={`flex items-center gap-1 ${delivery.className}`} title={delivery.label}>
              {message.status === 'delivered' ? '\u2713\u2713' :
               message.status === 'sent' ? '\u2713' :
               message.status === 'failed' ? '\u2717' : '...'}
              <span className="text-[10px] opacity-75">{delivery.label}</span>
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
// AGREEMENT INLINE INDICATOR (for thread view)
// ============================================================================

function AgreementInlineIndicator({ lead }: { lead: Lead }) {
  if (!lead.agreement_status) return null;

  const isSigned = lead.agreement_status === 'signed' || lead.agreement_status === 'completed';
  const isSent = lead.agreement_status === 'sent' || lead.agreement_status === 'pending' || lead.agreement_status === 'viewed';

  if (!isSigned && !isSent) return null;

  return (
    <div className="flex justify-center my-2">
      <div className={`px-4 py-2 rounded-lg border text-sm flex items-center gap-2 ${
        isSigned
          ? 'bg-green-500/10 border-green-500/30 text-green-400'
          : 'bg-purple-500/10 border-purple-500/30 text-purple-400'
      }`}>
        {isSigned ? (
          <>
            <span>{'\u2705'}</span>
            <span>Agreement SIGNED [{lead.agreement_signed_at ? new Date(lead.agreement_signed_at).toLocaleString() : 'Confirmed'}]</span>
          </>
        ) : (
          <>
            <span>{'\uD83D\uDCC4'}</span>
            <span>Agreement sent [Excess Funds] - Pending signature</span>
          </>
        )}
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
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [dailyStats, setDailyStats] = useState<DailyStats | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();

  // Fetch daily stats for morning report
  const fetchDailyStats = useCallback(async () => {
    try {
      const res = await fetch('/api/messages/stats');
      const data = await res.json();
      if (data.success) {
        setDailyStats(data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch daily stats:', err);
    }
  }, []);

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

        // Update the lead data in the selected conversation with full details from API
        if (data.lead) {
          setSelectedConversation(prev =>
            prev ? { ...prev, lead: data.lead } : prev
          );
          // Also update in the conversations list
          setConversations(prevConvs =>
            prevConvs.map(c =>
              c.lead_id === leadId ? { ...c, lead: data.lead } : c
            )
          );
        }

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

  // Load conversations and stats on mount
  useEffect(() => {
    fetchConversations();
    fetchDailyStats();

    // Poll for new messages every 30 seconds
    const interval = setInterval(fetchConversations, 30000);
    // Refresh stats every 60 seconds
    const statsInterval = setInterval(fetchDailyStats, 60000);
    return () => {
      clearInterval(interval);
      clearInterval(statsInterval);
    };
  }, [fetchConversations, fetchDailyStats]);

  // ========================================================================
  // SUPABASE REALTIME SUBSCRIPTIONS
  // ========================================================================
  useEffect(() => {
    const supabase = createClient();

    // Subscribe to sms_messages (new messages)
    const messagesChannel = supabase
      .channel('sms_messages_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'sms_messages' },
        (payload) => {
          const newMsg = payload.new as Record<string, unknown>;

          // If this message belongs to the currently selected conversation, add it
          if (selectedConversation && newMsg.lead_id === selectedConversation.lead_id) {
            const formattedMsg: Message = {
              id: newMsg.id as string,
              lead_id: newMsg.lead_id as string,
              direction: newMsg.direction as 'inbound' | 'outbound',
              body: (newMsg.body || newMsg.message || '') as string,
              from_number: (newMsg.from_number || '') as string,
              to_number: (newMsg.to_number || '') as string,
              status: (newMsg.status || 'received') as string,
              created_at: (newMsg.created_at || new Date().toISOString()) as string,
              read_at: null,
              intent: newMsg.intent as string | undefined,
              sentiment: newMsg.sentiment as string | undefined,
            };
            setMessages(prev => {
              // Avoid duplicates
              if (prev.some(m => m.id === formattedMsg.id)) return prev;
              return [...prev, formattedMsg];
            });
          }

          // Update conversation list
          setConversations(prev => {
            const leadId = newMsg.lead_id as string;
            const existing = prev.find(c => c.lead_id === leadId);
            if (existing) {
              return prev.map(c =>
                c.lead_id === leadId
                  ? {
                      ...c,
                      last_message: (newMsg.body || newMsg.message || '') as string,
                      last_message_time: (newMsg.created_at || new Date().toISOString()) as string,
                      last_direction: newMsg.direction as string,
                      total_messages: c.total_messages + 1,
                      unread_count: newMsg.direction === 'inbound' && c.lead_id !== selectedConversation?.lead_id
                        ? c.unread_count + 1
                        : c.unread_count,
                    }
                  : c
              ).sort((a, b) => new Date(b.last_message_time).getTime() - new Date(a.last_message_time).getTime());
            }
            // New conversation - refetch
            fetchConversations();
            return prev;
          });
        }
      )
      .subscribe();

    // Subscribe to maxsam_leads status changes
    const leadsChannel = supabase
      .channel('leads_status_realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'maxsam_leads' },
        (payload) => {
          const updated = payload.new as Record<string, unknown>;
          const leadId = updated.id as string;

          // Update lead data in conversations
          setConversations(prev =>
            prev.map(c => {
              if (c.lead_id === leadId && c.lead) {
                return {
                  ...c,
                  lead: {
                    ...c.lead,
                    status: (updated.status || c.lead.status) as string,
                    eleanor_score: (updated.eleanor_score ?? c.lead.eleanor_score) as number,
                    deal_grade: (updated.deal_grade ?? c.lead.deal_grade) as string | null,
                    last_contact_date: (updated.last_contact_date ?? c.lead.last_contact_date) as string | null,
                    contact_attempts: (updated.contact_attempts ?? c.lead.contact_attempts) as number,
                  },
                };
              }
              return c;
            })
          );

          // Update selected conversation lead
          if (selectedConversation?.lead_id === leadId && selectedConversation.lead) {
            setSelectedConversation(prev => {
              if (!prev?.lead) return prev;
              return {
                ...prev,
                lead: {
                  ...prev.lead,
                  status: (updated.status || prev.lead.status) as string,
                  eleanor_score: (updated.eleanor_score ?? prev.lead.eleanor_score) as number,
                  deal_grade: (updated.deal_grade ?? prev.lead.deal_grade) as string | null,
                  last_contact_date: (updated.last_contact_date ?? prev.lead.last_contact_date) as string | null,
                  contact_attempts: (updated.contact_attempts ?? prev.lead.contact_attempts) as number,
                },
              };
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(leadsChannel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.lead_id]);

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
              ? { ...c, lead: { ...c.lead, status: 'agreement_sent', agreement_status: 'sent', agreement_sent_at: new Date().toISOString() } }
              : c
          )
        );

        // Update selected conversation
        if (selectedConversation.lead) {
          setSelectedConversation({
            ...selectedConversation,
            lead: { ...selectedConversation.lead, status: 'agreement_sent', agreement_status: 'sent', agreement_sent_at: new Date().toISOString() }
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

  // ========================================================================
  // FILTER LOGIC
  // ========================================================================
  const filteredConversations = conversations.filter(conv => {
    if (activeFilter === 'all') return true;

    const lead = conv.lead;
    switch (activeFilter) {
      case 'needs_followup': {
        const followUp = getNextFollowUp(lead);
        return followUp ? new Date(followUp) <= new Date() : false;
      }
      case 'agreement_sent':
        return lead?.agreement_status === 'sent' || lead?.agreement_status === 'pending' || lead?.agreement_status === 'viewed';
      case 'agreement_signed':
        return lead?.agreement_status === 'signed' || lead?.agreement_status === 'completed';
      case 'no_response':
        return conv.total_messages > 0 && conv.last_direction === 'outbound' && conv.unread_count === 0;
      default:
        return true;
    }
  });

  // ========================================================================
  // FILTER TAB COUNTS
  // ========================================================================
  const filterCounts: Record<FilterTab, number> = {
    all: conversations.length,
    needs_followup: conversations.filter(c => {
      const fu = getNextFollowUp(c.lead);
      return fu ? new Date(fu) <= new Date() : false;
    }).length,
    agreement_sent: conversations.filter(c =>
      c.lead?.agreement_status === 'sent' || c.lead?.agreement_status === 'pending' || c.lead?.agreement_status === 'viewed'
    ).length,
    agreement_signed: conversations.filter(c =>
      c.lead?.agreement_status === 'signed' || c.lead?.agreement_status === 'completed'
    ).length,
    no_response: conversations.filter(c =>
      c.total_messages > 0 && c.last_direction === 'outbound' && c.unread_count === 0
    ).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Morning Report Bar */}
      <MorningReportBar stats={dailyStats} />

      <div className="flex flex-1 bg-zinc-950 rounded-xl border border-zinc-800 overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 border-r border-zinc-800 flex flex-col">
          <div className="p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              Messages
              {conversations.reduce((sum, c) => sum + c.unread_count, 0) > 0 && (
                <span className="ml-auto px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">
                  {conversations.reduce((sum, c) => sum + c.unread_count, 0)}
                </span>
              )}
            </h2>
          </div>

          {/* Filter Tabs */}
          <div className="border-b border-zinc-800 overflow-x-auto">
            <div className="flex p-1.5 gap-1">
              {FILTER_TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveFilter(tab.key)}
                  className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                    activeFilter === tab.key
                      ? 'bg-cyan-500/20 text-cyan-400 font-medium'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
                  }`}
                >
                  {tab.label}
                  {filterCounts[tab.key] > 0 && (
                    <span className={`ml-1 ${activeFilter === tab.key ? 'text-cyan-300' : 'text-zinc-600'}`}>
                      {filterCounts[tab.key]}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredConversations.length === 0 ? (
              <div className="p-6 text-center text-zinc-500">
                <p className="text-4xl mb-2">{activeFilter === 'all' ? '\uD83D\uDCED' : '\uD83D\uDD0D'}</p>
                <p>{activeFilter === 'all' ? 'No conversations yet' : 'No matches'}</p>
                <p className="text-sm">
                  {activeFilter === 'all'
                    ? 'Messages will appear here when leads respond'
                    : 'Try a different filter'}
                </p>
              </div>
            ) : (
              filteredConversations.map(conversation => (
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
                    {selectedConversation.phone} &bull; {selectedConversation.total_messages} messages
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
                      'Send Agreement'
                    )}
                  </button>
                  <button
                    onClick={handleOptOut}
                    className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm rounded-lg transition-colors"
                  >
                    Opt Out
                  </button>
                </div>
              </div>

              {/* Lead Info Bar */}
              {selectedConversation.lead && (
                <div className="p-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-4 flex-wrap">
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
                    <span className={`text-sm font-bold ${getGradeColor(selectedConversation.lead.deal_grade || getEleanorGrade(selectedConversation.lead.eleanor_score))}`}>
                      ({selectedConversation.lead.deal_grade || getEleanorGrade(selectedConversation.lead.eleanor_score)})
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-sm">Status:</span>
                    <span className="text-cyan-400 text-sm capitalize">
                      {selectedConversation.lead.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                  {/* Agreement badge in header */}
                  {(() => {
                    const badge = getAgreementBadge(selectedConversation.lead);
                    return (
                      <span className={`px-2 py-0.5 text-xs rounded ${badge.className}`}>
                        {badge.label}
                      </span>
                    );
                  })()}
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
                    <p className="text-4xl mb-2">{'\uD83D\uDCAC'}</p>
                    <p>No messages yet</p>
                    <p className="text-sm">Send the first message to start the conversation</p>
                  </div>
                ) : (
                  <>
                    {messages.map(message => (
                      <MessageBubble key={message.id} message={message} />
                    ))}
                    {/* Show agreement inline if sent but no agreement message event in thread */}
                    {selectedConversation.lead &&
                     selectedConversation.lead.agreement_status &&
                     !messages.some(m => m.channel === 'agreement' || m.agreement_event_type) && (
                      <AgreementInlineIndicator lead={selectedConversation.lead} />
                    )}
                  </>
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
                    {'\u26A1'}
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
                      'Send \u2192'
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-zinc-500">
              <div className="text-center">
                <p className="text-6xl mb-4">{'\uD83D\uDCAC'}</p>
                <p className="text-xl">Select a conversation</p>
                <p className="text-sm">Choose a conversation from the left to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
