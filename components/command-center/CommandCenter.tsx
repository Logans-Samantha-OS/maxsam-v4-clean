'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/Toast'
import NotebookSearch from './NotebookSearch'

export type CommandCenterProps = {
  mode?: string | null
  leadIds?: string[]
}

interface PipelineResult {
  success: boolean
  stage: string
  parsed: number
  inserted: number
  duplicates: number
  scored: number
  goldenLeads: number
  skipTraced: number
  queued: number
  totalPotential: number
  errors: string[]
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

interface AgentState {
  agent: string
  status: 'idle' | 'working' | 'paused' | 'error'
  current_task: string | null
  last_run: string | null
}

interface AgentGoal {
  id: string
  agent: string
  goal: string
  goal_key: string
  priority: number
  target_daily: number | null
  current_daily: number
  progress_percent: number | null
}

interface AgentLoopStatus {
  agents: Record<string, AgentState>
  goals: AgentGoal[]
  recent_decisions: Array<{
    agent: string
    decision: string
    reasoning: string
    outcome: string
    success: boolean
    created_at: string
  }>
  opportunities: {
    golden_uncontacted: number
    expiring_claims: number
    unscored: number
    missing_phones: number
    non_responders: number
  }
}

interface DrillDownModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

function DrillDownModal({ isOpen, onClose, title, children }: DrillDownModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-zinc-400 hover:text-white text-xl">&times;</button>
        </div>
        {children}
      </div>
    </div>
  )
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

function StatCard({
  label,
  value,
  subtext,
  color = 'zinc',
  onClick
}: {
  label: string
  value: string | number
  subtext?: string
  color?: string
  onClick?: () => void
}) {
  const colorClasses: Record<string, string> = {
    zinc: 'border-zinc-700',
    green: 'border-green-500/50',
    yellow: 'border-yellow-500/50',
    blue: 'border-blue-500/50',
    purple: 'border-purple-500/50',
  }

  return (
    <div
      className={`bg-zinc-900 border ${colorClasses[color]} rounded-lg p-4 ${onClick ? 'cursor-pointer hover:bg-zinc-800 transition-colors' : ''}`}
      onClick={onClick}
    >
      <div className="text-xs text-zinc-400 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-zinc-100 mt-1">{value}</div>
      {subtext && <div className="text-xs text-zinc-500 mt-1">{subtext}</div>}
      {onClick && <div className="text-xs text-blue-400 mt-1">Click to view →</div>}
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
  const router = useRouter()
  const { addToast } = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, unknown> | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [systemStatus, setSystemStatus] = useState<'online' | 'degraded' | 'offline'>('online')
  const [modalOpen, setModalOpen] = useState<string | null>(null)
  const [importProgress, setImportProgress] = useState<PipelineResult | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [agentStatus, setAgentStatus] = useState<AgentLoopStatus | null>(null)
  const [agentLoopLoading, setAgentLoopLoading] = useState(false)

  const fetchAgentStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/agent-loop')
      if (res.ok) {
        const data = await res.json()
        setAgentStatus(data)
      }
    } catch {
      // Ignore agent status errors
    }
  }, [])

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
    fetchAgentStatus()
    const interval = setInterval(() => {
      fetchStats()
      fetchAgentStatus()
    }, 30000)
    return () => clearInterval(interval)
  }, [fetchStats, fetchAgentStatus])

  const runAction = async (action: string, endpoint: string, body?: object, method: 'POST' | 'GET' = 'POST') => {
    setLoadingAction(action)
    setResults(null)

    try {
      const options: RequestInit = method === 'GET'
        ? { method: 'GET' }
        : {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body || {}),
          }

      const res = await fetch(endpoint, options)
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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.pdf')) {
      addToast('error', 'Please select a PDF file')
      return
    }

    setImporting(true)
    setModalOpen('import')
    setImportProgress(null)

    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('source', 'manual_upload')

      const res = await fetch('/api/pipeline/ingest', {
        method: 'POST',
        body: formData,
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setImportProgress(data)
        addToast('success', `Imported ${data.inserted} leads, ${data.goldenLeads} golden!`)
        fetchStats()
      } else {
        addToast('error', data.error || 'Import failed')
        setImportProgress(data)
      }
    } catch {
      addToast('error', 'Upload failed')
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const triggerImportFromURL = async (url: string) => {
    setImporting(true)
    setModalOpen('import')
    setImportProgress(null)

    try {
      const res = await fetch('/api/pipeline/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, source: 'url_import' }),
      })

      const data = await res.json()

      if (res.ok && data.success) {
        setImportProgress(data)
        addToast('success', `Imported ${data.inserted} leads from URL!`)
        fetchStats()
      } else {
        addToast('error', data.error || 'Import failed')
        setImportProgress(data)
      }
    } catch {
      addToast('error', 'URL import failed')
    } finally {
      setImporting(false)
    }
  }

  const runAgentLoop = async () => {
    setAgentLoopLoading(true)
    try {
      const res = await fetch('/api/agent-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      const data = await res.json()
      if (data.status === 'completed') {
        addToast('success', `Agent: ${data.action?.agent} - ${data.action?.action}`)
      } else if (data.status === 'idle') {
        addToast('info', 'No actions needed right now')
      } else {
        addToast('error', data.message || 'Agent loop failed')
      }
      fetchAgentStatus()
    } catch {
      addToast('error', 'Failed to run agent loop')
    } finally {
      setAgentLoopLoading(false)
    }
  }

  const toggleAgentPause = async (agent: string, paused: boolean) => {
    try {
      await fetch('/api/agent-loop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: paused ? 'pause' : 'resume', agent })
      })
      addToast('success', `${agent} ${paused ? 'paused' : 'resumed'}`)
      fetchAgentStatus()
    } catch {
      addToast('error', 'Failed to update agent')
    }
  }

  const getAgentStatusColor = (status: string) => {
    switch (status) {
      case 'idle': return 'bg-green-500'
      case 'working': return 'bg-blue-500 animate-pulse'
      case 'paused': return 'bg-yellow-500'
      case 'error': return 'bg-red-500'
      default: return 'bg-zinc-500'
    }
  }

  const getAgentEmoji = (agent: string) => {
    switch (agent) {
      case 'ALEX': return '🔍'
      case 'ELEANOR': return '🎯'
      case 'SAM': return '📱'
      case 'RALPH': return '🤖'
      default: return '🤖'
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
            <StatCard
              label="Total Leads"
              value={stats.totalLeads}
              onClick={() => router.push('/dashboard/leads')}
            />
            <StatCard
              label="Golden Leads"
              value={stats.goldenLeads}
              color="yellow"
              onClick={() => router.push('/dashboard/golden-leads')}
            />
            <StatCard
              label="Pipeline Value"
              value={formatCurrency(stats.pipelineValue)}
              color="green"
              onClick={() => setModalOpen('pipeline')}
            />
            <StatCard
              label="Projected Revenue"
              value={formatCurrency(stats.projectedRevenue)}
              subtext="25% fee"
              color="green"
              onClick={() => setModalOpen('revenue')}
            />
            <StatCard
              label="Contacted Today"
              value={stats.contactedToday}
              color="blue"
              onClick={() => router.push('/dashboard/leads?filter=contacted_today')}
            />
            <StatCard
              label="Messages"
              value={stats.messages.total}
              subtext={`${stats.messages.inbound} in / ${stats.messages.outbound} out`}
              color="purple"
              onClick={() => router.push('/dashboard/messages')}
            />
          </>
        ) : (
          <div className="col-span-6 text-center py-8 text-zinc-400">
            Failed to load stats
          </div>
        )}
      </div>

      {/* Agent Status Panel */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Agent Status</h2>
          <div className="flex gap-2">
            <button
              onClick={runAgentLoop}
              disabled={agentLoopLoading}
              className="px-3 py-1.5 text-xs bg-purple-600 hover:bg-purple-500 rounded-lg text-white transition-colors disabled:opacity-50"
            >
              {agentLoopLoading ? 'Running...' : 'Run Agent Loop'}
            </button>
            <button
              onClick={fetchAgentStatus}
              className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {agentStatus ? (
          <>
            {/* Agent Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {['ALEX', 'ELEANOR', 'SAM', 'RALPH'].map(agent => {
                const state = agentStatus.agents[agent]
                const goals = agentStatus.goals.filter(g => g.agent === agent)
                const completedGoals = goals.filter(g => g.progress_percent !== null && g.progress_percent >= 100).length

                return (
                  <div key={agent} className="bg-zinc-800 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getAgentEmoji(agent)}</span>
                        <span className="font-medium text-white text-sm">{agent}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${getAgentStatusColor(state?.status || 'idle')}`} />
                        <button
                          onClick={() => toggleAgentPause(agent, state?.status !== 'paused')}
                          className="text-xs text-zinc-400 hover:text-white"
                        >
                          {state?.status === 'paused' ? 'Resume' : 'Pause'}
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-500 capitalize mb-1">
                      {state?.current_task || state?.status || 'idle'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {completedGoals}/{goals.length} goals met today
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Opportunities */}
            <div className="grid grid-cols-5 gap-2 mb-4">
              <div className="bg-yellow-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-yellow-400">{agentStatus.opportunities.golden_uncontacted}</div>
                <div className="text-xs text-zinc-500">Golden Uncontacted</div>
              </div>
              <div className="bg-red-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-red-400">{agentStatus.opportunities.expiring_claims}</div>
                <div className="text-xs text-zinc-500">Expiring Claims</div>
              </div>
              <div className="bg-blue-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-blue-400">{agentStatus.opportunities.unscored}</div>
                <div className="text-xs text-zinc-500">Unscored</div>
              </div>
              <div className="bg-purple-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-purple-400">{agentStatus.opportunities.missing_phones}</div>
                <div className="text-xs text-zinc-500">Missing Phones</div>
              </div>
              <div className="bg-orange-900/30 rounded-lg p-2 text-center">
                <div className="text-lg font-bold text-orange-400">{agentStatus.opportunities.non_responders}</div>
                <div className="text-xs text-zinc-500">Non-Responders</div>
              </div>
            </div>

            {/* Recent Decisions */}
            {agentStatus.recent_decisions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-zinc-400 mb-2">Recent Agent Decisions</h3>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {agentStatus.recent_decisions.slice(0, 5).map((decision, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs bg-zinc-800/50 rounded p-2">
                      <span className={`flex-shrink-0 ${decision.success ? 'text-green-400' : 'text-red-400'}`}>
                        {decision.success ? '✓' : '✗'}
                      </span>
                      <div>
                        <span className="text-zinc-300">{decision.agent}:</span>{' '}
                        <span className="text-zinc-400">{decision.decision}</span>
                        {decision.outcome && (
                          <div className="text-zinc-500 mt-0.5">{decision.outcome}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-4 text-zinc-500">Loading agent status...</div>
        )}
      </div>

      {/* NotebookLM Search */}
      <NotebookSearch />

      {/* Pipeline Actions */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Pipeline Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <ActionButton
            label="Import PDFs"
            emoji="📄"
            description="Upload & process leads"
            color="blue"
            loading={importing}
            onClick={() => fileInputRef.current?.click()}
          />
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
        {/* Hidden file input for PDF upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleFileUpload}
        />
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
            onClick={() => runAction('Health Check', '/api/diagnostics', undefined, 'GET')}
          />
          <ActionButton
            label="Pipeline Stats"
            emoji="📊"
            description="Analytics overview"
            color="purple"
            loading={loadingAction === 'stats'}
            onClick={() => runAction('Pipeline Stats', '/api/analytics/pipeline', undefined, 'GET')}
          />
          <ActionButton
            label="Activity Feed"
            emoji="📋"
            description="Recent events"
            color="orange"
            loading={loadingAction === 'activity'}
            onClick={() => runAction('Activity', '/api/activity', undefined, 'GET')}
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

      {/* Pipeline Value Modal */}
      <DrillDownModal
        isOpen={modalOpen === 'pipeline'}
        onClose={() => setModalOpen(null)}
        title="Pipeline Value Breakdown"
      >
        {stats && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-green-400">{formatCurrency(stats.pipelineValue)}</div>
              <div className="text-zinc-400 text-sm">Total Pipeline Value</div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">By Status:</h4>
              {Object.entries(stats.statusCounts).map(([status, count]) => (
                <div key={status} className="flex justify-between items-center py-2 border-b border-zinc-800">
                  <span className="text-zinc-400 capitalize">{status.replace('_', ' ')}</span>
                  <span className="text-white font-medium">{count} leads</span>
                </div>
              ))}
            </div>
            <div className="pt-4 border-t border-zinc-700">
              <p className="text-xs text-zinc-500">
                Pipeline value = sum of all excess_funds_amount across {stats.totalLeads} leads
              </p>
            </div>
            <button
              onClick={() => { setModalOpen(null); router.push('/dashboard/leads'); }}
              className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm"
            >
              View All Leads
            </button>
          </div>
        )}
      </DrillDownModal>

      {/* Projected Revenue Modal */}
      <DrillDownModal
        isOpen={modalOpen === 'revenue'}
        onClose={() => setModalOpen(null)}
        title="Projected Revenue Calculation"
      >
        {stats && (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="text-3xl font-bold text-green-400">{formatCurrency(stats.projectedRevenue)}</div>
              <div className="text-zinc-400 text-sm">Projected Revenue (25% Fee)</div>
            </div>
            <div className="bg-zinc-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-300 mb-3">Revenue Calculation:</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Pipeline Value:</span>
                  <span className="text-white">{formatCurrency(stats.pipelineValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Recovery Fee:</span>
                  <span className="text-white">25%</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-zinc-700">
                  <span className="text-zinc-300 font-medium">Projected Revenue:</span>
                  <span className="text-green-400 font-bold">{formatCurrency(stats.projectedRevenue)}</span>
                </div>
              </div>
            </div>
            <div className="bg-zinc-800/50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-zinc-300 mb-2">By Deal Priority:</h4>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-red-900/30 rounded p-2">
                  <div className="text-red-400 font-bold">{stats.statusCounts['qualified'] || 0}</div>
                  <div className="text-xs text-zinc-500">Hot</div>
                </div>
                <div className="bg-yellow-900/30 rounded p-2">
                  <div className="text-yellow-400 font-bold">{stats.statusCounts['contacted'] || 0}</div>
                  <div className="text-xs text-zinc-500">Warm</div>
                </div>
                <div className="bg-blue-900/30 rounded p-2">
                  <div className="text-blue-400 font-bold">{stats.statusCounts['new'] || 0}</div>
                  <div className="text-xs text-zinc-500">New</div>
                </div>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Actual revenue depends on conversion rates and deal closures.
            </p>
            <button
              onClick={() => { setModalOpen(null); router.push('/dashboard/pipeline'); }}
              className="w-full mt-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-white text-sm"
            >
              View Pipeline
            </button>
          </div>
        )}
      </DrillDownModal>

      {/* Import Progress Modal */}
      <DrillDownModal
        isOpen={modalOpen === 'import'}
        onClose={() => !importing && setModalOpen(null)}
        title="Lead Import Pipeline"
      >
        <div className="space-y-4">
          {importing && !importProgress && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4" />
              <p className="text-zinc-300">Processing PDF with Gemini AI...</p>
              <p className="text-xs text-zinc-500 mt-2">Extracting leads, scoring, and cross-referencing</p>
            </div>
          )}

          {importProgress && (
            <div className="space-y-4">
              <div className={`text-center py-4 rounded-lg ${importProgress.success ? 'bg-green-900/30' : 'bg-red-900/30'}`}>
                <div className="text-2xl mb-2">{importProgress.success ? '✅' : '❌'}</div>
                <div className="text-lg font-bold text-white">
                  {importProgress.success ? 'Import Complete' : 'Import Failed'}
                </div>
                <div className="text-sm text-zinc-400">Stage: {importProgress.stage}</div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-400">{importProgress.parsed}</div>
                  <div className="text-xs text-zinc-500">Parsed</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-400">{importProgress.inserted}</div>
                  <div className="text-xs text-zinc-500">Inserted</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-400">{importProgress.goldenLeads}</div>
                  <div className="text-xs text-zinc-500">Golden Leads</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-orange-400">{importProgress.duplicates}</div>
                  <div className="text-xs text-zinc-500">Duplicates</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{importProgress.skipTraced}</div>
                  <div className="text-xs text-zinc-500">Skip Traced</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{importProgress.queued}</div>
                  <div className="text-xs text-zinc-500">Queued for SAM</div>
                </div>
              </div>

              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-4 text-center">
                <div className="text-sm text-zinc-400">Potential Revenue</div>
                <div className="text-2xl font-bold text-green-400">
                  {formatCurrency(importProgress.totalPotential * 0.25)}
                </div>
                <div className="text-xs text-zinc-500">25% of {formatCurrency(importProgress.totalPotential)}</div>
              </div>

              {importProgress.errors.length > 0 && (
                <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-red-400 mb-2">Errors:</h4>
                  <ul className="text-xs text-red-300 space-y-1 max-h-24 overflow-y-auto">
                    {importProgress.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => { setModalOpen(null); router.push('/dashboard/leads'); }}
                className="w-full py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm"
              >
                View Imported Leads
              </button>
            </div>
          )}

          {!importing && !importProgress && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-400 text-center">
                Upload a Dallas County excess funds PDF or import from URL
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="py-3 bg-blue-600 hover:bg-blue-500 rounded-lg text-white text-sm flex flex-col items-center"
                >
                  <span className="text-xl mb-1">📄</span>
                  Upload PDF
                </button>
                <button
                  onClick={() => {
                    const url = prompt('Enter PDF URL:')
                    if (url) triggerImportFromURL(url)
                  }}
                  className="py-3 bg-purple-600 hover:bg-purple-500 rounded-lg text-white text-sm flex flex-col items-center"
                >
                  <span className="text-xl mb-1">🔗</span>
                  Import from URL
                </button>
              </div>
            </div>
          )}
        </div>
      </DrillDownModal>
    </div>
  )
}
