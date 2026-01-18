'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  buildExecutionQueue,
  getQueueStats,
  QueueAction,
  UrgencyLevel,
  ActionType,
} from '@/lib/ralph/execution-queue'

interface Lead {
  id: string
  owner_name: string | null
  property_address: string | null
  excess_funds_amount: number | null
  eleanor_score: number | null
  status: string | null
  contact_attempts: number | null
  last_contact_date: string | null
  phone: string | null
  phone_1: string | null
  phone_2: string | null
  email: string | null
  deal_grade: string | null
  deal_type: string | null
  created_at: string | null
  updated_at: string | null
}

type FilterMode = 'all' | UrgencyLevel

const urgencyConfig: Record<UrgencyLevel, { color: string; bg: string; label: string }> = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/40', label: 'CRITICAL' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/20 border-orange-500/40', label: 'HIGH' },
  medium: { color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/40', label: 'MEDIUM' },
  low: { color: 'text-zinc-400', bg: 'bg-zinc-500/20 border-zinc-500/40', label: 'LOW' },
}

const actionIcons: Record<ActionType, string> = {
  call_now: '📞',
  send_sms: '📱',
  send_followup: '📨',
  skip_trace: '🔍',
  score_lead: '📊',
  generate_contract: '📝',
  send_contract: '✉️',
  escalate_human: '👤',
}

