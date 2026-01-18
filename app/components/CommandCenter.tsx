'use client'

export default function CommandCenter() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Command Center</h1>

      <p className="text-muted-foreground">
        Ralph execution queue, automations, and system status live here.
      </p>

      <div className="rounded-xl border p-6">
        <div>Mode: default</div>
        <div>Lead IDs: 0</div>
      </div>
    </div>
  )
}
