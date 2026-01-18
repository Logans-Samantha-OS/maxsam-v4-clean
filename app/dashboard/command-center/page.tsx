import { useSearchParams } from 'next/navigation'

import CommandCenter from '@/components/command-center/CommandCenter'

export default function CommandCenterPage() {
  return <CommandCenter />
}
const params = useSearchParams()
const mode = params.get('mode')
const leadIds = params.get('leads')?.split(',') ?? []
