import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware';

/**
 * POST /api/eleanor/score-all - Batch score all unscored leads
 */
export async function POST(request: NextRequest) {
  // GATE ENFORCEMENT - ORION BATCH SCORING
  const blocked = await enforceGates({ agent: 'orion', gate: 'gate_orion_scoring' });
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 });
  }

  try {
    const supabase = createClient();
    const body = await request.json();

    // Options
    const statusFilter = body.status || ['new'];
    const limit = body.limit || 100;
    const forceRescore = body.force || false;

    // Build query
    let query = supabase
      .from('maxsam_leads')
      .select('*');

    if (!forceRescore) {
      query = query.is('scored_at', null);
    }

    if (Array.isArray(statusFilter)) {
      query = query.in('status', statusFilter);
    }

    query = query.limit(limit);

    const { data: leads, error } = await query;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        message: 'No leads to score',
        scored: 0
      });
    }

    // Score each lead
    let scored = 0;
    const results: Array<{ id: string; score: number; grade: string }> = [];

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
          status: lead.status === 'new' ? 'scored' : lead.status
        })
        .eq('id', lead.id);

      if (!updateError) {
        scored++;
        results.push({
          id: lead.id,
          score: scoring.eleanor_score,
          grade: scoring.deal_grade
        });
      }
    }

    // Log status change for newly scored leads
    const newlyScored = leads.filter(l => l.status === 'new');
    if (newlyScored.length > 0) {
      await supabase.from('status_history').insert(
        newlyScored.map(lead => ({
          lead_id: lead.id,
          old_status: 'new',
          new_status: 'scored',
          changed_by: 'eleanor_batch',
          reason: 'Batch scoring completed'
        }))
      );
    }

    return NextResponse.json({
      message: `Scored ${scored} leads`,
      scored,
      total: leads.length,
      results
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
