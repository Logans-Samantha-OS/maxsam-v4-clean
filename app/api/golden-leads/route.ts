/**
 * Golden Leads API
 * Main endpoint for fetching golden leads data for dashboard
 *
 * Query params:
 * - limit: number (default 50)
 * - status: 'active' | 'pending' | 'sold' | 'all'
 * - county: string (filter by county name)
 * - super_only: 'true' (only show super golden leads)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '50');
  const status = searchParams.get('status');
  const county = searchParams.get('county');
  const superOnly = searchParams.get('super_only') === 'true';

  try {
    // Build query with super golden columns
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
        is_super_golden,
        golden_match_source,
        distressed_property_url,
        distressed_listing_price,
        combined_opportunity_value,
        eleanor_score,
        status,
        phone,
        phone_1,
        phone_2,
        created_at,
        updated_at
      `)
      .eq('is_golden', true);

    // Filter for super golden only if requested
    if (superOnly) {
      query = query.eq('is_super_golden', true);
    }

    // Filter by county if provided
    if (county && county !== 'all') {
      // County filter - match against city or use a county lookup
      // For now, we'll match cities that are in that county's metro area
      query = query.ilike('city', `%${county}%`);
    }

    // Filter by status if provided
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    // Order: super_golden first, then by eleanor_score
    query = query
      .order('is_super_golden', { ascending: false, nullsFirst: false })
      .order('eleanor_score', { ascending: false, nullsFirst: false })
      .limit(limit);

    const { data: goldenLeads, error, count } = await query;

    if (error) {
      console.error('[Golden Leads API] Query error:', error);
      throw error;
    }

    // Get summary stats for all golden leads
    const { data: allGolden } = await supabase
      .from('maxsam_leads')
      .select('excess_funds_amount, combined_opportunity_value, is_super_golden, eleanor_score, status')
      .eq('is_golden', true);

    const superGoldenLeads = allGolden?.filter(l => l.is_super_golden) || [];

    const stats = {
      total: allGolden?.length || 0,
      super_golden_count: superGoldenLeads.length,
      by_status: {
        new: allGolden?.filter(l => l.status === 'new' || !l.status).length || 0,
        contacted: allGolden?.filter(l => l.status === 'contacted').length || 0,
        qualified: allGolden?.filter(l => l.status === 'qualified').length || 0,
        negotiating: allGolden?.filter(l => l.status === 'negotiating').length || 0,
        closed: allGolden?.filter(l => l.status === 'closed').length || 0,
      },
      total_excess: allGolden?.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0) || 0,
      total_combined_value: allGolden?.reduce((sum, l) => sum + (l.combined_opportunity_value || 0), 0) || 0,
      avg_eleanor_score: allGolden?.length
        ? Math.round(allGolden.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / allGolden.length)
        : 0,
    };

    // Get county sources for filter dropdown
    const { data: counties } = await supabase
      .from('county_sources')
      .select('county_name, state')
      .eq('is_active', true)
      .order('county_name');

    return NextResponse.json({
      success: true,
      leads: goldenLeads || [],
      stats,
      counties: counties || [],
      count: count || goldenLeads?.length || 0,
    });
  } catch (error) {
    console.error('Golden leads fetch error:', error);
    let message = 'Unknown error';
    if (error instanceof Error) {
      message = error.message;
    } else if (typeof error === 'object' && error !== null) {
      message = JSON.stringify(error);
    } else if (typeof error === 'string') {
      message = error;
    }
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
