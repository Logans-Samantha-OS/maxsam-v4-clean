/**
 * AGENT LOOP - AUTONOMOUS DECISION ENGINE
 *
 * Runs every 15 minutes to:
 * 1. Check all agent goals and current state
 * 2. Identify highest priority action
 * 3. Execute action via appropriate endpoint
 * 4. Log decision with reasoning
 * 5. Update goal progress
 *
 * Priority order:
 * 1. URGENT: Golden leads uncontacted, expiring claims
 * 2. HIGH: Qualified leads needing follow-up
 * 3. MEDIUM: Scoring, skip tracing
 * 4. LOW: Re-engagement, maintenance
 */

import { createClient } from '@supabase/supabase-js';
import { addInsight } from './agent-memory';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AgentName = 'ALEX' | 'ELEANOR' | 'SAM' | 'RALPH';
export type AgentStatus = 'idle' | 'working' | 'paused' | 'error';

export interface AgentGoal {
  id: string;
  agent: AgentName;
  goal: string;
  goal_key: string;
  priority: number;
  target_daily: number | null;
  current_daily: number;
  active: boolean;
}

export interface AgentState {
  agent: AgentName;
  status: AgentStatus;
  current_task: string | null;
  last_run: string | null;
  context: Record<string, unknown>;
}

export interface AgentAction {
  agent: AgentName;
  action: string;
  goal_key: string;
  priority: number;
  target_id?: string; // lead_id or other identifier
  target_count?: number; // how many items to process
  reason: string;
  endpoint?: string;
  payload?: Record<string, unknown>;
}

export interface AgentDecision {
  agent: AgentName;
  situation: string;
  options: AgentAction[];
  decision: string;
  reasoning: string;
  outcome?: string;
  success?: boolean;
  execution_time_ms?: number;
}

export interface AgentLoopResult {
  status: 'completed' | 'idle' | 'error' | 'paused';
  message: string;
  action?: AgentAction;
  decision?: AgentDecision;
  error?: string;
}

/**
 * Get current state of all agents
 */
export async function getAgentStates(): Promise<Record<AgentName, AgentState>> {
  const supabase = getSupabase();

  const { data } = await supabase
    .from('agent_state')
    .select('*');

  const states: Record<string, AgentState> = {};
  for (const row of data || []) {
    states[row.agent as AgentName] = row;
  }

  return states as Record<AgentName, AgentState>;
}

/**
 * Get all active goals
 */
export async function getActiveGoals(): Promise<AgentGoal[]> {
  const supabase = getSupabase();

  // First, reset goals if needed (new day)
  await supabase.rpc('reset_daily_goals');

  const { data } = await supabase
    .from('agent_goals')
    .select('*')
    .eq('active', true)
    .order('priority', { ascending: true });

  return data || [];
}

/**
 * Update agent state
 */
export async function updateAgentState(
  agent: AgentName,
  status: AgentStatus,
  currentTask?: string
): Promise<void> {
  const supabase = getSupabase();

  await supabase
    .from('agent_state')
    .update({
      status,
      current_task: currentTask || null,
      last_run: status === 'working' ? new Date().toISOString() : undefined,
      updated_at: new Date().toISOString()
    })
    .eq('agent', agent);
}

/**
 * Log an agent decision
 */
export async function logDecision(decision: AgentDecision): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('agent_decisions')
    .insert({
      agent: decision.agent,
      situation: decision.situation,
      options: decision.options,
      decision: decision.decision,
      reasoning: decision.reasoning,
      outcome: decision.outcome,
      success: decision.success,
      execution_time_ms: decision.execution_time_ms
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to log decision:', error);
    return '';
  }

  return data.id;
}

/**
 * Increment goal progress
 */
export async function incrementGoalProgress(
  agent: AgentName,
  goalKey: string,
  amount: number = 1
): Promise<void> {
  const supabase = getSupabase();

  await supabase.rpc('increment_goal_progress', {
    p_agent: agent,
    p_goal_key: goalKey,
    p_amount: amount
  });
}

/**
 * Check for opportunities and determine next action
 */
