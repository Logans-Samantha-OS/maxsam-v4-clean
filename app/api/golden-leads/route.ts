/**
 * Golden Leads API
 * Main endpoint for fetching golden leads data for dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status'); // active, pending, sold, all

  try {
    // Build query - use is_golden column (the actual column name in database)
    let query = supabase
      .from('maxsam_leads')
      .select(`
        id,
        owner_name,
        property_address,
        city,
        state,
        zip_code,
        excess_funds_amount,
        is_golden,
        eleanor_score,
        zillow_status,
        zillow_url,
        zillow_price,
        zillow_checked_at,
        combined_value,
        deal_grade,
        potential_revenue,
        status,
        phone,
        phone_1,
        phone_2,
        created_at,
        updated_at
      `)
      .eq('is_golden', true)
      .order('eleanor_score', { ascending: false, nullsFirst: false })
      .limit(limit);

    if (status && status !== 'all') {
      query = query.eq('zillow_status', status);
    }

    const { data: goldenLeads, error, count } = await query;

    if (error) throw error;

    // Get summary stats
    const { data: allGolden } = await supabase
      .from('maxsam_leads')
      .select('excess_funds_amount, combined_value, zillow_status, eleanor_score')
      .eq('is_golden', true);

    const stats = {
      total: allGolden?.length || 0,
      by_status: {
        active: allGolden?.filter(l => l.zillow_status === 'active').length || 0,
        pending: allGolden?.filter(l => l.zillow_status === 'pending').length || 0,
        sold: allGolden?.filter(l => l.zillow_status === 'sold').length || 0,
        off_market: allGolden?.filter(l => l.zillow_status === 'off_market').length || 0,
        unknown: allGolden?.filter(l => !l.zillow_status || l.zillow_status === 'unknown').length || 0,
      },
      total_excess: allGolden?.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0) || 0,
      total_combined_value: allGolden?.reduce((sum, l) => sum + (l.combined_value || 0), 0) || 0,
      avg_eleanor_score: allGolden?.length ? Math.round(allGolden.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / allGolden.length) : 0,
    };

    // Get Zillow matches for these leads
    const leadIds = goldenLeads?.map(l => l.id) || [];
    let zillowMatches: Record<string, unknown>[] = [];

    if (leadIds.length > 0) {
      const { data: matches } = await supabase
        .from('zillow_matches')
        .select('*')
        .in('lead_id', leadIds)
        .order('scraped_at', { ascending: false });

      zillowMatches = matches || [];
    }

    // Create lookup for zillow matches
    const zillowByLead = new Map<string, unknown>();
    zillowMatches.forEach(m => {
      if (!zillowByLead.has(m.lead_id as string)) {
        zillowByLead.set(m.lead_id as string, m);
      }
    });

    // Enrich leads with zillow data
    const enrichedLeads = goldenLeads?.map(lead => ({
      ...lead,
      zillow_match: zillowByLead.get(lead.id) || null,
    })) || [];

    return NextResponse.json({
      success: true,
      leads: enrichedLeads,
      stats,
      count: count || goldenLeads?.length || 0,
    });
  } catch (error) {
    console.error('Golden leads fetch error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
