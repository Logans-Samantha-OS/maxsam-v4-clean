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

type LeadRow = {
  id: string
  owner_name: string
  phone: string
  phone_1: string | null
  phone_2: string | null
  excess_funds_amount: number
  case_number: string
  property_address: string
  status: string
  eleanor_score: number | null
  eleanor_grade: string | null
  agreement_status: string | null // derived from packets
}

type ActiveTab = 'leads' | 'agreements'

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

function formatCurrency(amount: number): string {
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
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
  const [activeTab, setActiveTab] = useState<ActiveTab>('leads')
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [packets, setPackets] = useState<AgreementPacket[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedPacket, setSelectedPacket] = useState<AgreementPacket | null>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3000)
  }

  // Load ALL leads with excess_funds_amount > 0, sorted by amount desc
  const loadLeads = useCallback(async () => {
    try {
      const response = await fetch('/api/leads?minAmount=1&sortBy=excess_funds_amount&sortOrder=desc&limit=500')
      const body = await response.json()
      if (body.leads) {
        setLeads(body.leads.map((l: Record<string, unknown>) => ({
          id: String(l.id),
          owner_name: String(l.owner_name || 'Unknown'),
          phone: String(l.phone || l.phone_1 || ''),
          phone_1: l.phone_1 ? String(l.phone_1) : null,
          phone_2: l.phone_2 ? String(l.phone_2) : null,
          excess_funds_amount: Number(l.excess_funds_amount || l.excess_amount || 0),
          case_number: String(l.case_number || ''),
          property_address: String(l.property_address || ''),
          status: String(l.status || 'new'),
          eleanor_score: l.eleanor_score ? Number(l.eleanor_score) : null,
          eleanor_grade: l.eleanor_grade ? String(l.eleanor_grade) : null,
          agreement_status: null,
        })))
      }
    } catch (err) {
      console.error('Failed to load leads:', err)
    }
  }, [])

  const loadPackets = useCallback(async () => {
    try {
      const response = await fetch('/api/agreements?limit=200')
      const body = await response.json()
      if (body.success) setPackets(body.packets || [])
    } catch (err) {
      console.error('Failed to load agreements:', err)
    }
  }, [])

  useEffect(() => {
    Promise.all([loadLeads(), loadPackets()]).finally(() => setLoading(false))
    const interval = setInterval(() => { loadLeads(); loadPackets() }, 30000)
    return () => clearInterval(interval)
  }, [loadLeads, loadPackets])

  // Derive agreement status for each lead from packets
  const leadsWithAgreementStatus = leads.map((lead) => {
    const leadPackets = packets.filter((p) => p.lead_id === lead.id)
    if (leadPackets.length === 0) return { ...lead, agreement_status: null }
    // Get the most recent packet's status
    const latestPacket = leadPackets.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    return { ...lead, agreement_status: latestPacket.status }
  })

  // Pipeline counts for leads
  const pipelineCounts = {
    total: leadsWithAgreementStatus.length,
    no_agreement: leadsWithAgreementStatus.filter((l) => !l.agreement_status).length,
    draft: leadsWithAgreementStatus.filter((l) => l.agreement_status === 'draft').length,
    sent: leadsWithAgreementStatus.filter((l) => l.agreement_status === 'sent').length,
    viewed: leadsWithAgreementStatus.filter((l) => l.agreement_status === 'viewed').length,
    signed: leadsWithAgreementStatus.filter((l) => l.agreement_status === 'signed').length,
  }

  // Filter leads
  const filteredLeads = leadsWithAgreementStatus.filter((lead) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      lead.owner_name.toLowerCase().includes(q) ||
      lead.phone.includes(q) ||
      lead.case_number.toLowerCase().includes(q) ||
      lead.property_address.toLowerCase().includes(q)
    )
  })

  // Filter packets
  const filteredPackets = packets.filter((p) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      p.client_name?.toLowerCase().includes(q) ||
      p.client_phone?.includes(q) ||
      p.lead_id?.includes(q)
    )
  })

  // Generate Agreement (PDF only, no send)
  const handleGenerate = async (leadId: string) => {
    setActionLoading(`generate-${leadId}`)
    try {
      const response = await fetch('/api/send-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, action: 'generate' }),
      })
      const body = await response.json()
      if (body.success) {
        showToast('Agreement generated', 'success')
        await loadPackets()
      } else {
        showToast(body.error || 'Failed to generate', 'error')
      }
    } catch {
      showToast('Failed to generate agreement', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Generate + Send Agreement
  const handleGenerateAndSend = async (leadId: string) => {
    setActionLoading(`send-${leadId}`)
    try {
      const response = await fetch('/api/send-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId, action: 'generate_and_send' }),
      })
      const body = await response.json()
      if (body.success) {
        showToast('Agreement generated and sent', 'success')
        await loadPackets()
      } else {
        showToast(body.error || 'Failed to send', 'error')
      }
    } catch {
      showToast('Failed to send agreement', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // Packet actions (resend/void)
  const handlePacketAction = async (packetId: string, action: 'resend' | 'void') => {
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
    <div className="h-[calc(100vh-120px)] flex flex-col rounded-lg overflow-hidden border relative" style={{ background: '#0d0f14', borderColor: '#1a1d28' }}>
      {/* Toast */}
      {toast && (
        <div
          className="absolute top-3 right-3 z-50 px-4 py-2 rounded-lg text-sm font-medium shadow-lg"
          style={{
            background: toast.type === 'success' ? '#065f46' : '#7f1d1d',
            color: toast.type === 'success' ? '#6ee7b7' : '#fca5a5',
            border: `1px solid ${toast.type === 'success' ? '#10b981' : '#ef4444'}`,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
        <h1 className="text-lg font-semibold" style={{ color: '#ffd700' }}>Agreement Center</h1>

        {/* Tab Switcher */}
        <div className="flex gap-1 ml-4">
          <button
            onClick={() => setActiveTab('leads')}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              background: activeTab === 'leads' ? '#ffd70020' : '#151820',
              color: activeTab === 'leads' ? '#ffd700' : '#6b7280',
              border: `1px solid ${activeTab === 'leads' ? '#ffd70040' : '#1a1d28'}`,
            }}
          >
            Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveTab('agreements')}
            className="text-xs px-3 py-1.5 rounded transition-colors"
            style={{
              background: activeTab === 'agreements' ? '#ffd70020' : '#151820',
              color: activeTab === 'agreements' ? '#ffd700' : '#6b7280',
              border: `1px solid ${activeTab === 'agreements' ? '#ffd70040' : '#1a1d28'}`,
            }}
          >
            Agreements ({packets.length})
          </button>
        </div>

        <div className="ml-auto">
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, case..."
            className="rounded px-3 py-1.5 text-xs focus:outline-none"
            style={{ background: '#151820', border: '1px solid #1a1d28', color: '#e0e0e8', width: '240px' }}
          />
        </div>
      </div>

      {/* Pipeline Status Bar */}
      <div className="flex items-center gap-1 px-5 py-2.5 border-b overflow-x-auto" style={{ background: '#0a0c10', borderColor: '#1a1d28' }}>
        {STATUS_PIPELINE.filter((s) => s.key !== 'voided').map((stage) => {
          const count = stage.key === 'draft'
            ? pipelineCounts.no_agreement
            : pipelineCounts[stage.key as keyof typeof pipelineCounts] || 0
          const label = stage.key === 'draft' ? 'No Agreement' : stage.label
          return (
            <div key={stage.key} className="flex items-center gap-1.5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded" style={{ background: stage.color + '15' }}>
                <span className="w-2 h-2 rounded-full" style={{ background: stage.color }} />
                <span className="text-xs" style={{ color: stage.color }}>{label}</span>
                <span className="text-xs font-bold" style={{ color: stage.color }}>{count}</span>
              </div>
              {stage.key !== 'signed' && (
                <span className="text-zinc-600 text-xs mx-1">&rarr;</span>
              )}
            </div>
          )
        })}
        <div className="ml-auto text-xs" style={{ color: '#a0a0b0' }}>
          Pipeline: {formatCurrency(leads.reduce((sum, l) => sum + (l.excess_funds_amount * 0.25), 0))} (25% fee)
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'leads' ? (
            /* ─── LEADS TAB ──────────────────────────────── */
            filteredLeads.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-3">📋</div>
                  <p className="text-sm" style={{ color: '#6b7280' }}>No leads with excess funds found</p>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: '#0d0f14' }}>
                  <tr className="border-b" style={{ borderColor: '#1a1d28' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Owner</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Excess Funds</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Property</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Score</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Agreement</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLeads.map((lead) => {
                    const agmtStatus = lead.agreement_status
                    const statusInfo = agmtStatus
                      ? STATUS_PIPELINE.find((s) => s.key === agmtStatus) || { label: agmtStatus, color: '#6b7280' }
                      : null
                    return (
                      <tr key={lead.id} className="border-b transition-colors hover:bg-[#151820]" style={{ borderColor: '#1a1d28' }}>
                        <td className="px-4 py-3">
                          <div className="font-medium" style={{ color: '#e0e0e8' }}>{lead.owner_name}</div>
                          <div className="text-[11px]" style={{ color: '#6b7280' }}>
                            {formatPhone(lead.phone)} {lead.case_number && `| Case ${lead.case_number}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-sm" style={{ color: '#ffd700' }}>
                            {formatCurrency(lead.excess_funds_amount)}
                          </span>
                          <div className="text-[10px]" style={{ color: '#6b7280' }}>
                            Fee: {formatCurrency(lead.excess_funds_amount * 0.25)}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-xs truncate max-w-[200px]" style={{ color: '#a0a0b0' }}>
                            {lead.property_address || 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {lead.eleanor_score != null ? (
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs" style={{ color: '#a0a0b0' }}>{lead.eleanor_score}</span>
                              {lead.eleanor_grade && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{
                                  background: lead.eleanor_grade.startsWith('A') ? '#ffd70020' : lead.eleanor_grade === 'B' ? '#10b98120' : '#6b728020',
                                  color: lead.eleanor_grade.startsWith('A') ? '#ffd700' : lead.eleanor_grade === 'B' ? '#10b981' : '#6b7280',
                                }}>
                                  {lead.eleanor_grade}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: '#4a4a5a' }}>&mdash;</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {statusInfo ? (
                            <div className="flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full" style={{ background: statusInfo.color }} />
                              <span className="text-xs" style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: '#4a4a5a' }}>None</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1.5 justify-end">
                            <button
                              onClick={() => handleGenerate(lead.id)}
                              disabled={actionLoading === `generate-${lead.id}`}
                              className="text-[11px] px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
                              style={{ background: '#6b728015', color: '#a0a0b0', border: '1px solid #6b728030' }}
                            >
                              {actionLoading === `generate-${lead.id}` ? '...' : 'Generate'}
                            </button>
                            <button
                              onClick={() => handleGenerateAndSend(lead.id)}
                              disabled={actionLoading === `send-${lead.id}`}
                              className="text-[11px] px-2.5 py-1.5 rounded transition-colors disabled:opacity-50"
                              style={{ background: '#ffd70015', color: '#ffd700', border: '1px solid #ffd70030' }}
                            >
                              {actionLoading === `send-${lead.id}` ? '...' : 'Send Agreement'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* ─── AGREEMENTS TAB ─────────────────────────── */
            filteredPackets.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-4xl mb-3">📄</div>
                  <p className="text-sm" style={{ color: '#6b7280' }}>No agreements yet</p>
                  <p className="text-xs mt-1" style={{ color: '#4a4a5a' }}>
                    Switch to the Leads tab to generate agreements
                  </p>
                </div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0" style={{ background: '#0d0f14' }}>
                  <tr className="border-b" style={{ borderColor: '#1a1d28' }}>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Client</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Type</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Status</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Sent</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider" style={{ color: '#6b7280' }}>Signed</th>
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
                        <td className="px-4 py-3 text-right">
                          <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                            {['sent', 'viewed'].includes(packet.status) && (
                              <button
                                onClick={() => handlePacketAction(packet.id, 'resend')}
                                disabled={actionLoading === `${packet.id}-resend`}
                                className="text-[11px] px-2 py-1 rounded transition-colors disabled:opacity-50"
                                style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
                              >
                                {actionLoading === `${packet.id}-resend` ? '...' : 'Resend'}
                              </button>
                            )}
                            {!['signed', 'voided'].includes(packet.status) && (
                              <button
                                onClick={() => handlePacketAction(packet.id, 'void')}
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
            )
          )}
        </div>

        {/* Detail Panel */}
        {selectedPacket && activeTab === 'agreements' && (
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
