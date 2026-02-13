'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// ============================================================================
// TYPES
// ============================================================================

interface Relative {
  name: string
  age?: number
}

interface PreviousAddress {
  street?: string
  city?: string
  state?: string
  zip?: string
  county?: string
}

interface Lead {
  id: string
  owner_name: string
  phone: string | null
  phone_1: string | null
  phone_2: string | null
  primary_phone: string | null
  primary_email: string | null
  phone_type: string | null
  property_address: string
  property_city: string | null
  city: string | null
  county: string
  state: string
  excess_funds_amount: number
  eleanor_score: number
  eleanor_grade: string | null
  priority_score: number | null
  value_score: number | null
  deal_grade: string
  is_golden: boolean
  is_golden_lead: boolean | null
  lead_class: string
  status: string
  skip_trace_status: string | null
  last_contact_at: string | null
  contact_attempts: number
  created_at: string
  updated_at: string
  notes: string | null
  expiry_date: string | null
  excess_funds_expiry_date: string | null
  relatives: Relative[] | string | null
  previous_addresses: PreviousAddress[] | string | null
  case_number: string | null
  sms_sent_count: number | null
  email: string | null
}

type SortField = 'owner_name' | 'excess_funds_amount' | 'eleanor_score' | 'created_at' | 'last_contact_at' | 'status'
type SortOrder = 'asc' | 'desc'

const STATUS_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'scored', label: 'Scored' },
  { value: 'skip_traced', label: 'Skip Traced' },
  { value: 'ready_for_outreach', label: 'Ready for Outreach' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'in_conversation', label: 'In Conversation' },
  { value: 'agreement_sent', label: 'Agreement Sent' },
  { value: 'signed', label: 'Signed' },
  { value: 'converted', label: 'Converted' },
  { value: 'opted_out', label: 'Opted Out' },
  { value: 'rejected', label: 'Rejected' },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLeadPhone(lead: Lead): string | null {
  return lead.primary_phone || lead.phone || lead.phone_1 || lead.phone_2 || null
}

function hasPhone(lead: Lead): boolean {
  return !!getLeadPhone(lead)
}

function hasScore(lead: Lead): boolean {
  return !!(lead.eleanor_score || lead.priority_score || lead.value_score)
}

