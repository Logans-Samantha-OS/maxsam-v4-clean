'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'

// ============================================================================
// TYPES
// ============================================================================

interface Lead {
  id: string
  owner_name: string
  property_address: string | null
  primary_phone: string | null
  phone: string | null
  phones: string | null
  phone_number: string | null
  phone_1: string | null
  phone_2: string | null
  owner_phone: string | null
  skip_trace_status: string | null
  skip_traced_at: string | null
  priority_score: number | null
  value_score: number | null
  eleanor_score: number | null
  scored_at: string | null
  status: string | null
  is_golden: boolean
  excess_funds_amount: number | null
  county: string | null
  cause_number: string | null
  expiry_date: string | null
  created_at: string
}

type PipelineStage =
  | 'opted_out'
  | 'converted'
  | 'in_conversation'
  | 'missing_address'
  | 'skip_trace_failed'
  | 'needs_skip_trace'
  | 'needs_scoring'
  | 'ready_for_outreach'

interface StageConfig {
  id: PipelineStage
  label: string
  icon: string
  color: string
  bgColor: string
  borderColor: string
  description: string
  actionLabel?: string
  actionIcon?: string
}

// ============================================================================
// STAGE CONFIGURATION
// ============================================================================

const STAGES: StageConfig[] = [
  {
    id: 'opted_out',
    label: 'Opted Out',
    icon: '🚫',
    color: 'text-gray-400',
    bgColor: 'bg-gray-500/10',
    borderColor: 'border-gray-500/30',
    description: 'Requested no contact',
  },
  {
    id: 'converted',
    label: 'Converted',
    icon: '✅',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
    description: 'Deal closed or agreement signed',
  },
  {
    id: 'in_conversation',
    label: 'In Conversation',
    icon: '💬',
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
    description: 'Active SMS/call thread',
  },
  {
    id: 'missing_address',
    label: 'Missing Address',
    icon: '🏠',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    description: 'Cannot skip trace without property address',
    actionLabel: 'Manual Entry Required',
    actionIcon: '📝',
  },
  {
    id: 'skip_trace_failed',
    label: 'Skip Trace Failed',
    icon: '❌',
    color: 'text-red-500',
    bgColor: 'bg-red-600/10',
    borderColor: 'border-red-600/30',
    description: 'Multiple attempts failed - needs manual lookup',
    actionLabel: 'Manual Lookup',
    actionIcon: '🔎',
  },
  {
    id: 'needs_skip_trace',
    label: 'Needs Skip Trace',
    icon: '🔍',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    borderColor: 'border-amber-500/30',
    description: 'Has address, waiting for phone lookup',
    actionLabel: 'Run Skip Trace',
    actionIcon: '🔍',
  },
  {
    id: 'needs_scoring',
    label: 'Needs Scoring',
    icon: '📊',
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
    description: 'Has phone, waiting for ELEANOR analysis',
    actionLabel: 'Run ELEANOR',
    actionIcon: '📊',
  },
  {
    id: 'ready_for_outreach',
    label: 'Ready for Outreach',
    icon: '🎯',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    description: 'Fully vetted - SAM can contact',
    actionLabel: 'Start SAM Outreach',
    actionIcon: '📱',
  },
]

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getLeadPhone(lead: Lead): string | null {
  return (
    lead.primary_phone ||
    lead.phone ||
    lead.phones ||
    lead.phone_number ||
    lead.phone_1 ||
    lead.phone_2 ||
    lead.owner_phone ||
    null
  )
}

function hasPhone(lead: Lead): boolean {
  return !!getLeadPhone(lead)
}

function hasAddress(lead: Lead): boolean {
  return !!(lead.property_address && lead.property_address.trim() !== '')
}

function hasScore(lead: Lead): boolean {
  return !!(lead.priority_score || lead.value_score || lead.eleanor_score || lead.scored_at)
}

