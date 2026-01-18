'use client'

export default function TopBar() {
  return (
    <header className="h-14 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-6">
      <span className="text-sm text-zinc-400">Executive Dashboard</span>
      <button className="text-sm text-zinc-300 hover:text-white">
        Refresh
      </button>
    </header>
  )
}
