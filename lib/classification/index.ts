/**
 * Economic Lead Classification - Index
 * Phase 13.3 - Foundational Classification Shift
 *
 * MaxSam V4 operates on ECONOMIC REALITY, not superficial labels.
 *
 * CLASS A — GOLDEN_TRANSACTIONAL (Dual revenue: recovery + wholesale)
 * CLASS B — GOLDEN_RECOVERY_ONLY (Big fish: $30K+ recovery)
 * CLASS C — STANDARD_RECOVERY (Capacity filler: $5K-$30K)
 *
 * Priority Order: A > B > C (immutable)
 * Never allow lower classes to delay higher classes.
 */

// Types
export * from './types';

// Eleanor Classification (Intelligence Owner)
export {
  classifyLead,
  classifyLeads,
  rankLeadsForDay,
  getRecommendedDailyVolume,
  explainClassification,
  type BulkClassificationResult,
  type DailyRecommendation,
} from './eleanorClassifier';

// ORION Class Approval (Policy & Safety Owner)
export {
  approveClassForToday,
  getClassApprovalMatrix,
  checkAndHaltLowerClasses,
  getClassConstraints,
} from './orionClassApproval';

// Capacity Orchestration (Autonomy Engine)
export {
  getCapacityState,
  getNextLeadsToContact,
  recordContactAttempt,
  getUtilizationReport,
  transitionToNextClass,
  refreshClassCounts,
  runOrchestrationCycle,
  type NextLeadResult,
  type UtilizationReport,
  type OrchestrationResult,
} from './capacityOrchestrator';

// Class Metrics (Separate by Class - Never Blend)
export {
  computeClassMetrics,
  storeClassMetrics,
  computeAllClassMetrics,
  compareClasses,
  generateMetricsDashboard,
  formatMetricsAsText,
  getPeriod,
  type MetricsPeriod,
  type ClassComparison,
  type MetricsDashboard,
} from './classMetrics';

// Backfill
export {
  getBackfillStatus,
  runBackfillViaDatabase,
  runBackfillViaTypeScript,
  reclassifyAllLeads,
  refreshDailyRankings,
  formatBackfillReport,
  type BackfillResult,
} from './backfill';
