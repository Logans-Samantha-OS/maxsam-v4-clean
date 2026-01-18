/**
 * N8N Governance Layer - Index
 * Phase 12.1 → 13.1 Bridge
 *
 * Export all governance utilities for n8n workflow management.
 *
 * GOVERNANCE PRINCIPLES:
 * - READ: Claude has full access
 * - PROPOSE: Claude can generate proposals
 * - DEPLOY: ONLY through ORION gate
 * - AUDIT: Append-only, immutable
 * - ROLLBACK: Always available
 */

// Types
export * from './types';

// Validation
export {
  validateWorkflowChange,
  computeWorkflowHash,
  validateNodeParameters,
  validateWorkflowConnections,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning,
} from './validateWorkflowChange';

// Diff Generation
export {
  diffWorkflowVersions,
  formatDiffAsText,
  formatDiffAsJSON,
} from './diffWorkflowVersions';

// Archive & Rollback
export {
  archiveWorkflow,
  getArchivedWorkflow,
  getLatestArchive,
  listArchives,
  pruneOldArchives,
  type ArchiveOptions,
} from './archiveWorkflow';

export {
  prepareRollback,
  executeRollback,
  prepareRollbackToLatest,
  canRollback,
  type RollbackRequest,
  type RollbackResult,
  type N8NClientInterface,
} from './rollbackWorkflow';

// N8N Client (Governed)
export {
  N8NGovernedClient,
  createN8NClient,
  getN8NClient,
  getWorkflowSummary,
  explainWorkflow,
  type N8NClientConfig,
} from './n8nClient';

// ORION Gate
export {
  ORIONGate,
  createORIONGate,
  getORIONGate,
  wouldBeAllowed,
  type ORIONConfig,
} from './orionGate';

// Engagement State Machine
export {
  isValidTransition,
  getValidTransitions,
  getRequiredGuard,
  transitionEngagementState,
  getLeadEngagementState,
  getLeadEngagementHistory,
  getHumanControlledLeads,
  shouldPauseSam,
  isSamPausedForLead,
  getLeadsWithSamPaused,
  requestHumanInvolvement,
  approveHumanInvolvement,
  activateHumanWork,
  completeHumanWork,
  getStateDisplayInfo,
  type TransitionRequest,
  type TransitionResult,
  type HumanApprovalRequest,
} from './engagementStateMachine';
