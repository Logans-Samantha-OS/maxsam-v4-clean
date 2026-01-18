import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const { buyer_id } = await request.json();

    if (!buyer_id) {
      return NextResponse.json({ error: 'Buyer ID is required' }, { status: 400 });
    }

    // Get buyer details
    const { data: buyer, error: buyerError } = await supabase
      .from('buyers')
      .select('*')
      .eq('id', buyer_id)
      .single();

    if (buyerError || !buyer) {
      return NextResponse.json({ error: 'Buyer not found' }, { status: 404 });
    }

    // Get matching leads (example: leads with excess_amount > $50,000 in buyer's budget range)
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .gte('excess_amount', buyer.budget_min || 0)
      .lte('excess_amount', buyer.budget_max || 999999999)
      .eq('status', 'new')
      .order('excess_amount', { ascending: false })
      .limit(10);

    if (leadsError) {
      return NextResponse.json({ error: 'Failed to fetch leads' }, { status: 500 });
    }

    // Create match records (you would need to create a lead_buyer_matches table)
    // For now, just return success
    const matchCount = leads?.length || 0;

    return NextResponse.json({
      success: true,
      message: `Found ${matchCount} matching leads for ${buyer.name}`,
      matches: matchCount,
      buyer_name: buyer.name,
      leads: leads || []
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending matches:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
