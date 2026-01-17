import QuickStatsHeader from '@/components/dashboard/QuickStatsHeader'
import Activity from '@/components/dashboard/Activity'
import ExecutionQueue from '@/components/dashboard/ExecutionQueue'

export default function HomePage() {
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">MaxSam V4</h1>

      <QuickStatsHeader />
      <ExecutionQueue />
      <Activity />
    </main>
  )
}
