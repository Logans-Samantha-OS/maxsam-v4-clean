'use client'

import CapitalFlowEngine from '@/components/CapitalFlowEngine'
import ContractsTable from '@/components/contracts/ContractsTable'
import NewContractButton from '@/components/contracts/NewContractButton'

export default function ContractsPage() {
  return (
    <div className="p-6 space-y-6">
      <CapitalFlowEngine />
      <NewContractButton />
      <ContractsTable />
    </div>
  )
}