export async function determineNextAction(): Promise<AgentAction | null> {
  const supabase = getSupabase();
  const actions: AgentAction[] = [];

  // Check agent states - skip if any agent is paused globally
  const states = await getAgentStates();
  const pausedAgents = Object.entries(states)
    .filter(([, s]) => s.status === 'paused')
    .map(([a]) => a);

  // ========================================
  // PRIORITY 1: URGENT - Money on the table
  // ========================================

  // Golden leads not contacted
  const { data: goldenUncontacted } = await supabase
    .from('maxsam_leads')
    .select('id')
    .eq('is_golden', true)
    .is('first_contact_at', null)
    .not('status', 'in', '("dead","closed")')
    .limit(20);

  if (goldenUncontacted && goldenUncontacted.length > 0 && !pausedAgents.includes('SAM')) {
    actions.push({
      agent: 'SAM',
      action: 'Contact golden leads',
      goal_key: 'contact_golden',
      priority: 1,
      target_count: goldenUncontacted.length,
      reason: `${goldenUncontacted.length} golden leads sitting uncontacted = money waiting`,
      endpoint: '/api/sam/run-batch',
      payload: { lead_ids: goldenUncontacted.map(l => l.id), priority: 'golden' }
    });
  }

  // Claims expiring in 7 days
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: expiringClaims } = await supabase
    .from('maxsam_leads')
    .select('id')
    .lt('claim_deadline', expiryDate)
    .is('first_contact_at', null)
    .not('status', 'in', '("dead","closed")')
    .limit(10);

  if (expiringClaims && expiringClaims.length > 0 && !pausedAgents.includes('SAM')) {
    actions.push({
      agent: 'SAM',
      action: 'Urgency outreach for expiring claims',
      goal_key: 'urgency_expiring',
      priority: 1,
      target_count: expiringClaims.length,
      reason: `${expiringClaims.length} claims expiring within 7 days - URGENT`,
      endpoint: '/api/sam/run-batch',
      payload: { lead_ids: expiringClaims.map(l => l.id), template: 'urgency' }
    });
  }

  // ========================================
  // PRIORITY 2-3: HIGH - Follow-ups
  // ========================================

  // Non-responders after 48 hours
  const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const { data: nonResponders } = await supabase
    .from('maxsam_leads')
    .select('id')
    .not('first_contact_at', 'is', null)
    .is('last_response_at', null)
    .lt('first_contact_at', fortyEightHoursAgo)
    .not('status', 'in', '("dead","closed","qualified")')
    .limit(30);

  if (nonResponders && nonResponders.length > 0 && !pausedAgents.includes('SAM')) {
    actions.push({
      agent: 'SAM',
      action: 'Follow up non-responders (48hr)',
      goal_key: 'followup_48hr',
      priority: 3,
      target_count: nonResponders.length,
      reason: `${nonResponders.length} leads haven't responded in 48+ hours`,
      endpoint: '/api/sam/run-batch',
      payload: { lead_ids: nonResponders.map(l => l.id), template: 'followup' }
    });
  }

  // ========================================
  // PRIORITY 4-5: MEDIUM - Processing
  // ========================================

  // Unscored leads
  const { data: unscored } = await supabase
    .from('maxsam_leads')
    .select('id')
    .is('eleanor_score', null)
    .not('status', 'in', '("dead","closed")')
    .limit(100);

  if (unscored && unscored.length > 0 && !pausedAgents.includes('ELEANOR')) {
    actions.push({
      agent: 'ELEANOR',
      action: 'Score unscored leads',
      goal_key: 'score_leads',
      priority: 4,
      target_count: unscored.length,
      reason: `${unscored.length} leads need scoring`,
      endpoint: '/api/eleanor/score-all',
      payload: { limit: Math.min(100, unscored.length) }
    });
  }

  // Leads missing phone numbers (need skip trace)
  const { data: missingPhones } = await supabase
    .from('maxsam_leads')
    .select('id')
    .is('phone', null)
    .is('phone_1', null)
    .not('status', 'in', '("dead","closed")')
    .not('eleanor_score', 'is', null) // Only skip trace scored leads
    .limit(50);

  if (missingPhones && missingPhones.length > 0 && !pausedAgents.includes('ALEX')) {
    actions.push({
      agent: 'ALEX',
      action: 'Skip trace leads missing phones',
      goal_key: 'skip_trace',
      priority: 5,
      target_count: missingPhones.length,
      reason: `${missingPhones.length} scored leads need phone numbers`,
      endpoint: '/api/alex/skip-trace-batch',
      payload: { lead_ids: missingPhones.map(l => l.id).slice(0, 20) }
    });
  }

  // ========================================
  // PRIORITY 6+: LOW - Re-engagement
  // ========================================

  // Cold leads (7+ days)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: coldLeads } = await supabase
    .from('maxsam_leads')
    .select('id')
    .not('first_contact_at', 'is', null)
    .lt('last_contact_at', sevenDaysAgo)
    .not('status', 'in', '("dead","closed","qualified","contract_sent")')
    .limit(20);

  if (coldLeads && coldLeads.length > 0 && !pausedAgents.includes('SAM')) {
    actions.push({
      agent: 'SAM',
      action: 'Re-engage cold leads (7 day)',
      goal_key: 'reengage_cold',
      priority: 6,
      target_count: coldLeads.length,
      reason: `${coldLeads.length} leads have gone cold - try re-engagement`,
      endpoint: '/api/sam/run-batch',
      payload: { lead_ids: coldLeads.map(l => l.id), template: 'reengage' }
    });
  }

  // Sort by priority and return highest
  actions.sort((a, b) => a.priority - b.priority);

  return actions.length > 0 ? actions[0] : null;
}

