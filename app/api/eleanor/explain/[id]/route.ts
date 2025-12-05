import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/eleanor/explain/[id] - Get scoring breakdown for a lead
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient();

    const { data: lead, error } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Calculate fresh score with full reasoning
    const scoring = calculateEleanorScore(lead);

    return NextResponse.json({
      lead_id: id,
      owner_name: lead.owner_name,
      property_address: lead.property_address,

      // Scoring results
      score: scoring.eleanor_score,
      grade: scoring.deal_grade,
      priority: scoring.contact_priority,
      deal_type: scoring.deal_type,

      // Financial analysis
      financial: {
        excess_funds: lead.excess_funds_amount,
        estimated_arv: lead.estimated_arv || (lead.excess_funds_amount * 3),
        estimated_repair: lead.estimated_repair_cost,
        estimated_equity: scoring.estimated_equity,
        excess_fee: scoring.excess_fee,
        wholesale_fee: scoring.wholesale_fee,
        potential_revenue: scoring.potential_revenue
      },

      // Detailed reasoning
      reasoning: scoring.reasoning,

      // Database values (may differ if not recently scored)
      stored_score: lead.eleanor_score,
      stored_grade: lead.deal_grade,
      last_scored: lead.scored_at,

      // Recommendation
      recommendation: getRecommendation(scoring)
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function getRecommendation(scoring: ReturnType<typeof calculateEleanorScore>): string {
  if (scoring.eleanor_score >= 85) {
    return 'PRIORITY: Contact immediately. This is a high-value opportunity with strong potential for closing.';
  }
  if (scoring.eleanor_score >= 70) {
    return 'HIGH: Add to daily call queue. Good potential but may need more follow-up.';
  }
  if (scoring.eleanor_score >= 55) {
    return 'MEDIUM: Include in weekly outreach. Worth pursuing but not urgent.';
  }
  if (scoring.eleanor_score >= 40) {
    return 'LOW: Nurture with automated messages. Low probability but still possible.';
  }
  return 'ARCHIVE: Minimal potential. Consider archiving unless circumstances change.';
}
