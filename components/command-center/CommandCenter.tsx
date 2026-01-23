'use client'

import { useState } from 'react'
import { useToast } from '@/components/Toast'

export type CommandCenterProps = {
  mode?: string | null
  leadIds?: string[]
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

export default function CommandCenter({ mode, leadIds }: CommandCenterProps) {
  const { addToast } = useToast()
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, unknown> | null>(null)

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
      } else {
        addToast('error', data.error || `${action} failed`)
      }
    } catch {
      addToast('error', `Network error during ${action}`)
    } finally {
      setLoadingAction(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Command Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            CEO controls for pipeline execution and system operations
          </p>
        </div>
      </div>

      {mode && (
        <div className="rounded-xl border bg-blue-50 dark:bg-blue-900/20 p-4">
          <p className="text-sm">Mode: <span className="font-medium">{mode}</span></p>
          {leadIds && leadIds.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Selected leads: {leadIds.length}
            </p>
          )}
        </div>
      )}

      {/* Pipeline Actions */}
      <div className="rounded-xl border bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Pipeline Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton
            label="Run Ralph"
            emoji="..."
            description="Execute orchestration"
            color="purple"
            loading={loadingAction === 'ralph'}
            onClick={() => runAction('Ralph', '/api/ralph/run')}
          />
          <ActionButton
            label="Score All"
            emoji="..."
            description="Eleanor batch scoring"
            color="green"
            loading={loadingAction === 'score'}
            onClick={() => runAction('Eleanor Score', '/api/eleanor/score-all', { status: ['new', 'scored'], limit: 100 })}
          />
          <ActionButton
            label="Skip Trace"
            emoji="..."
            description="Batch phone lookup"
            color="blue"
            loading={loadingAction === 'skip'}
            onClick={() => {
              addToast('info', 'Skip trace batch not yet implemented - use individual row buttons')
            }}
          />
          <ActionButton
            label="SAM Batch"
            emoji="..."
            description="Batch SMS outreach"
            color="orange"
            loading={loadingAction === 'sam'}
            onClick={() => runAction('SAM Batch', '/api/sam/run-batch')}
          />
        </div>
      </div>

      {/* Reporting */}
      <div className="rounded-xl border bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Reports & Diagnostics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ActionButton
            label="Morning Brief"
            emoji="..."
            description="Daily summary report"
            color="blue"
            loading={loadingAction === 'brief'}
            onClick={() => runAction('Morning Brief', '/api/morning-brief')}
          />
          <ActionButton
            label="System Health"
            emoji="..."
            description="Check all systems"
            color="green"
            loading={loadingAction === 'health'}
            onClick={() => runAction('Health Check', '/api/diagnostics')}
          />
          <ActionButton
            label="Pipeline Stats"
            emoji="..."
            description="Analytics overview"
            color="purple"
            loading={loadingAction === 'stats'}
            onClick={() => runAction('Pipeline Stats', '/api/analytics/pipeline')}
          />
          <ActionButton
            label="Activity Feed"
            emoji="..."
            description="Recent events"
            color="orange"
            loading={loadingAction === 'activity'}
            onClick={() => runAction('Activity', '/api/activity')}
          />
        </div>
      </div>

      {/* Quick Links */}
      <div className="rounded-xl border bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold mb-4 text-white">Quick Links</h2>
        <div className="flex flex-wrap gap-2">
          <a
            href="/dashboard/governance"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            System Governance
          </a>
          <a
            href="/dashboard/upload"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Upload PDFs
          </a>
          <a
            href="/dashboard/stats"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Statistics
          </a>
          <a
            href="/leads"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Leads Table
          </a>
          <a
            href="https://skooki.app.n8n.cloud"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            N8N Dashboard
          </a>
          <a
            href="https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-white transition-colors"
          >
            Supabase Dashboard
          </a>
        </div>
      </div>

      {/* Results Panel */}
      {results && (
        <div className="rounded-xl border bg-zinc-900 p-4">
          <h2 className="text-lg font-semibold mb-4 text-white">Last Action Results</h2>
          <pre className="bg-black rounded-lg p-4 text-xs text-green-400 overflow-auto max-h-64">
            {JSON.stringify(results, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
