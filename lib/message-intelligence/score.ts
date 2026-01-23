/**
 * Message Intelligence Confidence Scorer
 *
 * Applies delta rules to lead confidence scores based on message intent.
 */

import {
  MessageIntent,
  ConfidenceScores,
  ConfidenceDelta,
} from './types';

// ============================================================================
// DELTA RULES
// ============================================================================

const DELTA_RULES: Record<MessageIntent, ConfidenceDelta> = {
  AFFIRMATIVE: {
    identity: 15,
    claim: 15,
    motivation: 8,
    compliance: 0,
  },
  QUESTION: {
    identity: 0,
    claim: 3,
    motivation: 2,
    compliance: 0,
  },
  CONFUSED: {
    identity: 0,
    claim: 0,
    motivation: 0,
    compliance: 10,
  },
  HOSTILE: {
    identity: 0,
    claim: 0,
    motivation: -10,
    compliance: 35,
  },
  NEGATIVE: {
    identity: -15,
    claim: -25,
    motivation: 0,
    compliance: 20,
  },
  OUT_OF_SCOPE: {
    identity: 0,
    claim: 0,
    motivation: 0,
    compliance: 5,
  },
};

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Get the delta values for a given intent
 */
export function getDeltaForIntent(intent: MessageIntent): ConfidenceDelta {
  return DELTA_RULES[intent] || { identity: 0, claim: 0, motivation: 0, compliance: 0 };
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Apply confidence deltas to current scores
 */
export function applyDelta(
  currentScores: ConfidenceScores,
  intent: MessageIntent
): { newScores: ConfidenceScores; deltas: ConfidenceDelta } {
  const delta = getDeltaForIntent(intent);

  const newScores: ConfidenceScores = {
    identity_confidence: clamp(currentScores.identity_confidence + delta.identity, 0, 100),
    claim_confidence: clamp(currentScores.claim_confidence + delta.claim, 0, 100),
    motivation_score: clamp(currentScores.motivation_score + delta.motivation, 0, 100),
    compliance_risk: clamp(currentScores.compliance_risk + delta.compliance, 0, 100),
  };

  return { newScores, deltas: delta };
}

/**
 * Check if intent should trigger do_not_contact flag
 */
export function shouldSetDoNotContact(intent: MessageIntent): boolean {
  return intent === 'NEGATIVE';
}

/**
 * Check if intent requires human handoff
 */
export function requiresHandoff(intent: MessageIntent): boolean {
  return intent === 'HOSTILE';
}

/**
 * Calculate overall lead health score (0-100)
 * Higher is better - combines positive factors and subtracts risks
 */
export function calculateHealthScore(scores: ConfidenceScores): number {
  const positiveFactors = (
    scores.identity_confidence * 0.3 +
    scores.claim_confidence * 0.3 +
    scores.motivation_score * 0.2
  );

  const riskPenalty = scores.compliance_risk * 0.2;

  return clamp(Math.round(positiveFactors - riskPenalty), 0, 100);
}

/**
 * Get engagement level based on scores
 */
export function getEngagementLevel(scores: ConfidenceScores): 'cold' | 'warm' | 'hot' | 'risky' {
  if (scores.compliance_risk >= 50) {
    return 'risky';
  }

  const avgPositive = (
    scores.identity_confidence +
    scores.claim_confidence +
    scores.motivation_score
  ) / 3;

  if (avgPositive >= 70) return 'hot';
  if (avgPositive >= 40) return 'warm';
  return 'cold';
}

// ============================================================================
// BATCH SCORING
// ============================================================================

/**
 * Apply multiple intents (from conversation history) to calculate final scores
 */
export function calculateFromHistory(
  initialScores: ConfidenceScores,
  intents: MessageIntent[]
): ConfidenceScores {
  let scores = { ...initialScores };

  for (const intent of intents) {
    const { newScores } = applyDelta(scores, intent);
    scores = newScores;
  }

  return scores;
}
