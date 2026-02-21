/**
 * Execution Logger — writes structured rows to `workflow_executions`.
 *
 * Usage:
 *   const exec = await logExecution.start('/api/cron/sam-campaign', 'SAM Campaign')
 *   try {
 *     // … do work …
 *     await exec.success({ sent: 5, failed: 1 })
 *   } catch (err) {
 *     await exec.failure(err)
 *   }
 */

import { createClient } from '@/lib/supabase/server'

type Status = 'received' | 'running' | 'success' | 'failure'

interface StartOpts {
  instruction_id?: string
  lead_id?: string | null
}

interface ExecutionHandle {
  id: string
  /** Transition to running (called automatically by start) */
  markRunning: () => Promise<void>
  /** Record successful completion with optional artifact data */
  success: (artifacts?: Record<string, unknown>) => Promise<void>
  /** Record failure with error */
  failure: (err: unknown) => Promise<void>
}

async function upsertRow(
  id: string,
  fields: {
    status: Status
    artifacts?: Record<string, unknown>
    error?: string
    duration_ms?: number
  }
) {
  const supabase = createClient()
  await supabase
    .from('workflow_executions')
    .update({
      status: fields.status,
      artifacts: fields.artifacts ?? undefined,
      error: fields.error ?? undefined,
      duration_ms: fields.duration_ms ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
}

/**
 * Begin tracking an execution. Inserts a `received` row, immediately
 * transitions to `running`, and returns a handle for success/failure.
 */
async function start(
  webhookPath: string,
  workflowName?: string,
  opts?: StartOpts
): Promise<ExecutionHandle> {
  const supabase = createClient()
  const startedAt = Date.now()

  const { data } = await supabase
    .from('workflow_executions')
    .insert({
      webhook_path: webhookPath,
      workflow_name: workflowName ?? null,
      instruction_id: opts?.instruction_id ?? null,
      lead_id: opts?.lead_id ?? null,
      status: 'received' as Status,
    })
    .select('id')
    .single()

  const execId: string = data?.id ?? 'unknown'

  const handle: ExecutionHandle = {
    id: execId,

    markRunning: async () => {
      await upsertRow(execId, { status: 'running' })
    },

    success: async (artifacts?: Record<string, unknown>) => {
      await upsertRow(execId, {
        status: 'success',
        artifacts,
        duration_ms: Date.now() - startedAt,
      })
    },

    failure: async (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err)
      await upsertRow(execId, {
        status: 'failure',
        error: message,
        duration_ms: Date.now() - startedAt,
      })
    },
  }

  // Immediately mark as running
  await handle.markRunning()

  return handle
}

export const logExecution = { start }
