'use client'

import { useSearchParams } from 'next/navigation'
import CommandCenter from '@/components/command-center/CommandCenter'

export default function CommandCenterPage() {
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
