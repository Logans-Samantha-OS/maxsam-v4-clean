/**
 * AGENT SHARED MEMORY SYSTEM
 *
 * Allows agents to share knowledge about leads.
 * - ALEX stores discoveries (property records, ownership info)
 * - ELEANOR stores assessments (scores, urgency flags)
 * - SAM stores interactions (messages sent, responses)
 * - RALPH stores insights (patterns, recommendations)
 */

import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export type AgentName = 'ALEX' | 'ELEANOR' | 'SAM' | 'RALPH';
export type MemoryType = 'discovery' | 'assessment' | 'interaction' | 'insight' | 'warning';

export interface AgentMemory {
  id: string;
  lead_id?: string;
  agent: AgentName;
  memory_type: MemoryType;
  content: string;
  importance: number; // 1=critical, 10=trivial
  metadata: Record<string, unknown>;
  expires_at?: string;
  created_at: string;
}

export interface LeadContext {
  discoveries: AgentMemory[];
  assessments: AgentMemory[];
  interactions: AgentMemory[];
  insights: AgentMemory[];
  warnings: AgentMemory[];
  summary: string; // AI-friendly summary
}

/**
 * Get all memories about a lead from all agents
 */
export async function getLeadContext(leadId: string): Promise<LeadContext> {
  const supabase = getSupabase();

  const { data: memories, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false });

  if (error || !memories) {
    return {
      discoveries: [],
      assessments: [],
      interactions: [],
      insights: [],
      warnings: [],
      summary: 'No agent memories found for this lead.'
    };
  }

  const context: LeadContext = {
    discoveries: memories.filter(m => m.memory_type === 'discovery'),
    assessments: memories.filter(m => m.memory_type === 'assessment'),
    interactions: memories.filter(m => m.memory_type === 'interaction'),
    insights: memories.filter(m => m.memory_type === 'insight'),
    warnings: memories.filter(m => m.memory_type === 'warning'),
    summary: ''
  };

  // Build AI-friendly summary
  const summaryParts: string[] = [];

  if (context.warnings.length > 0) {
    summaryParts.push(`WARNINGS: ${context.warnings.map(w => w.content).join('; ')}`);
  }

  if (context.discoveries.length > 0) {
    summaryParts.push(`ALEX discovered: ${context.discoveries.slice(0, 3).map(d => d.content).join('; ')}`);
  }

  if (context.assessments.length > 0) {
    summaryParts.push(`ELEANOR assessed: ${context.assessments.slice(0, 2).map(a => a.content).join('; ')}`);
  }

  if (context.interactions.length > 0) {
    const recentInteraction = context.interactions[0];
    summaryParts.push(`Last interaction: ${recentInteraction.content}`);
  }

  if (context.insights.length > 0) {
    summaryParts.push(`Insights: ${context.insights.slice(0, 2).map(i => i.content).join('; ')}`);
  }

  context.summary = summaryParts.join('\n') || 'No prior context available.';

  return context;
}

/**
 * Add a memory about a lead
 */
