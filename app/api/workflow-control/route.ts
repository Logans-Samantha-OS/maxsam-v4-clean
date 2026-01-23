/**
 * Workflow Control API - MaxSam V4
 *
 * GET:  Retrieve workflow state (toggles, autonomy level)
 * POST: Update individual workflow toggles or autonomy level
 * PUT:  Emergency stop - disable all workflows
 *
 * This API provides graceful degradation if database is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface WorkflowState {
  intake_enabled: boolean;
  outreach_enabled: boolean;
  contracts_enabled: boolean;
  payments_enabled: boolean;
  autonomy_level: number;
  ralph_enabled: boolean;
  last_updated: string;
  updated_by: string;
}

// Default state when database is unavailable
const DEFAULT_STATE: WorkflowState = {
  intake_enabled: false,
  outreach_enabled: false,
  contracts_enabled: false,
  payments_enabled: false,
  autonomy_level: 0,
  ralph_enabled: false,
  last_updated: new Date().toISOString(),
  updated_by: 'system_default',
};

// GET: Retrieve current workflow state
export async function GET() {
  try {
    const supabase = createClient();

    // Try to fetch from system_config table
    const { data, error } = await supabase
      .from('system_config')
      .select('key, value')
      .in('key', [
        'intake_enabled',
        'outreach_enabled',
        'contracts_enabled',
        'payments_enabled',
        'autonomy_level',
        'ralph_enabled',
        'workflow_last_updated',
        'workflow_updated_by',
      ]);

    if (error) {
      // Database error - return default state with warning
      console.error('Workflow control DB error:', error.message);
      return NextResponse.json({
        ...DEFAULT_STATE,
        _warning: 'Database unavailable, showing default state',
      });
    }

    // Parse config values into state object
    const configMap: Record<string, string> = {};
    for (const row of data || []) {
      configMap[row.key] = row.value;
    }

    const state: WorkflowState = {
      intake_enabled: configMap['intake_enabled'] === 'true',
      outreach_enabled: configMap['outreach_enabled'] === 'true',
      contracts_enabled: configMap['contracts_enabled'] === 'true',
      payments_enabled: configMap['payments_enabled'] === 'true',
      autonomy_level: parseInt(configMap['autonomy_level'] || '0', 10),
      ralph_enabled: configMap['ralph_enabled'] === 'true',
      last_updated: configMap['workflow_last_updated'] || new Date().toISOString(),
      updated_by: configMap['workflow_updated_by'] || 'system',
    };

    return NextResponse.json(state);
  } catch (err) {
    console.error('Workflow control error:', err);
    return NextResponse.json({
      ...DEFAULT_STATE,
      _warning: 'Unexpected error, showing default state',
    });
  }
}

// POST: Update workflow state
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const allowedKeys = [
      'intake_enabled',
      'outreach_enabled',
      'contracts_enabled',
      'payments_enabled',
      'autonomy_level',
      'ralph_enabled',
    ];

    const updates: { key: string; value: string }[] = [];

    for (const configKey of allowedKeys) {
      if (configKey in body) {
        updates.push({
          key: configKey,
          value: String(body[configKey]),
        });
      }
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    // Add metadata
    updates.push(
      { key: 'workflow_last_updated', value: new Date().toISOString() },
      { key: 'workflow_updated_by', value: 'ceo_dashboard' }
    );

    // Upsert each config value
    for (const update of updates) {
      const { error } = await supabase
        .from('system_config')
        .upsert(update, { onConflict: 'key' });

      if (error) {
        console.error(`Failed to update ${update.key}:`, error.message);
        return NextResponse.json(
          { success: false, error: `Failed to update ${update.key}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      updated: Object.keys(body).filter((k) => allowedKeys.includes(k)),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Workflow control POST error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to update workflow state' },
      { status: 500 }
    );
  }
}

// PUT: Emergency stop - disable all workflows
export async function PUT() {
  try {
    const supabase = createClient();

    const emergencyUpdates = [
      { key: 'intake_enabled', value: 'false' },
      { key: 'outreach_enabled', value: 'false' },
      { key: 'contracts_enabled', value: 'false' },
      { key: 'payments_enabled', value: 'false' },
      { key: 'ralph_enabled', value: 'false' },
      { key: 'autonomy_level', value: '0' },
      { key: 'workflow_last_updated', value: new Date().toISOString() },
      { key: 'workflow_updated_by', value: 'emergency_stop' },
    ];

    for (const update of emergencyUpdates) {
      const { error } = await supabase
        .from('system_config')
        .upsert(update, { onConflict: 'key' });

      if (error) {
        console.error(`Emergency stop failed for ${update.key}:`, error.message);
      }
    }

    return NextResponse.json({
      success: true,
      action: 'emergency_stop',
      message: 'All workflows disabled. System in safe mode.',
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Emergency stop error:', err);
    return NextResponse.json(
      { success: false, error: 'Emergency stop failed' },
      { status: 500 }
    );
  }
}
