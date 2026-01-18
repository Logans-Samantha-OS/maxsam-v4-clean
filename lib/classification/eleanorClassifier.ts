/**
 * Eleanor Economic Classifier
 * Phase 13.3 - Economic Lead Classification
 *
 * Eleanor is the INTELLIGENCE OWNER.
 * Eleanor classifies every lead into A / B / C.
 * Eleanor explains why the classification exists.
 * Eleanor never executes.
 */

import {
  LeadClass,
  ClassificationResult,
  ClassificationFactor,
  CLASSIFICATION_THRESHOLDS,
  CLASS_DEFINITIONS,
  DailyRank,
  CLASS_PRIORITY_ORDER,
} from './types';
import { Lead, calculateEleanorScore, ScoringResult } from '../eleanor';

// ============================================================================
// CORE CLASSIFICATION FUNCTION
// ============================================================================

/**
 * Classify a lead into economic class A, B, or C.
 * Returns null if lead is not economically viable.
 *
 * Classification Logic:
 * 1. Check if meets minimum viability ($5K excess)
 * 2. Check for Class A (dual deal potential)
 * 3. Check for Class B (big fish recovery)
 * 4. Default to Class C (standard recovery)
 */
export function classifyLead(lead: Lead): ClassificationResult | null {
  const factors: ClassificationFactor[] = [];

  // Get Eleanor's scoring first
  const scoring = calculateEleanorScore(lead);
  const excessAmount = Number(lead.excess_funds_amount) || 0;

  // ============================================================================
  // STEP 1: Check minimum viability
  // ============================================================================

  if (excessAmount < CLASSIFICATION_THRESHOLDS.MINIMUM_VIABLE.minExcessFunds) {
    return null; // Not economically viable
  }

  factors.push({
    name: 'Excess Funds Amount',
    value: excessAmount,
    impact: excessAmount >= 30000 ? 'POSITIVE' : excessAmount >= 15000 ? 'NEUTRAL' : 'NEUTRAL',
    contribution: `$${excessAmount.toLocaleString()} available for recovery`,
  });

  // ============================================================================
  // STEP 2: Calculate expected values
  // ============================================================================

  const expectedRecoveryFee = excessAmount * 0.25; // 25% fee

  // Calculate wholesale potential (from Eleanor's scoring)
  const arv = Number(lead.estimated_arv) || (excessAmount > 0 ? excessAmount * 3 : 0);
  const repairCost = Number(lead.estimated_repair_cost) || (arv * 0.15);
  const mao = arv * 0.70;
  const equity = Math.max(0, arv - repairCost - mao);
  const expectedWholesaleFee = equity >= CLASSIFICATION_THRESHOLDS.CLASS_A.minWholesaleEquity
    ? equity * 0.10
    : 0;

  const isCrossReferenced = lead.is_cross_referenced || false;
  const hasDistressedSignal = isCrossReferenced || lead.is_distressed || false;

  factors.push({
    name: 'Cross-Referenced',
    value: isCrossReferenced,
    impact: isCrossReferenced ? 'POSITIVE' : 'NEUTRAL',
    contribution: isCrossReferenced
      ? 'On distressed list - dual deal potential'
      : 'Not on distressed list',
  });

  // ============================================================================
  // STEP 3: Determine class
  // ============================================================================

  let leadClass: LeadClass;
  let classReason: string;
  let revenuePaths: ClassificationResult['revenue_paths'];
  let expectedValue: number;
  let confidence: ClassificationResult['confidence'];

  // Check for Class A: Dual deal potential
  const meetsClassA = checkClassA(
    excessAmount,
    equity,
    isCrossReferenced,
    hasDistressedSignal
  );

  if (meetsClassA.qualifies) {
    leadClass = 'A';
    classReason = meetsClassA.reason;
    revenuePaths = ['excess_recovery', 'wholesale_assignment'];
    expectedValue = expectedRecoveryFee + expectedWholesaleFee;
    confidence = isCrossReferenced ? 'HIGH' : 'MEDIUM';

    factors.push({
      name: 'Wholesale Equity',
      value: equity,
      impact: 'POSITIVE',
      contribution: `$${equity.toLocaleString()} equity enables assignment`,
    });
  }
  // Check for Class B: Big fish recovery
  else if (excessAmount >= CLASSIFICATION_THRESHOLDS.CLASS_B.minExcessFunds) {
    leadClass = 'B';
    classReason = `Big fish recovery: $${excessAmount.toLocaleString()} excess funds (${expectedRecoveryFee.toLocaleString()} expected fee)`;
    revenuePaths = ['excess_recovery'];
    expectedValue = expectedRecoveryFee;
    confidence = 'HIGH';

    factors.push({
      name: 'Big Fish Status',
      value: true,
      impact: 'POSITIVE',
      contribution: `Exceeds $75K threshold for priority recovery`,
    });
  }
  // Default to Class C: Standard recovery
  else {
    leadClass = 'C';
    classReason = `Standard recovery: $${excessAmount.toLocaleString()} excess funds`;
    revenuePaths = ['excess_recovery'];
    expectedValue = expectedRecoveryFee;
    confidence = excessAmount >= 10000 ? 'MEDIUM' : 'LOW';
  }

  // ============================================================================
  // STEP 4: Estimate time to cash
  // ============================================================================

  const daysUntilExpiration = lead.days_until_expiration ?? lead.days_until_expiry ?? 180;
  const hasPhone = !!(lead.phone || lead.phone_1 || lead.phone_2);

  let expectedTimeToCash: number;
  if (leadClass === 'A') {
    // Dual deals take longer but are worth more
    expectedTimeToCash = hasPhone ? 45 : 60;
  } else if (leadClass === 'B') {
    // Big fish recoveries can move fast
    expectedTimeToCash = hasPhone ? 30 : 45;
  } else {
    // Standard recoveries
    expectedTimeToCash = hasPhone ? 35 : 50;
  }

  // Urgency adjustment
  if (daysUntilExpiration !== null && daysUntilExpiration < expectedTimeToCash) {
    expectedTimeToCash = Math.max(14, daysUntilExpiration - 7); // Rush it
    factors.push({
      name: 'Expiration Urgency',
      value: daysUntilExpiration,
      impact: 'NEGATIVE',
      contribution: `Only ${daysUntilExpiration} days until expiration - urgent`,
    });
  }

  factors.push({
    name: 'Contact Readiness',
    value: hasPhone,
    impact: hasPhone ? 'POSITIVE' : 'NEGATIVE',
    contribution: hasPhone ? 'Phone available for immediate contact' : 'Skip tracing required',
  });

  // ============================================================================
  // STEP 5: Build result
  // ============================================================================

  return {
    lead_class: leadClass,
    class_name: CLASS_DEFINITIONS[leadClass].name,
    class_reason: classReason,
    expected_value: Math.round(expectedValue * 100) / 100,
    expected_recovery_fee: Math.round(expectedRecoveryFee * 100) / 100,
    expected_wholesale_fee: Math.round(expectedWholesaleFee * 100) / 100,
    expected_time_to_cash: expectedTimeToCash,
    revenue_paths: revenuePaths,
    confidence,
    factors,
  };
}