export async function addMemory(
  leadId: string | null,
  agent: AgentName,
  memoryType: MemoryType,
  content: string,
  options?: {
    importance?: number;
    metadata?: Record<string, unknown>;
    expiresIn?: number; // hours
    skipDuplicate?: boolean;
  }
): Promise<string | null> {
  const supabase = getSupabase();

  // Check for duplicate if requested (avoid spam)
  if (options?.skipDuplicate && leadId) {
    const { data: existing } = await supabase
      .from('agent_memories')
      .select('id')
      .eq('lead_id', leadId)
      .eq('agent', agent)
      .eq('memory_type', memoryType)
      .ilike('content', content)
      .limit(1);

    if (existing && existing.length > 0) {
      return null; // Duplicate found
    }
  }

  const expires_at = options?.expiresIn
    ? new Date(Date.now() + options.expiresIn * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from('agent_memories')
    .insert({
      lead_id: leadId,
      agent,
      memory_type: memoryType,
      content,
      importance: options?.importance || 5,
      metadata: options?.metadata || {},
      expires_at
    })
    .select('id')
    .single();

  if (error) {
    console.error('Failed to add memory:', error);
    return null;
  }

  return data.id;
}

/**
 * Add discovery from ALEX (property info, ownership, etc.)
 */
export async function addDiscovery(
  leadId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return addMemory(leadId, 'ALEX', 'discovery', content, {
    metadata,
    skipDuplicate: true
  });
}

/**
 * Add assessment from ELEANOR (score insights, urgency, etc.)
 */
export async function addAssessment(
  leadId: string,
  content: string,
  importance?: number
): Promise<string | null> {
  return addMemory(leadId, 'ELEANOR', 'assessment', content, {
    importance,
    skipDuplicate: true
  });
}

/**
 * Add interaction from SAM (message sent/received)
 */
export async function addInteraction(
  leadId: string,
  content: string,
  metadata?: Record<string, unknown>
): Promise<string | null> {
  return addMemory(leadId, 'SAM', 'interaction', content, {
    metadata,
    skipDuplicate: false // Always log interactions
  });
}

/**
 * Add insight from RALPH or any agent
 */
export async function addInsight(
  leadId: string | null,
  agent: AgentName,
  content: string
): Promise<string | null> {
  return addMemory(leadId, agent, 'insight', content);
}

/**
 * Add warning (high priority, expires in 7 days)
 */
export async function addWarning(
  leadId: string,
  agent: AgentName,
  content: string
): Promise<string | null> {
  return addMemory(leadId, agent, 'warning', content, {
    importance: 1,
    expiresIn: 24 * 7 // 7 days
  });
}

/**
 * Get recent memories for an agent
 */
export async function getAgentMemories(
  agent: AgentName,
  limit: number = 100
): Promise<AgentMemory[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('agent', agent)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get agent memories:', error);
    return [];
  }

  return data || [];
}

/**
 * Get memories by type across all agents
 */
export async function getMemoriesByType(
  memoryType: MemoryType,
  limit: number = 100
): Promise<AgentMemory[]> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('agent_memories')
    .select('*')
    .eq('memory_type', memoryType)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Failed to get memories by type:', error);
    return [];
  }

  return data || [];
}

/**
 * Clean up expired memories
 */
export async function cleanupExpiredMemories(): Promise<number> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('agent_memories')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .not('expires_at', 'is', null)
    .select('id');

  if (error) {
    console.error('Failed to cleanup expired memories:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Build context string for SAM's outreach messages
 */
export async function buildOutreachContext(leadId: string): Promise<string> {
  const context = await getLeadContext(leadId);
  const parts: string[] = [];

  // Check for warnings first
  if (context.warnings.length > 0) {
    parts.push(`[CAUTION: ${context.warnings[0].content}]`);
  }

  // Add ALEX discoveries
  const relevantDiscoveries = context.discoveries.filter(d =>
    d.content.toLowerCase().includes('propert') ||
    d.content.toLowerCase().includes('owner') ||
    d.content.toLowerCase().includes('address')
  );
  if (relevantDiscoveries.length > 0) {
    parts.push(`[ALEX found: ${relevantDiscoveries[0].content}]`);
  }

  // Add ELEANOR urgency flags
  const urgentAssessments = context.assessments.filter(a =>
    a.importance <= 3 ||
    a.content.toLowerCase().includes('urgent') ||
    a.content.toLowerCase().includes('expir')
  );
  if (urgentAssessments.length > 0) {
    parts.push(`[ELEANOR: ${urgentAssessments[0].content}]`);
  }

  // Add last interaction context
  if (context.interactions.length > 0) {
    const last = context.interactions[0];
    parts.push(`[Last contact: ${last.content}]`);
  }

  return parts.join('\n');
}

/**
 * Get memory statistics
 */
export async function getMemoryStats(): Promise<{
  total: number;
  by_agent: Record<string, number>;
  by_type: Record<string, number>;
  last_24h: number;
}> {
  const supabase = getSupabase();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data } = await supabase
    .from('agent_memories')
    .select('agent, memory_type, created_at');

  if (!data) {
    return { total: 0, by_agent: {}, by_type: {}, last_24h: 0 };
  }

  const stats = {
    total: data.length,
    by_agent: {} as Record<string, number>,
    by_type: {} as Record<string, number>,
    last_24h: data.filter(d => d.created_at > yesterday).length
  };

  for (const row of data) {
    stats.by_agent[row.agent] = (stats.by_agent[row.agent] || 0) + 1;
    stats.by_type[row.memory_type] = (stats.by_type[row.memory_type] || 0) + 1;
  }

  return stats;
}
