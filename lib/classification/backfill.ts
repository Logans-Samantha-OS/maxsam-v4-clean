/**
 * Historical Lead Backfill
 * Phase 13.3 - Economic Lead Classification
 *
 * All historical leads must be backfilled into the new classification model.
 * This unlocks dormant value from all previously ingested data.
 */

import { createClient } from '@supabase/supabase-js';
import { LeadClass, BackfillStatus, ClassificationResult } from './types';
import { classifyLead, classifyLeads } from './eleanorClassifier';
import { Lead } from '../eleanor';

// ============================================================================
// BACKFILL STATUS
// ============================================================================

export async function getBackfillStatus(
  supabaseUrl: string,
  supabaseKey: string
): Promise<BackfillStatus> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get counts
  const { count: total } = await supabase
    .from('maxsam_leads')
    .select('*', { count: 'exact', head: true });

  const { count: classified } = await supabase
    .from('maxsam_leads')
    .select('*', { count: 'exact', head: true })
    .not('lead_class', 'is', null);

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

  // Get last backfill time from system_config
  const { data: config } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'last_classification_backfill')
    .single();

  // Check if backfill is in progress
  const { data: progressConfig } = await supabase
    .from('system_config')
    .select('value')
    .eq('key', 'classification_backfill_in_progress')
    .single();

  return {
    total_leads: total || 0,
    classified_leads: classified || 0,
    unclassified_leads: (total || 0) - (classified || 0),
    class_a_count: classA || 0,
    class_b_count: classB || 0,
    class_c_count: classC || 0,
    not_viable_count: (classified || 0) - (classA || 0) - (classB || 0) - (classC || 0),
    last_backfill_at: config?.value || null,
    backfill_in_progress: progressConfig?.value === 'true',
  };
}

// ============================================================================
// RUN BACKFILL
// ============================================================================

export interface BackfillResult {
  success: boolean;
  total_processed: number;
  class_a_count: number;
  class_b_count: number;
  class_c_count: number;
  not_viable_count: number;
  duration_ms: number;
  errors: string[];
}

/**
 * Backfill all unclassified leads using the database function.
 */
