import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { calculateEleanorScore } from '@/lib/eleanor';
import { skipTraceLeadById } from '@/lib/skip-tracing';
import { executeOutreach } from '@/lib/sam-outreach';
import { generateContract, ContractType } from '@/lib/contract-generator';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/leads/[id] - Get single lead
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient();

    const { data, error } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Get status history
    const { data: history } = await supabase
      .from('status_history')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    // Get communications
    const { data: communications } = await supabase
      .from('communication_logs')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    // Get contracts
    const { data: contracts } = await supabase
      .from('contracts')
      .select('*')
      .eq('lead_id', id)
      .order('created_at', { ascending: false });

    return NextResponse.json({
      lead: data,
      history,
      communications,
      contracts
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * PUT /api/leads/[id] - Update lead
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const body = await request.json();

    // Get current lead for status history
    const { data: currentLead } = await supabase
      .from('maxsam_leads')
      .select('status')
      .eq('id', id)
      .single();

    // Update lead
    const { data, error } = await supabase
      .from('maxsam_leads')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Log status change if status was updated
    if (body.status && currentLead && body.status !== currentLead.status) {
      await supabase.from('status_history').insert({
        lead_id: id,
        old_status: currentLead.status,
        new_status: body.status,
        changed_by: 'api',
        reason: body.reason || 'Manual update'
      });
    }

    return NextResponse.json({ lead: data });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * DELETE /api/leads/[id] - Delete lead
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient();

    const { error } = await supabase
      .from('maxsam_leads')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * POST /api/leads/[id] - Perform action on lead
 * Actions: score, skip-trace, send-sms, generate-contract
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = createClient();
    const body = await request.json();
    const action = body.action;

    // Get lead data
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    switch (action) {
      case 'score': {
        // Calculate Eleanor score
        const scoring = calculateEleanorScore(lead);

        await supabase.from('maxsam_leads').update({
          eleanor_score: scoring.eleanor_score,
          deal_grade: scoring.deal_grade,
          contact_priority: scoring.contact_priority,
          deal_type: scoring.deal_type,
          potential_revenue: scoring.potential_revenue,
          eleanor_reasoning: scoring.reasoning,
          scored_at: new Date().toISOString(),
          status: lead.status === 'new' ? 'scored' : lead.status
        }).eq('id', id);

        return NextResponse.json({ scoring });
      }

      case 'skip-trace': {
        const result = await skipTraceLeadById(id);
        return NextResponse.json(result);
      }

      case 'send-sms': {
        const result = await executeOutreach(lead);
        return NextResponse.json(result);
      }

      case 'generate-contract': {
        const contractType = body.contract_type as ContractType;
        if (!['excess_funds', 'wholesale', 'dual'].includes(contractType)) {
          return NextResponse.json(
            { error: 'Invalid contract_type. Use: excess_funds, wholesale, or dual' },
            { status: 400 }
          );
        }

        const result = await generateContract(id, contractType);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: score, skip-trace, send-sms, generate-contract' },
          { status: 400 }
        );
    }

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