function parseRelatives(val: Relative[] | string | null | undefined): Relative[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function parsePreviousAddresses(val: PreviousAddress[] | string | null | undefined): PreviousAddress[] {
  if (!val) return []
  if (Array.isArray(val)) return val
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

// ============================================================================
// TOAST COMPONENT
// ============================================================================

function Toast({
  message,
  type,
  onClose,
}: {
  message: string
  type: 'success' | 'error' | 'info'
  onClose: () => void
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000)
    return () => clearTimeout(timer)
  }, [onClose])

  const bgColor = {
    success: 'bg-green-500/90',
    error: 'bg-red-500/90',
    info: 'bg-cyan-500/90',
  }[type]

  return (
    <div className={`fixed top-4 right-4 z-[100] px-4 py-3 rounded-lg shadow-lg ${bgColor} text-white flex items-center gap-3`}>
      <span>{message}</span>
      <button onClick={onClose} className="hover:opacity-80">✕</button>
    </div>
  )
}

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
    scored: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    skip_traced: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
    ready_for_outreach: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    contacted: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    in_conversation: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
    agreement_sent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    signed: 'bg-green-500/20 text-green-400 border-green-500/30',
    converted: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
    opted_out: 'bg-red-500/20 text-red-400 border-red-500/30',
    rejected: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
    enriched: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    qualified: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    unknown: 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30',
  }

  const icons: Record<string, string> = {
    new: '🆕',
    scored: '📊',
    skip_traced: '🔍',
    ready_for_outreach: '🎯',
    contacted: '📞',
    in_conversation: '💬',
    agreement_sent: '📄',
    signed: '✅',
    converted: '💰',
    opted_out: '🚫',
    rejected: '❌',
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
// LEAD EDIT MODAL COMPONENT
// ============================================================================

function LeadEditModal({
  lead,
  onClose,
  onSave,
  saving,
}: {
  lead: Lead
  onClose: () => void
  onSave: (data: Partial<Lead>) => Promise<void>
  saving: boolean
}) {
  const [formData, setFormData] = useState({
    owner_name: lead.owner_name || '',
    primary_phone: lead.primary_phone || lead.phone || lead.phone_1 || lead.phone_2 || '',
    primary_email: lead.primary_email || '',
    property_address: lead.property_address || '',
    status: lead.status || 'new',
    is_golden: lead.is_golden || false,
    priority_score: lead.priority_score || lead.eleanor_score || 0,
    notes: lead.notes || '',
  })

  const notesRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await onSave(formData)
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-[60]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              ✏️ Edit Lead
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
                Contact Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Owner Name</label>
                  <Input
                    value={formData.owner_name}
                    onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">
                    Primary Phone <span className="text-zinc-600">(xxx) xxx-xxxx</span>
                  </label>
                  <Input
                    value={formData.primary_phone}
                    onChange={(e) => setFormData({ ...formData, primary_phone: e.target.value })}
                    placeholder="(214) 555-1234"
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Primary Email</label>
                  <Input
                    type="email"
                    value={formData.primary_email}
                    onChange={(e) => setFormData({ ...formData, primary_email: e.target.value })}
                    placeholder="owner@email.com"
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Property Address</label>
                  <Input
                    value={formData.property_address}
                    onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
                Status & Classification
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full h-9 px-3 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Priority Score (0-100)</label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.priority_score}
                    onChange={(e) => setFormData({ ...formData, priority_score: Number(e.target.value) })}
                    className="bg-zinc-950 border-zinc-700"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_golden}
                      onChange={(e) => setFormData({ ...formData, is_golden: e.target.checked })}
                      className="w-4 h-4 rounded bg-zinc-950 border-zinc-700 text-yellow-500"
                    />
                    <span className="text-sm text-zinc-300">⭐ Golden Lead</span>
                  </label>
                </div>
              </div>
            </div>
            {(parseRelatives(lead.relatives).length > 0 || parsePreviousAddresses(lead.previous_addresses).length > 0) && (
              <div>
                <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
                  Enriched Data
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {parseRelatives(lead.relatives).length > 0 && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2">Known Relatives</label>
                      <div className="space-y-1">
                        {parseRelatives(lead.relatives).map((rel, i) => (
                          <div key={i} className="text-sm text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                            {rel.name}{rel.age ? `, age ${rel.age}` : ''}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsePreviousAddresses(lead.previous_addresses).length > 0 && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-2">Previous Addresses</label>
                      <div className="space-y-1">
                        {parsePreviousAddresses(lead.previous_addresses).map((addr, i) => (
                          <div key={i} className="text-sm text-zinc-300 bg-zinc-950 px-2 py-1 rounded border border-zinc-800">
                            {[addr.street, addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div>
              <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-4">
                Notes & Comments
              </h3>
              <textarea
                ref={notesRef}
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Add notes about this lead..."
                rows={5}
                className="w-full px-3 py-2 rounded-md bg-zinc-950 border border-zinc-700 text-sm text-zinc-100 resize-none focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
              />
            </div>
            <div className="text-xs text-zinc-500 flex gap-6">
              <span>Created: {formatDate(lead.created_at)}</span>
              <span>Updated: {formatDate(lead.updated_at)}</span>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full" />
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

// ============================================================================
// BULK ACTION BAR COMPONENT
// ============================================================================

function BulkActionBar({
  selectedCount,
  selectedLeads,
  onSkipTrace,
  onSendToSam,
  onClearSelection,
  loading,
}: {
  selectedCount: number
  selectedLeads: Lead[]
  onSkipTrace: () => void
  onSendToSam: () => void
  onClearSelection: () => void
  loading: boolean
}) {
  if (selectedCount === 0) return null

  const leadsWithoutPhone = selectedLeads.filter((l) => !hasPhone(l)).length
  const leadsReadyForSam = selectedLeads.filter((l) => hasPhone(l) && hasScore(l)).length

  return (
    <div className="sticky top-0 z-40 mb-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
        <span className="text-white font-medium">
          {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="h-6 w-px bg-zinc-700" />

        {leadsWithoutPhone > 0 && (
          <button
            onClick={onSkipTrace}
            disabled={loading}
            className="px-4 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 border border-amber-500/30"
          >
            {loading ? (
              <div className="animate-spin w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full" />
            ) : (
              '🔍'
            )}
            Skip Trace Selected ({leadsWithoutPhone})
          </button>
        )}

        {leadsReadyForSam > 0 && (
          <button
            onClick={onSendToSam}
            disabled={loading}
            className="px-4 py-2 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 font-medium rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 border border-cyan-500/30"
          >
            {loading ? (
              <div className="animate-spin w-4 h-4 border-2 border-cyan-400 border-t-transparent rounded-full" />
            ) : (
              '📱'
            )}
            Send to SAM ({leadsReadyForSam})
          </button>
        )}

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
  onSkipTrace,
  onSendToSam,
  onEdit,
  onNotesClick,
  actionLoading,
  recentlyUpdated,
}: {
  lead: Lead
  isChecked: boolean
  onCheck: (leadId: string, checked: boolean) => void
  onSkipTrace: (lead: Lead) => void
  onSendToSam: (lead: Lead) => void
  onEdit: (lead: Lead) => void
  onNotesClick: (lead: Lead) => void
  actionLoading: string | null
  recentlyUpdated: boolean
}) {
  const phone = getLeadPhone(lead)
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

  const leadHasPhone = hasPhone(lead)
  const leadHasScore = hasScore(lead)

  return (
    <tr
      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-all ${
        (lead.is_golden || lead.is_golden_lead) ? 'bg-yellow-500/5' : ''
      } ${recentlyUpdated ? 'bg-green-500/10 animate-pulse' : ''}`}
    >
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => onCheck(lead.id, e.target.checked)}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-zinc-900 cursor-pointer"
        />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(lead)}
            className="font-medium text-white hover:text-yellow-400 hover:underline text-left"
          >
            {lead.owner_name || 'Unknown'}
          </button>
          {(lead.is_golden || lead.is_golden_lead) && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse" title="Golden Lead — Dual Opportunity">
              GOLDEN
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          {lead.skip_trace_status && (
            <span className={`text-[10px] px-1 py-0.5 rounded ${
              lead.skip_trace_status === 'found' ? 'bg-green-500/15 text-green-400' :
              lead.skip_trace_status === 'not_found' ? 'bg-red-500/15 text-red-400' :
              'bg-zinc-700/30 text-zinc-500'
            }`}>
              {lead.skip_trace_status === 'found' ? 'Traced' : lead.skip_trace_status}
            </span>
          )}
          {parseRelatives(lead.relatives).length > 0 && (
            <span className="text-[10px] px-1 py-0.5 rounded bg-purple-500/15 text-purple-400" title={parseRelatives(lead.relatives).map(r => r.name).join(', ')}>
              {parseRelatives(lead.relatives).length} relative{parseRelatives(lead.relatives).length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        {phone ? (
          <div>
            <a
              href={`tel:${phone}`}
              className="text-cyan-400 hover:text-cyan-300 hover:underline"
            >
              {formatPhone(phone)}
            </a>
            {lead.phone_type && (
              <span className={`ml-1.5 text-[10px] px-1 py-0.5 rounded ${
                lead.phone_type === 'Wireless' ? 'bg-green-500/15 text-green-400' : 'bg-zinc-700/30 text-zinc-500'
              }`}>
                {lead.phone_type}
              </span>
            )}
          </div>
        ) : (
          <span className="text-red-400 text-sm">No phone</span>
        )}
        {(lead.email || lead.primary_email) && (
          <div className="text-[10px] text-zinc-500 truncate max-w-[140px]" title={lead.email || lead.primary_email || ''}>
            {lead.email || lead.primary_email}
          </div>
        )}
      </td>
      <td className="px-4 py-3 max-w-xs">
        <div className="text-zinc-300 truncate">{lead.property_address}</div>
        <div className="text-xs text-zinc-500">
          {lead.property_city || lead.city}, {lead.county} County
        </div>
        {lead.case_number && (
          <div className="text-[10px] text-zinc-600 font-mono">
            Case {lead.case_number}
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-right">
        <span className={`font-mono font-semibold ${(lead.excess_funds_amount || 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
          ${(lead.excess_funds_amount || 0).toLocaleString()}
        </span>
        {(() => {
          const expiry = lead.expiry_date || lead.excess_funds_expiry_date
          if (!expiry) return null
          const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          if (days <= 0) return <div className="text-[10px] text-red-500 font-bold">EXPIRED</div>
          if (days <= 30) return <div className="text-[10px] text-red-400">{days}d left</div>
          if (days <= 90) return <div className="text-[10px] text-orange-400">{days}d left</div>
          return <div className="text-[10px] text-zinc-500">{days}d left</div>
        })()}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`font-bold ${getScoreColor(lead.eleanor_score || 0)}`}>
          {lead.eleanor_score || 0}
        </span>
        {(lead.eleanor_grade || lead.deal_grade) && (
          <span className="ml-1 text-xs text-zinc-500">
            ({lead.eleanor_grade || lead.deal_grade})
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status} />
      </td>
      <td className="px-3 py-3 text-center">
        <button
          onClick={() => onNotesClick(lead)}
          className={`p-1.5 rounded transition-colors ${
            lead.notes
              ? 'text-yellow-400 hover:bg-yellow-500/20'
              : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800'
          }`}
          title={lead.notes ? 'Has notes - click to view' : 'Add notes'}
        >
          {lead.notes ? '📝' : '📄'}
        </button>
      </td>
      <td className="px-4 py-3 text-zinc-400 text-sm">
        {getRelativeTime(lead.last_contact_at)}
        {lead.contact_attempts > 0 && (
          <span className="ml-1 text-xs text-zinc-500">
            ({lead.contact_attempts}x)
          </span>
        )}
      </td>
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          {!leadHasPhone && (
            <button
              onClick={() => onSkipTrace(lead)}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 rounded border border-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Run Skip Trace"
            >
              {isLoading ? (
                <span className="inline-block w-3 h-3 border border-amber-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                '🔍'
              )}
            </button>
          )}

          {leadHasPhone && leadHasScore && (
            <button
              onClick={() => onSendToSam(lead)}
              disabled={isLoading}
              className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Send to SAM for Outreach"
            >
              {isLoading ? (
                <span className="inline-block w-3 h-3 border border-cyan-400 border-t-transparent rounded-full animate-spin" />
              ) : (
                '📱'
              )}
            </button>
          )}

          <button
            onClick={() => onEdit(lead)}
            className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded border border-yellow-500/30 transition-colors"
            title="Edit Lead"
          >
            ✏️
          </button>
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

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [savingLead, setSavingLead] = useState(false)
  const [recentlyUpdated, setRecentlyUpdated] = useState<Set<string>>(new Set())

  const [stats, setStats] = useState({
    total: 0,
    withPhone: 0,
    highScore: 0,
    totalValue: 0,
    potentialFee: 0,
  })

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [leadClassFilter, setLeadClassFilter] = useState('all')
  const [hasPhoneFilter, setHasPhoneFilter] = useState(false)
  const [minAmount, setMinAmount] = useState(0)
  const [minScore, setMinScore] = useState(0)

  const [sortBy, setSortBy] = useState<SortField>('eleanor_score')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const limit = 50

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
  }, [])

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

      const withPhone = fetchedLeads.filter((l: Lead) => hasPhone(l)).length
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

  // ========================================================================
  // SKIP TRACE - NOW USING APIFY API (NOT N8N)
  // ========================================================================
  const triggerSkipTrace = async (lead: Lead) => {
    setActionLoading(lead.id)
    try {
      const res = await fetch('/api/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: lead.id,
          name: lead.owner_name,
          address: lead.property_address,
          cityStateZip: `${lead.property_city || lead.city || ''}, ${lead.state || 'TX'}`,
        }),
      })
      
      const data = await res.json()
      
      if (res.ok && data.success) {
        showToast(`Found phone: ${data.phone || 'Check lead details'}`, 'success')
        await fetchLeads()
      } else {
        throw new Error(data.error || 'Skip trace failed')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Skip trace failed', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // SAM Outreach webhook (still uses N8N for now)
  const triggerSamOutreach = async (lead: Lead) => {
    setActionLoading(lead.id)
    try {
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/sam-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          trigger: 'manual',
        }),
      })
      if (res.ok) {
        showToast('SAM outreach triggered! Check Telegram for updates.', 'success')
      } else {
        throw new Error('Failed')
      }
    } catch {
      showToast('SAM outreach failed - n8n may be at execution limit', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  // ========================================================================
  // BULK SKIP TRACE - NOW USING APIFY API (NOT N8N)
  // ========================================================================
  const bulkSkipTrace = async () => {
    setBulkLoading(true)
    const selectedLeadsList = filteredLeads.filter((l) => selectedIds.has(l.id) && !hasPhone(l))
    let successCount = 0

    for (const lead of selectedLeadsList) {
      try {
        const res = await fetch('/api/skip-trace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leadId: lead.id,
            name: lead.owner_name,
            address: lead.property_address,
            cityStateZip: `${lead.property_city || lead.city || ''}, ${lead.state || 'TX'}`,
          }),
        })
        const data = await res.json()
        if (res.ok && data.success) successCount++
      } catch {
        // Continue with next
      }
    }

    showToast(`Skip trace completed for ${successCount} leads!`, successCount > 0 ? 'success' : 'error')
    setSelectedIds(new Set())
    setBulkLoading(false)
    await fetchLeads()
  }

  // Bulk SAM outreach (still uses N8N)
  const bulkSendToSam = async () => {
    setBulkLoading(true)
    const selectedLeadsList = filteredLeads.filter(
      (l) => selectedIds.has(l.id) && hasPhone(l) && hasScore(l)
    )
    let successCount = 0

    for (const lead of selectedLeadsList) {
      try {
        const res = await fetch('https://skooki.app.n8n.cloud/webhook/sam-outreach', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_id: lead.id,
            trigger: 'manual',
          }),
        })
        if (res.ok) successCount++
      } catch {
        // Continue with next
      }
    }

    showToast(`SAM outreach triggered for ${successCount} leads!`, successCount > 0 ? 'success' : 'error')
    setSelectedIds(new Set())
    setBulkLoading(false)
  }

  const handleSaveLead = async (data: Partial<Lead>) => {
    if (!editingLead) return
    setSavingLead(true)

    try {
      const res = await fetch(`/api/leads/${editingLead.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) throw new Error('Failed to update lead')

      showToast('Lead updated successfully!', 'success')
      setEditingLead(null)

      setRecentlyUpdated((prev) => new Set(prev).add(editingLead.id))
      setTimeout(() => {
        setRecentlyUpdated((prev) => {
          const newSet = new Set(prev)
          newSet.delete(editingLead.id)
          return newSet
        })
      }, 3000)

      await fetchLeads()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to update lead', 'error')
    } finally {
      setSavingLead(false)
    }
  }

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (leadClassFilter === 'golden') return lead.is_golden || lead.is_golden_lead
      if (leadClassFilter === 'B') return !lead.is_golden && !lead.is_golden_lead
      return true
    })
  }, [leads, leadClassFilter])

  const selectedLeadsList = useMemo(() => {
    return filteredLeads.filter((l) => selectedIds.has(l.id))
  }, [filteredLeads, selectedIds])

  const allSelected = filteredLeads.length > 0 && selectedIds.size === filteredLeads.length
  const someSelected = selectedIds.size > 0 && selectedIds.size < filteredLeads.length

  return (
    <div className="space-y-6">
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {editingLead && (
        <LeadEditModal
          lead={editingLead}
          onClose={() => setEditingLead(null)}
          onSave={handleSaveLead}
          saving={savingLead}
        />
      )}

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
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
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

      <BulkActionBar
        selectedCount={selectedIds.size}
        selectedLeads={selectedLeadsList}
        onSkipTrace={bulkSkipTrace}
        onSendToSam={bulkSendToSam}
        onClearSelection={() => setSelectedIds(new Set())}
        loading={bulkLoading}
      />

      {error && (
        <div className="p-4 bg-red-950/50 border border-red-800 rounded-xl text-red-200">
          {error}
        </div>
      )}

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
              <th className="px-3 py-3 text-center text-xs font-medium text-zinc-400 uppercase">Notes</th>
              <SortableHeader label="Last Contact" field="last_contact_at" currentSort={sortBy} currentDirection={sortOrder} onSort={handleSort} />
              <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <div className="animate-spin w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full" />
                    <span className="text-zinc-400">Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : filteredLeads.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center text-zinc-500">
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
                  onSkipTrace={triggerSkipTrace}
                  onSendToSam={triggerSamOutreach}
                  onEdit={setEditingLead}
                  onNotesClick={setEditingLead}
                  actionLoading={actionLoading}
                  recentlyUpdated={recentlyUpdated.has(lead.id)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

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
    </div>
  )
}