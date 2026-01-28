// MaxSam V4 - Lead Bank API Route
// File: app/api/lead-bank/route.ts
// This powers the Lead Bank dashboard with real Supabase data

import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get('county');
  const minAmount = searchParams.get('minAmount');
  const status = searchParams.get('status');
  const isGolden = searchParams.get('golden');
  const limit = parseInt(searchParams.get('limit') || '100');
  const offset = parseInt(searchParams.get('offset') || '0');

  try {
    // === EXCESS FUNDS QUERY ===
    let excessFundsQuery = supabase
      .from('excess_funds')
      .select('*', { count: 'exact' });

    if (county) excessFundsQuery = excessFundsQuery.eq('county', county);
    if (minAmount) excessFundsQuery = excessFundsQuery.gte('excess_amount', parseFloat(minAmount));
    if (status) excessFundsQuery = excessFundsQuery.eq('status', status);
    if (isGolden === 'true') excessFundsQuery = excessFundsQuery.eq('is_golden_lead', true);

    const { data: excessFunds, count: excessCount, error: excessError } = await excessFundsQuery
      .order('excess_amount', { ascending: false })
      .range(offset, offset + limit - 1);

    if (excessError) throw excessError;

    // === PROPERTY INTELLIGENCE QUERY ===
    let propertyQuery = supabase
      .from('property_intelligence')
      .select('*', { count: 'exact' });

    if (county) propertyQuery = propertyQuery.ilike('county', `%${county}%`);

    const { data: properties, count: propertyCount, error: propertyError } = await propertyQuery
      .order('estimated_equity', { ascending: false })
      .range(offset, offset + limit - 1);

    if (propertyError) throw propertyError;

    // === AGGREGATE STATS ===
    const { data: excessStats } = await supabase
      .from('excess_funds')
      .select('county, excess_amount, status, is_golden_lead');

    const { data: propertyStats } = await supabase
      .from('property_intelligence')
      .select('county, estimated_equity, estimated_value');

    // Calculate totals
    const totalExcessFunds = excessStats?.reduce((sum, r) => sum + parseFloat(r.excess_amount || 0), 0) || 0;
    const totalPropertyEquity = propertyStats?.reduce((sum, r) => sum + parseFloat(r.estimated_equity || 0), 0) || 0;
    const goldenLeadCount = excessStats?.filter(r => r.is_golden_lead).length || 0;

    // County breakdown
    const countyBreakdown: Record<string, { excessFunds: number; properties: number; totalValue: number }> = {};
    
    excessStats?.forEach(r => {
      if (!countyBreakdown[r.county]) {
        countyBreakdown[r.county] = { excessFunds: 0, properties: 0, totalValue: 0 };
      }
      countyBreakdown[r.county].excessFunds += parseFloat(r.excess_amount || 0);
    });

    propertyStats?.forEach(r => {
      const county = r.county || 'Unknown';
      if (!countyBreakdown[county]) {
        countyBreakdown[county] = { excessFunds: 0, properties: 0, totalValue: 0 };
      }
      countyBreakdown[county].properties += 1;
      countyBreakdown[county].totalValue += parseFloat(r.estimated_equity || 0);
    });

    // Amount tiers for excess funds
    const amountTiers = {
      tier1_under5k: excessStats?.filter(r => parseFloat(r.excess_amount) < 5000).length || 0,
      tier2_5k_25k: excessStats?.filter(r => parseFloat(r.excess_amount) >= 5000 && parseFloat(r.excess_amount) < 25000).length || 0,
      tier3_25k_50k: excessStats?.filter(r => parseFloat(r.excess_amount) >= 25000 && parseFloat(r.excess_amount) < 50000).length || 0,
      tier4_50k_100k: excessStats?.filter(r => parseFloat(r.excess_amount) >= 50000 && parseFloat(r.excess_amount) < 100000).length || 0,
      tier5_over100k: excessStats?.filter(r => parseFloat(r.excess_amount) >= 100000).length || 0,
    };

    return NextResponse.json({
      success: true,
      
      // Summary stats for dashboard header
      summary: {
        totalExcessFunds: totalExcessFunds,
        totalPropertyEquity: totalPropertyEquity,
        combinedOpportunity: totalExcessFunds + totalPropertyEquity,
        excessFundsCount: excessCount || 0,
        propertyCount: propertyCount || 0,
        goldenLeadCount: goldenLeadCount,
      },

      // Breakdown by county
      countyBreakdown: countyBreakdown,

      // Amount distribution
      amountTiers: amountTiers,

      // Actual lead data
      leads: {
        excessFunds: excessFunds || [],
        properties: properties || [],
      },

      // Pagination info
      pagination: {
        limit,
        offset,
        excessFundsTotal: excessCount,
        propertiesTotal: propertyCount,
      }
    });

  } catch (error: any) {
    console.error('Lead Bank API Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Import new leads
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, data } = body;

    if (type === 'excess_funds') {
      const { data: inserted, error } = await supabase
        .from('excess_funds')
        .upsert(data, { onConflict: 'case_number,county' })
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, inserted: inserted?.length || 0 });
    }

    if (type === 'property') {
      const { data: inserted, error } = await supabase
        .from('property_intelligence')
        .upsert(data, { onConflict: 'property_id' })
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, inserted: inserted?.length || 0 });
    }

    return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 });

  } catch (error: any) {
    console.error('Lead Bank Import Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}