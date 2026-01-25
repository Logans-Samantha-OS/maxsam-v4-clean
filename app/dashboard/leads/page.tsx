'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ============================================================================
// TYPES
// ============================================================================

interface Lead {
  id: string
  owner_name: string
  phone: string | null
  phone_1: string | null
  phone_2: string | null
  property_address: string
  property_city: string | null
  city: string | null
  county: string
  state: string
  excess_funds_amount: number
  eleanor_score: number
  deal_grade: string
  is_golden: boolean
  lead_class: string
  status: string
  last_contact_at: string | null
  contact_attempts: number
  created_at: string
}

type SortField = 'owner_name' | 'excess_funds_amount' | 'eleanor_score' | 'created_at' | 'last_contact_at' | 'status'
type SortOrder = 'asc' | 'desc'

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

function StatsCard({
  label,
  value,
  subValue,
  color = 'cyan',
  icon,
}: {
  label: string
  value: string | number
  subValue?: string
  color?: string
  icon?: React.ReactNode
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    orange: 'from-orange-500/20 to-orange-600/10 border-orange-500/30',
  }

  const textColors: Record<string, string> = {
    cyan: 'text-cyan-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
  }

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 text-sm">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
    </div>
  )
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    contacted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    agreement_sent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    signed: 'bg-green-500/20 text-green-400 border-green-500/30',
    opted_out: 'bg-red-500/20 text-red-400 border-red-500/30',
    enriched: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    qualified: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    unknown: 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30',
  }

  const icons: Record<string, string> = {
    new: '🆕',
    contacted: '📞',
    agreement_sent: '📄',
    signed: '✅',
    opted_out: '🚫',
    enriched: '✨',
    qualified: '⭐',
    pending: '⏳',
    unknown: '❓',
  }

  const normalizedStatus = status?.toLowerCase().replace(/ /g, '_') || 'unknown'

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${colors[normalizedStatus] || colors.unknown}`}>
      {icons[normalizedStatus] || icons.unknown} {status || 'Unknown'}
    </span>
  )
}

// ============================================================================
// SORTABLE HEADER COMPONENT
// ============================================================================

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
  className = '',
}: {
  label: string
  field: SortField
  currentSort: SortField
  currentDirection: SortOrder
  onSort: (field: SortField) => void
  className?: string
}) {
  const isActive = currentSort === field

  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase cursor-pointer hover:text-zinc-200 transition-colors select-none ${className}`}
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-30'}`}>
          {isActive && currentDirection === 'asc' ? '↑' : '↓'}
        </span>
      </div>
    </th>
  )
}

// ============================================================================
// BULK ACTION BAR COMPONENT
// ============================================================================

function BulkActionBar({
  selectedCount,
  onSendSMS,
  onSendAgreement,
  onClearSelection,
  loading,
}: {
  selectedCount: number
  onSendSMS: () => void
  onSendAgreement: () => void
  onClearSelection: () => void
  loading: boolean
}) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
        <span className="text-white font-medium">
          {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="h-6 w-px bg-zinc-700" />
        <button
          onClick={onSendSMS}
          disabled={loading}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            '💬'
          )}
          Send SMS
        </button>
        <button
          onClick={onSendAgreement}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            '📄'
          )}
          Send Agreement
        </button>
        <div className="h-6 w-px bg-zinc-700" />
        <button
          onClick={onClearSelection}
          className="px-3 py-2 text-zinc-400 hover:text-white transition-colors"
        >
          ✕ Clear
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// LEAD ROW COMPONENT
// ============================================================================

