/**
 * N8N Governance Types
 * Phase 12.1 → 13.1 Bridge
 *
 * Deterministic types for workflow governance with zero authority leakage.
 */

// ============================================================================
// WORKFLOW TYPES
// ============================================================================

export interface N8NWorkflow {
  id: string;
  name: string;
  active: boolean;
  nodes: N8NNode[];
  connections: Record<string, unknown>;
  settings?: Record<string, unknown>;
  staticData?: Record<string, unknown>;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  versionId?: string;
}

export interface N8NNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters: Record<string, unknown>;
  credentials?: Record<string, { id: string; name: string }>;
  disabled?: boolean;
  notes?: string;
  notesInFlow?: boolean;
  executeOnce?: boolean;
  retryOnFail?: boolean;
  maxTries?: number;
  waitBetweenTries?: number;
  continueOnFail?: boolean;
  onError?: 'stopWorkflow' | 'continueRegularOutput' | 'continueErrorOutput';
}

export interface N8NExecution {
  id: string;
  finished: boolean;
  mode: 'manual' | 'trigger' | 'webhook' | 'retry' | 'integrated';
  retryOf?: string;
  retrySuccessId?: string;
  startedAt: string;
  stoppedAt?: string;
  status: 'success' | 'error' | 'waiting' | 'unknown';
  workflowId: string;
  workflowData: N8NWorkflow;
  data?: Record<string, unknown>;
}

// ============================================================================
// GOVERNANCE TYPES
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ApprovalSource = 'ORION' | 'MANUAL' | 'AUTONOMY_SCHEDULER';

export interface WorkflowChangeProposal {
  proposalId: string;
  workflowId: string;
  workflowName: string;
  previousVersionHash: string;
  proposedVersionHash: string;
  diffSummary: WorkflowDiffSummary;
  riskScore: number;
  riskLevel: RiskLevel;
  reason: string;
  proposedBy: string;
  proposedAt: string;
  rollbackReference: string;
  orionDecision?: ORIONDecision;
}

export interface WorkflowDiffSummary {
  nodesAdded: string[];
  nodesRemoved: string[];
  nodesModified: string[];
  connectionsChanged: boolean;
  settingsChanged: boolean;
  credentialsChanged: boolean;
  sensitiveChanges: SensitiveChange[];
  totalChanges: number;
}

export interface SensitiveChange {
  type: 'CREDENTIAL' | 'WEBHOOK' | 'HTTP_REQUEST' | 'DATABASE' | 'EXTERNAL_API';
  node: string;
  description: string;
  riskContribution: number;
}

export interface ORIONDecision {
  allowed: boolean;
  decisionId: string;
  reason: string;
  conditions?: string[];
  decidedAt: string;
  autonomyLevel: 0 | 1 | 2 | 3;
}

export interface WorkflowAuditRecord {
  id: string;
  workflow_id: string;
  previous_version_hash: string;
  proposed_version_hash: string;
  diff_summary: WorkflowDiffSummary;
  risk_score: number;
  risk_level: RiskLevel;
  approved_by: ApprovalSource | null;
  approval_context: string | null;
  deployed_at: string | null;
  rollback_reference: string;
  created_at: string;
}

export interface WorkflowArchive {
  archiveId: string;
  workflowId: string;
  workflowName: string;
  versionHash: string;
  workflow: N8NWorkflow;
  archivedAt: string;
  archivedBy: string;
  reason: string;
}

// ============================================================================
// ENGAGEMENT STATE MACHINE (Phase 13.1)
// ============================================================================

export type EngagementState =
  | 'NOT_CONTACTED'
  | 'SAM_ACTIVE'
  | 'AWAITING_RESPONSE'
  | 'HUMAN_REQUESTED'
  | 'HUMAN_APPROVED'
  | 'HUMAN_IN_PROGRESS'
  | 'HUMAN_COMPLETED'
  | 'RETURNED_TO_AUTONOMY'
  | 'CLOSED';

export interface EngagementStateTransition {
  from: EngagementState;
  to: EngagementState;
  guard: EngagementGuard;
}

export type EngagementGuard =
  | 'SAM_INITIATED'
  | 'RESPONSE_RECEIVED'
  | 'HUMAN_REQUEST_TRIGGERED'
  | 'ORION_APPROVED'
  | 'OPS_CONSOLE_ACTIVATED'
  | 'HUMAN_TASK_COMPLETE'
  | 'RETURN_AUTHORIZED'
  | 'DEAL_CLOSED'
  | 'LEAD_DEAD';

export interface EngagementStateRecord {
  lead_id: string;
  current_state: EngagementState;
  previous_state: EngagementState | null;
  transition_guard: EngagementGuard | null;
  transitioned_by: string;
  transition_reason: string;
  orion_decision_id: string | null;
  sam_paused: boolean;
  human_actor_id: string | null;
  transitioned_at: string;
  metadata: Record<string, unknown>;
}

