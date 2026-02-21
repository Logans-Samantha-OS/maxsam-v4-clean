'use client'

import { useEffect, useState, useCallback } from 'react'

type AgreementPacket = {
  id: string
  lead_id: string | null
  selection_code: number
  status: string
  signing_link: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  triggered_by: string | null
  sent_at: string | null
  signed_at: string | null
  created_at: string
}

type LeadOption = {
  id: string
  owner_name: string
  phone: string
  excess_funds_amount: number
  case_number: string
  status: string
}

const STATUS_PIPELINE: { key: string; label: string; color: string }[] = [
  { key: 'draft', label: 'Draft', color: '#6b7280' },
  { key: 'sent', label: 'Sent', color: '#3b82f6' },
  { key: 'viewed', label: 'Viewed', color: '#f59e0b' },
  { key: 'signed', label: 'Signed', color: '#22c55e' },
  { key: 'voided', label: 'Voided', color: '#ef4444' },
]

const SELECTION_LABELS: Record<number, string> = {
  1: 'Excess Funds',
  2: 'Wholesale',
  3: 'Full Recovery',
}

function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone || 'N/A'
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'N/A'
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function AgreementCenter() {
  const [packets, setPackets] = useState<AgreementPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Create modal state
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [selectionCode, setSelectionCode] = useState(1)
  const [creating, setCreating] = useState(false)
  const [leadSearch, setLeadSearch] = useState('')

  // Action state
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Detail panel
  const [selectedPacket, setSelectedPacket] = useState<AgreementPacket | null>(null)

  const loadPackets = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' })
      if (filterStatus !== 'all') params.set('status', filterStatus)
      const response = await fetch(`/api/agreements?${params}`)
      const body = await response.json()
      if (body.success) setPackets(body.packets || [])
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    loadPackets()
    const interval = setInterval(loadPackets, 30000)
    return () => clearInterval(interval)
  }, [loadPackets])

  const loadLeads = async () => {
    setLeadsLoading(true)
    try {
      const response = await fetch('/api/leads?minAmount=1&sortBy=excess_funds_amount&sortOrder=desc&limit=50')
      const body = await response.json()
      if (body.leads) {
        setLeads(body.leads.map((l: Record<string, unknown>) => ({
          id: String(l.id),
          owner_name: String(l.owner_name || 'Unknown'),
          phone: String(l.phone || l.phone_1 || ''),
          excess_funds_amount: Number(l.excess_funds_amount || l.excess_amount || 0),
          case_number: String(l.case_number || ''),
          status: String(l.status || ''),
        })))
      }
    } finally {
      setLeadsLoading(false)
    }
  }

  const openCreateModal = () => {
    setShowCreateModal(true)
    setSelectedLeadId('')
    setSelectionCode(1)
    loadLeads()
  }

  const createAgreement = async () => {
    if (!selectedLeadId || creating) return
    setCreating(true)
    try {
      const response = await fetch('/api/agreements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          selection_code: selectionCode,
          triggered_by: 'ui',
        }),
      })
      const body = await response.json()
      if (body.success) {
        setShowCreateModal(false)
        await loadPackets()
      }
    } finally {
      setCreating(false)
    }
  }

  const handleAction = async (packetId: string, action: 'resend' | 'void') => {
    setActionLoading(`${packetId}-${action}`)
    try {
      await fetch(`/api/agreements/${packetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      await loadPackets()
    } finally {
      setActionLoading(null)
    }
  }

  const statusCounts = STATUS_PIPELINE.map((stage) => ({
    ...stage,
    count: packets.filter((p) => p.status === stage.key).length,
  }))

  const filteredPackets = searchQuery.trim()
    ? packets.filter((p) => {
        const q = searchQuery.toLowerCase()
        return (
          p.client_name?.toLowerCase().includes(q) ||
          p.client_phone?.includes(q) ||
          p.lead_id?.includes(q)
        )
      })
    : packets

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-120px)]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-3" style={{ borderColor: '#ffd700', borderTopColor: 'transparent' }} />
          <p style={{ color: '#a0a0b0' }}>Loading agreements...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col rounded-lg overflow-hidden border" style={{ background: '#0d0f14', borderColor: '#1a1d28' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
        <h1 className="text-lg font-semibold" style={{ color: '#ffd700' }}>Agreement Center</h1>
        <button
          onClick={openCreateModal}
          className="ml-auto px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{ background: '#ffd700', color: '#0a0c10' }}
        >
          + New Agreement
        </button>
      </div>

      {/* Pipeline Status Bar */}
      <div className="flex items-center gap-1 px-5 py-3 border-b" style={{ background: '#0a0c10', borderColor: '#1a1d28' }}>
        <button
          onClick={() => setFilterStatus('all')}
          className="text-xs px-3 py-1.5 rounded transition-colors"
          style={{
            background: filterStatus === 'all' ? '#ffd70020' : '#151820',
            color: filterStatus === 'all' ? '#ffd700' : '#6b7280',
            border: `1px solid ${filterStatus === 'all' ? '#ffd70040' : '#1a1d28'}`,
          }}
        >
          All ({packets.length})
        </button>
        {statusCounts.map((stage) => (
          <button
            key={stage.key}
            onClick={() => setFilterStatus(stage.key)}
            className="text-xs px-3 py-1.5 rounded transition-colors flex items-center gap-1.5"
            style={{
              background: filterStatus === stage.key ? stage.color + '20' : '#151820',
              color: filterStatus === stage.key ? stage.color : '#6b7280',
              border: `1px solid ${filterStatus === stage.key ? stage.color + '40' : '#1a1d28'}`,
            }}
          >
            <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
            {stage.label} ({stage.count})
          </button>
        ))}
        <div className="ml-auto">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or phone..."
            className="rounded px-3 py-1.5 text-xs focus:outline-none"
            style={{ background: '#151820', border: '1px solid #1a1d28', color: '#e0e0e8', width: '220px' }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredPackets.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm" style={{ color: '#6b7280' }}>
                  {filterStatus !== 'all' ? `No ${filterStatus} agreements` : 'No agreements yet'}
                </p>
                <button
                  onClick={openCreateModal}
                  className="mt-3 text-xs px-3 py-1.5 rounded"
                  style={{ background: '#ffd70015', color: '#ffd700', border: '1px solid #ffd70030' }}
                >
                  Create First Agreement
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#1a1d28' }}>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Client</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Sent</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Signed</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Source</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPackets.map((packet) => {
                  const statusInfo = STATUS_PIPELINE.find((s) => s.key === packet.status) || { label: packet.status, color: '#6b7280' }
                  const isActive = selectedPacket?.id === packet.id
                  return (
                    <tr
                      key={packet.id}
                      onClick={() => setSelectedPacket(isActive ? null : packet)}
                      className="border-b cursor-pointer transition-colors"
                      style={{
                        borderColor: '#1a1d28',
                        background: isActive ? '#151820' : 'transparent',
                      }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: '#e0e0e8' }}>{packet.client_name || 'Unknown'}</div>
                        <div className="text-[11px]" style={{ color: '#6b7280' }}>{formatPhone(packet.client_phone || '')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded" style={{ background: '#ffd70015', color: '#ffd700' }}>
                          {SELECTION_LABELS[packet.selection_code] || `Code ${packet.selection_code}`}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: statusInfo.color }} />
                          <span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#a0a0b0' }}>
                        {timeAgo(packet.sent_at)}
                      </td>
                      <td className="px-4 py-3" style={{ color: packet.signed_at ? '#22c55e' : '#4a4a5a' }}>
                        {packet.signed_at ? timeAgo(packet.signed_at) : '\u2014'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs capitalize" style={{ color: '#6b7280' }}>
                          {packet.triggered_by || 'api'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                          {['sent', 'viewed'].includes(packet.status) && (
                            <button
                              onClick={() => handleAction(packet.id, 'resend')}
                              disabled={actionLoading === `${packet.id}-resend`}
                              className="text-[11px] px-2 py-1 rounded transition-colors disabled:opacity-50"
                              style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
                            >
                              {actionLoading === `${packet.id}-resend` ? '...' : 'Resend'}
                            </button>
                          )}
                          {!['signed', 'voided'].includes(packet.status) && (
                            <button
                              onClick={() => handleAction(packet.id, 'void')}
                              disabled={actionLoading === `${packet.id}-void`}
                              className="text-[11px] px-2 py-1 rounded transition-colors disabled:opacity-50"
                              style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}
                            >
                              {actionLoading === `${packet.id}-void` ? '...' : 'Void'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail Panel */}
        {selectedPacket && (
          <aside className="border-l overflow-y-auto" style={{ width: '300px', borderColor: '#1a1d28', background: '#10131a' }}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffd700' }}>
                  Agreement Details
                </h3>
                <button
                  onClick={() => setSelectedPacket(null)}
                  className="text-xs"
                  style={{ color: '#6b7280' }}
                >
                  Close
                </button>
              </div>

              <div className="space-y-3">
                <DetailRow label="Client" value={selectedPacket.client_name || 'Unknown'} />
                <DetailRow label="Phone" value={formatPhone(selectedPacket.client_phone || '')} />
                <DetailRow label="Email" value={selectedPacket.client_email || 'N/A'} />
                <DetailRow label="Type" value={SELECTION_LABELS[selectedPacket.selection_code] || 'Unknown'} valueColor="#ffd700" />
                <DetailRow
                  label="Status"
                  value={(STATUS_PIPELINE.find((s) => s.key === selectedPacket.status) || { label: selectedPacket.status }).label}
                  valueColor={(STATUS_PIPELINE.find((s) => s.key === selectedPacket.status) || { color: '#6b7280' }).color}
                />
                <DetailRow label="Triggered By" value={selectedPacket.triggered_by || 'api'} />
                <DetailRow label="Created" value={selectedPacket.created_at ? new Date(selectedPacket.created_at).toLocaleString() : 'N/A'} />
                <DetailRow label="Sent" value={selectedPacket.sent_at ? new Date(selectedPacket.sent_at).toLocaleString() : 'Not sent'} />
                <DetailRow
                  label="Signed"
                  value={selectedPacket.signed_at ? new Date(selectedPacket.signed_at).toLocaleString() : 'Not signed'}
                  valueColor={selectedPacket.signed_at ? '#22c55e' : '#6b7280'}
                />
              </div>

              {selectedPacket.signing_link && (
                <div>
                  <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#6b7280' }}>Signing Link</div>
                  <div
                    className="text-xs break-all p-2 rounded"
                    style={{ background: '#0a0c10', color: '#3b82f6', border: '1px solid #1a1d28' }}
                  >
                    {selectedPacket.signing_link}
                  </div>
                </div>
              )}

              {selectedPacket.lead_id && (
                <div className="space-y-2 pt-2">
                  <a
                    href={`/dashboard/leads?id=${selectedPacket.lead_id}`}
                    className="block text-center text-xs py-2 rounded transition-colors"
                    style={{ background: '#ffd70015', color: '#ffd700', border: '1px solid #ffd70030' }}
                  >
                    View Lead Profile
                  </a>
                  <a
                    href={`/dashboard/messages?phone=${selectedPacket.client_phone || ''}`}
                    className="block text-center text-xs py-2 rounded transition-colors"
                    style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
                  >
                    View Messages
                  </a>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Create Agreement Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div
            className="rounded-lg w-full max-w-md border"
            style={{ background: '#10131a', borderColor: '#1a1d28' }}
          >
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#1a1d28' }}>
              <h2 className="font-semibold" style={{ color: '#ffd700' }}>Create Agreement</h2>
              <button onClick={() => setShowCreateModal(false)} style={{ color: '#6b7280' }}>x</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Lead Select */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#a0a0b0' }}>
                  Select Lead
                </label>
                {leadsLoading ? (
                  <div className="text-xs py-2" style={{ color: '#6b7280' }}>Loading leads...</div>
                ) : leads.length === 0 ? (
                  <div className="text-xs py-2" style={{ color: '#6b7280' }}>No leads with excess funds found</div>
                ) : (
                  <>
                    <input
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Search by name or case number..."
                      className="w-full rounded px-3 py-2 text-xs mb-2 focus:outline-none"
                      style={{ background: '#151820', border: '1px solid #1a1d28', color: '#e0e0e8' }}
                    />
                    <select
                      value={selectedLeadId}
                      onChange={(e) => setSelectedLeadId(e.target.value)}
                      className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                      style={{ background: '#0a0c10', border: '1px solid #1a1d28', color: '#e0e0e8' }}
                      size={6}
                    >
                      <option value="">Choose a lead...</option>
                      {leads
                        .filter((lead) => {
                          if (!leadSearch.trim()) return true
                          const q = leadSearch.toLowerCase()
                          return (
                            lead.owner_name.toLowerCase().includes(q) ||
                            lead.case_number.toLowerCase().includes(q) ||
                            lead.phone.includes(q)
                          )
                        })
                        .map((lead) => (
                          <option key={lead.id} value={lead.id}>
                            {lead.owner_name} — ${lead.excess_funds_amount.toLocaleString()} — Case {lead.case_number || 'N/A'}
                          </option>
                        ))}
                    </select>
                  </>
                )}
              </div>

              {/* Agreement Type */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#a0a0b0' }}>
                  Agreement Type
                </label>
                <div className="flex gap-2">
                  {([
                    { code: 1, label: 'Excess Funds' },
                    { code: 2, label: 'Wholesale' },
                    { code: 3, label: 'Full Recovery' },
                  ] as const).map((opt) => (
                    <button
                      key={opt.code}
                      onClick={() => setSelectionCode(opt.code)}
                      className="flex-1 text-xs py-2 rounded transition-colors"
                      style={{
                        background: selectionCode === opt.code ? '#ffd70020' : '#0a0c10',
                        color: selectionCode === opt.code ? '#ffd700' : '#6b7280',
                        border: `1px solid ${selectionCode === opt.code ? '#ffd70040' : '#1a1d28'}`,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end" style={{ borderColor: '#1a1d28' }}>
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: '#151820', color: '#a0a0b0', border: '1px solid #1a1d28' }}
              >
                Cancel
              </button>
              <button
                onClick={createAgreement}
                disabled={!selectedLeadId || creating}
                className="px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40"
                style={{ background: '#ffd700', color: '#0a0c10' }}
              >
                {creating ? 'Creating...' : 'Create & Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: '#6b7280' }}>{label}</div>
      <div className="text-sm" style={{ color: valueColor || '#e0e0e8' }}>{value}</div>
    </div>
  )
}
