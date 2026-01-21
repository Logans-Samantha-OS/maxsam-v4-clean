import { supabase } from '@/lib/supabase/client'

export type MessageThread = {
  lead_id: string
  last_message_at: string
  owner_name: string | null
  preview: string | null
}

export async function getMessageThreads(): Promise<MessageThread[]> {
  const { data, error } = await supabase.rpc('get_message_threads')

  if (error) {
    console.error('getMessageThreads error', error)
    return []
  }

  return data ?? []
}

export async function getMessagesByLead(leadId: string) {
  const { data, error } = await supabase
    .from('sms_messages')
    .select('id, from_number, message, created_at')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('getMessagesByLead error', error)
    return []
  }

  return data ?? []
}
