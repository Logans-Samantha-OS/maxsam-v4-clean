'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import QuickStatsHeader from '@/components/dashboard/QuickStatsHeader'
import AnalyticsOverview from '@/components/dashboard/AnalyticsOverview'
import LeadTable from '@/components/dashboard/LeadTable'
import FilterPanel from '@/components/dashboard/FilterPanel'
import BulkActionsBar from '@/components/dashboard/BulkActionsBar'
import UploadZone from '@/components/dashboard/UploadZone'
import { fetchLeads, subscribeToLeads, type FetchLeadsOptions } from '@/lib/data/dashboard'
import type { Lead } from '@/lib/dashboard-utils'

export default function DashboardPage() {
  // Lead data state
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())
  const lastSelectedIndex = useRef<number | null>(null)

  // Filter state
  const [minAmount, setMinAmount] = useState(0)
  const [minScore, setMinScore] = useState(0)
  const [sortBy, setSortBy] = useState<string>('score_desc')
  const [hasPhone, setHasPhone] = useState(false)

  // Load leads from Supabase
  const loadLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: fetchError } = await fetchLeads({
      minAmount,
      minScore,
      hasPhone,
      sortBy: sortBy as FetchLeadsOptions['sortBy'],
      limit: 200,
    })

    if (fetchError) {
      setError(fetchError.message)
      setLeads([])
    } else {
      setLeads(data)
    }

    setLoading(false)
  }, [minAmount, minScore, hasPhone, sortBy])

  // Initial load
  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  // Real-time subscription
  useEffect(() => {
    const unsubscribe = subscribeToLeads((payload) => {
      if (payload.eventType === 'INSERT' && payload.new) {
        setLeads((prev) => [payload.new!, ...prev])
      } else if (payload.eventType === 'UPDATE' && payload.new) {
        setLeads((prev) =>
          prev.map((lead) => (lead.id === payload.new!.id ? payload.new! : lead))
        )
      } else if (payload.eventType === 'DELETE' && payload.old) {
        setLeads((prev) => prev.filter((lead) => lead.id !== payload.old!.id))
      }
    })

    return unsubscribe
  }, [])

  // Selection handlers
  const handleToggleSelect = useCallback(
    (id: string, shiftKey?: boolean) => {
      const currentIndex = leads.findIndex((l) => l.id === id)

      if (shiftKey && lastSelectedIndex.current !== null) {
        // Shift+click: select range
        const start = Math.min(lastSelectedIndex.current, currentIndex)
        const end = Math.max(lastSelectedIndex.current, currentIndex)
        const rangeIds = leads.slice(start, end + 1).map((l) => l.id)

        setSelectedLeads((prev) => {
          const next = new Set(prev)
          rangeIds.forEach((rid) => next.add(rid))
          return next
        })
      } else {
        // Regular click: toggle single
        setSelectedLeads((prev) => {
          const next = new Set(prev)
          if (next.has(id)) {
            next.delete(id)
          } else {
            next.add(id)
          }
          return next
        })
        lastSelectedIndex.current = currentIndex
      }
    },
    [leads]
  )

  const handleToggleSelectAll = useCallback(() => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map((l) => l.id)))
    }
  }, [leads, selectedLeads.size])

  const handleClearSelection = useCallback(() => {
    setSelectedLeads(new Set())
    lastSelectedIndex.current = null
  }, [])

  // Lead update handler (for inline edits)
  const handleLeadUpdate = useCallback((updatedLead: Lead) => {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === updatedLead.id ? updatedLead : lead))
    )
  }, [])

  // Filter reset
  const handleResetFilters = useCallback(() => {
    setMinAmount(0)
    setMinScore(0)
    setSortBy('score_desc')
    setHasPhone(false)
  }, [])

  // Calculate total value of selected leads
  const selectedTotalValue = leads
    .filter((l) => selectedLeads.has(l.id))
    .reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0)

  return (
    <main className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Executive Dashboard</h1>
        {loading && (
          <span className="text-sm text-zinc-500 animate-pulse">Loading...</span>
        )}
        {error && (
          <span className="text-sm text-red-400">Error: {error}</span>
        )}
      </div>

      <QuickStatsHeader leads={leads} />

      <UploadZone />

      <AnalyticsOverview leads={leads} />

      <FilterPanel
        minAmount={minAmount}
        setMinAmount={setMinAmount}
        minScore={minScore}
        setMinScore={setMinScore}
        sortBy={sortBy}
        setSortBy={setSortBy}
        hasPhone={hasPhone}
        setHasPhone={setHasPhone}
        onReset={handleResetFilters}
      />

      <LeadTable
        leads={leads}
        selectedLeads={selectedLeads}
        onToggleSelect={handleToggleSelect}
        onToggleSelectAll={handleToggleSelectAll}
        onLeadUpdate={handleLeadUpdate}
      />

      <BulkActionsBar
        selectedIds={Array.from(selectedLeads)}
        totalValue={selectedTotalValue}
        onClear={handleClearSelection}
        onSuccess={loadLeads}
      />
    </main>
  )
}
