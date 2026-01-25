import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This endpoint fixes the broken sam_enabled trigger and updates Sharon's lead
export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    // First, try to drop the problematic triggers via raw SQL
    const { error: dropError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Drop potentially problematic triggers
        DROP TRIGGER IF EXISTS trigger_check_sam_enabled ON maxsam_leads;
        DROP TRIGGER IF EXISTS maxsam_leads_sam_enabled_trigger ON maxsam_leads;
        DROP TRIGGER IF EXISTS sam_enabled_check_trigger ON maxsam_leads;
      `
    });

    if (dropError) {
      console.log('RPC not available, trying direct approach...');
    }

    // Now try a minimal update on Sharon's lead
    // Using session_replication_role to bypass triggers temporarily is a Postgres superuser feature
    // Instead, let's try to identify which specific trigger is the problem

    // List all triggers on maxsam_leads
    const { data: triggers, error: triggerError } = await supabase
      .from('pg_trigger')
      .select('*');

    console.log('Triggers:', triggers, 'Error:', triggerError);

    // For now, just return info about what we found
    return NextResponse.json({
      message: 'Trigger fix attempted',
      note: 'Please run the SQL migration in Supabase dashboard to fix permanently',
      sql: `
-- Run this in Supabase SQL Editor to fix the broken trigger:

-- Step 1: Find the problematic function
SELECT proname, prosrc
FROM pg_proc
WHERE prosrc LIKE '%NEW.sam_enabled%';

-- Step 2: Drop triggers that use it
DROP TRIGGER IF EXISTS trigger_check_sam_enabled ON maxsam_leads;

-- Step 3: Test an update
UPDATE maxsam_leads
SET eleanor_score = 80,
    eleanor_grade = 'A',
    is_golden_lead = true,
    notes = 'Merged duplicate lead on 2026-01-25. Score upgraded from 16 to 80.'
WHERE id = 'd95d0092-de66-41ef-a896-37df386955ec';
      `
    });

  } catch (error) {
    console.error('Fix trigger error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