function LeadRow({
  lead,
  isChecked,
  onCheck,
  onSendSMS,
  onViewMessages,
  onSendAgreement,
  actionLoading,
}: {
  lead: Lead
  isChecked: boolean
  onCheck: (leadId: string, checked: boolean) => void
  onSendSMS: (leadId: string) => void
  onViewMessages: (leadId: string) => void
  onSendAgreement: (leadId: string) => void
  actionLoading: string | null
}) {
  const getPhone = () => lead.phone || lead.phone_1 || lead.phone_2
  const isLoading = actionLoading === lead.id

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    if (cleaned.length === 11) {
      return `+${cleaned[0]} (${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`
    }
    return phone
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`
    return `${Math.floor(diffDays / 30)}mo ago`
  }

  return (
    <tr className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${lead.is_golden ? 'bg-yellow-500/5' : ''}`}>
      {/* Checkbox */}
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onCheck(lead.id, e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-zinc-900 cursor-pointer"
        />
      </td>
      {/* Name */}
      <td className="px-4 py-3">
        <a
          href={`/leads/${lead.id}`}
          className="font-medium text-white hover:text-yellow-400 hover:underline"
        >
          {lead.owner_name || 'Unknown'}
        </a>
        {lead.is_golden && (
          <span className="ml-2 text-yellow-400" title="Golden Lead">⭐</span>
        )}
      </td>
      {/* Phone */}
      <td className="px-4 py-3">
        {getPhone() ? (
          <a
            href={`tel:${getPhone()}`}
            className="text-cyan-400 hover:text-cyan-300 hover:underline"
          >
            {formatPhone(getPhone())}
          </a>
        ) : (
          <span className="text-zinc-600">No phone</span>
        )}
      </td>
      {/* Property */}
      <td className="px-4 py-3 max-w-xs">
        <div className="text-zinc-300 truncate">{lead.property_address}</div>
        <div className="text-xs text-zinc-500">
          {lead.property_city || lead.city}, {lead.county} County
        </div>
      </td>
      {/* Amount */}
      <td className="px-4 py-3 text-right">
        <span className={`font-mono font-semibold ${(lead.excess_funds_amount || 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
          ${(lead.excess_funds_amount || 0).toLocaleString()}
        </span>
      </td>
      {/* Score */}
      <td className="px-4 py-3 text-center">
        <span className={`font-bold ${getScoreColor(lead.eleanor_score || 0)}`}>
          {lead.eleanor_score || 0}
        </span>
        {lead.deal_grade && (
          <span className="ml-1 text-xs text-zinc-500">
            ({lead.deal_grade})
          </span>
        )}
      </td>
      {/* Status */}
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>
      {/* Last Contact */}
      <td className="px-4 py-3 text-zinc-400 text-sm">
        {getRelativeTime(lead.last_contact_at)}
        {lead.contact_attempts > 0 && (
          <span className="ml-1 text-xs text-zinc-500">
            ({lead.contact_attempts}x)
          </span>
        )}
      </td>
      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onViewMessages(lead.id)}
            className="px-2 py-1 text-xs bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 rounded border border-zinc-500/30 transition-colors"
            title="View Messages"
          >
            💬
          </button>
          <button
            onClick={() => onSendSMS(lead.id)}
            disabled={isLoading || !getPhone()}
            className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={getPhone() ? 'Send SMS' : 'No phone number'}
          >
            {isLoading ? '...' : '📱'}
          </button>
          <button
            onClick={() => onSendAgreement(lead.id)}
            disabled={isLoading}
            className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send Agreement"
          >
            {isLoading ? '...' : '📄'}
          </button>
          <a
            href={`/leads/${lead.id}`}
            className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded border border-yellow-500/30 transition-colors"
            title="View Details"
          >
            👁️
          </a>
        </div>
      </td>
    </tr>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LeadsDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [bulkLoading, setBulkLoading] = useState(false)

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    withPhone: 0,
    highScore: 0,
    totalValue: 0,
    potentialFee: 0,
  })

  // Filters
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [leadClassFilter, setLeadClassFilter] = useState('all')
  const [hasPhoneFilter, setHasPhoneFilter] = useState(false)
  const [minAmount, setMinAmount] = useState(0)
  const [minScore, setMinScore] = useState(0)

  // Sorting
  const [sortBy, setSortBy] = useState<SortField>('eleanor_score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  // Selected leads for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        sortBy,
        sortOrder,
      })

      if (search) params.append('search', search)
      if (statusFilter !== 'all') params.append('status', statusFilter)
      if (hasPhoneFilter) params.append('hasPhone', 'true')
      if (minAmount > 0) params.append('minAmount', minAmount.toString())
      if (minScore > 0) params.append('minScore', minScore.toString())

      const res = await fetch(`/api/leads?${params}`)
      if (!res.ok) throw new Error('Failed to fetch leads')

      const data = await res.json()
      const fetchedLeads = data.leads || []
      setLeads(fetchedLeads)
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)

      // Calculate stats from leads
      const withPhone = fetchedLeads.filter((l: Lead) => l.phone || l.phone_1 || l.phone_2).length
      const highScore = fetchedLeads.filter((l: Lead) => (l.eleanor_score || 0) >= 80).length
      const totalValue = fetchedLeads.reduce((sum: number, l: Lead) => sum + (l.excess_funds_amount || 0), 0)

      setStats({
        total: data.total || fetchedLeads.length,
        withPhone,
        highScore,
        totalValue,
        potentialFee: totalValue * 0.25,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch leads')
    } finally {
      setLoading(false)
    }
  }, [page, sortBy, sortOrder, search, statusFilter, hasPhoneFilter, minAmount, minScore])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  const handleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
    setPage(1)
  }

  const handleCheck = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds)
    if (checked) {
      newSelected.add(leadId)
    } else {
      newSelected.delete(leadId)
    }
    setSelectedIds(newSelected)
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredLeads.map(l => l.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSendSMS = async (leadId: string) => {
    setActionLoading(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to send SMS')
      fetchLeads()
    } catch (err) {
      console.error('Send SMS error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleViewMessages = (leadId: string) => {
    window.location.href = `/dashboard/messages?lead=${leadId}`
  }

  const handleSendAgreement = async (leadId: string) => {
    setActionLoading(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-contract' }),
      })
      if (!res.ok) throw new Error('Failed to send agreement')
      fetchLeads()
    } catch (err) {
      console.error('Send agreement error:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const bulkSendSMS = async () => {
    setBulkLoading(true)
    const ids = Array.from(selectedIds)

    for (const id of ids) {
      try {
        await fetch(`/api/leads/${id}/sms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      } catch (err) {
        console.error('Bulk SMS error:', err)
      }
    }

    setSelectedIds(new Set())
    setBulkLoading(false)
    await fetchLeads()
  }

  const bulkSendAgreement = async () => {
    setBulkLoading(true)
    const ids = Array.from(selectedIds)

    for (const id of ids) {
      try {
        await fetch(`/api/leads/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-contract' }),
        })
      } catch (err) {
        console.error('Bulk agreement error:', err)
      }
    }

    setSelectedIds(new Set())
    setBulkLoading(false)
    await fetchLeads()
  }

  // Filter leads by lead class on client side
  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (leadClassFilter === 'golden') return lead.is_golden
      if (leadClassFilter === 'B') return !lead.is_golden
      return true
    })
  }, [leads, leadClassFilter])

  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredLeads.length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-cyan-500">📊</span> Leads Dashboard
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            {total} total leads • Manage and track all leads
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads}>
          🔄 Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-5 gap-4">
        <StatsCard
          label="Total Leads"
          value={stats.total}
          subValue="All imported leads"
          color="cyan"
          icon="📋"
        />
        <StatsCard
          label="With Phone"
          value={stats.withPhone}
          subValue="Ready for outreach"
          color="green"
          icon="📱"
        />
        <StatsCard
          label="High Score (80+)"
          value={stats.highScore}
          subValue="Top prospects"
          color="yellow"
          icon="⭐"
        />
        <StatsCard
          label="Total Value"
          value={`$${(stats.totalValue / 1000).toFixed(0)}K`}
          subValue="Excess funds available"
          color="purple"
          icon="💰"
        />
        <StatsCard
          label="Potential Fee (25%)"
          value={`$${(stats.potentialFee / 1000).toFixed(0)}K`}
          subValue="Revenue opportunity"
          color="orange"
          icon="💵"
        />
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800">
        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Search</label>
          <Input
            placeholder="Name, phone, address..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="bg-zinc-950 border-zinc-700"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
            className="w-full h-9 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100"
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="agreement_sent">Agreement Sent</option>
            <option value="signed">Signed</option>
            <option value="opted_out">Opted Out</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Lead Class</label>
          <select
            value={leadClassFilter}
            onChange={(e) => setLeadClassFilter(e.target.value)}
            className="w-full h-9 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100"
          >
            <option value="all">All Classes</option>
            <option value="golden">Golden Only ⭐</option>
            <option value="B">Class B Only</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Min Amount</label>
          <Input
            type="number"
            placeholder="0"
            value={minAmount || ''}
            onChange={(e) => {
              setMinAmount(Number(e.target.value) || 0)
              setPage(1)
            }}
            className="bg-zinc-950 border-zinc-700"
          />
        </div>

        <div>
          <label className="text-xs text-zinc-400 mb-1 block">Min Score</label>
          <Input
            type="number"
            placeholder="0"
            value={minScore || ''}
            onChange={(e) => {
              setMinScore(Number(e.target.value) || 0)
              setPage(1)
            }}
            className="bg-zinc-950 border-zinc-700"
          />
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasPhoneFilter}
              onChange={(e) => {
                setHasPhoneFilter(e.target.checked)
                setPage(1)
              }}
              className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-yellow-500"
            />
            <span className="text-sm text-zinc-300">Has Phone</span>
          </label>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-zinc-900 cursor-pointer"
                />
              </th>
              <SortableHeader label="Name" field="owner_name" currentSort={sortBy} currentDirection={sortOrder} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Property</th>
              <SortableHeader label="Amount" field="excess_funds_amount" currentSort={sortBy} currentDirection={sortOrder} onSort={handleSort} className="text-right" />
              <SortableHeader label="Score" field="eleanor_score" currentSort={sortBy} currentDirection={sortOrder} onSort={handleSort} className="text-center" />
              <SortableHeader label="Status" field="status" currentSort={sortBy} currentDirection={sortOrder} onSort={handleSort} />
              <SortableHeader label="Last Contact" field="last_contact_at" currentSort={sortBy} currentDirection={sortOrder} onSort={handleSort} />
              <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
                    <span className="text-zinc-400">Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
                  No leads found matching your criteria
                </td>
              </tr>
            ) : (
              filteredLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  isChecked={selectedIds.has(lead.id)}
                  onCheck={handleCheck}
                  onSendSMS={handleSendSMS}
                  onViewMessages={handleViewMessages}
                  onSendAgreement={handleSendAgreement}
                  actionLoading={actionLoading}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Showing {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} of {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              ← Previous
            </Button>
            <span className="flex items-center px-3 text-sm text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next →
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onSendSMS={bulkSendSMS}
        onSendAgreement={bulkSendAgreement}
        onClearSelection={() => setSelectedIds(new Set())}
        loading={bulkLoading}
      />
    </div>
  )
}
