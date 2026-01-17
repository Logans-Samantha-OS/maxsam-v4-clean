'use client'

export default function ExecutionQueue() {
  async function runRalph() {
    await fetch('/api/ralph/run', { method: 'POST' })
  }

  return (
    <div className="rounded-xl bg-zinc-900 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Execution Queue</h2>
        <button
          onClick={runRalph}
          className="px-4 py-2 rounded-md bg-indigo-600 hover:bg-indigo-500"
        >
          Run Ralph
        </button>
      </div>

      <div className="text-sm text-zinc-400">
        Click to process the next queued action.
      </div>
    </div>
  )
}
