import { supabase } from '@/lib/supabase';
import { notifications } from '@/lib/notifications';
import { NextResponse } from 'next/server';

export async function GET(request) {
  try {
    // Get today's date (YYYY-MM-DD)
    const today = new Date().toISOString().split('T')[0];

    // Fetch leads added/scored today
    const { data: newLeads } = await supabase
      .from('maxsam_leads')
      .select('*')
      .gte('created_at', today)
      .order('eleanor_score', { ascending: false });

    // Fetch high-priority leads ready to call
    const { data: hotLeads } = await supabase
      .from('maxsam_leads')
      .select('*')
      .in('deal_grade', ['A+', 'A'])
      .eq('status', 'scored')
      .not('phone', 'is', null)
      .order('eleanor_score', { ascending: false })
      .limit(20);

    // Fetch follow-ups due today
    const { data: followUps } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('next_follow_up_date', today)
      .order('contact_priority', { ascending: false });

    const summary = {
      newLeadsToday: newLeads?.length || 0,
      hotLeadsReady: hotLeads?.length || 0,
      followUpsDue: followUps?.length || 0,
      totalCallsToday:
        (hotLeads?.length || 0) + (followUps?.length || 0),
    };

    const callList = [
      ...(followUps || []).map((lead) => ({
        ...lead,
        priority: 'FOLLOW-UP',
        reason: 'Scheduled callback',
      })),
      ...(hotLeads || []).map((lead) => ({
        ...lead,
        priority: lead.deal_grade,
        reason: 'New hot lead',
      })),
    ];

    const brief = {
      date: today,
      summary,
      callList,
      topPriority: (hotLeads || [])[0] || null,
    };

    // Send Telegram notification (optional)
    if (brief.callList.length > 0) {
      const message = `
☀️ <b>GOOD MORNING - DAILY BRIEF</b>
📅 ${new Date().toLocaleDateString()}

📊 <b>TODAY'S NUMBERS:</b>
- New Leads: ${summary.newLeadsToday}
- Hot Leads Ready: ${summary.hotLeadsReady}
- Follow-ups Due: ${summary.followUpsDue}

🎯 <b>TOTAL CALLS TODAY: ${summary.totalCallsToday}</b>

${
        brief.topPriority
          ? `
🔥 <b>TOP PRIORITY:</b>
- ${brief.topPriority.owner_name}
- ${brief.topPriority.property_address}
- $${(brief.topPriority.excess_funds_amount || 0).toLocaleString()}
- Grade: ${brief.topPriority.deal_grade} (Score: ${
              brief.topPriority.eleanor_score
            })
- Phone: ${brief.topPriority.phone || 'MISSING'}

👆 CALL THIS ONE FIRST!
`
          : ''
      }

📋 <b>Full call list:</b> Check dashboard
`;

      try {
        await notifications.sendTelegram(message);
      } catch (err) {
        console.error('Telegram send failed (non-fatal):', err);
      }
    }

    return NextResponse.json(brief);
  } catch (error) {
    console.error('Morning brief error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
