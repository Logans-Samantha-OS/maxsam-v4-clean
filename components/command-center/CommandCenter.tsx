'use client'

export type CommandCenterProps = {
  mode?: string | null
  leadIds?: string[]
}

export default function CommandCenter({ mode, leadIds }: CommandCenterProps) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Command Center</h1>

      <p className="text-muted-foreground">
        Ralph execution queue, automations, and system status live here.
      </p>

      <div className="rounded-xl border p-6 space-y-2">
        <div>Mode: {mode ?? 'default'}</div>
        <div>Lead IDs: {leadIds?.length ?? 0}</div>
      </div>
    </div>
  )
}
