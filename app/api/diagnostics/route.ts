/**
 * Diagnostics API - READ-ONLY
 * Phase 13.3 - Data Source Diagnosis
 *
 * Returns:
 * - Supabase URL (redacted)
 * - Table names queried
 * - Lead counts from DB
 * - Classification status
 *
 * NO MUTATION CONTROLS
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface DiagnosticsResult {
  timestamp: string;
  environment: string | undefined;
  supabase: {
    url_host: string;
    url_set: boolean;
    anon_key_set: boolean;
    service_key_set: boolean;
  };
  tables_queried: string[];
  lead_counts: {
    total: number;
    by_status: Record<string, number>;
    by_class: {
      A: number;
      B: number;
      C: number;
      unclassified: number;
    };
    with_phone: number;
    with_excess_funds: number;
  };
  classification_status: {
    backfill_complete: boolean;
    last_backfill_at: string | null;
    big_fish_threshold: number;
  };
  errors: string[];
}

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  // Redact URL for display (show only host)
  let redactedUrl = 'NOT_SET';
  try {
    if (supabaseUrl) {
      const url = new URL(supabaseUrl);
      redactedUrl = url.host;
    }
  } catch {
    redactedUrl = 'INVALID_URL';
  }

  const diagnostics: DiagnosticsResult = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    supabase: {
      url_host: redactedUrl,
      url_set: !!supabaseUrl,
      anon_key_set: !!supabaseKey,
      service_key_set: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    tables_queried: [
      'maxsam_leads',
      'execution_queue',
      'activity_feed',
      'contracts',
      'campaign_state',
      'class_metrics',
    ],
    lead_counts: {
      total: 0,
      by_status: {},
      by_class: {
        A: 0,
        B: 0,
        C: 0,
        unclassified: 0,
      },
      with_phone: 0,
      with_excess_funds: 0,
    },
    classification_status: {
      backfill_complete: false,
      last_backfill_at: null,
      big_fish_threshold: 75000,
    },
    errors: [],
  };

  // If no Supabase URL, return early
  if (!supabaseUrl || !supabaseKey) {
    diagnostics.errors.push('Supabase credentials not configured');
    return NextResponse.json(diagnostics);
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get total lead count
    const { count: totalCount, error: countError } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      diagnostics.errors.push(`Lead count error: ${countError.message}`);
    } else {
      diagnostics.lead_counts.total = totalCount || 0;
    }

    // Get counts by status
    const { data: statusCounts, error: statusError } = await supabase
      .from('maxsam_leads')
      .select('status')
      .not('status', 'is', null);

    if (statusError) {
      diagnostics.errors.push(`Status count error: ${statusError.message}`);
    } else if (statusCounts) {
      const byStatus: Record<string, number> = {};
      for (const row of statusCounts) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1;
      }
      diagnostics.lead_counts.by_status = byStatus;
    }

    // Get counts by class
    const { data: classCounts, error: classError } = await supabase
      .from('maxsam_leads')
      .select('lead_class');

    if (classError) {
      diagnostics.errors.push(`Class count error: ${classError.message}`);
    } else if (classCounts) {
      let classA = 0, classB = 0, classC = 0, unclassified = 0;
      for (const row of classCounts) {
        if (row.lead_class === 'A') classA++;
        else if (row.lead_class === 'B') classB++;
        else if (row.lead_class === 'C') classC++;
        else unclassified++;
      }
      diagnostics.lead_counts.by_class = {
        A: classA,
        B: classB,
        C: classC,
        unclassified,
      };
    }

    // Get leads with phone
    const { count: phoneCount } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .not('phone', 'is', null);

    diagnostics.lead_counts.with_phone = phoneCount || 0;

    // Get leads with excess funds > 0
    const { count: excessCount } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .gt('excess_funds_amount', 0);

    diagnostics.lead_counts.with_excess_funds = excessCount || 0;

    // Check backfill status
    const { data: configData } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', ['last_classification_backfill', 'classification_backfill_in_progress']);

    if (configData) {
      for (const config of configData) {
        if (config.key === 'last_classification_backfill') {
          diagnostics.classification_status.last_backfill_at = config.value;
          diagnostics.classification_status.backfill_complete = !!config.value;
        }
      }
    }

  } catch (err) {
    diagnostics.errors.push(`Exception: ${err instanceof Error ? err.message : 'Unknown'}`);
  }

  return NextResponse.json(diagnostics);
}

// Block mutations
export async function POST() {
  return NextResponse.json({ error: 'Diagnostics is read-only' }, { status: 405 });
}

export async function PUT() {
  return NextResponse.json({ error: 'Diagnostics is read-only' }, { status: 405 });
}

export async function DELETE() {
  return NextResponse.json({ error: 'Diagnostics is read-only' }, { status: 405 });
}
