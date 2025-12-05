import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/analytics/pipeline - Get pipeline metrics
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get leads by status
    const { data: leads } = await supabase
      .from('maxsam_leads')
      .select('status, excess_funds_amount, potential_revenue, deal_type, deal_grade, contact_priority');

    if (!leads) {
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Calculate pipeline stages
    const stages = [
      { name: 'New', status: 'new', color: '#3b82f6' },
      { name: 'Scored', status: 'scored', color: '#8b5cf6' },
      { name: 'Contacted', status: 'contacted', color: '#06b6d4' },
      { name: 'Qualified', status: 'qualified', color: '#f59e0b' },
      { name: 'Contract Sent', status: 'contract_sent', color: '#a855f7' },
      { name: 'Signed', status: 'contract_signed', color: '#10b981' },
      { name: 'Closed', status: 'closed', color: '#22c55e' },
      { name: 'Dead', status: 'dead', color: '#ef4444' }
    ].map(stage => {
      const stageLeads = leads.filter(l => l.status === stage.status);
      return {
        ...stage,
        count: stageLeads.length,
        value: stageLeads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0),
        potential: stageLeads.reduce((sum, l) => sum + (Number(l.potential_revenue) || 0), 0)
      };
    });

    // Deal type distribution
    const dealTypes = {
      dual: leads.filter(l => l.deal_type === 'dual').length,
      excess_only: leads.filter(l => l.deal_type === 'excess_only').length,
      wholesale: leads.filter(l => l.deal_type === 'wholesale').length
    };

    // Grade distribution
    const grades = {
      'A+': leads.filter(l => l.deal_grade === 'A+').length,
      'A': leads.filter(l => l.deal_grade === 'A').length,
      'B': leads.filter(l => l.deal_grade === 'B').length,
      'C': leads.filter(l => l.deal_grade === 'C').length,
      'D': leads.filter(l => l.deal_grade === 'D').length
    };

    // Priority distribution
    const priorities = {
      hot: leads.filter(l => l.contact_priority === 'hot').length,
      warm: leads.filter(l => l.contact_priority === 'warm').length,
      cold: leads.filter(l => l.contact_priority === 'cold').length
    };

    // Conversion funnel (percentage that moved to next stage)
    const totalLeads = leads.length;
    const funnel = stages.map((stage, i) => ({
      stage: stage.name,
      count: stage.count,
      percentage: totalLeads > 0 ? Math.round((stage.count / totalLeads) * 100) : 0
    }));

    return NextResponse.json({
      total_leads: totalLeads,
      total_pipeline_value: leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0),
      total_potential_revenue: leads.reduce((sum, l) => sum + (Number(l.potential_revenue) || 0), 0),
      stages,
      deal_types: dealTypes,
      grades,
      priorities,
      funnel
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
