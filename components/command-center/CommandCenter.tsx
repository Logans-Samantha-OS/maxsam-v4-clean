'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/Toast'

export type CommandCenterProps = {
  mode?: string | null
  leadIds?: string[]
}

interface Stats {
  totalLeads: number
  goldenLeads: number
  pipelineValue: number
  projectedRevenue: number
  contactedToday: number
  leadsToday: number
  avgScore: number
  statusCounts: Record<string, number>
  messages: {
    total: number
    inbound: number
    outbound: number
  }
}

interface ActionButtonProps {
  label: string
  emoji: string
  description: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple'
}

function ActionButton({ label, emoji, description, onClick, loading, disabled, color = 'blue' }: ActionButtonProps) {
  const colorClasses = {
    blue: 'from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 border-blue-500/30',
    green: 'from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 border-green-500/30',
    orange: 'from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 border-orange-500/30',
    red: 'from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 border-red-500/30',
    purple: 'from-purple-600 to-purple-500 hover:from-purple-500 hover:to-purple-400 border-purple-500/30',
  }

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
        ${loading ? 'animate-pulse' : ''}
        bg-gradient-to-br ${colorClasses[color]}
      `}
    >
      <span className="text-2xl mb-2">{loading ? '...' : emoji}</span>
      <span className="text-sm font-bold text-white">{label}</span>
      <span className="text-xs text-white/70 mt-1 text-center">{description}</span>
    </button>
  )
}

function StatCard({ label, value, subtext, color = 'zinc' }: { label: string; value: string | number; subtext?: string; color?: string }) {
  const colorClasses: Record<string, string> = {
    zinc: 'border-zinc-700',
    green: 'border-green-500/50',
    yellow: 'border-yellow-500/50',
    blue: 'border-blue-500/50',
    purple: 'border-purple-500/50',
  }

  return (
    <div className={`bg-zinc-900 border ${colorClasses[color]} rounded-lg p-4`}>
      <div className="text-xs text-zinc-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-zinc-100 mt-1">{value}</div>
      {subtext && <div className="text-xs text-zinc-500 mt-1">{subtext}</div>}
    </div>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default function CommandCenter({ mode, leadIds }: CommandCenterProps) {
  const { addToast } = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, unknown> | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [systemStatus, setSystemStatus] = useState<'online' | 'degraded' | 'offline'>('online')

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setSystemStatus('online')
      } else {
        setSystemStatus('degraded')
      }
    } catch {
      setSystemStatus('offline')
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [fetchStats])

  const runAction = async (action: string, endpoint: string, body?: object) => {
    setLoadingAction(action)
    setResults(null)

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      })

      const data = await res.json()

      if (res.ok) {
        addToast('success', `${action} completed successfully`)
        setResults(data)
        fetchStats()
      } else {
        addToast('error', data.error || `${action} failed`)
      }
    } catch {
      addToast('error', `Network error during ${action}`)
    } finally {
      setLoadingAction(null)
    }
  }

  const getStatusColor = (status: 'online' | 'degraded' | 'offline') => {
    switch (status) {
      case 'online': return 'bg-green-500'
      case 'degraded': return 'bg-yellow-500'
      case 'offline': return 'bg-red-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Command Center</h1>
          <p className="text-zinc-400 text-sm mt-1">
            CEO controls for pipeline execution and system operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-800">
            <div className={`w-2 h-2 rounded-full ${getStatusColor(systemStatus)} animate-pulse`} />
            <span className="text-xs text-zinc-400 capitalize">{systemStatus}</span>
          </div>
          <button
            onClick={fetchStats}
            className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {mode && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-900/20 p-4">
          <p className="text-sm text-blue-200">Mode: <span className="font-medium">{mode}</span></p>
          {leadIds && leadIds.length > 0 && (
            <p className="text-sm text-blue-300/70">
              Selected leads: {leadIds.length}
            </p>
          )}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {statsLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-3 bg-zinc-800 rounded w-16 mb-2" />
              <div className="h-6 bg-zinc-800 rounded w-20" />
            </div>
          ))
        ) : stats ? (
          <>
            <StatCard label="Total Leads" value={stats.totalLeads} />
            <StatCard label="Golden Leads" value={stats.goldenLeads} color="yellow" />
            <StatCard label="Pipeline Value" value={formatCurrency(stats.pipelineValue)} color="green" />
            <StatCard
              label="Projected Revenue"
              value={formatCurrency(stats.projectedRevenue)}
              subtext="25% fee"
              color="green"
            />
            <StatCard
              label="Contacted Today"
              value={stats.contactedToday}
              color="blue"
            />
            <StatCard
              label="Messages"
              value={stats.messages.total}
              subtext={`${stats.messages.inbound} in / ${stats.messages.outbound} out`}
              color="purple"
            />
          </>
        ) : (
          <div className="col-span-6 text-center py-8 text-zinc-400">
            Failed to load stats
          </div>
        )}
      </div>

      {/* Pipeline Actions */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Pipeline Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton
            label="Run Ralph"
            emoji="🤖"
            description="Execute orchestration"
            color="purple"
            loading={loadingAction === 'ralph'}
            onClick={() => runAction('Ralph', '/api/ralph/run')}
          />
          <ActionButton
            label="Score All"
            emoji="🎯"
            description="Eleanor batch scoring"
            color="green"
            loading={loadingAction === 'score'}
            onClick={() => runAction('Eleanor Score', '/api/eleanor/score-all', { status: ['new', 'scored'], limit: 100 })}
          />
          <ActionButton
            label="Skip Trace"
            emoji="🔍"
            description="Batch phone lookup"
            color="blue"
            loading={loadingAction === 'skip'}
            onClick={() => {
              addToast('info', 'Skip trace runs automatically at 2AM CST')
            }}
          />
          <ActionButton
            label="SAM Batch"
            emoji="📱"
            description="Batch SMS outreach"
            color="orange"
            loading={loadingAction === 'sam'}
            onClick={() => runAction('SAM Batch', '/api/sam/run-batch')}
          />
        </div>
      </div>

      {/* Reports & Diagnostics */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Reports & Diagnostics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton
            label="Morning Brief"
            emoji="☀️"
            description="Daily summary report"
            color="blue"
            loading={loadingAction === 'brief'}
            onClick={() => runAction('Morning Brief', '/api/morning-brief')}
          />
          <ActionButton
            label="System Health"
            emoji="💚"
            description="Check all systems"
            color="green"
            loading={loadingAction === 'health'}
            onClick={() => runAction('Health Check', '/api/diagnostics')}
          />
          <ActionButton
            label="Pipeline Stats"
            emoji="📊"
            description="Analytics overview"
            color="purple"
            loading={loadingAction === 'stats'}
            onClick={() => runAction('Pipeline Stats', '/api/analytics/pipeline')}
          />
          <ActionButton
            label="Activity Feed"
            emoji="📋"
            description="Recent events"
            color="orange"
            loading={loadingAction === 'activity'}
            onClick={() => runAction('Activity', '/api/activity')}
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/leads"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Leads Dashboard
          </a>
          <a
            href="/dashboard/pipeline"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Pipeline View
          </a>
          <a
            href="/dashboard/messages"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Messages
          </a>
          <a
            href="/dashboard/golden-leads"
            className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 rounded-lg text-sm text-white transition-colors"
          >
            Golden Leads
          </a>
          <a
            href="/dashboard/governance"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Governance
          </a>
          <a
            href="/dashboard/upload"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Upload PDFs
          </a>
          <a
            href="https://skooki.app.n8n.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm text-white transition-colors"
          >
            N8N Dashboard
          </a>
          <a
            href="https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm text-white transition-colors"
          >
            Supabase
          </a>
        </div>
      </div>

      {/* Automation Schedule */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Automation Schedule (CST)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500">2:00 AM</div>
            <div className="font-medium text-zinc-200">ALEX Skip Trace</div>
            <div className="text-xs text-zinc-400">Find phones for leads</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500">5:00 AM</div>
            <div className="font-medium text-zinc-200">Eleanor Scoring</div>
            <div className="text-xs text-zinc-400">Score new/updated leads</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500">8:00 AM</div>
            <div className="font-medium text-zinc-200">Daily Brief</div>
            <div className="text-xs text-zinc-400">Telegram summary</div>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <div className="text-xs text-zinc-500">9:00 AM</div>
            <div className="font-medium text-zinc-200">SAM Outreach</div>
            <div className="text-xs text-zinc-400">SMS top 20 leads</div>
          </div>
        </div>
      </div>

      {/* Results Panel */}
      {results && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-lg font-semibold mb-4 text-white">Last Action Results</h2>
          <pre className="bg-black rounded-lg p-4 text-xs text-green-400 overflow-auto max-h-64">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