// ============================================================================
// VALID STATE TRANSITIONS (IMMUTABLE)
// ============================================================================

export const VALID_ENGAGEMENT_TRANSITIONS: EngagementStateTransition[] = [
  { from: 'NOT_CONTACTED', to: 'SAM_ACTIVE', guard: 'SAM_INITIATED' },
  { from: 'SAM_ACTIVE', to: 'AWAITING_RESPONSE', guard: 'RESPONSE_RECEIVED' },
  { from: 'SAM_ACTIVE', to: 'HUMAN_REQUESTED', guard: 'HUMAN_REQUEST_TRIGGERED' },
  { from: 'AWAITING_RESPONSE', to: 'SAM_ACTIVE', guard: 'SAM_INITIATED' },
  { from: 'AWAITING_RESPONSE', to: 'HUMAN_REQUESTED', guard: 'HUMAN_REQUEST_TRIGGERED' },
  { from: 'AWAITING_RESPONSE', to: 'CLOSED', guard: 'DEAL_CLOSED' },
  { from: 'HUMAN_REQUESTED', to: 'HUMAN_APPROVED', guard: 'ORION_APPROVED' },
  { from: 'HUMAN_APPROVED', to: 'HUMAN_IN_PROGRESS', guard: 'OPS_CONSOLE_ACTIVATED' },
  { from: 'HUMAN_IN_PROGRESS', to: 'HUMAN_COMPLETED', guard: 'HUMAN_TASK_COMPLETE' },
  { from: 'HUMAN_COMPLETED', to: 'RETURNED_TO_AUTONOMY', guard: 'RETURN_AUTHORIZED' },
  { from: 'HUMAN_COMPLETED', to: 'CLOSED', guard: 'DEAL_CLOSED' },
  { from: 'RETURNED_TO_AUTONOMY', to: 'SAM_ACTIVE', guard: 'SAM_INITIATED' },
  { from: 'RETURNED_TO_AUTONOMY', to: 'CLOSED', guard: 'DEAL_CLOSED' },
  // Dead lead transitions (from any active state)
  { from: 'SAM_ACTIVE', to: 'CLOSED', guard: 'LEAD_DEAD' },
  { from: 'AWAITING_RESPONSE', to: 'CLOSED', guard: 'LEAD_DEAD' },
  { from: 'HUMAN_REQUESTED', to: 'CLOSED', guard: 'LEAD_DEAD' },
  { from: 'HUMAN_IN_PROGRESS', to: 'CLOSED', guard: 'LEAD_DEAD' },
];

// ============================================================================
// RISK SCORING CONFIGURATION
// ============================================================================

export const RISK_WEIGHTS = {
  CREDENTIAL_CHANGE: 30,
  WEBHOOK_CHANGE: 20,
  HTTP_REQUEST_CHANGE: 15,
  DATABASE_CHANGE: 25,
  EXTERNAL_API_CHANGE: 15,
  NODE_ADDED: 5,
  NODE_REMOVED: 10,
  NODE_MODIFIED: 5,
  CONNECTION_CHANGE: 5,
  SETTINGS_CHANGE: 3,
} as const;

export const RISK_THRESHOLDS = {
  LOW: 0,
  MEDIUM: 20,
  HIGH: 50,
  CRITICAL: 80,
} as const;

// ============================================================================
// MCP ACCESS CONFIGURATION
// ============================================================================

export interface N8NMCPConfig {
  baseUrl: string;
  apiKey: string;
  allowedOperations: N8NOperation[];
}

export type N8NOperation =
  | 'READ_WORKFLOWS'
  | 'READ_NODES'
  | 'READ_EXECUTIONS'
  | 'READ_ERRORS'
  | 'READ_VERSIONS'
  | 'PROPOSE_WORKFLOW'
  | 'PROPOSE_MODIFICATION'
  | 'DEPLOY_GOVERNED';

export const CLAUDE_ALLOWED_OPERATIONS: N8NOperation[] = [
  'READ_WORKFLOWS',
  'READ_NODES',
  'READ_EXECUTIONS',
  'READ_ERRORS',
  'READ_VERSIONS',
  'PROPOSE_WORKFLOW',
  'PROPOSE_MODIFICATION',
  // DEPLOY_GOVERNED is NEVER allowed directly - must go through ORION gate
];

// ============================================================================
// GOVERNANCE RESULT TYPES
// ============================================================================

export interface GovernanceResult<T> {
  success: boolean;
  data?: T;
  error?: GovernanceError;
  auditId?: string;
}

export interface GovernanceError {
  code: GovernanceErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export type GovernanceErrorCode =
  | 'VALIDATION_FAILED'
  | 'ORION_REJECTED'
  | 'ROLLBACK_UNAVAILABLE'
  | 'DEPLOYMENT_BLOCKED'
  | 'INVALID_STATE_TRANSITION'
  | 'UNAUTHORIZED_OPERATION'
  | 'AUDIT_WRITE_FAILED';
