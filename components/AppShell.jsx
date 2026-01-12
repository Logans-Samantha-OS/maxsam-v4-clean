'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AppShell({ children }) {
  const pathname = usePathname();

  const navItems = [
    { id: 'morning-brief', label: 'Morning Brief', icon: '☀️', path: '/morning-brief' },
    { id: 'dashboard', label: 'Dashboard', icon: '\u25c6', path: '/' },
    { id: 'sellers', label: 'Sellers', icon: '\u25c7', path: '/sellers' },
    { id: 'buyers', label: 'Buyers', icon: '\u25c7', path: '/buyers' },
    { id: 'contracts', label: 'Contracts', icon: '\u25c9', path: '/contracts' },
    { id: 'analytics', label: 'Analytics', icon: '\u25c8', path: '/analytics' },
    { id: 'system-health', label: 'System Health', icon: '🏥', path: '/system-health' },
    { id: 'simulator', label: 'Simulator', icon: '🎯', path: '/simulator' },
    { id: 'testing', label: 'Testing', icon: '🧪', path: '/testing' },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      {/* Sidebar */}
      <aside className="w-64 bg-[#111111] border-r border-zinc-800 flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <Link
            href="/"
            className="inline-flex flex-col cursor-pointer group"
          >
            <h1 className="text-xl font-bold text-cyan-400 group-hover:text-cyan-300">
              MaxSam V4
            </h1>
            <p className="text-zinc-500 text-sm group-hover:text-zinc-300">
              Operations Platform
            </p>
          </Link>
        </div>

        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map((item) => {
              const isActive =
                item.path === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.path);

              return (
                <li key={item.id}>
                  <Link
                    href={item.path}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition cursor-pointer ${
                      isActive
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    <span
                      className={
                        isActive ? 'text-cyan-400' : 'text-zinc-600'
                      }
                    >
                      {item.icon}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 rounded-lg">
            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-green-400 text-sm">All Systems Online</span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
