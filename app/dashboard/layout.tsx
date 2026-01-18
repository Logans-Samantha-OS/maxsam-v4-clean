import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default function DashboardLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen bg-zinc-950 text-white">
      <Sidebar />

      <div className="flex-1 flex flex-col">
        <TopBar />
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
