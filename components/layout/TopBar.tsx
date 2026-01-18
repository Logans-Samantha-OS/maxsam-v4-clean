'use client'

export default function TopBar() {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6">
      <span className="text-sm text-zinc-400">Executive Dashboard</span>
      <button className="text-sm bg-zinc-800 px-3 py-1 rounded hover:bg-zinc-700">
        Refresh
      </button>
    </header>
  )
}
