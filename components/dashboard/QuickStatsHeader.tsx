'use client'

import { useEffect, useState } from 'react'
import { fetchDashboardStats } from '@/lib/dashboard/stats'

type DashboardStats = {
  readyToBlast: number
  pendingReply: number
  hotResponses: number
  activityEvents: number
}

export default function QuickStatsHeader() {
  const [stats, setStats] = useState<DashboardStats>({
    readyToBlast: 0,
    pendingReply: 0,
    hotResponses: 0,
    activityEvents: 0,
  })

  useEffect(() => {
    // initial fetch
    fetchDashboardStats().then(setStats)

    // poll every 5 seconds
    const interval = setInterval(() => {
      fetchDashboardStats().then(setStats)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="grid grid-cols-4 gap-4">
      <Stat label="Ready to Blast" value={stats.readyToBlast} />
      <Stat label="Pending Reply" value={stats.pendingReply} />
      <Stat label="Hot Responses" value={stats.hotResponses} />
      <Stat label="Activity Events" value={stats.activityEvents} />
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-zinc-900 p-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  )
}
