import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware';

/**
 * POST /api/eleanor/score - Score a single lead
 */
export async function POST(request: NextRequest) {
  // GATE ENFORCEMENT - ORION SCORING
  const blocked = await enforceGates({ agent: 'orion', gate: 'gate_orion_scoring' });
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 });
  }

  try {
    const body = await request.json();
    const { lead_id, lead_data } = body;

    // If lead_id provided, fetch from database
    if (lead_id) {
      const supabase = createClient();
      const { data: lead, error } = await supabase
        .from('maxsam_leads')
        .select('*')
        .eq('id', lead_id)
        .single();

      if (error || !lead) {
        return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
      }

      const scoring = calculateEleanorScore(lead);

      // Update lead in database
      await supabase.from('maxsam_leads').update({
        eleanor_score: scoring.eleanor_score,
        deal_grade: scoring.deal_grade,
        contact_priority: scoring.contact_priority,
        deal_type: scoring.deal_type,
        potential_revenue: scoring.potential_revenue,
        eleanor_reasoning: scoring.reasoning,
        scored_at: new Date().toISOString(),
        status: lead.status === 'new' ? 'scored' : lead.status
      }).eq('id', lead_id);

      return NextResponse.json({
        lead_id,
        scoring,
        updated: true
      });
    }

    // If lead_data provided, calculate score without saving
    if (lead_data) {
      const scoring = calculateEleanorScore({
        id: 'temp',
        ...lead_data
      });

      return NextResponse.json({
        scoring,
        updated: false
      });
    }

    return NextResponse.json(
      { error: 'Provide either lead_id or lead_data' },
      { status: 400 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
