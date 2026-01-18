/**
 * ORION Class Approval Matrix
 * Phase 13.3 - Economic Lead Classification
 *
 * ORION is the POLICY & SAFETY OWNER.
 * ORION decides which classes are allowed today.
 * ORION enforces priority order: Class A > Class B > Class C.
 * No ORION approval → no outreach.
 */

import { createClient } from '@supabase/supabase-js';
import {
  LeadClass,
  ClassApprovalRequest,
  ClassApprovalDecision,
  ClassApprovalMatrix,
  CLASS_PRIORITY_ORDER,
  CLASS_DEFINITIONS,
  CapacityConfig,
} from './types';

// ============================================================================
// ORION APPROVAL RULES (IMMUTABLE)
// ============================================================================

interface ORIONClassRule {
  name: string;
  check: (
    request: ClassApprovalRequest,
    context: ClassApprovalContext
  ) => { passed: boolean; reason: string };
}

interface ClassApprovalContext {
  autonomyLevel: 0 | 1 | 2 | 3;
  samEnabled: boolean;
  isWithinSamHours: boolean;
  higherClassesExhausted: boolean;
  dailyBudgetRemaining: number;
  classMetrics: {
    optOutRate: number;
    negativeResponseRate: number;
  } | null;
}

const ORION_CLASS_RULES: ORIONClassRule[] = [
  // Rule 1: Sam must be enabled
  {
    name: 'SAM_ENABLED',
    check: (_, context) => {
      if (!context.samEnabled) {
        return { passed: false, reason: 'Sam is disabled' };
      }
      return { passed: true, reason: 'Sam is enabled' };
    },
  },

  // Rule 2: Must be within Sam hours
  {
    name: 'WITHIN_SAM_HOURS',
    check: (_, context) => {
      if (!context.isWithinSamHours) {
        return { passed: false, reason: 'Outside Sam operating hours' };
      }
      return { passed: true, reason: 'Within Sam hours' };
    },
  },

  // Rule 3: Autonomy level check
  {
    name: 'AUTONOMY_LEVEL',
    check: (request, context) => {
      // Class A requires autonomy level 1+
      // Class B requires autonomy level 1+
      // Class C requires autonomy level 2+
      const requiredLevel = request.class === 'C' ? 2 : 1;

      if (context.autonomyLevel < requiredLevel) {
        return {
          passed: false,
          reason: `Class ${request.class} requires autonomy level ${requiredLevel}, current: ${context.autonomyLevel}`,
        };
      }
      return {
        passed: true,
        reason: `Autonomy level ${context.autonomyLevel} sufficient for Class ${request.class}`,
      };
    },
  },

  // Rule 4: Higher classes must be exhausted first
  {
    name: 'PRIORITY_ORDER',
    check: (request, context) => {
      if (request.class === 'A') {
        // Class A is always allowed (highest priority)
        return { passed: true, reason: 'Class A has highest priority' };
      }

      if (!context.higherClassesExhausted) {
        const higherClasses = CLASS_PRIORITY_ORDER.slice(
          0,
          CLASS_PRIORITY_ORDER.indexOf(request.class)
        );
        return {
          passed: false,
          reason: `Higher priority classes (${higherClasses.join(', ')}) not exhausted`,
        };
      }

      return { passed: true, reason: 'Higher priority classes exhausted' };
    },
  },

  // Rule 5: Opt-out rate check (stop-loss)
  {
    name: 'OPT_OUT_THRESHOLD',
    check: (request, context) => {
      if (!context.classMetrics) {
        return { passed: true, reason: 'No metrics available yet' };
      }

      const threshold = request.class === 'C' ? 0.05 : 0.08; // 5% for C, 8% for A/B

      if (context.classMetrics.optOutRate > threshold) {
        return {
          passed: false,
          reason: `Opt-out rate ${(context.classMetrics.optOutRate * 100).toFixed(1)}% exceeds threshold ${(threshold * 100).toFixed(1)}%`,
        };
      }

      return { passed: true, reason: 'Opt-out rate within limits' };
    },
  },

  // Rule 6: Budget check
  {
    name: 'DAILY_BUDGET',
    check: (request, context) => {
      if (context.dailyBudgetRemaining <= 0) {
        return { passed: false, reason: 'Daily contact budget exhausted' };
      }

      if (request.lead_count > context.dailyBudgetRemaining) {
        return {
          passed: true, // Still approve but with limit
          reason: `Approved with limit: ${context.dailyBudgetRemaining} leads (requested: ${request.lead_count})`,
        };
      }

      return { passed: true, reason: 'Within daily budget' };
    },
  },
];

