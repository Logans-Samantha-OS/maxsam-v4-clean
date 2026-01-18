import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function fetchExecutionQueue(actorType: string) {
  const supabase = getSupabase();
  return supabase
    .from('execution_queue')
    .select('*')
    .eq('actor_type', actorType)
    .order('created_at', { ascending: true })
}

export async function fetchActivityFeed() {
  const supabase = getSupabase();
  return supabase
    .from('activity_feed')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
}

export async function fetchPendingEscalations() {
  const supabase = getSupabase();
  return supabase
    .from('pending_escalations')
    .select('*')
}
