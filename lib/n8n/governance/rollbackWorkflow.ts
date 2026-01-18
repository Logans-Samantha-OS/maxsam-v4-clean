/**
 * rollbackWorkflow.ts
 * Phase 12.1 → 13.1 Bridge
 *
 * Deterministic workflow rollback with full audit trail.
 * Rollback is a governed operation - requires ORION approval.
 */

import { createClient } from '@supabase/supabase-js';
import {
  N8NWorkflow,
  WorkflowArchive,
  WorkflowChangeProposal,
  GovernanceResult,
  GovernanceError,
  ORIONDecision,
} from './types';
import { getArchivedWorkflow, getLatestArchive, archiveWorkflow } from './archiveWorkflow';
import { validateWorkflowChange } from './validateWorkflowChange';
import { diffWorkflowVersions, formatDiffAsText } from './diffWorkflowVersions';
import { computeWorkflowHash } from './validateWorkflowChange';

// ============================================================================
// ROLLBACK TYPES
// ============================================================================

export interface RollbackRequest {
  workflowId: string;
  targetVersionHash: string;
  reason: string;
  requestedBy: string;
  currentWorkflow: N8NWorkflow;
}

export interface RollbackResult {
  rollbackId: string;
  workflowId: string;
  previousVersionHash: string;
  targetVersionHash: string;
  targetWorkflow: N8NWorkflow;
  diff: string;
  requiresOrionApproval: boolean;
  proposal: WorkflowChangeProposal | null;
}

// ============================================================================
// CORE ROLLBACK FUNCTION
// ============================================================================

/**
 * Prepare a rollback proposal.
 * This does NOT execute the rollback - it creates a governed proposal.
 * Actual deployment requires ORION approval.
 */
export async function prepareRollback(
  request: RollbackRequest,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<RollbackResult>> {
  // 1. Fetch target version from archive
  const archiveResult = await getArchivedWorkflow(
    request.workflowId,
    request.targetVersionHash,
    supabaseUrl,
    supabaseKey
  );

  if (!archiveResult.success || !archiveResult.data) {
    return {
      success: false,
      error: archiveResult.error || {
        code: 'ROLLBACK_UNAVAILABLE',
        message: `Target version ${request.targetVersionHash} not found in archive`,
      },
    };
  }

  const targetWorkflow = archiveResult.data.workflow;
  const currentVersionHash = computeWorkflowHash(request.currentWorkflow);

  // 2. Validate the rollback as a change proposal
  const validationResult = validateWorkflowChange(
    request.currentWorkflow,
    targetWorkflow,
    `ROLLBACK: ${request.reason}`,
    request.requestedBy
  );

  if (!validationResult.success || !validationResult.data) {
    return {
      success: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: 'Rollback validation failed',
        details: { errors: validationResult.data?.errors },
      },
    };
  }

  // 3. Generate human-readable diff
  const diff = diffWorkflowVersions(request.currentWorkflow, targetWorkflow);
  const diffText = formatDiffAsText(diff);

  // 4. Archive current version before rollback
  await archiveWorkflow(
    request.currentWorkflow,
    supabaseUrl,
    supabaseKey,
    {
      reason: `Pre-rollback archive: ${request.reason}`,
      archivedBy: 'ROLLBACK_SYSTEM',
    }
  );

  // 5. Build rollback result
  const rollbackId = generateRollbackId(request.workflowId);

  return {
    success: true,
    data: {
      rollbackId,
      workflowId: request.workflowId,
      previousVersionHash: currentVersionHash,
      targetVersionHash: request.targetVersionHash,
      targetWorkflow,
      diff: diffText,
      requiresOrionApproval: true, // ALWAYS requires approval
      proposal: validationResult.data.proposal,
    },
    auditId: rollbackId,
  };
}

/**
 * Execute a rollback after ORION approval.
 * This function requires a valid ORION decision.
 */
