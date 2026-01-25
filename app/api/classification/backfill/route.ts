import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { classifyLead } from '@/lib/classification/eleanorClassifier';
import { Lead } from '@/lib/eleanor';

/**
 * POST /api/classification/backfill
 * Run classification on leads with $5K+ excess funds.
 *
 * Query params:
 * - reclassify=true: Reclassify ALL leads (not just unclassified)
 *
 * Classification Rules (per CLAUDE.md):
 * - Class A: Dual deal potential (cross-referenced OR distressed + excess + equity)
 * - Class B: $75K+ excess (big fish recovery only)
 * - Class C: $5K-$75K excess (standard recovery)
 */
export async function POST(request: Request) {
  const url = new URL(request.url);
  const reclassifyAll = url.searchParams.get('reclassify') === 'true';

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Supabase configuration missing' },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Build query - either all viable leads or just unclassified
    let query = supabase
      .from('maxsam_leads')
      .select('*')
      .gte('excess_funds_amount', 5000)
      .order('excess_funds_amount', { ascending: false });

    if (!reclassifyAll) {
      query = query.is('lead_class', null);
    }

    const { data: leads, error: fetchError } = await query;

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch leads: ${fetchError.message}` },
        { status: 500 }
      );
    }

    if (!leads || leads.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No unclassified leads found',
        total_processed: 0,
        class_a_count: 0,
        class_b_count: 0,
        class_c_count: 0,
        not_viable_count: 0,
        duration_ms: Date.now() - startTime,
      });
    }

    let classACount = 0;
    let classBCount = 0;
    let classCCount = 0;
    let notViableCount = 0;

    // Classify each lead
    for (const lead of leads) {
      const classification = classifyLead(lead as Lead);

      if (classification) {
        const { error: updateError } = await supabase
          .from('maxsam_leads')
          .update({
            lead_class: classification.lead_class,
            class_reason: classification.class_reason,
            expected_value: classification.expected_value,
            expected_time_to_cash: classification.expected_time_to_cash,
            class_confidence: classification.confidence,
            classified_at: new Date().toISOString(),
          })
          .eq('id', lead.id);

        if (updateError) {
          errors.push(`Failed to update lead ${lead.id}: ${updateError.message}`);
        } else {
          switch (classification.lead_class) {
            case 'A': classACount++; break;
            case 'B': classBCount++; break;
            case 'C': classCCount++; break;
          }
        }
      } else {
        notViableCount++;
      }
    }

    // Update last backfill timestamp
    await supabase.from('system_config').upsert({
      key: 'last_classification_backfill',
      value: new Date().toISOString(),
    }, { onConflict: 'key' });

    return NextResponse.json({
      success: true,
      total_processed: leads.length,
      class_a_count: classACount,
      class_b_count: classBCount,
      class_c_count: classCCount,
      not_viable_count: notViableCount,
      duration_ms: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Classification backfill error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/classification/backfill
 * Get backfill status and statistics.
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
    const { count: total } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true });

    const { count: classified } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .not('lead_class', 'is', null);

    const { count: unclassified } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .is('lead_class', null)
      .gte('excess_funds_amount', 5000);

    const { count: classA } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_class', 'A');

    const { count: classB } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_class', 'B');

    const { count: classC } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .eq('lead_class', 'C');

    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'last_classification_backfill')
      .single();

    return NextResponse.json({
      total_leads: total || 0,
      classified_leads: classified || 0,
      unclassified_viable: unclassified || 0,
      class_a_count: classA || 0,
      class_b_count: classB || 0,
      class_c_count: classC || 0,
      last_backfill_at: config?.value || null,
    });
  } catch (err) {
    console.error('Backfill status error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
