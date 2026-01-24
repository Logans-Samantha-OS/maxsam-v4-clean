/**
 * WORKFLOW STATE PERSISTENCE
 *
 * Prevents duplicate actions by tracking what workflows have run.
 * Every N8N workflow should check state before running and save state after.
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export interface WorkflowState {
  id: string;
  workflow_name: string;
  run_id?: string;
  lead_id?: string;
  state: Record<string, unknown>;
  started_at: string;
  completed_at?: string;
  status: 'running' | 'completed' | 'failed' | 'skipped';
}

export interface CheckStateResult {
  ran_recently: boolean;
  last_run?: string;
  last_state?: Record<string, unknown>;
  last_status?: string;
  hours_since_last?: number;
}

/**
 * Check if a workflow ran recently for a specific lead
 */
export async function checkWorkflowState(
  workflowName: string,
  leadId: string,
  withinHours: number = 24
): Promise<CheckStateResult> {
  const supabase = getSupabase();
  const cutoffTime = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('workflow_state')
    .select('*')
    .eq('workflow_name', workflowName)
    .eq('lead_id', leadId)
    .gte('started_at', cutoffTime)
    .in('status', ['completed', 'running'])
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return { ran_recently: false };
  }

  const hoursSince = (Date.now() - new Date(data.started_at).getTime()) / (1000 * 60 * 60);

  return {
    ran_recently: true,
    last_run: data.started_at,
    last_state: data.state,
    last_status: data.status,
    hours_since_last: Math.round(hoursSince * 10) / 10
  };
}

/**
 * Check if any workflow is currently running for a lead
 */
export async function isWorkflowRunning(leadId: string): Promise<boolean> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from('workflow_state')
    .select('id')
    .eq('lead_id', leadId)
    .eq('status', 'running')
    .limit(1);

  return data !== null && data.length > 0;
}

/**
 * Start tracking a workflow run
 */
export async function startWorkflow(
  workflowName: string,
  leadId?: string,
  runId?: string
): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('workflow_state')
    .insert({
      workflow_name: workflowName,
      lead_id: leadId,
      run_id: runId || `run_${Date.now()}`,
      status: 'running',
      state: { started_by: 'api' }
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to start workflow tracking:', error);
    throw error;
  }

  return data.id;
}

/**
 * Save workflow completion state
 */
export async function saveWorkflowState(
  workflowName: string,
  leadId: string,
  state: Record<string, unknown>,
  status: 'completed' | 'failed' | 'skipped' = 'completed'
): Promise<void> {
  const supabase = getSupabase();

  // First, try to update any running workflow
  const { data: existing } = await supabase
    .from('workflow_state')
    .select('id')
    .eq('workflow_name', workflowName)
    .eq('lead_id', leadId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single();

  if (existing) {
    // Update existing running workflow
    await supabase
      .from('workflow_state')
      .update({
        state,
        status,
        completed_at: new Date().toISOString()
      })
      .eq('id', existing.id);
  } else {
    // Insert new completed record
    await supabase
      .from('workflow_state')
      .insert({
        workflow_name: workflowName,
        lead_id: leadId,
        state,
        status,
        completed_at: new Date().toISOString()
      });
  }
}

/**
 * Complete a workflow by ID
 */
export async function completeWorkflow(
  workflowId: string,
  state: Record<string, unknown>,
  status: 'completed' | 'failed' | 'skipped' = 'completed'
): Promise<void> {
  const supabase = getSupabase();

  await supabase
    .from('workflow_state')
    .update({
      state,
      status,
      completed_at: new Date().toISOString()
    })
    .eq('id', workflowId);
}

/**
 * Get complete workflow history for a lead
 */
export async function getWorkflowHistory(
  leadId: string,
  limit: number = 50
): Promise<WorkflowState[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('workflow_state')
    .select('*')
    .eq('lead_id', leadId)
    .order('started_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get workflow history:', error);
    return [];
  }

  return data || [];
}

/**
 * Get recent workflow runs across all leads
 */
export async function getRecentWorkflows(
  workflowName?: string,
  limit: number = 100
): Promise<WorkflowState[]> {
  const supabase = getSupabase();

  let query = supabase
    .from('workflow_state')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(limit);

  if (workflowName) {
    query = query.eq('workflow_name', workflowName);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Failed to get recent workflows:', error);
    return [];
  }

  return data || [];
}

/**
 * Clean up old workflow state records (keep last 30 days)
 */
export async function cleanupOldWorkflowState(): Promise<number> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('workflow_state')
    .delete()
    .lt('started_at', cutoff)
    .select('id');

  if (error) {
    console.error('Failed to cleanup old workflow state:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStats(hours: number = 24): Promise<{
  total: number;
  completed: number;
  failed: number;
  running: number;
  by_workflow: Record<string, number>;
}> {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('workflow_state')
    .select('workflow_name, status')
    .gte('started_at', cutoff);

  if (!data) {
    return { total: 0, completed: 0, failed: 0, running: 0, by_workflow: {} };
  }

  const stats = {
    total: data.length,
    completed: data.filter(d => d.status === 'completed').length,
    failed: data.filter(d => d.status === 'failed').length,
    running: data.filter(d => d.status === 'running').length,
    by_workflow: {} as Record<string, number>
  };

  for (const row of data) {
    stats.by_workflow[row.workflow_name] = (stats.by_workflow[row.workflow_name] || 0) + 1;
  }

  return stats;
}
