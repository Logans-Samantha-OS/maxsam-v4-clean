/**
 * Economic Lead Classification Types
 * Phase 13.3 - Foundational Classification Shift
 *
 * Every lead is classified by ECONOMIC REALITY, not by superficial labels.
 * This unlocks dormant value from all previously ingested data.
 */

// ============================================================================
// LEAD CLASSES (ECONOMIC REALITY)
// ============================================================================

/**
 * Economic Lead Classification
 *
 * CLASS A — GOLDEN_TRANSACTIONAL
 *   - Excess funds recovery opportunity
 *   - Distressed property transaction opportunity
 *   - Dual revenue paths (recovery + assignment)
 *   - Highest total lifetime value
 *   - Highest priority at all times
 *
 * CLASS B — GOLDEN_RECOVERY_ONLY
 *   - Excess funds recovery opportunity only
 *   - No distressed property sale
 *   - Large recoverable balance ("big fish")
 *   - Single but clean revenue path
 *   - Often faster time-to-cash than Class A
 *   - Must be actively worked, not deprioritized
 *
 * CLASS C — STANDARD_RECOVERY
 *   - Excess funds recovery only
 *   - Smaller balances
 *   - Still profitable but lower urgency
 *   - Capacity-filler only (optional, later)
 *
 * ⚠️ These are ECONOMIC classes, not quality judgments.
 */
export type LeadClass = 'A' | 'B' | 'C';

export interface LeadClassDefinition {
  class: LeadClass;
  name: string;
  description: string;
  priority: number; // 1 = highest
  revenuePaths: ('excess_recovery' | 'wholesale_assignment')[];
  minExpectedValue: number;
  maxContactAttempts: number;
  cooldownHours: number;
  dailyCapPercent: number; // Percentage of daily capacity
}

// ============================================================================
// CLASS DEFINITIONS (IMMUTABLE)
// ============================================================================

export const CLASS_DEFINITIONS: Record<LeadClass, LeadClassDefinition> = {
  A: {
    class: 'A',
    name: 'GOLDEN_TRANSACTIONAL',
    description: 'Dual revenue: Excess funds + distressed property transaction',
    priority: 1,
    revenuePaths: ['excess_recovery', 'wholesale_assignment'],
    minExpectedValue: 20000, // $20K minimum expected value
    maxContactAttempts: 8,
    cooldownHours: 4, // Aggressive follow-up
    dailyCapPercent: 100, // No cap - drain fully first
  },
  B: {
    class: 'B',
    name: 'GOLDEN_RECOVERY_ONLY',
    description: 'Big fish: Large excess funds recovery only',
    priority: 2,
    revenuePaths: ['excess_recovery'],
    minExpectedValue: 7500, // $7.5K+ fee (25% of $30K+)
    maxContactAttempts: 6,
    cooldownHours: 6,
    dailyCapPercent: 100, // Fill remaining capacity
  },
  C: {
    class: 'C',
    name: 'STANDARD_RECOVERY',
    description: 'Smaller balance excess funds recovery',
    priority: 3,
    revenuePaths: ['excess_recovery'],
    minExpectedValue: 1250, // $1.25K+ fee (25% of $5K+)
    maxContactAttempts: 4,
    cooldownHours: 24, // Lower urgency
    dailyCapPercent: 50, // Only use half remaining capacity
  },
};

// ============================================================================
// CLASSIFICATION THRESHOLDS
// ============================================================================

export const CLASSIFICATION_THRESHOLDS = {
  // Class A: Dual deal thresholds
  CLASS_A: {
    minExcessFunds: 15000, // At least $15K excess
    minWholesaleEquity: 10000, // At least $10K equity
    requiresCrossReference: false, // Cross-ref boosts but not required
    crossReferenceBoost: true, // If cross-referenced, auto-qualify
  },

  // Class B: Big fish recovery thresholds
  CLASS_B: {
    minExcessFunds: 75000, // "Big fish" = $75K+ excess (updated threshold)
    maxExcessFunds: null, // No upper limit
    minExpectedFee: 18750, // At least $18.75K fee (25% of $75K)
  },

  // Class C: Standard recovery thresholds
  CLASS_C: {
    minExcessFunds: 5000, // Minimum $5K excess
    maxExcessFunds: 75000, // Below Class B threshold
    minExpectedFee: 1250, // At least $1.25K fee
  },

  // Below Class C = Not economically viable
  MINIMUM_VIABLE: {
    minExcessFunds: 5000, // Below this = not worth pursuing
  },
} as const;

// ============================================================================
// CLASSIFICATION RESULT
// ============================================================================

