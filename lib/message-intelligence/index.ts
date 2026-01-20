/**
 * Message Intelligence Module
 *
 * Phase 1: Deterministic classification with confidence scoring
 */

// Types
export * from './types';

// Classification
export { classify, classifyMessage, analyzeSentiment } from './classify';

// Scoring
export {
  applyDelta,
  getDeltaForIntent,
  shouldSetDoNotContact,
  requiresHandoff,
  calculateHealthScore,
  getEngagementLevel,
  calculateFromHistory,
} from './score';

// Readiness
export {
  checkReadiness,
  getReadinessPercentage,
  getNextSteps,
  shouldFlagForReview,
  getRecommendedAction,
} from './readiness';
