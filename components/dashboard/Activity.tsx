'use client'

import { useEffect, useState } from 'react'
import { fetchActivityFeed } from '@/lib/Phase10/queue'

export default function Activity() {
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    fetchActivityFeed().then(({ data }) => setEvents(data || []))

    const interval = setInterval(() => {
      fetchActivityFeed().then(({ data }) => setEvents(data || []))
    }, 3000)

    return () => clearInterval(interval)
  }, [])

  if (!events.length) {
    return <div className="text-zinc-400">No activity yet.</div>
  }

  return (
    <div className="space-y-2">
      {events.map((e) => (
        <div
          key={e.id}
          className="rounded-lg bg-zinc-900 px-3 py-2 text-sm"
        >
          <div className="font-medium">{e.event_type}</div>
          <div className="text-zinc-400">{e.status}</div>
        </div>
      ))}
    </div>
  )
}
