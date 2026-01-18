/**
 * validateWorkflowChange.ts
 * Phase 12.1 → 13.1 Bridge
 *
 * Deterministic workflow validation with risk scoring.
 * Every change must pass validation before ORION approval.
 */

import {
  N8NWorkflow,
  N8NNode,
  WorkflowChangeProposal,
  WorkflowDiffSummary,
  SensitiveChange,
  RiskLevel,
  GovernanceResult,
  GovernanceError,
  RISK_WEIGHTS,
  RISK_THRESHOLDS,
} from './types';
import { diffWorkflowVersions } from './diffWorkflowVersions';
import { createHash } from 'crypto';

// ============================================================================
// VALIDATION RESULT
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  proposal: WorkflowChangeProposal | null;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  field?: string;
  severity: 'BLOCKING';
}

export interface ValidationWarning {
  code: string;
  message: string;
  field?: string;
  severity: 'WARNING';
}

// ============================================================================
// BLOCKED PATTERNS (IMMUTABLE)
// ============================================================================

const BLOCKED_NODE_TYPES = [
  'n8n-nodes-base.executeCommand', // Shell execution
  'n8n-nodes-base.ssh',            // SSH access
  'n8n-nodes-base.ftp',            // FTP access
  'n8n-nodes-base.sshFtp',         // SFTP access
] as const;

const BLOCKED_CREDENTIAL_PATTERNS = [
  /aws.*secret/i,
  /stripe.*secret/i,
  /production.*key/i,
  /master.*key/i,
] as const;

const SENSITIVE_NODE_TYPES = [
  'n8n-nodes-base.httpRequest',
  'n8n-nodes-base.webhook',
  'n8n-nodes-base.postgres',
  'n8n-nodes-base.supabase',
  'n8n-nodes-base.executeWorkflow',
] as const;

// ============================================================================
// CORE VALIDATION FUNCTION
// ============================================================================

export function validateWorkflowChange(
  previousWorkflow: N8NWorkflow | null,
  proposedWorkflow: N8NWorkflow,
  reason: string,
  proposedBy: string
): GovernanceResult<ValidationResult> {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // -------------------------------------------------------------------------
  // 1. BASIC STRUCTURE VALIDATION
  // -------------------------------------------------------------------------

  if (!proposedWorkflow.id) {
    errors.push({
      code: 'MISSING_WORKFLOW_ID',
      message: 'Workflow must have an ID',
      field: 'id',
      severity: 'BLOCKING',
    });
  }

  if (!proposedWorkflow.name) {
    errors.push({
      code: 'MISSING_WORKFLOW_NAME',
      message: 'Workflow must have a name',
      field: 'name',
      severity: 'BLOCKING',
    });
  }

  if (!Array.isArray(proposedWorkflow.nodes)) {
    errors.push({
      code: 'INVALID_NODES',
      message: 'Workflow nodes must be an array',
      field: 'nodes',
      severity: 'BLOCKING',
    });
  }

  // -------------------------------------------------------------------------
  // 2. REASON VALIDATION
  // -------------------------------------------------------------------------

  if (!reason || reason.trim().length < 10) {
    errors.push({
      code: 'INSUFFICIENT_REASON',
      message: 'Change reason must be at least 10 characters explaining the change',
      field: 'reason',
      severity: 'BLOCKING',
    });
  }

  // -------------------------------------------------------------------------
  // 3. BLOCKED NODE TYPE CHECK
  // -------------------------------------------------------------------------

  for (const node of proposedWorkflow.nodes || []) {
    if (BLOCKED_NODE_TYPES.includes(node.type as any)) {
      errors.push({
        code: 'BLOCKED_NODE_TYPE',
        message: `Node type "${node.type}" is blocked for security reasons`,
        field: `nodes[${node.id}].type`,
        severity: 'BLOCKING',
      });
    }
  }

  // -------------------------------------------------------------------------
  // 4. CREDENTIAL PATTERN CHECK
  // -------------------------------------------------------------------------

  for (const node of proposedWorkflow.nodes || []) {
    if (node.credentials) {
      for (const [credType, credRef] of Object.entries(node.credentials)) {
        for (const pattern of BLOCKED_CREDENTIAL_PATTERNS) {
          if (pattern.test(credRef.name)) {
            errors.push({
              code: 'BLOCKED_CREDENTIAL',
              message: `Credential "${credRef.name}" matches blocked pattern`,
              field: `nodes[${node.id}].credentials.${credType}`,
              severity: 'BLOCKING',
            });
          }
        }
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5. SENSITIVE NODE WARNINGS
  // -------------------------------------------------------------------------

  for (const node of proposedWorkflow.nodes || []) {
    if (SENSITIVE_NODE_TYPES.includes(node.type as any)) {
      warnings.push({
        code: 'SENSITIVE_NODE',
        message: `Node "${node.name}" (${node.type}) requires careful review`,
        field: `nodes[${node.id}]`,
        severity: 'WARNING',
      });
    }
  }

  // -------------------------------------------------------------------------
  // 6. COMPUTE DIFF AND RISK SCORE
  // -------------------------------------------------------------------------

  const previousHash = previousWorkflow
    ? computeWorkflowHash(previousWorkflow)
    : 'NEW_WORKFLOW';
  const proposedHash = computeWorkflowHash(proposedWorkflow);

  const diff = diffWorkflowVersions(previousWorkflow, proposedWorkflow);
  const riskScore = computeRiskScore(diff);
  const riskLevel = computeRiskLevel(riskScore);

  // -------------------------------------------------------------------------
  // 7. HIGH RISK VALIDATIONS
  // -------------------------------------------------------------------------

  if (riskLevel === 'CRITICAL') {
    warnings.push({
      code: 'CRITICAL_RISK',
      message: `Change has critical risk score (${riskScore}). Requires manual ORION approval.`,
      severity: 'WARNING',
    });
  }

  if (diff.credentialsChanged) {
    warnings.push({
      code: 'CREDENTIALS_MODIFIED',
      message: 'Credentials have been modified. Verify no secrets are exposed.',
      severity: 'WARNING',
    });
  }

  // -------------------------------------------------------------------------
  // 8. BUILD PROPOSAL (if valid)
  // -------------------------------------------------------------------------

  const valid = errors.length === 0;

  const proposal: WorkflowChangeProposal | null = valid
    ? {
        proposalId: generateProposalId(),
        workflowId: proposedWorkflow.id,
        workflowName: proposedWorkflow.name,
        previousVersionHash: previousHash,
        proposedVersionHash: proposedHash,
        diffSummary: diff,
        riskScore,
        riskLevel,
        reason,
        proposedBy,
        proposedAt: new Date().toISOString(),
        rollbackReference: previousHash !== 'NEW_WORKFLOW' ? previousHash : '',
      }
    : null;

  return {
    success: valid,
    data: {
      valid,
      proposal,
      errors,
      warnings,
    },
  };
}

// ============================================================================
// RISK SCORING
// ============================================================================

function computeRiskScore(diff: WorkflowDiffSummary): number {
  let score = 0;

  // Node changes
  score += diff.nodesAdded.length * RISK_WEIGHTS.NODE_ADDED;
  score += diff.nodesRemoved.length * RISK_WEIGHTS.NODE_REMOVED;
  score += diff.nodesModified.length * RISK_WEIGHTS.NODE_MODIFIED;

  // Structural changes
  if (diff.connectionsChanged) {
    score += RISK_WEIGHTS.CONNECTION_CHANGE;
  }
  if (diff.settingsChanged) {
    score += RISK_WEIGHTS.SETTINGS_CHANGE;
  }
  if (diff.credentialsChanged) {
    score += RISK_WEIGHTS.CREDENTIAL_CHANGE;
  }

  // Sensitive changes
  for (const change of diff.sensitiveChanges) {
    score += change.riskContribution;
  }

  return Math.min(score, 100); // Cap at 100
}

function computeRiskLevel(score: number): RiskLevel {
  if (score >= RISK_THRESHOLDS.CRITICAL) return 'CRITICAL';
  if (score >= RISK_THRESHOLDS.HIGH) return 'HIGH';
  if (score >= RISK_THRESHOLDS.MEDIUM) return 'MEDIUM';
  return 'LOW';
}

// ============================================================================
// UTILITIES
// ============================================================================

export function computeWorkflowHash(workflow: N8NWorkflow): string {
  // Create deterministic hash from workflow content
  const content = JSON.stringify({
    id: workflow.id,
    name: workflow.name,
    nodes: workflow.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      type: n.type,
      parameters: n.parameters,
      credentials: n.credentials,
    })),
    connections: workflow.connections,
    settings: workflow.settings,
  });

  return createHash('sha256').update(content).digest('hex').substring(0, 16);
}

