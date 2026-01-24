/**
 * Match Golden Leads API
 * N8N webhook endpoint to trigger the match_golden_leads() function
 *
 * POST /api/leads/match-golden
 * Triggers matching between maxsam_leads and distressed_properties
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    // Call the match_golden_leads() function
    const { data, error } = await supabase.rpc('match_golden_leads');

    if (error) {
      console.error('[Match Golden] Function error:', error);
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    const matchCount = data || 0;

    // Get updated stats
    const { data: stats } = await supabase
      .from('maxsam_leads')
      .select('id, is_super_golden')
      .eq('is_super_golden', true);

    return NextResponse.json({
      success: true,
      new_matches: matchCount,
      total_super_golden: stats?.length || 0,
      message: `Successfully matched ${matchCount} new super golden leads`,
    });
  } catch (error) {
    console.error('[Match Golden] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}

// Also support GET for easy testing
export async function GET() {
  const supabase = createClient();

  try {
    // Get current super golden stats
    const { data: superGolden, error } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, golden_match_source, combined_opportunity_value')
      .eq('is_super_golden', true)
      .order('combined_opportunity_value', { ascending: false });

    if (error) {
      return NextResponse.json(
        { error: error.message, success: false },
        { status: 500 }
      );
    }

    // Get unmatched distressed properties count
    const { count: unmatchedCount } = await supabase
      .from('distressed_properties')
      .select('id', { count: 'exact', head: true })
      .is('matched_lead_id', null);

    return NextResponse.json({
      success: true,
      super_golden_leads: superGolden?.length || 0,
      unmatched_distressed_properties: unmatchedCount || 0,
      top_opportunities: superGolden?.slice(0, 10) || [],
    });
  } catch (error) {
    console.error('[Match Golden GET] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}
