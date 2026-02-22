'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  // Core Operations
  { label: '📊 Dashboard', href: '/dashboard' },
  { label: '🖥️ Live Ops', href: '/dashboard/ops' },
  { label: '🎯 CEO Control', href: '/Executive' },
  { label: '🎮 Command Center', href: '/dashboard/command-center' },
  
  // Lead Management
  { label: '📋 All Leads', href: '/dashboard/leads' },
  { label: '🩺 Lead Health', href: '/dashboard/lead-health' },
  { label: '⭐ Golden Leads', href: '/dashboard/golden-leads' },
  { label: '🏦 Lead Bank', href: '/lead-bank' },
  
  // Revenue Generation
  { label: '💰 Marketplace', href: '/marketplace' },
  { label: '👥 Buyers', href: '/buyers' },
  { label: '📈 Pipeline', href: '/dashboard/pipeline' },
  
  // Communication
  { label: '💬 Messages', href: '/dashboard/messages' },
  
  // Data & Import
  { label: '📤 Smart Import', href: '/dashboard/upload' },
  { label: '📉 Stats', href: '/dashboard/stats' },
  { label: '🧩 Skills', href: '/dashboard/skills' },
  { label: '🗂️ Tasks', href: '/dashboard/tasks' },
  
  // System
  { label: '⚙️ Governance', href: '/dashboard/governance' },
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