function generateProposalId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `PROP-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// SPECIALIZED VALIDATORS
// ============================================================================

export function validateNodeParameters(node: N8NNode): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check for hardcoded secrets in parameters
  const paramString = JSON.stringify(node.parameters);

  const secretPatterns = [
    { pattern: /sk_live_[a-zA-Z0-9]+/, name: 'Stripe live key' },
    { pattern: /sk_test_[a-zA-Z0-9]+/, name: 'Stripe test key' },
    { pattern: /Bearer [a-zA-Z0-9_-]+/, name: 'Bearer token' },
    { pattern: /api[_-]?key[=:]["']?[a-zA-Z0-9]+/i, name: 'API key' },
  ];

  for (const { pattern, name } of secretPatterns) {
    if (pattern.test(paramString)) {
      errors.push({
        code: 'HARDCODED_SECRET',
        message: `Possible ${name} detected in node "${node.name}"`,
        field: `nodes[${node.id}].parameters`,
        severity: 'BLOCKING',
      });
    }
  }

  return errors;
}

export function validateWorkflowConnections(workflow: N8NWorkflow): ValidationError[] {
  const errors: ValidationError[] = [];
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  // Check that all connections reference existing nodes
  for (const [sourceId, outputs] of Object.entries(workflow.connections || {})) {
    if (!nodeIds.has(sourceId)) {
      errors.push({
        code: 'ORPHAN_CONNECTION_SOURCE',
        message: `Connection references non-existent source node: ${sourceId}`,
        field: `connections.${sourceId}`,
        severity: 'BLOCKING',
      });
    }

    // Check outputs
    for (const [outputKey, connections] of Object.entries(outputs as Record<string, any>)) {
      for (const connArray of connections || []) {
        for (const conn of connArray || []) {
          if (conn.node && !nodeIds.has(conn.node)) {
            errors.push({
              code: 'ORPHAN_CONNECTION_TARGET',
              message: `Connection references non-existent target node: ${conn.node}`,
              field: `connections.${sourceId}.${outputKey}`,
              severity: 'BLOCKING',
            });
          }
        }
      }
    }
  }

  return errors;
}