export async function runBackfillViaDatabase(
  supabaseUrl: string,
  supabaseKey: string
): Promise<BackfillResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const startTime = Date.now();
  const errors: string[] = [];

  try {
    // Set in-progress flag
    await supabase.from('system_config').upsert({
      key: 'classification_backfill_in_progress',
      value: 'true',
      updated_at: new Date().toISOString(),
    });

    // Run database backfill function
    const { data, error } = await supabase.rpc('backfill_lead_classifications');

    if (error) {
      errors.push(`Database error: ${error.message}`);
      return {
        success: false,
        total_processed: 0,
        class_a_count: 0,
        class_b_count: 0,
        class_c_count: 0,
        not_viable_count: 0,
        duration_ms: Date.now() - startTime,
        errors,
      };
    }

    const result = data?.[0] || {
      total_processed: 0,
      class_a_count: 0,
      class_b_count: 0,
      class_c_count: 0,
      not_viable_count: 0,
    };

    // Update last backfill timestamp
    await supabase.from('system_config').upsert({
      key: 'last_classification_backfill',
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Clear in-progress flag
    await supabase.from('system_config').upsert({
      key: 'classification_backfill_in_progress',
      value: 'false',
      updated_at: new Date().toISOString(),
    });

    return {
      success: true,
      total_processed: result.total_processed,
      class_a_count: result.class_a_count,
      class_b_count: result.class_b_count,
      class_c_count: result.class_c_count,
      not_viable_count: result.not_viable_count,
      duration_ms: Date.now() - startTime,
      errors,
    };
  } catch (err) {
    errors.push(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`);

    // Clear in-progress flag
    await supabase.from('system_config').upsert({
      key: 'classification_backfill_in_progress',
      value: 'false',
      updated_at: new Date().toISOString(),
    });

    return {
      success: false,
      total_processed: 0,
      class_a_count: 0,
      class_b_count: 0,
      class_c_count: 0,
      not_viable_count: 0,
      duration_ms: Date.now() - startTime,
      errors,
    };
  }
}

/**
 * Backfill using TypeScript classification logic (for validation/testing).
 */
export async function runBackfillViaTypeScript(
  batchSize: number,
  supabaseUrl: string,
  supabaseKey: string
): Promise<BackfillResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const startTime = Date.now();
  const errors: string[] = [];

  let totalProcessed = 0;
  let classACounted = 0;
  let classBCount = 0;
  let classCCount = 0;
  let notViableCount = 0;

  try {
    // Set in-progress flag
    await supabase.from('system_config').upsert({
      key: 'classification_backfill_in_progress',
      value: 'true',
      updated_at: new Date().toISOString(),
    });

    // Process in batches
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      // Get batch of unclassified leads
      const { data: leads, error } = await supabase
        .from('maxsam_leads')
        .select('*')
        .is('lead_class', null)
        .order('excess_funds_amount', { ascending: false, nullsFirst: false })
        .range(offset, offset + batchSize - 1);

      if (error) {
        errors.push(`Batch fetch error at offset ${offset}: ${error.message}`);
        break;
      }

      if (!leads || leads.length === 0) {
        hasMore = false;
        break;
      }

      // Classify each lead
      for (const lead of leads) {
        const classification = classifyLead(lead as Lead);
        totalProcessed++;

        if (classification) {
          // Update lead with classification
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
            errors.push(`Update error for lead ${lead.id}: ${updateError.message}`);
          } else {
            switch (classification.lead_class) {
              case 'A':
                classACounted++;
                break;
              case 'B':
                classBCount++;
                break;
              case 'C':
                classCCount++;
                break;
            }
          }
        } else {
          notViableCount++;
        }
      }

      offset += batchSize;

      // Safety check
      if (totalProcessed > 100000) {
        errors.push('Safety limit reached: 100,000 leads processed');
        break;
      }
    }

    // Update last backfill timestamp
    await supabase.from('system_config').upsert({
      key: 'last_classification_backfill',
      value: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    // Clear in-progress flag
    await supabase.from('system_config').upsert({
      key: 'classification_backfill_in_progress',
      value: 'false',
      updated_at: new Date().toISOString(),
    });

    return {
      success: errors.length === 0,
      total_processed: totalProcessed,
      class_a_count: classACounted,
      class_b_count: classBCount,
      class_c_count: classCCount,
      not_viable_count: notViableCount,
      duration_ms: Date.now() - startTime,
      errors,
    };
  } catch (err) {
    errors.push(`Exception: ${err instanceof Error ? err.message : 'Unknown error'}`);

    // Clear in-progress flag
    await supabase.from('system_config').upsert({
      key: 'classification_backfill_in_progress',
      value: 'false',
      updated_at: new Date().toISOString(),
    });

    return {
      success: false,
      total_processed: totalProcessed,
      class_a_count: classACounted,
      class_b_count: classBCount,
      class_c_count: classCCount,
      not_viable_count: notViableCount,
      duration_ms: Date.now() - startTime,
      errors,
    };
  }
}

// ============================================================================
// RE-CLASSIFY ALL LEADS
// ============================================================================

/**
 * Re-classify ALL leads (including already classified ones).
 * Use when classification logic changes.
 */
export async function reclassifyAllLeads(
  supabaseUrl: string,
  supabaseKey: string
): Promise<BackfillResult> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // First, clear all classifications
  await supabase
    .from('maxsam_leads')
    .update({
      lead_class: null,
      class_reason: null,
      expected_value: null,
      expected_time_to_cash: null,
      class_confidence: null,
      classified_at: null,
      daily_rank: null,
    })
    .not('id', 'is', null); // Update all

  // Then run backfill
  return runBackfillViaDatabase(supabaseUrl, supabaseKey);
}

// ============================================================================
// DAILY RANKING REFRESH
// ============================================================================

export async function refreshDailyRankings(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ total_ranked: number }> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase.rpc('compute_daily_rankings');

  if (error) {
    console.error('Failed to compute daily rankings:', error);
    return { total_ranked: 0 };
  }

  return { total_ranked: data || 0 };
}

// ============================================================================
// BACKFILL REPORT
// ============================================================================

export function formatBackfillReport(result: BackfillResult): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('           LEAD CLASSIFICATION BACKFILL REPORT');
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`Status: ${result.success ? '✓ SUCCESS' : '✗ FAILED'}`);
  lines.push(`Duration: ${(result.duration_ms / 1000).toFixed(2)}s`);
  lines.push('');
  lines.push('CLASSIFICATION RESULTS:');
  lines.push(`  Total Processed: ${result.total_processed}`);
  lines.push('');
  lines.push('  BY CLASS:');
  lines.push(`    Class A (GOLDEN_TRANSACTIONAL): ${result.class_a_count}`);
  lines.push(`    Class B (GOLDEN_RECOVERY_ONLY): ${result.class_b_count}`);
  lines.push(`    Class C (STANDARD_RECOVERY):    ${result.class_c_count}`);
  lines.push(`    Not Viable (<$5K):              ${result.not_viable_count}`);
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('ERRORS:');
    for (const error of result.errors) {
      lines.push(`  • ${error}`);
    }
    lines.push('');
  }

  // Summary
  const total = result.class_a_count + result.class_b_count + result.class_c_count;
  const classAPercent = total > 0 ? ((result.class_a_count / total) * 100).toFixed(1) : '0';
  const classBPercent = total > 0 ? ((result.class_b_count / total) * 100).toFixed(1) : '0';
  const classCPercent = total > 0 ? ((result.class_c_count / total) * 100).toFixed(1) : '0';

  lines.push('DISTRIBUTION:');
  lines.push(`  Class A: ${classAPercent}% (highest priority, dual deals)`);
  lines.push(`  Class B: ${classBPercent}% (big fish, recovery only)`);
  lines.push(`  Class C: ${classCPercent}% (standard, capacity filler)`);
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
