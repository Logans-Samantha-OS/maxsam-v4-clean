/**
 * Message Intelligence Readiness Gate
 *
 * Determines if a lead is ready for documents based on:
 * - Recent affirmative messages
 * - Confidence thresholds
 * - Compliance risk level
 */

import {
  MessageIntent,
  ConfidenceScores,
  ReadinessResult,
} from './types';

// ============================================================================
// THRESHOLDS
// ============================================================================

const THRESHOLDS = {
  IDENTITY_CONFIDENCE_MIN: 70,
  CLAIM_CONFIDENCE_MIN: 70,
  COMPLIANCE_RISK_MAX: 50,
  RECENT_MESSAGES_COUNT: 3,
};

// ============================================================================
// READINESS CHECK
// ============================================================================

/**
 * Check if lead is ready for documents
 *
 * Criteria:
 * 1. At least one AFFIRMATIVE intent in recent messages (last 3)
 * 2. identity_confidence >= 70
 * 3. claim_confidence >= 70
 * 4. compliance_risk < 50
 */
export function checkReadiness(
  scores: ConfidenceScores,
  recentIntents: MessageIntent[]
): ReadinessResult {
  const reasons: string[] = [];

  // Check for affirmative in recent messages
  const hasAffirmative = recentIntents.some(intent => intent === 'AFFIRMATIVE');

  // Check identity confidence
  const identityOk = scores.identity_confidence >= THRESHOLDS.IDENTITY_CONFIDENCE_MIN;

  // Check claim confidence
  const claimOk = scores.claim_confidence >= THRESHOLDS.CLAIM_CONFIDENCE_MIN;

  // Check compliance risk
  const complianceOk = scores.compliance_risk < THRESHOLDS.COMPLIANCE_RISK_MAX;

  // Build reasons array
  if (!hasAffirmative) {
    reasons.push(`No AFFIRMATIVE intent in last ${THRESHOLDS.RECENT_MESSAGES_COUNT} messages`);
  }
  if (!identityOk) {
    reasons.push(`Identity confidence (${scores.identity_confidence}) < ${THRESHOLDS.IDENTITY_CONFIDENCE_MIN}`);
  }
  if (!claimOk) {
    reasons.push(`Claim confidence (${scores.claim_confidence}) < ${THRESHOLDS.CLAIM_CONFIDENCE_MIN}`);
  }
  if (!complianceOk) {
    reasons.push(`Compliance risk (${scores.compliance_risk}) >= ${THRESHOLDS.COMPLIANCE_RISK_MAX}`);
  }

  const ready = hasAffirmative && identityOk && claimOk && complianceOk;

  return {
    ready,
    reasons: ready ? ['All criteria met'] : reasons,
    scores,
    has_affirmative_in_recent: hasAffirmative,
  };
}

/**
 * Get readiness percentage (0-100)
 * Useful for progress indicators
 */
export function getReadinessPercentage(scores: ConfidenceScores, hasAffirmative: boolean): number {
  let percentage = 0;

  // Affirmative contributes 25%
  if (hasAffirmative) {
    percentage += 25;
  }

  // Identity confidence contributes 25% (scaled)
  percentage += Math.min(25, (scores.identity_confidence / THRESHOLDS.IDENTITY_CONFIDENCE_MIN) * 25);

  // Claim confidence contributes 25% (scaled)
  percentage += Math.min(25, (scores.claim_confidence / THRESHOLDS.CLAIM_CONFIDENCE_MIN) * 25);

  // Compliance safety contributes 25% (inverse - lower risk = higher contribution)
  const complianceSafety = Math.max(0, THRESHOLDS.COMPLIANCE_RISK_MAX - scores.compliance_risk);
  percentage += Math.min(25, (complianceSafety / THRESHOLDS.COMPLIANCE_RISK_MAX) * 25);

  return Math.round(percentage);
}

/**
 * Get next steps needed to reach readiness
 */
export function getNextSteps(
  scores: ConfidenceScores,
  hasAffirmative: boolean
): string[] {
  const steps: string[] = [];

  if (!hasAffirmative) {
    steps.push('Get affirmative confirmation from lead');
  }

  if (scores.identity_confidence < THRESHOLDS.IDENTITY_CONFIDENCE_MIN) {
    const needed = THRESHOLDS.IDENTITY_CONFIDENCE_MIN - scores.identity_confidence;
    steps.push(`Increase identity confidence by ${needed}+ points`);
  }

  if (scores.claim_confidence < THRESHOLDS.CLAIM_CONFIDENCE_MIN) {
    const needed = THRESHOLDS.CLAIM_CONFIDENCE_MIN - scores.claim_confidence;
    steps.push(`Increase claim confidence by ${needed}+ points`);
  }

  if (scores.compliance_risk >= THRESHOLDS.COMPLIANCE_RISK_MAX) {
    steps.push('Address compliance concerns before proceeding');
  }

  if (steps.length === 0) {
    steps.push('Ready to send documents!');
  }

  return steps;
}

/**
 * Check if lead should be flagged for review
 */
export function shouldFlagForReview(scores: ConfidenceScores): boolean {
  // Flag if compliance risk is elevated but not yet at threshold
  if (scores.compliance_risk >= 30 && scores.compliance_risk < 50) {
    return true;
  }

  // Flag if motivation is declining (low score with some engagement)
  if (scores.motivation_score < 20 && (scores.identity_confidence > 0 || scores.claim_confidence > 0)) {
    return true;
  }

  return false;
}

/**
 * Get recommended action based on readiness state
 */
export function getRecommendedAction(
  scores: ConfidenceScores,
  hasAffirmative: boolean
): string {
  // If ready, recommend sending documents
  if (
    hasAffirmative &&
    scores.identity_confidence >= THRESHOLDS.IDENTITY_CONFIDENCE_MIN &&
    scores.claim_confidence >= THRESHOLDS.CLAIM_CONFIDENCE_MIN &&
    scores.compliance_risk < THRESHOLDS.COMPLIANCE_RISK_MAX
  ) {
    return 'SEND_AGREEMENT';
  }

  // If compliance risk is high, recommend handoff
  if (scores.compliance_risk >= THRESHOLDS.COMPLIANCE_RISK_MAX) {
    return 'HANDOFF_HUMAN';
  }

  // If missing identity confirmation
  if (scores.identity_confidence < THRESHOLDS.IDENTITY_CONFIDENCE_MIN) {
    return 'ASK_IDENTITY';
  }

  // If missing claim intent
  if (scores.claim_confidence < THRESHOLDS.CLAIM_CONFIDENCE_MIN) {
    return 'SEND_EXPLANATION';
  }

  // Default: wait for more engagement
  return 'WAIT';
}