// ============================================================================
// ORION CLASS APPROVAL
// ============================================================================

export async function approveClassForToday(
  request: ClassApprovalRequest,
  supabaseUrl: string,
  supabaseKey: string
): Promise<ClassApprovalDecision> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const context = await getApprovalContext(request.class, supabaseUrl, supabaseKey);

  // Evaluate all rules
  const ruleResults: { rule: string; passed: boolean; reason: string }[] = [];
  let allPassed = true;
  const conditions: string[] = [];

  for (const rule of ORION_CLASS_RULES) {
    const result = rule.check(request, context);
    ruleResults.push({ rule: rule.name, ...result });

    if (!result.passed) {
      allPassed = false;
    }
  }

  // Calculate max leads
  let maxLeads: number | null = null;
  if (allPassed) {
    maxLeads = Math.min(request.lead_count, context.dailyBudgetRemaining);

    // Class C gets capped at 50% of remaining capacity
    if (request.class === 'C') {
      maxLeads = Math.floor(maxLeads * 0.5);
      conditions.push('Class C capped at 50% of remaining capacity');
    }
  }

  // Build decision
  const decisionId = generateDecisionId(request.class);
  const decision: ClassApprovalDecision = {
    class: request.class,
    approved: allPassed,
    decision_id: decisionId,
    reason: allPassed
      ? `Class ${request.class} approved for today`
      : ruleResults
          .filter((r) => !r.passed)
          .map((r) => `[${r.rule}] ${r.reason}`)
          .join('; '),
    conditions,
    max_leads: maxLeads,
    expires_at: getEndOfDay(),
    decided_at: new Date().toISOString(),
  };

  // Log decision (append-only)
  await logApprovalDecision(decision, context, supabaseUrl, supabaseKey);

  return decision;
}

// ============================================================================
// APPROVAL MATRIX
// ============================================================================

export async function getClassApprovalMatrix(
  supabaseUrl: string,
  supabaseKey: string
): Promise<ClassApprovalMatrix> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Get today's decisions
  const { data: decisions } = await supabase
    .from('class_approval_log')
    .select('*')
    .eq('date', today)
    .order('decided_at', { ascending: false });

  // Get current autonomy level
  const { data: controls } = await supabase
    .from('system_controls')
    .select('control_key, control_value')
    .in('control_key', ['autonomy_level']);

  const autonomyLevel =
    (controls?.find((c) => c.control_key === 'autonomy_level')?.control_value as 0 | 1 | 2 | 3) || 0;

  // Build matrix
  const decisionMap = new Map<LeadClass, ClassApprovalDecision>();
  for (const d of decisions || []) {
    if (!decisionMap.has(d.class)) {
      decisionMap.set(d.class, {
        class: d.class,
        approved: d.approved,
        decision_id: d.decision_id,
        reason: d.reason,
        conditions: d.conditions || [],
        max_leads: d.max_leads,
        expires_at: d.expires_at,
        decided_at: d.decided_at,
      });
    }
  }

  const activeClasses: LeadClass[] = [];
  const haltedClasses: LeadClass[] = [];

  for (const cls of CLASS_PRIORITY_ORDER) {
    const decision = decisionMap.get(cls);
    if (decision?.approved) {
      activeClasses.push(cls);
    } else if (decision) {
      haltedClasses.push(cls);
    }
  }

  return {
    date: today,
    autonomy_level: autonomyLevel,
    decisions: Array.from(decisionMap.values()),
    priority_order: CLASS_PRIORITY_ORDER,
    active_classes: activeClasses,
    halted_classes: haltedClasses,
  };
}

// ============================================================================
// CONTEXT HELPERS
// ============================================================================

