'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import CommandCenter from '@/components/command-center/CommandCenter'

function CommandCenterContent() {
  const params = useSearchParams()
  const mode = params.get('mode')
  const leadIds = params.get('leads')?.split(',') ?? []

  return (
    <CommandCenter
      mode={mode}
      leadIds={leadIds}
    />
  )
}

export default function CommandCenterPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading Command Center...</div>}>
      <CommandCenterContent />
    </Suspense>
  )
}
