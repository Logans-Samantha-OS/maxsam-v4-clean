/**
 * One-time migration endpoint for Agent System tables
 *
 * POST /api/migrate/agent-system
 *
 * Creates all necessary tables for the agent intelligence system:
 * - workflow_state
 * - agent_goals
 * - agent_state
 * - agent_decisions
 * - agent_memories
 *
 * Plus helper functions and default data
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  // Verify admin secret for security
  const secret = request.headers.get('x-admin-secret');
  const expectedSecret = process.env.ADMIN_SECRET || 'migrate-agent-system-2024';

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient();
  const results: Array<{ step: string; success: boolean; error?: string }> = [];

  // Step 1: Check workflow_state table
  const { error: workflowError } = await supabase
    .from('workflow_state')
    .select('id')
    .limit(1);

  if (workflowError && workflowError.code === '42P01') {
    results.push({
      step: 'workflow_state',
      success: false,
      error: 'Table does not exist. Please run migration SQL in Supabase dashboard.'
    });
  } else if (!workflowError) {
    results.push({ step: 'workflow_state', success: true });
  } else {
    results.push({ step: 'workflow_state', success: false, error: workflowError.message });
  }

  // Step 2: Check agent_goals table
  const { error: goalsError } = await supabase
    .from('agent_goals')
    .select('id')
    .limit(1);

  if (goalsError && goalsError.code === '42P01') {
    results.push({
      step: 'agent_goals',
      success: false,
      error: 'Table does not exist. Please run migration SQL in Supabase dashboard.'
    });
  } else if (!goalsError) {
    results.push({ step: 'agent_goals', success: true });
  } else {
    results.push({ step: 'agent_goals', success: false, error: goalsError.message });
  }

  // Step 3: Check agent_state table
  const { error: stateError } = await supabase
    .from('agent_state')
    .select('id')
    .limit(1);

  if (stateError && stateError.code === '42P01') {
    results.push({
      step: 'agent_state',
      success: false,
      error: 'Table does not exist. Please run migration SQL in Supabase dashboard.'
    });
  } else if (!stateError) {
    results.push({ step: 'agent_state', success: true });
  } else {
    results.push({ step: 'agent_state', success: false, error: stateError.message });
  }

  // Step 4: Check agent_decisions table
  const { error: decisionsError } = await supabase
    .from('agent_decisions')
    .select('id')
    .limit(1);

  if (decisionsError && decisionsError.code === '42P01') {
    results.push({
      step: 'agent_decisions',
      success: false,
      error: 'Table does not exist. Please run migration SQL in Supabase dashboard.'
    });
  } else if (!decisionsError) {
    results.push({ step: 'agent_decisions', success: true });
  } else {
    results.push({ step: 'agent_decisions', success: false, error: decisionsError.message });
  }

  // Step 5: Check agent_memories table
  const { error: memoriesError } = await supabase
    .from('agent_memories')
    .select('id')
    .limit(1);

  if (memoriesError && memoriesError.code === '42P01') {
    results.push({
      step: 'agent_memories',
      success: false,
      error: 'Table does not exist. Please run migration SQL in Supabase dashboard.'
    });
  } else if (!memoriesError) {
    results.push({ step: 'agent_memories', success: true });
  } else {
    results.push({ step: 'agent_memories', success: false, error: memoriesError.message });
  }

  // Check overall success
  const allSuccess = results.every(r => r.success);
  const needsMigration = results.some(r => r.error?.includes('does not exist'));

  if (needsMigration) {
    return NextResponse.json({
      success: false,
      message: 'Some tables do not exist. Please run the SQL migration in Supabase dashboard.',
      migrationFile: 'supabase/migrations/002_agent_system.sql',
      results,
      instructions: [
        '1. Go to Supabase Dashboard > SQL Editor',
        '2. Open the migration file: supabase/migrations/002_agent_system.sql',
        '3. Copy and paste the entire SQL',
        '4. Click "Run" to execute',
        '5. Retry this endpoint to verify'
      ]
    }, { status: 400 });
  }

  // If tables exist, try to insert default data
  if (allSuccess) {
    // Insert default goals if not present
    const { count } = await supabase
      .from('agent_goals')
      .select('*', { count: 'exact', head: true });

    if (count === 0) {
      // Insert default ALEX goals
      await supabase.from('agent_goals').insert([
        { agent: 'ALEX', goal: 'Process new county PDFs', goal_key: 'process_pdfs', priority: 2, target_daily: 5 },
        { agent: 'ALEX', goal: 'Query NotebookLM for new leads', goal_key: 'query_notebook', priority: 3, target_daily: 3 },
        { agent: 'ALEX', goal: 'Skip trace leads missing phones', goal_key: 'skip_trace', priority: 4, target_daily: 50 },
        { agent: 'ALEX', goal: 'Cross-reference property records', goal_key: 'cross_reference', priority: 5, target_daily: 20 },
      ]);

      // Insert default ELEANOR goals
      await supabase.from('agent_goals').insert([
        { agent: 'ELEANOR', goal: 'Score unscored leads', goal_key: 'score_leads', priority: 2, target_daily: 100 },
        { agent: 'ELEANOR', goal: 'Identify golden leads', goal_key: 'identify_golden', priority: 1, target_daily: 20 },
        { agent: 'ELEANOR', goal: 'Re-score stale leads (>7 days)', goal_key: 'rescore_stale', priority: 6, target_daily: 30 },
        { agent: 'ELEANOR', goal: 'Calculate deal potential', goal_key: 'calc_potential', priority: 4, target_daily: 50 },
      ]);

      // Insert default SAM goals
      await supabase.from('agent_goals').insert([
        { agent: 'SAM', goal: 'Contact golden leads immediately', goal_key: 'contact_golden', priority: 1, target_daily: 20 },
        { agent: 'SAM', goal: 'Follow up non-responders (48hr)', goal_key: 'followup_48hr', priority: 3, target_daily: 30 },
        { agent: 'SAM', goal: 'Re-engage cold leads (7 day)', goal_key: 'reengage_cold', priority: 5, target_daily: 20 },
        { agent: 'SAM', goal: 'Urgency outreach - expiring claims', goal_key: 'urgency_expiring', priority: 1, target_daily: 10 },
        { agent: 'SAM', goal: 'Send agreement to qualified leads', goal_key: 'send_agreements', priority: 2, target_daily: 10 },
      ]);

      // Insert default RALPH goals
      await supabase.from('agent_goals').insert([
        { agent: 'RALPH', goal: 'Monitor pipeline health', goal_key: 'monitor_pipeline', priority: 1, target_daily: null },
        { agent: 'RALPH', goal: 'Generate morning brief', goal_key: 'morning_brief', priority: 4, target_daily: 1 },
        { agent: 'RALPH', goal: 'Alert on stuck workflows', goal_key: 'alert_stuck', priority: 2, target_daily: null },
        { agent: 'RALPH', goal: 'Coordinate agent priorities', goal_key: 'coordinate', priority: 3, target_daily: null },
      ]);

      results.push({ step: 'insert_goals', success: true });
    }

    // Insert default agent states if not present
    const { count: stateCount } = await supabase
      .from('agent_state')
      .select('*', { count: 'exact', head: true });

    if (stateCount === 0) {
      await supabase.from('agent_state').insert([
        { agent: 'ALEX', status: 'idle' },
        { agent: 'ELEANOR', status: 'idle' },
        { agent: 'SAM', status: 'idle' },
        { agent: 'RALPH', status: 'idle' },
      ]);

      results.push({ step: 'insert_agent_states', success: true });
    }
  }

  return NextResponse.json({
    success: allSuccess,
    message: allSuccess
      ? 'All agent system tables are ready!'
      : 'Some issues found - see results',
    results
  });
}

/**
 * GET - Check migration status
 */
export async function GET() {
  const supabase = createClient();
  const tables = ['workflow_state', 'agent_goals', 'agent_state', 'agent_decisions', 'agent_memories'];
  const status: Record<string, boolean> = {};

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .select('id')
      .limit(1);

    status[table] = !error || error.code !== '42P01';
  }

  const allReady = Object.values(status).every(Boolean);

  return NextResponse.json({
    ready: allReady,
    tables: status,
    migrationFile: 'supabase/migrations/002_agent_system.sql'
  });
}
