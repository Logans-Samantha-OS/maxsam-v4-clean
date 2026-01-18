/**
 * archiveWorkflow.ts
 * Phase 12.1 → 13.1 Bridge
 *
 * Deterministic workflow archival for rollback capability.
 * Every workflow version is archived before modification.
 */

import { createClient } from '@supabase/supabase-js';
import {
  N8NWorkflow,
  WorkflowArchive,
  GovernanceResult,
  GovernanceError,
} from './types';
import { computeWorkflowHash } from './validateWorkflowChange';

// ============================================================================
// ARCHIVE STORAGE
// ============================================================================

const ARCHIVE_TABLE = 'n8n_workflow_archive';

export interface ArchiveOptions {
  reason: string;
  archivedBy: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// CORE ARCHIVE FUNCTION
// ============================================================================

export async function archiveWorkflow(
  workflow: N8NWorkflow,
  supabaseUrl: string,
  supabaseKey: string,
  options: ArchiveOptions
): Promise<GovernanceResult<WorkflowArchive>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const versionHash = computeWorkflowHash(workflow);
    const archiveId = generateArchiveId(workflow.id, versionHash);

    // Check if this exact version is already archived
    const { data: existing } = await supabase
      .from(ARCHIVE_TABLE)
      .select('archive_id')
      .eq('workflow_id', workflow.id)
      .eq('version_hash', versionHash)
      .single();

    if (existing) {
      return {
        success: true,
        data: {
          archiveId: existing.archive_id,
          workflowId: workflow.id,
          workflowName: workflow.name,
          versionHash,
          workflow,
          archivedAt: new Date().toISOString(),
          archivedBy: options.archivedBy,
          reason: 'Already archived',
        },
      };
    }

    // Create archive record
    const archive: WorkflowArchive = {
      archiveId,
      workflowId: workflow.id,
      workflowName: workflow.name,
      versionHash,
      workflow,
      archivedAt: new Date().toISOString(),
      archivedBy: options.archivedBy,
      reason: options.reason,
    };

    const { error } = await supabase.from(ARCHIVE_TABLE).insert({
      archive_id: archive.archiveId,
      workflow_id: archive.workflowId,
      workflow_name: archive.workflowName,
      version_hash: archive.versionHash,
      workflow_json: archive.workflow,
      archived_at: archive.archivedAt,
      archived_by: archive.archivedBy,
      reason: archive.reason,
      metadata: options.metadata || {},
    });

    if (error) {
      return {
        success: false,
        error: {
          code: 'AUDIT_WRITE_FAILED',
          message: `Failed to archive workflow: ${error.message}`,
          details: { supabaseError: error },
        },
      };
    }

    return {
      success: true,
      data: archive,
      auditId: archiveId,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'AUDIT_WRITE_FAILED',
        message: `Archive operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}

// ============================================================================
// ARCHIVE RETRIEVAL
// ============================================================================

export async function getArchivedWorkflow(
  workflowId: string,
  versionHash: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<WorkflowArchive>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from(ARCHIVE_TABLE)
      .select('*')
      .eq('workflow_id', workflowId)
      .eq('version_hash', versionHash)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: {
          code: 'ROLLBACK_UNAVAILABLE',
          message: `No archive found for workflow ${workflowId} version ${versionHash}`,
        },
      };
    }

    return {
      success: true,
      data: {
        archiveId: data.archive_id,
        workflowId: data.workflow_id,
        workflowName: data.workflow_name,
        versionHash: data.version_hash,
        workflow: data.workflow_json,
        archivedAt: data.archived_at,
        archivedBy: data.archived_by,
        reason: data.reason,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ROLLBACK_UNAVAILABLE',
        message: `Failed to retrieve archive: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}

export async function getLatestArchive(
  workflowId: string,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<WorkflowArchive>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from(ARCHIVE_TABLE)
      .select('*')
      .eq('workflow_id', workflowId)
      .order('archived_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return {
        success: false,
        error: {
          code: 'ROLLBACK_UNAVAILABLE',
          message: `No archive found for workflow ${workflowId}`,
        },
      };
    }

    return {
      success: true,
      data: {
        archiveId: data.archive_id,
        workflowId: data.workflow_id,
        workflowName: data.workflow_name,
        versionHash: data.version_hash,
        workflow: data.workflow_json,
        archivedAt: data.archived_at,
        archivedBy: data.archived_by,
        reason: data.reason,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ROLLBACK_UNAVAILABLE',
        message: `Failed to retrieve archive: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}

export async function listArchives(
  workflowId: string,
  supabaseUrl: string,
  supabaseKey: string,
  limit: number = 10
): Promise<GovernanceResult<WorkflowArchive[]>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from(ARCHIVE_TABLE)
      .select('*')
      .eq('workflow_id', workflowId)
      .order('archived_at', { ascending: false })
      .limit(limit);

    if (error) {
      return {
        success: false,
        error: {
          code: 'ROLLBACK_UNAVAILABLE',
          message: `Failed to list archives: ${error.message}`,
        },
      };
    }

    const archives: WorkflowArchive[] = (data || []).map((d) => ({
      archiveId: d.archive_id,
      workflowId: d.workflow_id,
      workflowName: d.workflow_name,
      versionHash: d.version_hash,
      workflow: d.workflow_json,
      archivedAt: d.archived_at,
      archivedBy: d.archived_by,
      reason: d.reason,
    }));

    return {
      success: true,
      data: archives,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'ROLLBACK_UNAVAILABLE',
        message: `Failed to list archives: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}

// ============================================================================
// UTILITIES
// ============================================================================

function generateArchiveId(workflowId: string, versionHash: string): string {
  const timestamp = Date.now().toString(36);
  return `ARCH-${workflowId.substring(0, 8)}-${versionHash.substring(0, 8)}-${timestamp}`.toUpperCase();
}

// ============================================================================
// ARCHIVE CLEANUP (for admin use only)
// ============================================================================

export async function pruneOldArchives(
  workflowId: string,
  keepCount: number,
  supabaseUrl: string,
  supabaseKey: string
): Promise<GovernanceResult<number>> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get all archives for this workflow, ordered by date
    const { data: allArchives, error: fetchError } = await supabase
      .from(ARCHIVE_TABLE)
      .select('archive_id, archived_at')
      .eq('workflow_id', workflowId)
      .order('archived_at', { ascending: false });

    if (fetchError) {
      return {
        success: false,
        error: {
          code: 'AUDIT_WRITE_FAILED',
          message: `Failed to fetch archives: ${fetchError.message}`,
        },
      };
    }

    if (!allArchives || allArchives.length <= keepCount) {
      return {
        success: true,
        data: 0,
      };
    }

    // Get IDs of archives to delete (all but the most recent `keepCount`)
    const archivesToDelete = allArchives.slice(keepCount);
    const idsToDelete = archivesToDelete.map((a) => a.archive_id);

    const { error: deleteError } = await supabase
      .from(ARCHIVE_TABLE)
      .delete()
      .in('archive_id', idsToDelete);

    if (deleteError) {
      return {
        success: false,
        error: {
          code: 'AUDIT_WRITE_FAILED',
          message: `Failed to delete old archives: ${deleteError.message}`,
        },
      };
    }

    return {
      success: true,
      data: idsToDelete.length,
    };
  } catch (err) {
    return {
      success: false,
      error: {
        code: 'AUDIT_WRITE_FAILED',
        message: `Prune operation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
      },
    };
  }
}