/**
 * Execute an agent action
 */
export async function executeAction(action: AgentAction): Promise<{
  success: boolean;
  outcome: string;
  data?: unknown;
}> {
  if (!action.endpoint) {
    return {
      success: false,
      outcome: 'No endpoint configured for this action'
    };
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    const response = await fetch(`${baseUrl}${action.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(action.payload || {})
    });

    const data = await response.json();

    if (response.ok) {
      return {
        success: true,
        outcome: data.message || `Completed: ${action.action}`,
        data
      };
    } else {
      return {
        success: false,
        outcome: data.error || `Failed: ${response.status}`,
        data
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      outcome: `Exception: ${message}`
    };
  }
}

/**
 * Run one iteration of the agent loop
 */
export async function runAgentLoop(): Promise<AgentLoopResult> {
  const startTime = Date.now();

  try {
    // 1. Check if all agents are paused
    const states = await getAgentStates();
    const allPaused = Object.values(states).every(s => s.status === 'paused');
    if (allPaused) {
      return {
        status: 'paused',
        message: 'All agents are paused'
      };
    }

    // 2. Determine next action
    const action = await determineNextAction();
    if (!action) {
      return {
        status: 'idle',
        message: 'No actions needed - all goals met or no opportunities'
      };
    }

    // 3. Update agent state to working
    await updateAgentState(action.agent, 'working', action.action);

    // 4. Execute the action
    const result = await executeAction(action);
    const executionTime = Date.now() - startTime;

    // 5. Build and log decision
    const decision: AgentDecision = {
      agent: action.agent,
      situation: action.reason,
      options: [action], // In future, could include alternatives considered
      decision: action.action,
      reasoning: `Priority ${action.priority}: ${action.reason}`,
      outcome: result.outcome,
      success: result.success,
      execution_time_ms: executionTime
    };

    await logDecision(decision);

    // 6. Update goal progress if successful
    if (result.success) {
      await incrementGoalProgress(action.agent, action.goal_key, action.target_count || 1);
    }

    // 7. Update agent state back to idle (or error)
    await updateAgentState(
      action.agent,
      result.success ? 'idle' : 'error'
    );

    // 8. Add insight if something interesting happened
    if (action.target_count && action.target_count > 10) {
      await addInsight(
        null,
        'RALPH',
        `${action.agent} processed ${action.target_count} items for "${action.action}"`
      );
    }

    return {
      status: 'completed',
      message: result.outcome,
      action,
      decision
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Agent loop error:', error);

    return {
      status: 'error',
      message: 'Agent loop failed',
      error: message
    };
  }
}

/**
 * Get agent loop status summary
 */
export async function getAgentLoopStatus(): Promise<{
  agents: Record<AgentName, AgentState>;
  goals: AgentGoal[];
  recent_decisions: AgentDecision[];
  opportunities: {
    golden_uncontacted: number;
    expiring_claims: number;
    unscored: number;
    missing_phones: number;
    non_responders: number;
  };
}> {
  const supabase = getSupabase();

  const [agents, goals] = await Promise.all([
    getAgentStates(),
    getActiveGoals()
  ]);

  // Get recent decisions
  const { data: decisions } = await supabase
    .from('agent_decisions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  // Count opportunities
  const [
    { count: golden },
    { count: expiring },
    { count: unscored },
    { count: missing },
    { count: nonResponders }
  ] = await Promise.all([
    supabase.from('maxsam_leads').select('*', { count: 'exact', head: true })
      .eq('is_golden', true).is('first_contact_at', null),
    supabase.from('maxsam_leads').select('*', { count: 'exact', head: true })
      .lt('claim_deadline', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .is('first_contact_at', null),
    supabase.from('maxsam_leads').select('*', { count: 'exact', head: true })
      .is('eleanor_score', null),
    supabase.from('maxsam_leads').select('*', { count: 'exact', head: true })
      .is('phone', null).is('phone_1', null),
    supabase.from('maxsam_leads').select('*', { count: 'exact', head: true })
      .not('first_contact_at', 'is', null).is('last_response_at', null)
      .lt('first_contact_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
  ]);

  return {
    agents,
    goals,
    recent_decisions: decisions || [],
    opportunities: {
      golden_uncontacted: golden || 0,
      expiring_claims: expiring || 0,
      unscored: unscored || 0,
      missing_phones: missing || 0,
      non_responders: nonResponders || 0
    }
  };
}

/**
 * Pause or resume an agent
 */
export async function setAgentPaused(agent: AgentName, paused: boolean): Promise<void> {
  await updateAgentState(agent, paused ? 'paused' : 'idle');
}

/**
 * Pause or resume all agents
 */
export async function setAllAgentsPaused(paused: boolean): Promise<void> {
  const agents: AgentName[] = ['ALEX', 'ELEANOR', 'SAM', 'RALPH'];
  await Promise.all(agents.map(a => setAgentPaused(a, paused)));
}
