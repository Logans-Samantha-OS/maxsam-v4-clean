import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Get total leads
    const { count: totalLeads, error: totalError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true });
    
    if (totalError) throw totalError;
    
    // Get pipeline value
    const { data: leadsData, error: valueError } = await supabase
      .from('leads')
      .select('excess_amount');
    
    if (valueError) throw valueError;
    
    const pipelineValue = leadsData?.reduce((sum, lead) => sum + (lead.excess_amount || 0), 0) || 0;
    const projectedRevenue = pipelineValue * 0.25; // 25% fee
    
    // Get golden leads count
    const { count: goldenLeads, error: goldenError } = await supabase
      .from('leads')
      .select('*', { count: 'exact', head: true })
      .eq('golden_lead', true);
    
    if (goldenError) throw goldenError;
    
    return NextResponse.json({
      totalLeads: totalLeads || 0,
      pipelineValue,
      projectedRevenue,
      goldenLeads: goldenLeads || 0
    });
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
