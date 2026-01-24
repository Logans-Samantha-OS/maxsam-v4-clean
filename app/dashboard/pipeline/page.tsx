'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

interface Lead {
  id: string
  owner_name: string
  phone: string | null
  phone_1: string | null
  phone_2: string | null
  property_address: string
  city: string
  county: string
  excess_funds_amount: number
  eleanor_score: number
  is_golden: boolean
  status: string | null
  last_contact_at: string | null
  contact_attempts: number
}

interface Column {
  id: string
  title: string
  status: string | null
  color: string
  collapsed?: boolean
}

const COLUMNS: Column[] = [
  { id: 'new', title: 'New Leads', status: null, color: 'border-blue-500' },
  { id: 'contacted', title: 'Contacted', status: 'contacted', color: 'border-yellow-500' },
  { id: 'agreement_sent', title: 'Agreement Sent', status: 'agreement_sent', color: 'border-purple-500' },
  { id: 'signed', title: 'Signed', status: 'signed', color: 'border-green-500' },
  { id: 'opted_out', title: 'Opted Out', status: 'opted_out', color: 'border-red-500', collapsed: true },
]

export default function PipelineDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set(['opted_out']))
  const [draggingLead, setDraggingLead] = useState<string | null>(null)

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/leads?limit=500')
      if (!res.ok) throw new Error('Failed to fetch leads')

      const data = await res.json()
      setLeads(data.leads || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const getLeadsByStatus = (status: string | null) => {
    if (status === null) {
      return leads.filter(l => !l.status || l.status === 'new')
    }
    return leads.filter(l => l.status === status)
  }

  const getColumnValue = (columnId: string) => {
    const columnLeads = getLeadsByStatus(
      COLUMNS.find(c => c.id === columnId)?.status ?? null
    )
    return columnLeads.reduce((sum, lead) => sum + (lead.excess_funds_amount || 0), 0)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'bg-green-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return '1d ago'
    if (diffDays < 7) return `${diffDays}d ago`
    return `${Math.floor(diffDays / 7)}w ago`
  }

  const toggleColumn = (columnId: string) => {
    const newCollapsed = new Set(collapsedColumns)
    if (newCollapsed.has(columnId)) {
      newCollapsed.delete(columnId)
    } else {
      newCollapsed.add(columnId)
    }
    setCollapsedColumns(newCollapsed)
  }

  const handleDragStart = (leadId: string) => {
    setDraggingLead(leadId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (columnId: string) => {
    if (!draggingLead) return

    const newStatus = COLUMNS.find(c => c.id === columnId)?.status

    try {
      const res = await fetch(`/api/leads/${draggingLead}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus || 'new' }),
      })

      if (!res.ok) throw new Error('Failed to update lead status')

      // Optimistically update UI
      setLeads(prev => prev.map(lead =>
        lead.id === draggingLead
          ? { ...lead, status: newStatus || null }
          : lead
      ))
    } catch (err) {
      console.error('Failed to update lead:', err)
    }

    setDraggingLead(null)
  }

  // Calculate totals
  const totalPipelineValue = leads.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0)
  const goldenCount = leads.filter(l => l.is_golden).length
  const contactedToday = leads.filter(l => {
    if (!l.last_contact_at) return false
    const contactDate = new Date(l.last_contact_at)
    const today = new Date()
    return contactDate.toDateString() === today.toDateString()
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-zinc-400">Loading pipeline...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950 border border-red-800 rounded-lg text-red-200">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Deal Pipeline</h1>
          <p className="text-sm text-zinc-400">
            Drag and drop leads to update their status
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads}>
          Refresh
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400">Total Leads</div>
          <div className="text-2xl font-bold text-zinc-100">{leads.length}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400">Golden Leads</div>
          <div className="text-2xl font-bold text-yellow-400">{goldenCount}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400">Contacted Today</div>
          <div className="text-2xl font-bold text-zinc-100">{contactedToday}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="text-sm text-zinc-400">Pipeline Value</div>
          <div className="text-2xl font-bold text-green-400">{formatCurrency(totalPipelineValue)}</div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map(column => {
          const columnLeads = getLeadsByStatus(column.status)
          const columnValue = getColumnValue(column.id)
          const isCollapsed = collapsedColumns.has(column.id)

          return (
            <div
              key={column.id}
              className={`flex-shrink-0 ${isCollapsed ? 'w-16' : 'w-80'} transition-all duration-200`}
              onDragOver={handleDragOver}
              onDrop={() => handleDrop(column.id)}
            >
              {/* Column Header */}
              <div
                className={`bg-zinc-900 border-t-4 ${column.color} rounded-t-lg p-3 cursor-pointer`}
                onClick={() => toggleColumn(column.id)}
              >
                {isCollapsed ? (
                  <div className="flex flex-col items-center">
                    <span className="text-zinc-400 text-xs font-medium [writing-mode:vertical-lr] rotate-180">
                      {column.title}
                    </span>
                    <Badge variant="secondary" className="mt-2">
                      {columnLeads.length}
                    </Badge>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-zinc-100">{column.title}</h3>
                      <p className="text-xs text-zinc-500">
                        {columnLeads.length} leads · {formatCurrency(columnValue)}
                      </p>
                    </div>
                    <span className="text-zinc-500">
                      {isCollapsed ? '→' : '←'}
                    </span>
                  </div>
                )}
              </div>

              {/* Column Body */}
              {!isCollapsed && (
                <div className="bg-zinc-950 border border-zinc-800 border-t-0 rounded-b-lg p-2 min-h-[400px] max-h-[calc(100vh-350px)] overflow-y-auto space-y-2">
                  {columnLeads.length === 0 ? (
                    <div className="text-center text-zinc-500 py-8 text-sm">
                      No leads
                    </div>
                  ) : (
                    columnLeads.map(lead => (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={() => handleDragStart(lead.id)}
                        className={`bg-zinc-900 border border-zinc-800 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-zinc-700 transition-colors ${
                          draggingLead === lead.id ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <a
                              href={`/leads/${lead.id}`}
                              className="font-medium text-zinc-100 hover:text-yellow-400 text-sm truncate block"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {lead.owner_name || 'Unknown'}
                            </a>
                          </div>
                          {lead.is_golden && (
                            <span className="text-yellow-400 flex-shrink-0" title="Golden Lead">
                              ⭐
                            </span>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="text-lg font-bold text-green-400 mt-1">
                          {formatCurrency(lead.excess_funds_amount)}
                        </div>

                        {/* Property */}
                        <div className="text-xs text-zinc-400 mt-1 truncate">
                          {lead.property_address}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {lead.city}, {lead.county}
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800">
                          {/* Score */}
                          <div className="flex items-center gap-1">
                            <div className={`w-2 h-2 rounded-full ${getScoreColor(lead.eleanor_score || 0)}`} />
                            <span className="text-xs text-zinc-400">
                              {lead.eleanor_score || 0}
                            </span>
                          </div>

                          {/* Last Contact */}
                          {lead.last_contact_at && (
                            <span className="text-xs text-zinc-500">
                              {getRelativeTime(lead.last_contact_at)}
                            </span>
                          )}

                          {/* Actions */}
                          <div className="flex gap-1">
                            <button
                              className="text-zinc-500 hover:text-zinc-300 text-xs"
                              onClick={(e) => {
                                e.stopPropagation()
                                window.location.href = `/dashboard/messages?lead=${lead.id}`
                              }}
                              title="Messages"
                            >
                              💬
                            </button>
                            {(lead.phone || lead.phone_1 || lead.phone_2) && (
                              <a
                                href={`tel:${lead.phone || lead.phone_1 || lead.phone_2}`}
                                className="text-zinc-500 hover:text-zinc-300 text-xs"
                                onClick={(e) => e.stopPropagation()}
                                title="Call"
                              >
                                📞
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
