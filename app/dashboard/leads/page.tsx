'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Lead {
  id: string
  owner_name: string
  phone: string | null
  phone_1: string | null
  phone_2: string | null
  property_address: string
  city: string
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

type SortField = 'owner_name' | 'excess_funds_amount' | 'eleanor_score' | 'created_at' | 'last_contact_at'
type SortOrder = 'asc' | 'desc'

export default function LeadsDashboardPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set())

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
      setLeads(data.leads || [])
      setTotalPages(data.totalPages || 1)
      setTotal(data.total || 0)
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

  const toggleSelectAll = () => {
    if (selectedLeads.size === leads.length) {
      setSelectedLeads(new Set())
    } else {
      setSelectedLeads(new Set(leads.map(l => l.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedLeads)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedLeads(newSelected)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0)
  }

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

  const getPhone = (lead: Lead) => {
    return lead.phone || lead.phone_1 || lead.phone_2
  }

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-400'
    if (score >= 50) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getStatusBadge = (status: string | null) => {
    const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      new: { label: 'New', variant: 'secondary' },
      contacted: { label: 'Contacted', variant: 'outline' },
      agreement_sent: { label: 'Agreement Sent', variant: 'default' },
      signed: { label: 'Signed', variant: 'default' },
      opted_out: { label: 'Opted Out', variant: 'destructive' },
    }

    const config = statusConfig[status || 'new'] || { label: status || 'New', variant: 'secondary' as const }
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never'
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays} days ago`
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
    return `${Math.floor(diffDays / 30)} months ago`
  }

  const handleSendSMS = async (leadId: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!res.ok) throw new Error('Failed to send SMS')
      fetchLeads()
    } catch (err) {
      console.error('Send SMS error:', err)
    }
  }

  // Filter leads by lead class on client side (since API may not support it yet)
  const filteredLeads = leads.filter(lead => {
    if (leadClassFilter === 'golden') return lead.is_golden
    if (leadClassFilter === 'B') return !lead.is_golden
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Leads Dashboard</h1>
          <p className="text-sm text-zinc-400">
            {total} total leads {selectedLeads.size > 0 && `(${selectedLeads.size} selected)`}
          </p>
        </div>
        <div className="flex gap-2">
          {selectedLeads.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => setSelectedLeads(new Set())}>
                Clear Selection
              </Button>
              <Button variant="default" size="sm">
                Send Campaign ({selectedLeads.size})
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={fetchLeads}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
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
            <option value="golden">Golden Only</option>
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
              className="w-4 h-4 rounded bg-zinc-950 border-zinc-700"
            />
            <span className="text-sm text-zinc-300">Has Phone</span>
          </label>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="p-4 bg-red-950 border border-red-800 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-zinc-800 hover:bg-zinc-900">
              <TableHead className="w-10">
                <input
                  type="checkbox"
                  checked={selectedLeads.size === leads.length && leads.length > 0}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded bg-zinc-950 border-zinc-700"
                />
              </TableHead>
              <TableHead
                className="cursor-pointer hover:text-zinc-100"
                onClick={() => handleSort('owner_name')}
              >
                Name {sortBy === 'owner_name' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Property</TableHead>
              <TableHead
                className="cursor-pointer hover:text-zinc-100 text-right"
                onClick={() => handleSort('excess_funds_amount')}
              >
                Amount {sortBy === 'excess_funds_amount' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-center">Class</TableHead>
              <TableHead
                className="cursor-pointer hover:text-zinc-100 text-center"
                onClick={() => handleSort('eleanor_score')}
              >
                Score {sortBy === 'eleanor_score' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead>Status</TableHead>
              <TableHead
                className="cursor-pointer hover:text-zinc-100"
                onClick={() => handleSort('last_contact_at')}
              >
                Last Contact {sortBy === 'last_contact_at' && (sortOrder === 'asc' ? '↑' : '↓')}
              </TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-zinc-400">
                  Loading leads...
                </TableCell>
              </TableRow>
            ) : filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-8 text-zinc-400">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow
                  key={lead.id}
                  className="border-zinc-800 hover:bg-zinc-800/50"
                >
                  <TableCell>
                    <input
                      type="checkbox"
                      checked={selectedLeads.has(lead.id)}
                      onChange={() => toggleSelect(lead.id)}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-700"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-zinc-100">
                    <a
                      href={`/leads/${lead.id}`}
                      className="hover:text-yellow-400 hover:underline"
                    >
                      {lead.owner_name || 'Unknown'}
                    </a>
                  </TableCell>
                  <TableCell>
                    {getPhone(lead) ? (
                      <a
                        href={`tel:${getPhone(lead)}`}
                        className="text-zinc-300 hover:text-yellow-400"
                      >
                        {formatPhone(getPhone(lead))}
                      </a>
                    ) : (
                      <span className="text-zinc-500">No phone</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-zinc-300">
                    <div>{lead.property_address}</div>
                    <div className="text-xs text-zinc-500">
                      {lead.city}, {lead.county} County
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-zinc-100">
                    {formatCurrency(lead.excess_funds_amount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {lead.is_golden ? (
                      <span className="text-yellow-400 text-lg" title="Golden Lead">
                        ⭐
                      </span>
                    ) : (
                      <span className="text-zinc-500 text-sm">B</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`font-bold ${getScoreColor(lead.eleanor_score || 0)}`}>
                      {lead.eleanor_score || 0}
                    </span>
                    {lead.deal_grade && (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({lead.deal_grade})
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(lead.status)}
                  </TableCell>
                  <TableCell className="text-zinc-400 text-sm">
                    {getRelativeTime(lead.last_contact_at)}
                    {lead.contact_attempts > 0 && (
                      <span className="ml-1 text-xs text-zinc-500">
                        ({lead.contact_attempts}x)
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.location.href = `/dashboard/messages?lead=${lead.id}`}
                        title="View Messages"
                      >
                        💬
                      </Button>
                      {getPhone(lead) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendSMS(lead.id)}
                          title="Send SMS"
                        >
                          📱
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.location.href = `/api/leads/${lead.id}/agreement`}
                        title="Send Agreement"
                      >
                        📄
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
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
              Previous
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
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
