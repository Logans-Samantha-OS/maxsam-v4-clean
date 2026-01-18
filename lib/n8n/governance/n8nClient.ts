/**
 * n8nClient.ts
 * Phase 12.1 → 13.1 Bridge
 *
 * N8N MCP Client Wrapper with governance enforcement.
 * Claude has FULL READ access but PROPOSE-only for changes.
 * Deployment requires ORION approval.
 */

import {
  N8NWorkflow,
  N8NExecution,
  N8NOperation,
  CLAUDE_ALLOWED_OPERATIONS,
  GovernanceResult,
  WorkflowChangeProposal,
} from './types';
import { validateWorkflowChange } from './validateWorkflowChange';
import { archiveWorkflow } from './archiveWorkflow';
import { diffWorkflowVersions, formatDiffAsText } from './diffWorkflowVersions';

// ============================================================================
// N8N CLIENT CONFIGURATION
// ============================================================================

export interface N8NClientConfig {
  baseUrl: string;
  apiKey: string;
  supabaseUrl: string;
  supabaseKey: string;
}

// ============================================================================
// N8N CLIENT CLASS
// ============================================================================

export class N8NGovernedClient {
  private config: N8NClientConfig;
  private allowedOperations: Set<N8NOperation>;

  constructor(config: N8NClientConfig) {
    this.config = config;
    this.allowedOperations = new Set(CLAUDE_ALLOWED_OPERATIONS);
  }

  // ==========================================================================
  // OPERATION GUARDS
  // ==========================================================================

  private checkOperation(operation: N8NOperation): void {
    if (!this.allowedOperations.has(operation)) {
      throw new Error(
        `Operation ${operation} is not allowed. Claude cannot deploy directly.`
      );
    }
  }

  // ==========================================================================
  // READ OPERATIONS (FULL ACCESS)
  // ==========================================================================

