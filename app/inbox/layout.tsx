import type { ReactNode } from 'react'
import Sidebar from '@/components/layout/Sidebar'

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden text-white" style={{ background: '#0a0c10' }}>
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 h-full">{children}</main>
    </div>
  )
}
