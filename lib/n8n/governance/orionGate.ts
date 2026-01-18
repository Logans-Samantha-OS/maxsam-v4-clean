/**
 * orionGate.ts
 * Phase 12.1 → 13.1 Bridge
 *
 * ORION Governance Gate - The ONLY path to n8n deployment.
 * All workflow changes must pass through this gate.
 *
 * ORION enforces:
 * - Autonomy level requirements
 * - Risk thresholds
 * - Rate limits
 * - Rollback availability
 * - Audit trail completeness
 */

import { createClient } from '@supabase/supabase-js';
import {
  N8NWorkflow,
  WorkflowChangeProposal,
  WorkflowAuditRecord,
  ORIONDecision,
  GovernanceResult,
  RiskLevel,
} from './types';
import { archiveWorkflow } from './archiveWorkflow';
import { computeWorkflowHash } from './validateWorkflowChange';

// ============================================================================
// ORION CONFIGURATION
// ============================================================================

export interface ORIONConfig {
  supabaseUrl: string;
  supabaseKey: string;
  n8nBaseUrl: string;
  n8nApiKey: string;
}

// ============================================================================
// ORION DECISION RULES
// ============================================================================

interface ORIONRule {
  name: string;
  check: (proposal: WorkflowChangeProposal, context: ORIONContext) => RuleResult;
}

interface RuleResult {
  passed: boolean;
  reason: string;
  conditions?: string[];
}

interface ORIONContext {
  currentAutonomyLevel: 0 | 1 | 2 | 3;
  samEnabled: boolean;
  ralphEnabled: boolean;
  recentDeployments: number; // In last hour
  maxDeploymentsPerHour: number;
}

// ============================================================================
// ORION RULES (IMMUTABLE)
// ============================================================================

const ORION_RULES: ORIONRule[] = [
  // Rule 1: Risk threshold check
  {
    name: 'RISK_THRESHOLD',
    check: (proposal, context) => {
      // CRITICAL risk requires autonomy level 3
      if (proposal.riskLevel === 'CRITICAL' && context.currentAutonomyLevel < 3) {
        return {
          passed: false,
          reason: `CRITICAL risk changes require autonomy level 3. Current level: ${context.currentAutonomyLevel}`,
        };
      }

      // HIGH risk requires autonomy level 2
      if (proposal.riskLevel === 'HIGH' && context.currentAutonomyLevel < 2) {
        return {
          passed: false,
          reason: `HIGH risk changes require autonomy level 2. Current level: ${context.currentAutonomyLevel}`,
        };
      }

      return {
        passed: true,
        reason: `Risk level ${proposal.riskLevel} is acceptable at autonomy level ${context.currentAutonomyLevel}`,
      };
    },
  },

  // Rule 2: Rollback availability
  {
    name: 'ROLLBACK_AVAILABLE',
    check: (proposal) => {
      // New workflows don't need rollback reference
      if (proposal.previousVersionHash === 'NEW_WORKFLOW') {
        return {
          passed: true,
          reason: 'New workflow - no rollback required',
        };
      }

      if (!proposal.rollbackReference) {
        return {
          passed: false,
          reason: 'Modification requires a rollback reference. Archive current version first.',
        };
      }

      return {
        passed: true,
        reason: 'Rollback reference available',
      };
    },
  },

  // Rule 3: Rate limiting
  {
    name: 'RATE_LIMIT',
    check: (proposal, context) => {
      if (context.recentDeployments >= context.maxDeploymentsPerHour) {
        return {
          passed: false,
          reason: `Rate limit exceeded. ${context.recentDeployments}/${context.maxDeploymentsPerHour} deployments in last hour.`,
        };
      }

      return {
        passed: true,
        reason: `Rate limit OK: ${context.recentDeployments}/${context.maxDeploymentsPerHour}`,
      };
    },
  },

  // Rule 4: Credentials change requires high autonomy
  {
    name: 'CREDENTIAL_CHANGE_AUTONOMY',
    check: (proposal, context) => {
      if (proposal.diffSummary.credentialsChanged && context.currentAutonomyLevel < 2) {
        return {
          passed: false,
          reason: 'Credential changes require autonomy level 2 or higher',
        };
      }

      return {
        passed: true,
        reason: 'Credential requirements met',
      };
    },
  },

  // Rule 5: Reason must be substantive
  {
    name: 'SUBSTANTIVE_REASON',
    check: (proposal) => {
      if (proposal.reason.length < 20) {
        return {
          passed: false,
          reason: 'Change reason must be at least 20 characters',
        };
      }

      return {
        passed: true,
        reason: 'Reason is substantive',
      };
    },
  },
];

