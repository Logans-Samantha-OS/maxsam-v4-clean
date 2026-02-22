import { createClient, SupabaseClient } from '@supabase/supabase-js'

type ExecutionStatus = 'received' | 'running' | 'success' | 'failure'

export type LogExecutionInput = {
  id?: string
  status: ExecutionStatus
  workflowName: string
  webhookPath?: string
  instructionId?: string
  leadId?: string | null
  artifacts?: Record<string, unknown>
  errorText?: string
}

function getServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Supabase environment variables not configured for execution logging')
  }

  return createClient(url, key)
}

export async function logExecution(input: LogExecutionInput): Promise<string | null> {
  try {
    const supabase = getServiceClient()

    if (input.id) {
      const { error } = await supabase
        .from('workflow_executions')
        .update({
          status: input.status,
          webhook_path: input.webhookPath,
          instruction_id: input.instructionId,
          lead_id: input.leadId ?? null,
          artifacts: input.artifacts || {},
          error_text: input.errorText ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.id)

      if (error) return null
      return input.id
    }

    const { data, error } = await supabase
      .from('workflow_executions')
      .insert({
        status: input.status,
        workflow_name: input.workflowName,
        webhook_path: input.webhookPath,
        instruction_id: input.instructionId,
        lead_id: input.leadId ?? null,
        artifacts: input.artifacts || {},
        error_text: input.errorText ?? null,
      })
      .select('id')
      .single()

    if (error) return null
    return data?.id || null
  } catch {
    return null
  }
}
