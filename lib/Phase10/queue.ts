import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function fetchExecutionQueue(actorType: string) {
  return supabase
    .from('execution_queue')
    .select('*')
    .eq('actor_type', actorType)
    .order('created_at', { ascending: true })
}

export async function fetchActivityFeed() {
  return supabase
    .from('activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
}

export async function fetchPendingEscalations() {
  return supabase
    .from('pending_escalations')
    .select('*')
}
