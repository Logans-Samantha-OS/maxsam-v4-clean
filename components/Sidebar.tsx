'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: '🏠', href: '/' },
  { id: 'sellers', label: 'Sellers', icon: '👥', href: '/sellers' },
  { id: 'buyers', label: 'Buyers', icon: '🏢', href: '/buyers' },
  { id: 'contracts', label: 'Contracts', icon: '📄', href: '/contracts' },
  { id: 'analytics', label: 'Analytics', icon: '📊', href: '/analytics' },
  { id: 'morning-brief', label: 'Morning Brief', icon: '🌅', href: '/morning-brief' },
  { id: 'system-health', label: 'System Health', icon: '💚', href: '/system-health' },
  { id: 'simulator', label: 'Simulator', icon: '🎮', href: '/simulator' },
  { id: 'testing', label: 'Testing', icon: '🧪', href: '/testing' },
  { id: 'settings', label: 'Settings', icon: '⚙️', href: '/settings' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-[#111111] border-r border-zinc-800 flex flex-col min-h-screen">
      <div className="p-6 border-b border-zinc-800">
        <h1 className="text-xl font-bold text-cyan-400">MaxSam V4</h1>
        <p className="text-zinc-500 text-sm">Logan Toups • 100% Revenue</p>
      </div>

      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/' && pathname.startsWith(item.href));

            return (
              <li key={item.id}>
                <Link
                  href={item.href}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive
                      ? 'bg-cyan-500/20 text-cyan-400'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="p-4 border-t border-zinc-800">
        <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
          <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-green-400 text-sm">All Systems Online</span>
        </div>
      </div>
    </aside>
  );
}
