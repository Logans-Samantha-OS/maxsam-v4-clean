import QuickStatsHeader from '@/components/dashboard/QuickStatsHeader'
import Activity from '@/components/dashboard/Activity'
import ExecutionQueue from '@/components/dashboard/ExecutionQueue'

export default function RalphPage() {
  return (
    <main className="p-6 space-y-6 min-h-screen bg-zinc-950">
      <h1 className="text-2xl font-bold text-white">Ralph Execution Queue</h1>
      <p className="text-zinc-400">Quick execution view for Ralph-prioritized actions</p>

      <QuickStatsHeader />
      <ExecutionQueue />
      <Activity />
    </main>
  )
}