function getLeadStage(lead: Lead): PipelineStage {
  const leadHasPhone = hasPhone(lead)
  const leadHasAddress = hasAddress(lead)
  const leadHasScore = hasScore(lead)
  const skipTraceFailed =
    lead.skip_trace_status === 'failed' || lead.skip_trace_status === 'not_found'

  // Check terminal states first
  if (lead.status === 'opted_out') return 'opted_out'
  if (lead.status === 'converted' || lead.status === 'signed') return 'converted'
  if (['contacted', 'in_conversation', 'agreement_sent'].includes(lead.status || ''))
    return 'in_conversation'

  // Check data completeness
  if (!leadHasAddress) return 'missing_address'
  if (!leadHasPhone && skipTraceFailed) return 'skip_trace_failed'
  if (!leadHasPhone) return 'needs_skip_trace'
  if (!leadHasScore) return 'needs_scoring'

  return 'ready_for_outreach'
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return '$0'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getScore(lead: Lead): number | null {
  return lead.eleanor_score || lead.priority_score || lead.value_score || null
}

// ============================================================================
// COMPONENTS
// ============================================================================

function SummaryCard({
  label,
  value,
  subValue,
  color = 'cyan',
  icon,
}: {
  label: string
  value: string | number
  subValue?: string
  color?: 'cyan' | 'green' | 'red' | 'yellow'
  icon?: string
}) {
  const colorClasses = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
  }

  const textColors = {
    cyan: 'text-cyan-400',
    green: 'text-green-400',
    red: 'text-red-400',
    yellow: 'text-yellow-400',
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

function StageCard({
  stage,
  count,
  value,
  isSelected,
  onClick,
  onAction,
  actionLoading,
}: {
  stage: StageConfig
  count: number
  value: number
  isSelected: boolean
  onClick: () => void
  onAction?: () => void
  actionLoading: boolean
}) {
  return (
    <div
      className={`${stage.bgColor} border ${stage.borderColor} rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.02] ${
        isSelected ? 'ring-2 ring-yellow-500 ring-offset-2 ring-offset-zinc-950' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{stage.icon}</span>
        <span className={`text-3xl font-bold ${stage.color}`}>{count}</span>
      </div>
      <h3 className={`font-semibold ${stage.color} mb-1`}>{stage.label}</h3>
      <p className="text-xs text-zinc-500 mb-2">{stage.description}</p>
      <p className="text-sm text-green-400 font-medium">{formatCurrency(value)}</p>
      {stage.actionLabel && onAction && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onAction()
          }}
          disabled={actionLoading || count === 0}
          className={`mt-3 w-full py-2 px-3 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${stage.bgColor} ${stage.borderColor} ${stage.color} hover:bg-opacity-30`}
        >
          {actionLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="animate-spin w-3 h-3 border-2 border-current border-t-transparent rounded-full" />
              Running...
            </span>
          ) : (
            <span>
              {stage.actionIcon} {stage.actionLabel}
            </span>
          )}
        </button>
      )}
    </div>
  )
}

function LeadTable({
  leads,
  onClose,
}: {
  leads: Lead[]
  onClose: () => void
}) {
  const [sortedLeads, setSortedLeads] = useState<Lead[]>([])

  useEffect(() => {
    // Sort by amount descending
    const sorted = [...leads].sort(
      (a, b) => (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0)
    )
    setSortedLeads(sorted.slice(0, 50))
  }, [leads])

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-zinc-800">
        <h3 className="text-lg font-semibold text-white">
          Lead Details ({leads.length > 50 ? `Showing 50 of ${leads.length}` : leads.length})
        </h3>
        <button
          onClick={onClose}
          className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Owner Name
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Property Address
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Phone
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Amount
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Score
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                County
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Golden
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">
                Expiry Date
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.map((lead) => (
              <tr
                key={lead.id}
                className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-4 py-3">
                  <a
                    href={`/leads/${lead.id}`}
                    className="text-white hover:text-yellow-400 font-medium"
                  >
                    {lead.owner_name || 'Unknown'}
                  </a>
                </td>
                <td className="px-4 py-3 text-zinc-400 text-sm">
                  {lead.property_address || '—'}
                </td>
                <td className="px-4 py-3">
                  {hasPhone(lead) ? (
                    <a
                      href={`tel:${getLeadPhone(lead)}`}
                      className="text-cyan-400 hover:text-cyan-300 text-sm"
                    >
                      {getLeadPhone(lead)}
                    </a>
                  ) : (
                    <span className="text-red-400 text-sm">Missing</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="text-green-400 font-semibold">
                    {formatCurrency(lead.excess_funds_amount)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {getScore(lead) !== null ? (
                    <span className="text-white">{getScore(lead)}</span>
                  ) : (
                    <span className="text-zinc-500">Unscored</span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400 text-sm">{lead.county || '—'}</td>
                <td className="px-4 py-3">{lead.is_golden && <span title="Golden Lead">⭐</span>}</td>
                <td className="px-4 py-3 text-zinc-400 text-sm">{formatDate(lead.expiry_date)}</td>
              </tr>
            ))}
            {sortedLeads.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                  No leads in this stage
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function N8NWarningBanner() {
  return (
    <div className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/30 rounded-xl p-4 mt-6">
      <div className="flex items-start gap-3">
        <span className="text-2xl">⚠️</span>
        <div>
          <h4 className="text-orange-400 font-semibold mb-1">N8N Execution Limit Reached</h4>
          <p className="text-zinc-400 text-sm">
            You&apos;ve used 2,500/2,500 executions for January. Workflows won&apos;t run until February
            1st unless you upgrade your n8n plan or self-host.
          </p>
        </div>
      </div>
    </div>
  )
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LeadHealthPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStage, setSelectedStage] = useState<PipelineStage | null>(null)
  const [actionLoading, setActionLoading] = useState<PipelineStage | null>(null)
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

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

  // Clear toast after 5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [toastMessage])

  // Group leads by stage
  const leadsByStage = useMemo(() => {
    const groups: Record<PipelineStage, Lead[]> = {
      opted_out: [],
      converted: [],
      in_conversation: [],
      missing_address: [],
      skip_trace_failed: [],
      needs_skip_trace: [],
      needs_scoring: [],
      ready_for_outreach: [],
    }

    leads.forEach((lead) => {
      const stage = getLeadStage(lead)
      groups[stage].push(lead)
    })

    return groups
  }, [leads])

  // Calculate totals
  const totalLeads = leads.length
  const pipelineValue = leads.reduce((sum, lead) => sum + (lead.excess_funds_amount || 0), 0)
  const readyForOutreach = leadsByStage.ready_for_outreach.length
  const blockedLeads =
    leadsByStage.missing_address.length +
    leadsByStage.skip_trace_failed.length +
    leadsByStage.needs_skip_trace.length +
    leadsByStage.needs_scoring.length

  // Calculate value per stage
  const getStageValue = (stage: PipelineStage) =>
    leadsByStage[stage].reduce((sum, lead) => sum + (lead.excess_funds_amount || 0), 0)

  // N8N webhook handlers
  const triggerSkipTrace = async () => {
    setActionLoading('needs_skip_trace')
    try {
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', source: 'lead-health' }),
      })
      if (res.ok) {
        setToastMessage({ type: 'success', message: 'Skip trace triggered! Check Telegram for updates.' })
      } else {
        throw new Error('Failed')
      }
    } catch {
      setToastMessage({ type: 'error', message: 'Failed - n8n may be at execution limit (2500/2500)' })
    } finally {
      setActionLoading(null)
    }
  }

  const triggerEleanor = async () => {
    setActionLoading('needs_scoring')
    try {
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/eleanor-score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', source: 'lead-health' }),
      })
      if (res.ok) {
        setToastMessage({ type: 'success', message: 'ELEANOR scoring triggered! Check Telegram for updates.' })
      } else {
        throw new Error('Failed')
      }
    } catch {
      setToastMessage({ type: 'error', message: 'Failed - n8n may be at execution limit (2500/2500)' })
    } finally {
      setActionLoading(null)
    }
  }

  const triggerSamOutreach = async () => {
    setActionLoading('ready_for_outreach')
    try {
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/sam-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual', source: 'lead-health' }),
      })
      if (res.ok) {
        setToastMessage({ type: 'success', message: 'SAM outreach triggered! Check Telegram for updates.' })
      } else {
        throw new Error('Failed')
      }
    } catch {
      setToastMessage({ type: 'error', message: 'Failed - n8n may be at execution limit (2500/2500)' })
    } finally {
      setActionLoading(null)
    }
  }

  const getStageAction = (stageId: PipelineStage): (() => void) | undefined => {
    switch (stageId) {
      case 'needs_skip_trace':
        return triggerSkipTrace
      case 'needs_scoring':
        return triggerEleanor
      case 'ready_for_outreach':
        return triggerSamOutreach
      default:
        return undefined
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-zinc-400 flex items-center gap-3">
          <div className="animate-spin w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full" />
          Loading lead health data...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-950 border border-red-800 rounded-lg text-red-200">{error}</div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg ${
            toastMessage.type === 'success'
              ? 'bg-green-500/90 text-white'
              : 'bg-red-500/90 text-white'
          }`}
        >
          {toastMessage.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-2">
            <span className="text-cyan-400">🩺</span> Lead Health
          </h1>
          <p className="text-sm text-zinc-400">
            Data acquisition pipeline - see where leads are stuck
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLeads}>
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Total Leads" value={totalLeads} icon="📋" color="cyan" />
        <SummaryCard
          label="Pipeline Value"
          value={formatCurrency(pipelineValue)}
          icon="💰"
          color="green"
        />
        <SummaryCard
          label="Ready for Outreach"
          value={readyForOutreach}
          icon="🎯"
          color="cyan"
          subValue={`${formatCurrency(getStageValue('ready_for_outreach'))}`}
        />
        <SummaryCard
          label="Blocked (Need Data)"
          value={blockedLeads}
          icon="⛔"
          color="red"
          subValue="Missing address, phone, or score"
        />
      </div>

      {/* Pipeline Stage Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAGES.map((stage) => (
          <StageCard
            key={stage.id}
            stage={stage}
            count={leadsByStage[stage.id].length}
            value={getStageValue(stage.id)}
            isSelected={selectedStage === stage.id}
            onClick={() => setSelectedStage(selectedStage === stage.id ? null : stage.id)}
            onAction={getStageAction(stage.id)}
            actionLoading={actionLoading === stage.id}
          />
        ))}
      </div>

      {/* Lead Table (when stage selected) */}
      {selectedStage && (
        <LeadTable
          leads={leadsByStage[selectedStage]}
          onClose={() => setSelectedStage(null)}
        />
      )}

      {/* N8N Warning Banner */}
      <N8NWarningBanner />
    </div>
  )
}