async function getApprovalContext(
  requestedClass: LeadClass,
  supabaseUrl: string,
  supabaseKey: string
): Promise<ClassApprovalContext> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get system controls
  const { data: controls } = await supabase
    .from('system_controls')
    .select('control_key, control_value')
    .in('control_key', [
      'autonomy_level',
      'sam_enabled',
      'sam_hours_start',
      'sam_hours_end',
    ]);

  const controlMap = new Map(
    (controls || []).map((c) => [c.control_key, c.control_value])
  );

  // Check Sam hours
  const now = new Date();
  const currentHour = now.getHours();
  const samStart = (controlMap.get('sam_hours_start') as number) || 9;
  const samEnd = (controlMap.get('sam_hours_end') as number) || 18;
  const isWithinSamHours = currentHour >= samStart && currentHour < samEnd;

  // Get campaign state
  const today = new Date().toISOString().split('T')[0];
  const { data: campaignState } = await supabase
    .from('campaign_state')
    .select('*')
    .eq('date', today)
    .single();

  // Check if higher classes are exhausted
  let higherClassesExhausted = true;
  if (requestedClass !== 'A') {
    for (const cls of CLASS_PRIORITY_ORDER) {
      if (cls === requestedClass) break;
      const remaining =
        cls === 'A'
          ? campaignState?.class_a_remaining || 0
          : cls === 'B'
            ? campaignState?.class_b_remaining || 0
            : 0;
      if (remaining > 0) {
        higherClassesExhausted = false;
        break;
      }
    }
  }

  // Get class metrics
  const { data: metrics } = await supabase
    .from('class_metrics')
    .select('opt_out_rate, negative_response_rate')
    .eq('class', requestedClass)
    .eq('period', 'week')
    .order('period_end', { ascending: false })
    .limit(1)
    .single();

  const dailyBudgetRemaining =
    (campaignState?.daily_capacity_target || 50) -
    (campaignState?.used_capacity || 0);

  return {
    autonomyLevel: (controlMap.get('autonomy_level') as 0 | 1 | 2 | 3) || 0,
    samEnabled: controlMap.get('sam_enabled') === true,
    isWithinSamHours,
    higherClassesExhausted,
    dailyBudgetRemaining,
    classMetrics: metrics
      ? {
          optOutRate: metrics.opt_out_rate || 0,
          negativeResponseRate: metrics.negative_response_rate || 0,
        }
      : null,
  };
}

async function logApprovalDecision(
  decision: ClassApprovalDecision,
  context: ClassApprovalContext,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  await supabase.from('class_approval_log').insert({
    decision_id: decision.decision_id,
    date: today,
    class: decision.class,
    approved: decision.approved,
    reason: decision.reason,
    conditions: decision.conditions,
    max_leads: decision.max_leads,
    expires_at: decision.expires_at,
    autonomy_level: context.autonomyLevel,
    decided_at: decision.decided_at,
  });
}

// ============================================================================
// ENFORCEMENT: Halt lower classes if higher-class capacity reappears
// ============================================================================

export async function checkAndHaltLowerClasses(
  supabaseUrl: string,
  supabaseKey: string
): Promise<{ halted: LeadClass[]; reason: string } | null> {
  const supabase = createClient(supabaseUrl, supabaseKey);
  const today = new Date().toISOString().split('T')[0];

  // Get current campaign state
  const { data: state } = await supabase
    .from('campaign_state')
    .select('*')
    .eq('date', today)
    .single();

  if (!state) return null;

  const halted: LeadClass[] = [];
  let reason = '';

  // If Class A has leads, halt B and C
  if (state.class_a_remaining > 0 && state.active_class !== 'A') {
    halted.push('B', 'C');
    reason = `Class A has ${state.class_a_remaining} leads remaining - halting lower classes`;

    await supabase
      .from('campaign_state')
      .update({
        active_class: 'A',
        halted_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('date', today);
  }
  // If Class B has leads and we're on C, halt C
  else if (
    state.class_b_remaining > 0 &&
    state.active_class === 'C' &&
    state.class_a_remaining === 0
  ) {
    halted.push('C');
    reason = `Class B has ${state.class_b_remaining} leads remaining - halting Class C`;

    await supabase
      .from('campaign_state')
      .update({
        active_class: 'B',
        halted_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('date', today);
  }

  if (halted.length > 0) {
    return { halted, reason };
  }

  return null;
}

// ============================================================================
// CLASS-SPECIFIC CONSTRAINTS
// ============================================================================

export function getClassConstraints(leadClass: LeadClass): {
  maxContactAttempts: number;
  cooldownHours: number;
  dailyCapPercent: number;
  stopLossOptOutRate: number;
  stopLossNegativeRate: number;
} {
  const defn = CLASS_DEFINITIONS[leadClass];

  return {
    maxContactAttempts: defn.maxContactAttempts,
    cooldownHours: defn.cooldownHours,
    dailyCapPercent: defn.dailyCapPercent,
    stopLossOptOutRate: leadClass === 'C' ? 0.05 : 0.08,
    stopLossNegativeRate: leadClass === 'C' ? 0.15 : 0.20,
  };
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateDecisionId(cls: LeadClass): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ORION-${cls}-${timestamp}-${random}`.toUpperCase();
}

function getEndOfDay(): string {
  const eod = new Date();
  eod.setHours(23, 59, 59, 999);
  return eod.toISOString();
}
