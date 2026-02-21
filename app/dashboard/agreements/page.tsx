'use client'

import { useEffect, useState, useCallback } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Agreement = {
  id: string
  lead_id: string | null
  agreement_type: string
  status: string
  pdf_url: string | null
  storage_path: string | null
  client_name: string | null
  client_phone: string | null
  client_email: string | null
  excess_funds_amount: number | null
  fee_percent: number | null
  sent_at: string | null
  signed_at: string | null
  created_at: string
}

type LeadOption = {
  id: string
  owner_name: string
  phone: string
  excess_funds_amount: number
  status: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_PIPELINE = [
  { key: 'draft', label: 'Draft', color: '#6b7280' },
  { key: 'sent', label: 'Sent', color: '#3b82f6' },
  { key: 'viewed', label: 'Viewed', color: '#f59e0b' },
  { key: 'signed', label: 'Signed', color: '#22c55e' },
  { key: 'voided', label: 'Voided', color: '#ef4444' },
]

const TYPE_LABELS: Record<string, string> = {
  excess_funds: 'Excess Funds (25%)',
  wholesale: 'Wholesale (10%)',
}

function formatPhone(phone: string): string {
  const digits = (phone || '').replace(/\D/g, '')
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  if (digits.length === 11) return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  return phone || 'N/A'
}

function formatCurrency(amount: number | null): string {
  if (!amount) return 'N/A'
  return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 0 })
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '--'
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AgreementCenter() {
  // Data
  const [agreements, setAgreements] = useState<Agreement[]>([])
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  // Generate modal
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [leadsLoading, setLeadsLoading] = useState(false)
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [agreementType, setAgreementType] = useState<'excess_funds' | 'wholesale'>('excess_funds')
  const [generating, setGenerating] = useState(false)
  const [generateResult, setGenerateResult] = useState<{ success: boolean; message: string; pdfUrl?: string } | null>(null)

  // Send confirmation dialog
  const [sendConfirm, setSendConfirm] = useState<Agreement | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Detail panel
  const [selectedAgreement, setSelectedAgreement] = useState<Agreement | null>(null)

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // -----------------------------------------------------------------------
  // Data loading
  // -----------------------------------------------------------------------

  const loadAgreements = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '200' })
      if (filterStatus !== 'all') params.set('status', filterStatus)

      // Fetch from agreements API (agreement_packets table)
      const res = await fetch(`/api/agreements?${params}`)
      const body = await res.json()
      if (body.success && body.packets) {
        // Map agreement_packets to our Agreement type
        setAgreements(
          body.packets.map((p: Record<string, unknown>) => ({
            id: String(p.id || ''),
            lead_id: p.lead_id ? String(p.lead_id) : null,
            agreement_type: p.agreement_type
              ? String(p.agreement_type)
              : p.selection_code === 2
                ? 'wholesale'
                : 'excess_funds',
            status: String(p.status || 'draft'),
            pdf_url: p.pdf_url ? String(p.pdf_url) : (p.signing_link ? String(p.signing_link) : null),
            storage_path: p.storage_path ? String(p.storage_path) : null,
            client_name: p.client_name ? String(p.client_name) : null,
            client_phone: p.client_phone ? String(p.client_phone) : null,
            client_email: p.client_email ? String(p.client_email) : null,
            excess_funds_amount: p.excess_funds_amount ? Number(p.excess_funds_amount) : null,
            fee_percent: p.fee_percent ? Number(p.fee_percent) : (p.selection_code === 2 ? 10 : 25),
            sent_at: p.sent_at ? String(p.sent_at) : null,
            signed_at: p.signed_at ? String(p.signed_at) : null,
            created_at: String(p.created_at || ''),
          }))
        )
      }
    } finally {
      setLoading(false)
    }
  }, [filterStatus])

  useEffect(() => {
    loadAgreements()
    const interval = setInterval(loadAgreements, 30000)
    return () => clearInterval(interval)
  }, [loadAgreements])

  const loadLeads = async () => {
    setLeadsLoading(true)
    try {
      const res = await fetch('/api/leads?limit=100')
      const body = await res.json()
      if (body.leads) {
        setLeads(
          (body.leads as Record<string, unknown>[])
            .map((l) => ({
              id: String(l.id),
              owner_name: String(l.owner_name || 'Unknown'),
              phone: String(l.phone || l.phone_1 || ''),
              excess_funds_amount: Number(l.excess_funds_amount || l.excess_amount || 0),
              status: String(l.status || ''),
            }))
            .filter((l) => l.phone)
        )
      }
    } finally {
      setLeadsLoading(false)
    }
  }

  // -----------------------------------------------------------------------
  // Actions
  // -----------------------------------------------------------------------

  const openGenerateModal = () => {
    setShowGenerateModal(true)
    setSelectedLeadId('')
    setAgreementType('excess_funds')
    setGenerateResult(null)
    loadLeads()
  }

  const generateAgreement = async () => {
    if (!selectedLeadId || generating) return
    setGenerating(true)
    setGenerateResult(null)
    try {
      const res = await fetch('/api/send-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: selectedLeadId,
          agreement_type: agreementType,
          action: 'generate',
        }),
      })
      const body = await res.json()
      if (body.success) {
        setGenerateResult({
          success: true,
          message: 'Agreement PDF generated successfully.',
          pdfUrl: body.pdf_url,
        })
        await loadAgreements()
        showToast('Agreement generated')
      } else {
        setGenerateResult({
          success: false,
          message: body.error || 'Generation failed',
        })
      }
    } finally {
      setGenerating(false)
    }
  }

  const sendAgreement = async (agreement: Agreement) => {
    setSendingId(agreement.id)
    try {
      const res = await fetch('/api/send-agreement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agreement_id: agreement.id,
          action: 'send',
        }),
      })
      const body = await res.json()
      if (body.success) {
        showToast(`Agreement sent to ${agreement.client_name}`)
        await loadAgreements()
      } else if (body.requires_approval) {
        showToast(body.error, 'error')
      } else {
        showToast(body.error || 'Send failed', 'error')
      }
    } finally {
      setSendingId(null)
      setSendConfirm(null)
    }
  }

  const voidAgreement = async (agreementId: string) => {
    try {
      await fetch(`/api/agreements/${agreementId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'void' }),
      })
      showToast('Agreement voided')
      await loadAgreements()
    } catch {
      showToast('Failed to void', 'error')
    }
  }

  // -----------------------------------------------------------------------
  // Derived data
  // -----------------------------------------------------------------------

  const statusCounts = STATUS_PIPELINE.map((stage) => ({
    ...stage,
    count: agreements.filter((a) => a.status === stage.key).length,
  }))

  const filteredAgreements = (() => {
    let filtered = filterStatus === 'all' ? agreements : agreements.filter((a) => a.status === filterStatus)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (a) =>
          a.client_name?.toLowerCase().includes(q) ||
          a.client_phone?.includes(q) ||
          a.agreement_type?.includes(q)
      )
    }
    return filtered
  })()

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

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

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[60] px-4 py-2 rounded text-sm font-medium shadow-lg transition-all"
          style={{
            background: toast.type === 'success' ? '#10b981' : '#ef4444',
            color: '#fff',
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 border-b" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
        <h1 className="text-lg font-semibold" style={{ color: '#ffd700' }}>Agreement Center</h1>
        <button
          onClick={openGenerateModal}
          className="ml-auto px-3 py-1.5 rounded text-sm font-medium transition-colors"
          style={{ background: '#ffd700', color: '#0a0c10' }}
        >
          + Generate Agreement
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
          All ({agreements.length})
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
            placeholder="Search name, phone, type..."
            className="rounded px-3 py-1.5 text-xs focus:outline-none"
            style={{ background: '#151820', border: '1px solid #1a1d28', color: '#e0e0e8', width: '220px' }}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-1 min-h-0">
        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          {filteredAgreements.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-3">📄</div>
                <p className="text-sm" style={{ color: '#6b7280' }}>
                  {filterStatus !== 'all' ? `No ${filterStatus} agreements` : 'No agreements yet'}
                </p>
                <button
                  onClick={openGenerateModal}
                  className="mt-3 text-xs px-3 py-1.5 rounded"
                  style={{ background: '#ffd70015', color: '#ffd700', border: '1px solid #ffd70030' }}
                >
                  Generate First Agreement
                </button>
              </div>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b" style={{ borderColor: '#1a1d28' }}>
                  {['Client', 'Type', 'Amount', 'Status', 'Sent', 'Signed', 'PDF', 'Actions'].map((h, i) => (
                    <th
                      key={h}
                      className={`${i === 7 ? 'text-right' : 'text-left'} px-4 py-3 text-xs font-semibold uppercase tracking-wider`}
                      style={{ color: '#6b7280' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAgreements.map((agr) => {
                  const statusInfo = STATUS_PIPELINE.find((s) => s.key === agr.status) || { label: agr.status, color: '#6b7280' }
                  const isActive = selectedAgreement?.id === agr.id
                  return (
                    <tr
                      key={agr.id}
                      onClick={() => setSelectedAgreement(isActive ? null : agr)}
                      className="border-b cursor-pointer transition-colors"
                      style={{ borderColor: '#1a1d28', background: isActive ? '#151820' : 'transparent' }}
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium" style={{ color: '#e0e0e8' }}>{agr.client_name || 'Unknown'}</div>
                        <div className="text-[11px]" style={{ color: '#6b7280' }}>{formatPhone(agr.client_phone || '')}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-1 rounded" style={{ background: '#ffd70015', color: '#ffd700' }}>
                          {TYPE_LABELS[agr.agreement_type] || agr.agreement_type}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#ffd700' }}>
                        {formatCurrency(agr.excess_funds_amount)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full" style={{ background: statusInfo.color }} />
                          <span style={{ color: statusInfo.color }}>{statusInfo.label}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3" style={{ color: '#a0a0b0' }}>{timeAgo(agr.sent_at)}</td>
                      <td className="px-4 py-3" style={{ color: agr.signed_at ? '#22c55e' : '#4a4a5a' }}>
                        {agr.signed_at ? timeAgo(agr.signed_at) : '\u2014'}
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        {agr.pdf_url ? (
                          <a
                            href={agr.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs px-2 py-1 rounded"
                            style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
                          >
                            View PDF
                          </a>
                        ) : (
                          <span className="text-xs" style={{ color: '#4a4a5a' }}>--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-1 justify-end">
                          {agr.status === 'draft' && agr.pdf_url && (
                            <button
                              onClick={() => setSendConfirm(agr)}
                              disabled={sendingId === agr.id}
                              className="text-[11px] px-2 py-1 rounded disabled:opacity-50"
                              style={{ background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e30' }}
                            >
                              {sendingId === agr.id ? '...' : 'Send'}
                            </button>
                          )}
                          {['sent', 'viewed'].includes(agr.status) && (
                            <button
                              onClick={() => setSendConfirm(agr)}
                              disabled={sendingId === agr.id}
                              className="text-[11px] px-2 py-1 rounded disabled:opacity-50"
                              style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
                            >
                              {sendingId === agr.id ? '...' : 'Resend'}
                            </button>
                          )}
                          {!['signed', 'voided'].includes(agr.status) && (
                            <button
                              onClick={() => voidAgreement(agr.id)}
                              className="text-[11px] px-2 py-1 rounded"
                              style={{ background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430' }}
                            >
                              Void
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
        {selectedAgreement && (
          <aside className="border-l overflow-y-auto" style={{ width: '300px', borderColor: '#1a1d28', background: '#10131a' }}>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#ffd700' }}>Agreement Details</h3>
                <button onClick={() => setSelectedAgreement(null)} className="text-xs" style={{ color: '#6b7280' }}>Close</button>
              </div>

              <div className="space-y-3">
                <DetailRow label="Client" value={selectedAgreement.client_name || 'Unknown'} />
                <DetailRow label="Phone" value={formatPhone(selectedAgreement.client_phone || '')} />
                <DetailRow label="Email" value={selectedAgreement.client_email || 'N/A'} />
                <DetailRow label="Type" value={TYPE_LABELS[selectedAgreement.agreement_type] || selectedAgreement.agreement_type} valueColor="#ffd700" />
                <DetailRow label="Amount" value={formatCurrency(selectedAgreement.excess_funds_amount)} valueColor="#ffd700" />
                <DetailRow label="Fee" value={selectedAgreement.fee_percent ? `${selectedAgreement.fee_percent}%` : 'N/A'} />
                <DetailRow
                  label="Status"
                  value={(STATUS_PIPELINE.find((s) => s.key === selectedAgreement.status) || { label: selectedAgreement.status }).label}
                  valueColor={(STATUS_PIPELINE.find((s) => s.key === selectedAgreement.status) || { color: '#6b7280' }).color}
                />
                <DetailRow label="Created" value={selectedAgreement.created_at ? new Date(selectedAgreement.created_at).toLocaleString() : 'N/A'} />
                <DetailRow label="Sent" value={selectedAgreement.sent_at ? new Date(selectedAgreement.sent_at).toLocaleString() : 'Not sent'} />
                <DetailRow
                  label="Signed"
                  value={selectedAgreement.signed_at ? new Date(selectedAgreement.signed_at).toLocaleString() : 'Not signed'}
                  valueColor={selectedAgreement.signed_at ? '#22c55e' : '#6b7280'}
                />
              </div>

              {selectedAgreement.pdf_url && (
                <a
                  href={selectedAgreement.pdf_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-xs py-2 rounded transition-colors"
                  style={{ background: '#3b82f615', color: '#3b82f6', border: '1px solid #3b82f630' }}
                >
                  View / Download PDF
                </a>
              )}

              {selectedAgreement.status === 'draft' && selectedAgreement.pdf_url && (
                <button
                  onClick={() => setSendConfirm(selectedAgreement)}
                  className="w-full text-center text-xs py-2 rounded transition-colors"
                  style={{ background: '#22c55e15', color: '#22c55e', border: '1px solid #22c55e30' }}
                >
                  Send Agreement via SMS
                </button>
              )}

              {selectedAgreement.lead_id && (
                <div className="space-y-2 pt-2">
                  <a
                    href={`/dashboard/leads?id=${selectedAgreement.lead_id}`}
                    className="block text-center text-xs py-2 rounded transition-colors"
                    style={{ background: '#ffd70015', color: '#ffd700', border: '1px solid #ffd70030' }}
                  >
                    View Lead Profile
                  </a>
                  <a
                    href={`/dashboard/messages?phone=${selectedAgreement.client_phone || ''}`}
                    className="block text-center text-xs py-2 rounded transition-colors"
                    style={{ background: '#151820', color: '#a0a0b0', border: '1px solid #1a1d28' }}
                  >
                    View Messages
                  </a>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Generate Agreement Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-lg w-full max-w-lg border" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
            <div className="p-4 border-b flex items-center justify-between" style={{ borderColor: '#1a1d28' }}>
              <h2 className="font-semibold" style={{ color: '#ffd700' }}>Generate Agreement</h2>
              <button onClick={() => setShowGenerateModal(false)} style={{ color: '#6b7280' }}>x</button>
            </div>
            <div className="p-4 space-y-4">
              {/* Lead Select */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#a0a0b0' }}>Select Lead</label>
                {leadsLoading ? (
                  <div className="text-xs py-2" style={{ color: '#6b7280' }}>Loading leads...</div>
                ) : leads.length === 0 ? (
                  <div className="text-xs py-2" style={{ color: '#6b7280' }}>No leads with phone numbers found</div>
                ) : (
                  <select
                    value={selectedLeadId}
                    onChange={(e) => setSelectedLeadId(e.target.value)}
                    className="w-full rounded px-3 py-2 text-sm focus:outline-none"
                    style={{ background: '#0a0c10', border: '1px solid #1a1d28', color: '#e0e0e8' }}
                  >
                    <option value="">Choose a lead...</option>
                    {leads.map((lead) => (
                      <option key={lead.id} value={lead.id}>
                        {lead.owner_name} - {formatPhone(lead.phone)}
                        {lead.excess_funds_amount > 0 ? ` ($${lead.excess_funds_amount.toLocaleString()})` : ''}
                        {lead.status ? ` [${lead.status}]` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Agreement Type */}
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: '#a0a0b0' }}>Agreement Type</label>
                <div className="flex gap-2">
                  {([
                    { type: 'excess_funds' as const, label: 'Excess Funds (25%)', desc: 'Contingency fee recovery' },
                    { type: 'wholesale' as const, label: 'Wholesale (10%)', desc: 'Assignment/finder fee' },
                  ]).map((opt) => (
                    <button
                      key={opt.type}
                      onClick={() => setAgreementType(opt.type)}
                      className="flex-1 text-left p-3 rounded transition-colors"
                      style={{
                        background: agreementType === opt.type ? '#ffd70020' : '#0a0c10',
                        color: agreementType === opt.type ? '#ffd700' : '#6b7280',
                        border: `1px solid ${agreementType === opt.type ? '#ffd70040' : '#1a1d28'}`,
                      }}
                    >
                      <div className="text-xs font-medium">{opt.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Result */}
              {generateResult && (
                <div
                  className="p-3 rounded text-xs"
                  style={{
                    background: generateResult.success ? '#10b98115' : '#ef444415',
                    color: generateResult.success ? '#10b981' : '#ef4444',
                    border: `1px solid ${generateResult.success ? '#10b98130' : '#ef444430'}`,
                  }}
                >
                  <p>{generateResult.message}</p>
                  {generateResult.pdfUrl && (
                    <a
                      href={generateResult.pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline mt-1 block"
                    >
                      View Generated PDF
                    </a>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t flex gap-2 justify-end" style={{ borderColor: '#1a1d28' }}>
              <button
                onClick={() => setShowGenerateModal(false)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: '#151820', color: '#a0a0b0', border: '1px solid #1a1d28' }}
              >
                {generateResult?.success ? 'Done' : 'Cancel'}
              </button>
              <button
                onClick={generateAgreement}
                disabled={!selectedLeadId || generating}
                className="px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40"
                style={{ background: '#ffd700', color: '#0a0c10' }}
              >
                {generating ? 'Generating PDF...' : 'Generate PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Send Confirmation Dialog */}
      {sendConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="rounded-lg w-full max-w-sm border" style={{ background: '#10131a', borderColor: '#1a1d28' }}>
            <div className="p-4 border-b" style={{ borderColor: '#1a1d28' }}>
              <h2 className="font-semibold" style={{ color: '#ffd700' }}>Confirm Send</h2>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-sm" style={{ color: '#e0e0e8' }}>
                Send this agreement via SMS to <strong>{sendConfirm.client_name}</strong>?
              </p>
              <div className="text-xs space-y-1" style={{ color: '#a0a0b0' }}>
                <div>Phone: {formatPhone(sendConfirm.client_phone || '')}</div>
                <div>Type: {TYPE_LABELS[sendConfirm.agreement_type] || sendConfirm.agreement_type}</div>
                <div>Amount: {formatCurrency(sendConfirm.excess_funds_amount)}</div>
              </div>
              <div className="p-2 rounded text-[11px]" style={{ background: '#f59e0b15', color: '#f59e0b', border: '1px solid #f59e0b30' }}>
                This will send an SMS with the PDF link. Ensure the agreement is correct before sending.
              </div>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end" style={{ borderColor: '#1a1d28' }}>
              <button
                onClick={() => setSendConfirm(null)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: '#151820', color: '#a0a0b0', border: '1px solid #1a1d28' }}
              >
                Cancel
              </button>
              <button
                onClick={() => sendAgreement(sendConfirm)}
                disabled={sendingId === sendConfirm.id}
                className="px-4 py-1.5 rounded text-sm font-medium disabled:opacity-40"
                style={{ background: '#22c55e', color: '#fff' }}
              >
                {sendingId === sendConfirm.id ? 'Sending...' : 'Yes, Send via SMS'}
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
