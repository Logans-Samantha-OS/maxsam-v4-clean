import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/classification/summary
 * Phase 13.3 - Economic Lead Classification Summary
 *
 * Returns class A/B/C breakdown with expected values.
 * READ-ONLY endpoint.
 */
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get class counts and values
    const { data: classA } = await supabase
      .from('maxsam_leads')
      .select('expected_value')
      .eq('lead_class', 'A');

    const { data: classB } = await supabase
      .from('maxsam_leads')
      .select('expected_value')
      .eq('lead_class', 'B');

    const { data: classC } = await supabase
      .from('maxsam_leads')
      .select('expected_value')
      .eq('lead_class', 'C');

    const { count: unclassified } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .is('lead_class', null)
      .gte('excess_funds_amount', 5000);

    // Calculate stats
    const calcStats = (data: { expected_value: number }[] | null) => {
      if (!data || data.length === 0) {
        return { count: 0, total_expected_value: 0, avg_expected_value: 0 };
      }
      const total = data.reduce((sum, row) => sum + (row.expected_value || 0), 0);
      return {
        count: data.length,
        total_expected_value: Math.round(total * 100) / 100,
        avg_expected_value: Math.round((total / data.length) * 100) / 100,
      };
    };

    const aStats = calcStats(classA);
    const bStats = calcStats(classB);
    const cStats = calcStats(classC);

    const totalViable = aStats.count + bStats.count + cStats.count;
    const totalExpected =
      aStats.total_expected_value +
      bStats.total_expected_value +
      cStats.total_expected_value;

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      big_fish_threshold: 75000,
      by_class: {
        A: aStats,
        B: bStats,
        C: cStats,
      },
      unclassified: unclassified || 0,
      total_viable_leads: totalViable,
      total_expected_value: Math.round(totalExpected * 100) / 100,
    });
  } catch (err) {
    console.error('Classification summary error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