  /**
   * List all workflows
   */
  async listWorkflows(): Promise<GovernanceResult<N8NWorkflow[]>> {
    this.checkOperation('READ_WORKFLOWS');

    try {
      const response = await fetch(`${this.config.baseUrl}/api/v1/workflows`, {
        headers: {
          'X-N8N-API-KEY': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `Failed to list workflows: ${response.statusText}`,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || [],
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

  /**
   * Get a specific workflow by ID
   */
  async getWorkflow(id: string): Promise<GovernanceResult<N8NWorkflow>> {
    this.checkOperation('READ_WORKFLOWS');

    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/workflows/${id}`,
        {
          headers: {
            'X-N8N-API-KEY': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `Failed to get workflow: ${response.statusText}`,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
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

  /**
   * List executions for a workflow
   */
  async listExecutions(
    workflowId?: string,
    limit: number = 20
  ): Promise<GovernanceResult<N8NExecution[]>> {
    this.checkOperation('READ_EXECUTIONS');

    try {
      let url = `${this.config.baseUrl}/api/v1/executions?limit=${limit}`;
      if (workflowId) {
        url += `&workflowId=${workflowId}`;
      }

      const response = await fetch(url, {
        headers: {
          'X-N8N-API-KEY': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `Failed to list executions: ${response.statusText}`,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || [],
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

  /**
   * Get execution details
   */
  async getExecution(id: string): Promise<GovernanceResult<N8NExecution>> {
    this.checkOperation('READ_EXECUTIONS');

    try {
      const response = await fetch(
        `${this.config.baseUrl}/api/v1/executions/${id}`,
        {
          headers: {
            'X-N8N-API-KEY': this.config.apiKey,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `Failed to get execution: ${response.statusText}`,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data,
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

  /**
   * Get failed executions (errors)
   */
  async getFailedExecutions(
    workflowId?: string,
    limit: number = 20
  ): Promise<GovernanceResult<N8NExecution[]>> {
    this.checkOperation('READ_ERRORS');

    try {
      let url = `${this.config.baseUrl}/api/v1/executions?status=error&limit=${limit}`;
      if (workflowId) {
        url += `&workflowId=${workflowId}`;
      }

      const response = await fetch(url, {
        headers: {
          'X-N8N-API-KEY': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: `Failed to get errors: ${response.statusText}`,
          },
        };
      }

      const data = await response.json();
      return {
        success: true,
        data: data.data || [],
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
  // PROPOSE OPERATIONS (NO DIRECT DEPLOYMENT)
  // ==========================================================================

  /**
   * Propose a new workflow.
   * This does NOT create the workflow - it generates a proposal for ORION approval.
   */
  async proposeNewWorkflow(
    workflow: N8NWorkflow,
    reason: string,
    proposedBy: string
  ): Promise<GovernanceResult<WorkflowChangeProposal>> {
    this.checkOperation('PROPOSE_WORKFLOW');

    // Validate the workflow
    const validationResult = validateWorkflowChange(null, workflow, reason, proposedBy);

    if (!validationResult.success || !validationResult.data?.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Workflow validation failed',
          details: { errors: validationResult.data?.errors },
        },
      };
    }

    return {
      success: true,
      data: validationResult.data.proposal!,
    };
  }

  /**
   * Propose a workflow modification.
   * This does NOT update the workflow - it generates a proposal for ORION approval.
   */
  async proposeWorkflowModification(
    workflowId: string,
    proposedWorkflow: N8NWorkflow,
    reason: string,
    proposedBy: string
  ): Promise<GovernanceResult<WorkflowChangeProposal>> {
    this.checkOperation('PROPOSE_MODIFICATION');

    // Get current workflow
    const currentResult = await this.getWorkflow(workflowId);
    if (!currentResult.success || !currentResult.data) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: `Cannot find workflow ${workflowId} to modify`,
        },
      };
    }

    const currentWorkflow = currentResult.data;

    // Archive current version before proposing changes
    await archiveWorkflow(
      currentWorkflow,
      this.config.supabaseUrl,
      this.config.supabaseKey,
      {
        reason: `Pre-modification archive: ${reason}`,
        archivedBy: proposedBy,
      }
    );

    // Validate the proposed changes
    const validationResult = validateWorkflowChange(
      currentWorkflow,
      proposedWorkflow,
      reason,
      proposedBy
    );

    if (!validationResult.success || !validationResult.data?.valid) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Workflow modification validation failed',
          details: { errors: validationResult.data?.errors },
        },
      };
    }

    return {
      success: true,
      data: validationResult.data.proposal!,
    };
  }

  /**
   * Generate a diff between two workflow versions
   */
  async generateDiff(
    workflowId: string,
    proposedWorkflow: N8NWorkflow
  ): Promise<GovernanceResult<string>> {
    this.checkOperation('READ_WORKFLOWS');

    const currentResult = await this.getWorkflow(workflowId);
    if (!currentResult.success || !currentResult.data) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: `Cannot find workflow ${workflowId}`,
        },
      };
    }

    const diff = diffWorkflowVersions(currentResult.data, proposedWorkflow);
    const diffText = formatDiffAsText(diff);

    return {
      success: true,
      data: diffText,
    };
  }

  // ==========================================================================
  // DEPLOY OPERATIONS (ORION-GATED ONLY)
  // ==========================================================================

  /**
   * Deploy a workflow - REQUIRES ORION DECISION
   * This is not directly callable by Claude.
   * It must go through the ORION gate.
   */
  async deployWorkflow(
    workflow: N8NWorkflow,
    _orionDecisionId: string
  ): Promise<GovernanceResult<{ deployedAt: string }>> {
    // This operation is NEVER in CLAUDE_ALLOWED_OPERATIONS
    // It can only be called by the ORION gate
    this.checkOperation('DEPLOY_GOVERNED');

    // If we reach here, something is wrong
    return {
      success: false,
      error: {
        code: 'UNAUTHORIZED_OPERATION',
        message: 'Direct deployment is not allowed. Use ORION governance gate.',
      },
    };
  }
}

// ============================================================================
// CLIENT FACTORY
// ============================================================================

let clientInstance: N8NGovernedClient | null = null;

export function createN8NClient(config: N8NClientConfig): N8NGovernedClient {
  clientInstance = new N8NGovernedClient(config);
  return clientInstance;
}

export function getN8NClient(): N8NGovernedClient | null {
  return clientInstance;
}

// ============================================================================
// CONVENIENCE FUNCTIONS FOR CLAUDE
// ============================================================================

/**
 * Quick read of workflow status
 */
export async function getWorkflowSummary(
  client: N8NGovernedClient
): Promise<
  GovernanceResult<{
    totalWorkflows: number;
    activeWorkflows: number;
    recentErrors: number;
  }>
> {
  const workflowsResult = await client.listWorkflows();
  if (!workflowsResult.success) {
    return {
      success: false,
      error: workflowsResult.error,
    };
  }

  const workflows = workflowsResult.data || [];
  const errorsResult = await client.getFailedExecutions(undefined, 50);

  return {
    success: true,
    data: {
      totalWorkflows: workflows.length,
      activeWorkflows: workflows.filter((w) => w.active).length,
      recentErrors: errorsResult.success ? (errorsResult.data?.length || 0) : 0,
    },
  };
}

/**
 * Explain a workflow in plain English
 */
export function explainWorkflow(workflow: N8NWorkflow): string {
  const lines: string[] = [];

  lines.push(`## Workflow: ${workflow.name}`);
  lines.push(`ID: ${workflow.id}`);
  lines.push(`Active: ${workflow.active ? 'Yes' : 'No'}`);
  lines.push(`Nodes: ${workflow.nodes.length}`);
  lines.push('');

  lines.push('### Node Flow:');
  for (const node of workflow.nodes) {
    const disabled = node.disabled ? ' [DISABLED]' : '';
    lines.push(`- ${node.name} (${node.type})${disabled}`);
    if (node.notes) {
      lines.push(`  Notes: ${node.notes}`);
    }
  }

  return lines.join('\n');
}
