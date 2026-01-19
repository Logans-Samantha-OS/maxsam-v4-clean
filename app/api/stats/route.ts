import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get total leads - use maxsam_leads (canonical table)
    const { count: totalLeads, error: totalError } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true });

    if (totalError) throw totalError;

    // Get pipeline value - use excess_funds_amount (correct column name)
    const { data: leadsData, error: valueError } = await supabase
      .from('maxsam_leads')
      .select('excess_funds_amount');

    if (valueError) throw valueError;

    const pipelineValue = leadsData?.reduce((sum, lead) => sum + (lead.excess_funds_amount || 0), 0) || 0;
    const projectedRevenue = pipelineValue * 0.25; // 25% fee

    // Get golden leads count
    const { count: goldenLeads, error: goldenError } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .eq('is_golden_lead', true);

    if (goldenError) throw goldenError;

    // Get expiring leads count
    const { count: expiringLeads, error: expiringError } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .lt('expiration_date', new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());

    if (expiringError) throw expiringError;

    return NextResponse.json({
      totalLeads: totalLeads || 0,
      pipelineValue,
      projectedRevenue,
      goldenLeads: goldenLeads || 0,
      expiringLeads: expiringLeads || 0
    });
    
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