// ============================================================================
// CLASS A QUALIFICATION
// ============================================================================

function checkClassA(
  excessAmount: number,
  equity: number,
  isCrossReferenced: boolean,
  hasDistressedSignal: boolean
): { qualifies: boolean; reason: string } {
  const thresholds = CLASSIFICATION_THRESHOLDS.CLASS_A;

  // Cross-referenced leads auto-qualify for Class A if they meet minimum excess
  if (isCrossReferenced && excessAmount >= thresholds.minExcessFunds) {
    return {
      qualifies: true,
      reason: `Cross-referenced dual deal: $${excessAmount.toLocaleString()} excess + distressed property`,
    };
  }

  // Check standard Class A thresholds
  if (
    excessAmount >= thresholds.minExcessFunds &&
    equity >= thresholds.minWholesaleEquity
  ) {
    return {
      qualifies: true,
      reason: `Dual deal potential: $${excessAmount.toLocaleString()} excess + $${equity.toLocaleString()} equity`,
    };
  }

  // High equity with moderate excess
  if (equity >= 25000 && excessAmount >= 10000) {
    return {
      qualifies: true,
      reason: `High equity dual deal: $${equity.toLocaleString()} equity opportunity`,
    };
  }

  return {
    qualifies: false,
    reason: 'Does not meet dual deal thresholds',
  };
}

