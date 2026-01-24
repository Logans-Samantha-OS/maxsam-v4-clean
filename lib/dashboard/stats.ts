import { createClient } from '@supabase/supabase-js'

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function fetchDashboardStats() {
  const supabase = getSupabase();

  // Query only tables that definitely exist (maxsam_leads)
  // execution_queue and activity_feed may not exist yet
  const [
    readyToBlast,
    pendingReply,
    hotResponses
  ] = await Promise.all([
    // Ready to blast: new leads with phone numbers
    supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'new')
      .or('phone_1.neq.null,phone_2.neq.null'),

    // Pending reply: contacted but not responded
    supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'contacted'),

    // Hot responses: qualified or responded leads
    supabase
      .from('maxsam_leads')
      .select('id', { count: 'exact', head: true })
      .in('status', ['qualified', 'responded'])
  ])

  // Try to get activity count, but don't fail if table doesn't exist
  let activityEvents = 0;
  try {
    const { count } = await supabase
      .from('activity_feed')
      .select('id', { count: 'exact', head: true })
    activityEvents = count ?? 0;
  } catch {
    // Table may not exist, default to 0
  }

  return {
    readyToBlast: readyToBlast.count ?? 0,
    pendingReply: pendingReply.count ?? 0,
    hotResponses: hotResponses.count ?? 0,
    activityEvents
  }
}
