import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';
import { notifyLeadsImported } from '@/lib/telegram';

/**
 * POST /api/cron/score-leads - Score all unscored leads
 *
 * Called by Vercel Cron at 6:00 AM daily
 * Or can be triggered manually
 */
export async function POST() {
  try {
    const supabase = createClient();

    // Get unscored leads
    const { data: leads, error } = await supabase
      .from('maxsam_leads')
      .select('*')
      .is('scored_at', null)
      .in('status', ['new'])
      .limit(200);

    if (error) {
      throw new Error(`Failed to fetch leads: ${error.message}`);
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No leads to score',
        scored: 0
      });
    }

    let scored = 0;
    let hotCount = 0;

    for (const lead of leads) {
      const scoring = calculateEleanorScore(lead);

      const { error: updateError } = await supabase
        .from('maxsam_leads')
        .update({
          eleanor_score: scoring.eleanor_score,
          deal_grade: scoring.deal_grade,
          contact_priority: scoring.contact_priority,
          deal_type: scoring.deal_type,
          potential_revenue: scoring.potential_revenue,
          eleanor_reasoning: scoring.reasoning,
          scored_at: new Date().toISOString(),
          status: 'scored'
        })
        .eq('id', lead.id);

      if (!updateError) {
        scored++;
        if (scoring.contact_priority === 'hot') {
          hotCount++;
        }
      }
    }

    // Log status changes
    await supabase.from('status_history').insert(
      leads.slice(0, scored).map(lead => ({
        lead_id: lead.id,
        old_status: 'new',
        new_status: 'scored',
        changed_by: 'cron_score',
        reason: 'Daily Eleanor scoring'
      }))
    );

    // Notify if there are hot leads
    if (hotCount > 0) {
      await notifyLeadsImported(hotCount, 'Eleanor Scoring (Hot Leads!)');
    }

    return NextResponse.json({
      success: true,
      scored,
      hot_leads: hotCount,
      total: leads.length
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
