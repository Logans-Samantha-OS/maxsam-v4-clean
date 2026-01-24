'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'CEO Control', href: '/Executive' },
  { label: 'Command Center', href: '/dashboard/command-center' },
  { label: 'Leads', href: '/dashboard/leads' },
  { label: 'Pipeline', href: '/dashboard/pipeline' },
  { label: 'Golden Leads', href: '/dashboard/golden-leads' },
  { label: 'Messages', href: '/dashboard/messages' },
  { label: 'Governance', href: '/dashboard/governance' },
  { label: 'Smart Import', href: '/dashboard/upload' },
  { label: 'Stats', href: '/dashboard/stats' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-800 p-4">
      <h1 className="text-lg font-semibold mb-6 text-zinc-100">
        MAXSAM V4
      </h1>

      <nav className="space-y-1">
        {NAV_ITEMS.map(item => {
          const active = pathname === item.href

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded px-3 py-2 text-sm transition-colors ${
                active
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
