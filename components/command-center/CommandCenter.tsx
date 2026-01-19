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

      {mode && (
        <div className="rounded-xl border bg-blue-50 dark:bg-blue-900/20 p-4">
          <p className="text-sm">Mode: <span className="font-medium">{mode}</span></p>
          {leadIds && leadIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Selected leads: {leadIds.length}
            </p>
          )}
        </div>
      )}

      {/* Future slots */}
      <div className="rounded-xl border p-6">
        Command Center UI will be progressively enhanced here.
      </div>
    </div>
  )
}
