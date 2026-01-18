'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const nav = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Stats', href: '/dashboard/stats' },
  { label: 'Command Center', href: '/dashboard/command-center' },
  { label: 'Leads', href: '/leads' },
]

export default function Sidebar() {
  const path = usePathname()

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 p-4">
      <h1 className="text-lg font-semibold mb-6">MAXSAM V4</h1>

      <nav className="space-y-2">
        {nav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`block rounded px-3 py-2 text-sm ${
              path === item.href
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:bg-zinc-900'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