export async function executeRollback(
  rollbackResult: RollbackResult,
  orionDecision: ORIONDecision,
  n8nClient: N8NClientInterface,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<{ deployedAt: string }>> {
  // 1. Verify ORION approval
  if (!orionDecision.allowed) {
    return {
      success: false,
      error: {
        code: 'ORION_REJECTED',
        message: `ORION rejected rollback: ${orionDecision.reason}`,
        details: { decision: orionDecision },
      },
    };
  }

  // 2. Write audit record BEFORE deployment
  const auditResult = await writeRollbackAudit(
    rollbackResult,
    orionDecision,
    supabaseUrl,
    supabaseKey
  );

  if (!auditResult.success) {
    return {
      success: false,
      error: {
        code: 'AUDIT_WRITE_FAILED',
        message: 'Failed to write rollback audit record',
        details: { nestedError: auditResult.error },
      },
    };
  }

  // 3. Deploy via n8n client
  try {
    await n8nClient.updateWorkflow(
      rollbackResult.workflowId,
      rollbackResult.targetWorkflow
    );

    // 4. Update audit with deployment timestamp
    await updateRollbackAuditDeployed(
      rollbackResult.rollbackId,
      supabaseUrl,
      supabaseKey
    );

    return {
      success: true,
      data: {
        deployedAt: new Date().toISOString(),
      },
      auditId: rollbackResult.rollbackId,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'DEPLOYMENT_BLOCKED',
        message: `Failed to deploy rollback: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}

// ============================================================================
// N8N CLIENT INTERFACE (for dependency injection)
// ============================================================================

export interface N8NClientInterface {
  updateWorkflow(id: string, workflow: N8NWorkflow): Promise<void>;
  getWorkflow(id: string): Promise<N8NWorkflow>;
  activateWorkflow(id: string): Promise<void>;
  deactivateWorkflow(id: string): Promise<void>;
}

// ============================================================================
// AUDIT FUNCTIONS
// ============================================================================

async function writeRollbackAudit(
  rollback: RollbackResult,
  decision: ORIONDecision,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<void>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { error } = await supabase.from('n8n_workflow_audit').insert({
      id: rollback.rollbackId,
      workflow_id: rollback.workflowId,
      previous_version_hash: rollback.previousVersionHash,
      proposed_version_hash: rollback.targetVersionHash,
      diff_summary: rollback.proposal?.diffSummary || {},
      risk_score: rollback.proposal?.riskScore || 0,
      risk_level: rollback.proposal?.riskLevel || 'LOW',
      approved_by: decision.allowed ? 'ORION' : null,
      approval_context: JSON.stringify({
        type: 'ROLLBACK',
        orionDecision: decision,
        reason: rollback.proposal?.reason,
      }),
      rollback_reference: rollback.previousVersionHash,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return {
        success: false,
        error: {
          code: 'AUDIT_WRITE_FAILED',
          message: error.message,
        },
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'AUDIT_WRITE_FAILED',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    };
  }
}

async function updateRollbackAuditDeployed(
  rollbackId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase
    .from('n8n_workflow_audit')
    .update({ deployed_at: new Date().toISOString() })
    .eq('id', rollbackId);
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

/**
 * Prepare rollback to the most recent archived version.
 */
export async function prepareRollbackToLatest(
  workflowId: string,
  currentWorkflow: N8NWorkflow,
  reason: string,
  requestedBy: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<RollbackResult>> {
  const latestResult = await getLatestArchive(workflowId, supabaseUrl, supabaseKey);

  if (!latestResult.success || !latestResult.data) {
    return {
      success: false,
      error: latestResult.error || {
        code: 'ROLLBACK_UNAVAILABLE',
        message: `No archived versions found for workflow ${workflowId}`,
      },
    };
  }

  return prepareRollback(
    {
      workflowId,
      targetVersionHash: latestResult.data.versionHash,
      reason,
      requestedBy,
      currentWorkflow,
    },
    supabaseUrl,
    supabaseKey
  );
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateRollbackId(workflowId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `ROLL-${workflowId.substring(0, 8)}-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// ROLLBACK SAFETY CHECKS
// ============================================================================

export function canRollback(
  currentWorkflow: N8NWorkflow,
  targetWorkflow: N8NWorkflow
): { allowed: boolean; reason: string } {
  // Check if workflows are for the same logical workflow
  if (currentWorkflow.id !== targetWorkflow.id) {
    return {
      allowed: false,
      reason: 'Cannot rollback to a different workflow ID',
    };
  }

  // Check if target is actually different
  const currentHash = computeWorkflowHash(currentWorkflow);
  const targetHash = computeWorkflowHash(targetWorkflow);

  if (currentHash === targetHash) {
    return {
      allowed: false,
      reason: 'Target version is identical to current version',
    };
  }

  // Additional safety checks could go here
  // e.g., check for breaking schema changes

  return {
    allowed: true,
    reason: 'Rollback is permitted',
  };
}