// ============================================================================
// ORION GATE CLASS
// ============================================================================

export class ORIONGate {
  private config: ORIONConfig;

  constructor(config: ORIONConfig) {
    this.config = config;
  }

  // ==========================================================================
  // CORE DECISION FUNCTION
  // ==========================================================================

  async evaluateProposal(
    proposal: WorkflowChangeProposal
  ): Promise<GovernanceResult<ORIONDecision>> {
    // Get context from database
    const context = await this.getContext();
    if (!context.success || !context.data) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Failed to get ORION context',
        },
      };
    }

    // Evaluate all rules
    const ruleResults: { rule: string; result: RuleResult }[] = [];
    let allPassed = true;
    const conditions: string[] = [];

    for (const rule of ORION_RULES) {
      const result = rule.check(proposal, context.data);
      ruleResults.push({ rule: rule.name, result });

      if (!result.passed) {
        allPassed = false;
      }

      if (result.conditions) {
        conditions.push(...result.conditions);
      }
    }

    // Build decision
    const decisionId = generateDecisionId();
    const decision: ORIONDecision = {
      allowed: allPassed,
      decisionId,
      reason: allPassed
        ? 'All ORION rules passed'
        : ruleResults
            .filter((r) => !r.result.passed)
            .map((r) => `[${r.rule}] ${r.result.reason}`)
            .join('; '),
      conditions: conditions.length > 0 ? conditions : undefined,
      decidedAt: new Date().toISOString(),
      autonomyLevel: context.data.currentAutonomyLevel,
    };

    // Write decision to audit trail
    await this.recordDecision(proposal, decision, ruleResults);

    return {
      success: true,
      data: decision,
    };
  }

  // ==========================================================================
  // DEPLOYMENT EXECUTION (ONLY PATH)
  // ==========================================================================

  async executeDeployment(
    proposal: WorkflowChangeProposal,
    workflow: N8NWorkflow
  ): Promise<GovernanceResult<{ deployedAt: string }>> {
    // 1. Evaluate proposal through ORION
    const decisionResult = await this.evaluateProposal(proposal);
    if (!decisionResult.success || !decisionResult.data) {
      return {
        success: false,
        error: decisionResult.error,
      };
    }

    const decision = decisionResult.data;

    // 2. Check if allowed
    if (!decision.allowed) {
      return {
        success: false,
        error: {
          code: 'ORION_REJECTED',
          message: decision.reason,
        },
      };
    }

    // 3. Write audit record BEFORE deployment
    const auditResult = await this.writeAuditRecord(proposal, decision);
    if (!auditResult.success) {
      return {
        success: false,
        error: {
          code: 'AUDIT_WRITE_FAILED',
          message: 'Failed to write audit record before deployment',
        },
      };
    }

    // 4. Execute deployment to n8n
    try {
      const isNewWorkflow = proposal.previousVersionHash === 'NEW_WORKFLOW';
      const endpoint = isNewWorkflow
        ? `${this.config.n8nBaseUrl}/api/v1/workflows`
        : `${this.config.n8nBaseUrl}/api/v1/workflows/${proposal.workflowId}`;

      const method = isNewWorkflow ? 'POST' : 'PUT';

      const response = await fetch(endpoint, {
        method,
        headers: {
          'X-N8N-API-KEY': this.config.n8nApiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(workflow),
      });

      if (!response.ok) {
        // Deployment failed - update audit record
        await this.markDeploymentFailed(proposal.proposalId, response.statusText);

        return {
          success: false,
          error: {
            code: 'DEPLOYMENT_BLOCKED',
            message: `n8n deployment failed: ${response.statusText}`,
          },
        };
      }

      // 5. Update audit record with deployment timestamp
      const deployedAt = new Date().toISOString();
      await this.markDeploymentSuccessful(proposal.proposalId, deployedAt);

      return {
        success: true,
        data: { deployedAt },
        auditId: proposal.proposalId,
      };
    } catch (err) {
      await this.markDeploymentFailed(
        proposal.proposalId,
        err instanceof Error ? err.message : 'Unknown error'
      );

      return {
        success: false,
        error: {
          code: 'DEPLOYMENT_BLOCKED',
          message: `Deployment failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
        },
      };
    }
  }

  // ==========================================================================
  // CONTEXT RETRIEVAL
  // ==========================================================================

  private async getContext(): Promise<GovernanceResult<ORIONContext>> {
    const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

    try {
      // Get system controls
      const { data: controls, error: controlsError } = await supabase
        .from('system_controls')
        .select('control_key, control_value')
        .in('control_key', [
          'autonomy_level',
          'sam_enabled',
          'ralph_enabled',
          'max_deployments_per_hour',
        ]);

      if (controlsError) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: controlsError.message,
          },
        };
      }

      // Get recent deployments count
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count, error: countError } = await supabase
        .from('n8n_workflow_audit')
        .select('*', { count: 'exact', head: true })
        .gte('deployed_at', oneHourAgo);

      if (countError) {
        console.error('Failed to count recent deployments:', countError);
      }

      // Parse controls
      const controlMap = new Map(
        (controls || []).map((c) => [c.control_key, c.control_value])
      );

      const context: ORIONContext = {
        currentAutonomyLevel: (controlMap.get('autonomy_level') as 0 | 1 | 2 | 3) || 0,
        samEnabled: controlMap.get('sam_enabled') === true,
        ralphEnabled: controlMap.get('ralph_enabled') === true,
        recentDeployments: count || 0,
        maxDeploymentsPerHour: (controlMap.get('max_deployments_per_hour') as number) || 10,
      };

      return {
        success: true,
        data: context,
      };
    } catch (err) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      };
    }
  }

  // ==========================================================================
  // AUDIT FUNCTIONS
  // ==========================================================================

  private async recordDecision(
    proposal: WorkflowChangeProposal,
    decision: ORIONDecision,
    ruleResults: { rule: string; result: RuleResult }[]
  ): Promise<void> {
    const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

    await supabase.from('orion_decisions').insert({
      decision_id: decision.decisionId,
      proposal_id: proposal.proposalId,
      workflow_id: proposal.workflowId,
      allowed: decision.allowed,
      reason: decision.reason,
      conditions: decision.conditions,
      rule_results: ruleResults,
      autonomy_level: decision.autonomyLevel,
      decided_at: decision.decidedAt,
    });
  }

  private async writeAuditRecord(
    proposal: WorkflowChangeProposal,
    decision: ORIONDecision
  ): Promise<GovernanceResult<void>> {
    const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

    try {
      const { error } = await supabase.from('n8n_workflow_audit').insert({
        id: proposal.proposalId,
        workflow_id: proposal.workflowId,
        previous_version_hash: proposal.previousVersionHash,
        proposed_version_hash: proposal.proposedVersionHash,
        diff_summary: proposal.diffSummary,
        risk_score: proposal.riskScore,
        risk_level: proposal.riskLevel,
        approved_by: decision.allowed ? 'ORION' : null,
        approval_context: JSON.stringify({
          orionDecision: decision,
          proposedBy: proposal.proposedBy,
          reason: proposal.reason,
        }),
        rollback_reference: proposal.rollbackReference,
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

  private async markDeploymentSuccessful(
    proposalId: string,
    deployedAt: string
  ): Promise<void> {
    const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

    await supabase
      .from('n8n_workflow_audit')
      .update({ deployed_at: deployedAt })
      .eq('id', proposalId);
  }

  private async markDeploymentFailed(
    proposalId: string,
    error: string
  ): Promise<void> {
    const supabase = createClient(this.config.supabaseUrl, this.config.supabaseKey);

    // We can't update the audit record (append-only), but we can log the failure
    await supabase.from('deployment_failures').insert({
      proposal_id: proposalId,
      error_message: error,
      failed_at: new Date().toISOString(),
    });
  }
}

// ============================================================================
// FACTORY
// ============================================================================

let gateInstance: ORIONGate | null = null;

export function createORIONGate(config: ORIONConfig): ORIONGate {
  gateInstance = new ORIONGate(config);
  return gateInstance;
}

export function getORIONGate(): ORIONGate | null {
  return gateInstance;
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateDecisionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `ORION-${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// CONVENIENCE: Check if deployment would be allowed (dry run)
// ============================================================================

export async function wouldBeAllowed(
  gate: ORIONGate,
  proposal: WorkflowChangeProposal
): Promise<{ allowed: boolean; reason: string }> {
  const result = await gate.evaluateProposal(proposal);

  if (!result.success || !result.data) {
    return {
      allowed: false,
      reason: result.error?.message || 'Evaluation failed',
    };
  }

  return {
    allowed: result.data.allowed,
    reason: result.data.reason,
  };
}