// ============================================================================
// DAILY RANKING
// ============================================================================

/**
 * Rank leads within their class for daily prioritization.
 * Returns leads sorted by priority within each class.
 */
export function rankLeadsForDay(
  leads: Array<Lead & { id: string; last_attempt_at?: string | null }>
): DailyRank[] {
  const now = new Date();
  const rankings: DailyRank[] = [];

  for (const lead of leads) {
    const classification = classifyLead(lead);
    if (!classification) continue; // Not viable

    const scoring = calculateEleanorScore(lead);
    const classDefn = CLASS_DEFINITIONS[classification.lead_class];

    // Calculate urgency score (0-100)
    const daysUntilExpiration = lead.days_until_expiration ?? lead.days_until_expiry ?? 180;
    let urgencyScore = 0;
    if (daysUntilExpiration <= 7) urgencyScore = 100;
    else if (daysUntilExpiration <= 14) urgencyScore = 90;
    else if (daysUntilExpiration <= 30) urgencyScore = 75;
    else if (daysUntilExpiration <= 60) urgencyScore = 50;
    else if (daysUntilExpiration <= 90) urgencyScore = 25;
    else urgencyScore = 10;

    // Calculate contact readiness (0-100)
    const hasPhone = !!(lead.phone || lead.phone_1 || lead.phone_2);
    const hasEmail = !!lead.email;
    let contactReadiness = 0;
    if (hasPhone) contactReadiness += 70;
    if (hasEmail) contactReadiness += 30;

    // Check cooldown
    let nextEligibleAt: string | null = null;
    if (lead.last_attempt_at) {
      const lastAttempt = new Date(lead.last_attempt_at);
      const cooldownMs = classDefn.cooldownHours * 60 * 60 * 1000;
      const eligibleTime = new Date(lastAttempt.getTime() + cooldownMs);

      if (eligibleTime > now) {
        nextEligibleAt = eligibleTime.toISOString();
      }
    }

    // Composite score for ranking within class
    const compositeScore =
      (classification.expected_value / 1000) * 0.4 + // Value weight
      urgencyScore * 0.4 + // Urgency weight
      contactReadiness * 0.2; // Readiness weight

    rankings.push({
      lead_id: lead.id,
      lead_class: classification.lead_class,
      daily_rank: 0, // Will be set after sorting
      rank_reason: `${classification.class_name}: ${classification.class_reason}`,
      expected_value: classification.expected_value,
      urgency_score: urgencyScore,
      contact_readiness: contactReadiness,
      last_attempt_at: lead.last_attempt_at || null,
      next_eligible_at: nextEligibleAt,
    });
  }

  // Sort by class priority first, then by composite score within class
  rankings.sort((a, b) => {
    const classCompare =
      CLASS_PRIORITY_ORDER.indexOf(a.lead_class) -
      CLASS_PRIORITY_ORDER.indexOf(b.lead_class);
    if (classCompare !== 0) return classCompare;

    // Within same class, sort by value + urgency
    const aScore = a.expected_value / 1000 + a.urgency_score;
    const bScore = b.expected_value / 1000 + b.urgency_score;
    return bScore - aScore;
  });

  // Assign daily ranks
  rankings.forEach((r, i) => {
    r.daily_rank = i + 1;
  });

  return rankings;
}

// ============================================================================
// BULK CLASSIFICATION
// ============================================================================

export interface BulkClassificationResult {
  total: number;
  classified: number;
  not_viable: number;
  by_class: {
    A: number;
    B: number;
    C: number;
  };
  total_expected_value: number;
  classifications: Array<{
    lead_id: string;
    result: ClassificationResult | null;
  }>;
}

/**
 * Classify multiple leads and return aggregate statistics.
 */
