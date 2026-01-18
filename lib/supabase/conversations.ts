import { supabase } from './client';

export type ConversationPreview = {
  id: string;
  last_message: string | null;
  last_message_at: string | null;
  last_direction: 'inbound' | 'outbound' | null;
  total_messages: number;
  unread_count: number;
};

export type Lead = {
  id: string;
  owner_name: string;
  phone: string | null;
};

export type SMSMessage = {
  id: string;
  lead_id: string;
  message: string;
  direction: 'inbound' | 'outbound';
  created_at: string;
};

/**
 * Fetch conversation list
 */
export async function getConversations(): Promise<ConversationPreview[]> {
  const { data, error } = await supabase
    .from('conversations_view')
    .select('*')
    .order('last_message_at', { ascending: false });

  if (error) {
    console.error('getConversations error:', error);
    return [];
  }

  return data ?? [];
}

/**
 * Fetch a single conversation thread
 */
export async function getConversationThread(leadId: string): Promise<{
  lead: Lead | null;
  messages: SMSMessage[];
}> {
  const { data: lead } = await supabase
    .from('leads')
    .select('id, owner_name, phone')
    .eq('id', leadId)
    .single();

  const { data: messages, error } = await supabase
    .from('sms_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('getConversationThread error:', error);
    return { lead: null, messages: [] };
  }

  return {
    lead: lead ?? null,
    messages: messages ?? [],
  };
}

/**
 * Realtime subscription
 */
export function subscribeToMessages(
  leadId: string | null,
  onMessage: (msg: SMSMessage) => void
) {
  if (!leadId) return () => {};

  const channel = supabase
    .channel(`sms:${leadId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'sms_messages',
        filter: `lead_id=eq.${leadId}`,
      },
      (payload) => {
        onMessage(payload.new as SMSMessage);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Send a reply
 */
export async function sendReply(leadId: string, message: string) {
  const { error } = await supabase.from('sms_messages').insert({
    lead_id: leadId,
    message,
    direction: 'outbound',
  });

  if (error) {
    console.error('sendReply error:', error);
    return false;
  }

  return true;
}