export default function CommandCenter() {
  const [queue, setQueue] = useState<QueueAction[]>([])
  const [loading, setLoading] = useState(true)
  const [executing, setExecuting] = useState<string | null>(null)
  const [filterMode, setFilterMode] = useState<FilterMode>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date())

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/leads?limit=500')
      const data = await res.json()

      if (data.leads) {
        const executionQueue = buildExecutionQueue(data.leads as Lead[])
        setQueue(executionQueue)
      }
    } catch (err) {
      console.error('Failed to fetch leads:', err)
    } finally {
      setLoading(false)
      setLastRefresh(new Date())
    }
  }, [])

  useEffect(() => {
    fetchQueue()
    const interval = setInterval(fetchQueue, 30000)
    return () => clearInterval(interval)
  }, [fetchQueue])

  const executeAction = async (action: QueueAction) => {
    setExecuting(action.id)

    try {
      // Use OS execute endpoint for all actions
      const res = await fetch('/api/os/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-maxsam-authority': 'os',
        },
        body: JSON.stringify({
          leadId: action.leadId,
          actionType: action.actionType,
        }),
      })

      const result = await res.json()

      if (!result.ok) {
        console.error('Execution failed:', result.error)
      }

      await fetchQueue()
    } catch (err) {
      console.error('Action failed:', err)
    } finally {
      setExecuting(null)
    }
  }

  const stats = getQueueStats(queue)

  const filteredQueue =
    filterMode === 'all' ? queue : queue.filter((a) => a.urgency === filterMode)

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`
    return `$${amount.toFixed(0)}`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-cyan-500" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="text-3xl">⚡</span>
            Execution Queue
          </h1>
          <p className="text-zinc-500 text-sm mt-1">
            Ranked actions ready for execution • Last updated{' '}
            {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchQueue}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm font-medium transition-colors"
        >
          Refresh Queue
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-sm text-zinc-500">Total Actions</div>
          <div className="text-2xl font-bold text-white">{stats.total}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-red-500/30">
          <div className="text-sm text-red-400">Critical</div>
          <div className="text-2xl font-bold text-red-400">{stats.critical}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-orange-500/30">
          <div className="text-sm text-orange-400">High</div>
          <div className="text-2xl font-bold text-orange-400">{stats.high}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-yellow-500/30">
          <div className="text-sm text-yellow-400">Medium</div>
          <div className="text-2xl font-bold text-yellow-400">{stats.medium}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-green-500/30">
          <div className="text-sm text-green-400">Pipeline Value</div>
          <div className="text-2xl font-bold text-green-400">
            {formatCurrency(stats.totalPotentialRevenue)}
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 pb-4">
        {(['all', 'critical', 'high', 'medium', 'low'] as FilterMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setFilterMode(mode)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterMode === mode
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {mode === 'all' ? 'All' : mode.charAt(0).toUpperCase() + mode.slice(1)}
            {mode !== 'all' && (
              <span className="ml-2 text-xs opacity-70">
                ({mode === 'critical' ? stats.critical : mode === 'high' ? stats.high : mode === 'medium' ? stats.medium : stats.low})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Queue List */}
      <div className="space-y-3">
        {filteredQueue.length === 0 ? (
          <div className="bg-zinc-900 rounded-xl p-12 text-center border border-zinc-800">
            <div className="text-4xl mb-4">✅</div>
            <div className="text-xl font-medium text-zinc-300">Queue Clear</div>
            <div className="text-zinc-500 mt-2">
              {filterMode === 'all'
                ? 'No actionable leads at this time'
                : `No ${filterMode} priority actions`}
            </div>
          </div>
        ) : (
          filteredQueue.map((action, index) => {
            const isExpanded = expandedId === action.id
            const isExecuting = executing === action.id
            const config = urgencyConfig[action.urgency]

            return (
              <div
                key={action.id}
                className={`bg-zinc-900 rounded-xl border ${config.bg} overflow-hidden transition-all`}
              >
                {/* Main Row */}
                <div
                  className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : action.id)}
                >
                  <div className="flex items-start gap-4">
                    {/* Rank & Icon */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs text-zinc-500 font-mono">#{index + 1}</span>
                      <span className="text-2xl">{actionIcons[action.actionType]}</span>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                          {config.label}
                        </span>
                        <span className="font-semibold text-white truncate">
                          {action.leadName}
                        </span>
                        <span className="text-zinc-500 text-sm hidden md:inline">
                          • {action.propertyAddress}
                        </span>
                      </div>

                      <div className="text-sm font-medium text-cyan-400 mb-2">
                        {action.actionLabel}
                      </div>

                      <div className="text-sm text-zinc-400 line-clamp-2">
                        {action.whySurfaced}
                      </div>
                    </div>

                    {/* Right Side Stats */}
                    <div className="text-right space-y-1 shrink-0">
                      <div className="text-lg font-bold text-green-400">
                        {formatCurrency(action.excessAmount)}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Score: {action.eleanorScore}
                      </div>
                      <div className="text-xs text-zinc-600">
                        Priority: {action.priorityScore}
                      </div>
                    </div>

                    {/* Execute Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        executeAction(action)
                      }}
                      disabled={isExecuting}
                      className={`px-4 py-2 rounded-lg font-medium transition-all shrink-0 ${
                        isExecuting
                          ? 'bg-zinc-700 text-zinc-400 cursor-wait'
                          : action.urgency === 'critical'
                          ? 'bg-red-600 hover:bg-red-500 text-white'
                          : 'bg-cyan-600 hover:bg-cyan-500 text-white'
                      }`}
                    >
                      {isExecuting ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⟳</span> Running
                        </span>
                      ) : (
                        'Execute'
                      )}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 bg-zinc-950/50 p-4 space-y-4">
                    <div className="grid md:grid-cols-3 gap-4">
                      {/* Recommended Action */}
                      <div className="bg-zinc-900/50 rounded-lg p-3">
                        <div className="text-xs text-cyan-400 font-medium mb-1">
                          RECOMMENDED ACTION
                        </div>
                        <div className="text-sm text-white">
                          {action.recommendedAction}
                        </div>
                      </div>

                      {/* Why Surfaced */}
                      <div className="bg-zinc-900/50 rounded-lg p-3">
                        <div className="text-xs text-purple-400 font-medium mb-1">
                          WHY SURFACED NOW
                        </div>
                        <div className="text-sm text-zinc-300">
                          {action.whySurfaced}
                        </div>
                      </div>

                      {/* Consequence */}
                      <div className="bg-zinc-900/50 rounded-lg p-3">
                        <div className="text-xs text-red-400 font-medium mb-1">
                          IF IGNORED
                        </div>
                        <div className="text-sm text-zinc-300">
                          {action.consequenceIfIgnored}
                        </div>
                      </div>
                    </div>

                    {/* Metadata Row */}
                    <div className="flex flex-wrap gap-3 text-xs">
                      <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">
                        Status: {action.metadata.status}
                      </span>
                      <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">
                        Attempts: {action.metadata.contactAttempts}
                      </span>
                      {action.metadata.daysSinceContact !== null && (
                        <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">
                          Last Contact: {action.metadata.daysSinceContact}d ago
                        </span>
                      )}
                      <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">
                        Created: {action.metadata.daysSinceCreated}d ago
                      </span>
                      <span
                        className={`px-2 py-1 rounded ${
                          action.metadata.hasPhone
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}
                      >
                        {action.metadata.hasPhone ? '✓ Has Phone' : '✗ No Phone'}
                      </span>
                      <span className="px-2 py-1 bg-zinc-800 rounded text-zinc-400">
                        Grade: {action.metadata.dealGrade}
                      </span>
                    </div>

                    {/* Quick Actions */}
                    <div className="flex gap-2 pt-2 border-t border-zinc-800">
                      <a
                        href={`/dashboard/leads?id=${action.leadId}`}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-sm text-zinc-300"
                      >
                        View Lead
                      </a>
                      <button
                        onClick={() => executeAction(action)}
                        disabled={isExecuting}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-sm text-white font-medium"
                      >
                        {action.actionLabel}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Action Type Breakdown */}
      {queue.length > 0 && (
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-sm text-zinc-500 mb-3">Action Type Breakdown</div>
          <div className="flex flex-wrap gap-3">
            {(Object.entries(stats.actionBreakdown) as [ActionType, number][])
              .filter(([, count]) => count > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <div
                  key={type}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg"
                >
                  <span>{actionIcons[type]}</span>
                  <span className="text-sm text-zinc-300 capitalize">
                    {type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm font-bold text-cyan-400">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  )
}