export interface ClassificationResult {
  lead_class: LeadClass;
  class_name: string;
  class_reason: string;
  expected_value: number; // Total expected revenue
  expected_recovery_fee: number; // 25% of excess funds
  expected_wholesale_fee: number; // 10% of equity (Class A only)
  expected_time_to_cash: number; // Days estimate
  revenue_paths: ('excess_recovery' | 'wholesale_assignment')[];
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  factors: ClassificationFactor[];
}

export interface ClassificationFactor {
  name: string;
  value: string | number | boolean;
  impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
  contribution: string;
}

// ============================================================================
// CAPACITY STATE
// ============================================================================

export interface CapacityState {
  date: string; // YYYY-MM-DD
  daily_capacity_target: number;
  used_capacity: number;
  remaining_capacity: number;
  utilization_percent: number;

  // Per-class tracking
  class_a_contacted: number;
  class_a_remaining: number;
  class_b_contacted: number;
  class_b_remaining: number;
  class_c_contacted: number;
  class_c_remaining: number;

  // Current active class
  active_class: LeadClass | null;
  halted_reason: string | null;

  // Last updated
  updated_at: string;
}

export interface CapacityConfig {
  daily_target: number; // Target outreach per day
  utilization_target: number; // Target % (e.g., 90)
  class_a_exhausted: boolean;
  class_b_exhausted: boolean;
  allowed_classes: LeadClass[];
}

// ============================================================================
// CLASS-SPECIFIC METRICS
// ============================================================================

export interface ClassMetrics {
  class: LeadClass;
  period: 'day' | 'week' | 'month' | 'all_time';
  period_start: string;
  period_end: string;

  // Volume metrics
  total_leads: number;
  contacted: number;
  responded: number;
  qualified: number;
  contracted: number;
  closed: number;

  // Revenue metrics
  total_expected_value: number;
  total_recovered: number;
  avg_deal_size: number;

  // Efficiency metrics
  conversion_rate: number; // contacted -> closed
  response_rate: number; // contacted -> responded
  qualification_rate: number; // responded -> qualified
  close_rate: number; // qualified -> closed

  // Time metrics
  avg_time_to_response_hours: number;
  avg_time_to_close_days: number;
  avg_time_to_cash_days: number;

  // Cost metrics
  cost_per_lead: number;
  cost_per_close: number;
  cost_per_recovered_dollar: number;

  // Signal metrics
  opt_out_rate: number;
  negative_response_rate: number;
  dropoff_stages: Record<string, number>;
}

// ============================================================================
// ORION CLASS APPROVAL
// ============================================================================

export interface ClassApprovalRequest {
  class: LeadClass;
  lead_count: number;
  total_expected_value: number;
  reason: string;
}

export interface ClassApprovalDecision {
  class: LeadClass;
  approved: boolean;
  decision_id: string;
  reason: string;
  conditions: string[];
  max_leads: number | null;
  expires_at: string;
  decided_at: string;
}

export interface ClassApprovalMatrix {
  date: string;
  autonomy_level: 0 | 1 | 2 | 3;
  decisions: ClassApprovalDecision[];
  priority_order: LeadClass[];
  active_classes: LeadClass[];
  halted_classes: LeadClass[];
}

// ============================================================================
// DAILY RANKING
// ============================================================================

export interface DailyRank {
  lead_id: string;
  lead_class: LeadClass;
  daily_rank: number; // 1 = highest priority today
  rank_reason: string;
  expected_value: number;
  urgency_score: number;
  contact_readiness: number;
  last_attempt_at: string | null;
  next_eligible_at: string | null;
}

// ============================================================================
// BACKFILL STATUS
// ============================================================================

export interface BackfillStatus {
  total_leads: number;
  classified_leads: number;
  unclassified_leads: number;
  class_a_count: number;
  class_b_count: number;
  class_c_count: number;
  not_viable_count: number;
  last_backfill_at: string | null;
  backfill_in_progress: boolean;
}

// ============================================================================
// PRIORITY ORDER (IMMUTABLE LAW)
// ============================================================================

export const CLASS_PRIORITY_ORDER: LeadClass[] = ['A', 'B', 'C'];

/**
 * Returns true if classA has higher priority than classB.
 * Used to enforce: "Never allow lower classes to delay higher classes"
 */
export function isHigherPriority(classA: LeadClass, classB: LeadClass): boolean {
  return CLASS_PRIORITY_ORDER.indexOf(classA) < CLASS_PRIORITY_ORDER.indexOf(classB);
}

/**
 * Returns the next class to work after current class is exhausted.
 */
export function getNextClass(currentClass: LeadClass): LeadClass | null {
  const currentIndex = CLASS_PRIORITY_ORDER.indexOf(currentClass);
  const nextIndex = currentIndex + 1;

  if (nextIndex >= CLASS_PRIORITY_ORDER.length) {
    return null; // No more classes
  }

  return CLASS_PRIORITY_ORDER[nextIndex];
}
