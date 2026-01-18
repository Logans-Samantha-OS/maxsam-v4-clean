import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function fetchDashboardStats() {
  const supabase = getSupabase();
  const [
    queued,
    pendingReply,
    hotResponses,
    activityCount
  ] = await Promise.all([
    supabase
      .from('execution_queue')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'queued'),

    supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'contacted'),

    supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'responded'),

    supabase
      .from('activity_feed')
      .select('id', { count: 'exact', head: true })
  ])

  return {
    readyToBlast: queued.count ?? 0,
    pendingReply: pendingReply.count ?? 0,
    hotResponses: hotResponses.count ?? 0,
    activityEvents: activityCount.count ?? 0
  }
}
