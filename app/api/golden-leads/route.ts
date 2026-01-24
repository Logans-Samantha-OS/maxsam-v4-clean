/**
 * Golden Leads API
 * Main endpoint for fetching golden leads data for dashboard
 *
 * Queries maxsam_leads table for leads with is_golden=true
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const supabase = createClient();
  const { searchParams } = new URL(request.url);

  const limit = parseInt(searchParams.get('limit') || '50');

  try {
    // Query golden leads with only columns that definitely exist
    // Using same columns as stats API which works
    const { data: goldenLeads, error } = await supabase
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

    if (error) {
      console.error('[Golden Leads API] Query error:', error);
      return NextResponse.json({
        error: error.message,
        success: false,
        details: error
      }, { status: 500 });
    }

    // Get summary stats
    const stats = {
      total: goldenLeads?.length || 0,
      total_excess: goldenLeads?.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0) || 0,
      avg_eleanor_score: goldenLeads?.length
        ? Math.round(goldenLeads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / goldenLeads.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      leads: goldenLeads || [],
      stats,
      count: goldenLeads?.length || 0,
    });
  } catch (error) {
    console.error('Golden leads fetch error:', error);
    // Better error extraction
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