export function classifyLeads(
  leads: Array<Lead & { id: string }>
): BulkClassificationResult {
  const classifications: BulkClassificationResult['classifications'] = [];
  const byClass = { A: 0, B: 0, C: 0 };
  let totalExpectedValue = 0;
  let notViable = 0;

  for (const lead of leads) {
    const result = classifyLead(lead);
    classifications.push({ lead_id: lead.id, result });

    if (result) {
      byClass[result.lead_class]++;
      totalExpectedValue += result.expected_value;
    } else {
      notViable++;
    }
  }

  return {
    total: leads.length,
    classified: leads.length - notViable,
    not_viable: notViable,
    by_class: byClass,
    total_expected_value: Math.round(totalExpectedValue * 100) / 100,
    classifications,
  };
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

export interface DailyRecommendation {
  recommended_class: LeadClass;
  recommended_volume: number;
  reason: string;
  expected_value: number;
  leads_available: number;
}

/**
 * Eleanor's daily volume recommendation per class.
 */
export function getRecommendedDailyVolume(
  classStats: { A: number; B: number; C: number },
  dailyCapacity: number
): DailyRecommendation[] {
  const recommendations: DailyRecommendation[] = [];
  let remainingCapacity = dailyCapacity;

  // Class A: Drain fully
  if (classStats.A > 0) {
    const volume = Math.min(classStats.A, remainingCapacity);
    recommendations.push({
      recommended_class: 'A',
      recommended_volume: volume,
      reason: 'Highest priority: Dual revenue paths',
      expected_value: volume * 15000, // Rough estimate
      leads_available: classStats.A,
    });
    remainingCapacity -= volume;
  }

  // Class B: Fill remaining
  if (classStats.B > 0 && remainingCapacity > 0) {
    const volume = Math.min(classStats.B, remainingCapacity);
    recommendations.push({
      recommended_class: 'B',
      recommended_volume: volume,
      reason: 'Big fish: Fast time-to-cash',
      expected_value: volume * 10000, // Rough estimate
      leads_available: classStats.B,
    });
    remainingCapacity -= volume;
  }

  // Class C: Capacity filler only
  if (classStats.C > 0 && remainingCapacity > 0) {
    const maxClassC = Math.floor(remainingCapacity * 0.5); // Only 50%
    const volume = Math.min(classStats.C, maxClassC);
    if (volume > 0) {
      recommendations.push({
        recommended_class: 'C',
        recommended_volume: volume,
        reason: 'Capacity filler: Lower priority',
        expected_value: volume * 3000, // Rough estimate
        leads_available: classStats.C,
      });
    }
  }

  return recommendations;
}

// ============================================================================
// EXPLAIN CLASSIFICATION
// ============================================================================

/**
 * Generate human-readable explanation for why a lead is classified as it is.
 */
export function explainClassification(
  lead: Lead,
  classification: ClassificationResult | null
): string {
  const lines: string[] = [];

  if (!classification) {
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('           LEAD NOT ECONOMICALLY VIABLE');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Excess Funds: $${(Number(lead.excess_funds_amount) || 0).toLocaleString()}`);
    lines.push(`Minimum Required: $${CLASSIFICATION_THRESHOLDS.MINIMUM_VIABLE.minExcessFunds.toLocaleString()}`);
    lines.push('');
    lines.push('This lead does not meet the minimum threshold for pursuit.');
    return lines.join('\n');
  }

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`           CLASS ${classification.lead_class}: ${classification.class_name}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push(`REASON: ${classification.class_reason}`);
  lines.push('');
  lines.push('EXPECTED VALUE BREAKDOWN:');
  lines.push(`  • Recovery Fee (25%): $${classification.expected_recovery_fee.toLocaleString()}`);
  if (classification.expected_wholesale_fee > 0) {
    lines.push(`  • Wholesale Fee (10%): $${classification.expected_wholesale_fee.toLocaleString()}`);
  }
  lines.push(`  • TOTAL EXPECTED: $${classification.expected_value.toLocaleString()}`);
  lines.push('');
  lines.push('REVENUE PATHS:');
  for (const path of classification.revenue_paths) {
    lines.push(`  ✓ ${path.replace('_', ' ').toUpperCase()}`);
  }
  lines.push('');
  lines.push(`ESTIMATED TIME TO CASH: ${classification.expected_time_to_cash} days`);
  lines.push(`CONFIDENCE: ${classification.confidence}`);
  lines.push('');
  lines.push('CLASSIFICATION FACTORS:');
  for (const factor of classification.factors) {
    const icon = factor.impact === 'POSITIVE' ? '✓' : factor.impact === 'NEGATIVE' ? '✗' : '•';
    lines.push(`  ${icon} ${factor.name}: ${factor.contribution}`);
  }
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
