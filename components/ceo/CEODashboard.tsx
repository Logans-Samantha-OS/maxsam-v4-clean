'use client'

import { useState, useEffect, useCallback } from 'react'

// ============================================================================
// TYPES
// ============================================================================

interface GovernanceGate {
  id: string
  control_key: string
  enabled: boolean
  disabled_by: string | null
  disabled_at: string | null
  disabled_reason: string | null
}

interface WorkflowControl {
  id: string
  n8n_workflow_id: string
  workflow_name: string
  enabled: boolean
  n8n_active_state: boolean | null
  last_synced_at: string | null
}

interface GovernanceState {
  system_killed: boolean
  governance_gates: GovernanceGate[]
  workflow_controls: WorkflowControl[]
}

interface SystemConfig {
  autonomy_level: number
  ralph_enabled: boolean
  outreach_enabled: boolean
}

// ============================================================================
// TOGGLE COMPONENT
// ============================================================================

function Toggle({
  enabled,
  onChange,
  loading,
  disabled,
  size = 'md'
}: {
  enabled: boolean
  onChange: () => void
  loading?: boolean
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClasses = {
    sm: 'w-8 h-4',
    md: 'w-12 h-6',
    lg: 'w-16 h-8'
  }
  const dotSizes = {
    sm: 'w-3 h-3',
    md: 'w-5 h-5',
    lg: 'w-7 h-7'
  }
  const translateX = {
    sm: enabled ? 'translate-x-4' : 'translate-x-0.5',
    md: enabled ? 'translate-x-6' : 'translate-x-0.5',
    lg: enabled ? 'translate-x-8' : 'translate-x-0.5'
  }

  return (
    <button
      onClick={onChange}
      disabled={loading || disabled}
      className={`relative rounded-full transition-colors duration-200 ${sizeClasses[size]} ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
      } ${enabled ? 'bg-green-500' : 'bg-zinc-600'}`}
    >
      <span
        className={`absolute top-0.5 left-0 bg-white rounded-full shadow transition-transform duration-200 ${dotSizes[size]} ${translateX[size]} ${
          loading ? 'animate-pulse' : ''
        }`}
      />
    </button>
  )
}

// ============================================================================
// AUTONOMY SLIDER
// ============================================================================

function AutonomySlider({
  value,
  onChange,
  loading
}: {
  value: number
  onChange: (v: number) => void
  loading?: boolean
}) {
  const levels = [
    { value: 0, label: 'OFF', description: 'Manual only', color: 'bg-zinc-600' },
    { value: 1, label: 'LOW', description: 'Assist mode', color: 'bg-yellow-500' },
    { value: 2, label: 'MED', description: 'Semi-auto', color: 'bg-orange-500' },
    { value: 3, label: 'FULL', description: 'Full auto', color: 'bg-red-500' }
  ]

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <span className="text-sm text-zinc-400">Autonomy Level</span>
        <span className={`text-sm font-bold ${loading ? 'animate-pulse' : ''}`}>
          {levels[value].label}
        </span>
      </div>
      <div className="flex gap-2">
        {levels.map((level) => (
          <button
            key={level.value}
            onClick={() => onChange(level.value)}
            disabled={loading}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all ${
              value === level.value
                ? `${level.color} text-white shadow-lg`
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            } ${loading ? 'opacity-50' : ''}`}
          >
            <div>{level.label}</div>
            <div className="text-[10px] opacity-70">{level.description}</div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// PIPELINE CONTROL CARD
// ============================================================================

function PipelineControlCard({
  title,
  gateKey,
  enabled,
  loading,
  onToggle,
  description,
  icon
}: {
  title: string
  gateKey: string
  enabled: boolean
  loading: boolean
  onToggle: (key: string, enabled: boolean) => void
  description: string
  icon: string
}) {
  return (
    <div
      className={`p-4 rounded-xl border transition-all ${
        enabled
          ? 'bg-green-900/20 border-green-500/50'
          : 'bg-zinc-900 border-zinc-700'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="font-semibold text-white">{title}</span>
        </div>
        <Toggle
          enabled={enabled}
          onChange={() => onToggle(gateKey, !enabled)}
          loading={loading}
        />
      </div>
      <p className="text-xs text-zinc-400">{description}</p>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded ${
            enabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
          }`}
        >
          {enabled ? 'ACTIVE' : 'PAUSED'}
        </span>
      </div>
    </div>
  )
}

// ============================================================================
// WORKFLOW ROW
// ============================================================================

function WorkflowRow({
  workflow,
  onToggle,
  onTrigger,
  loading,
  systemKilled
}: {
  workflow: WorkflowControl
  onToggle: (id: string, enabled: boolean) => void
  onTrigger: (id: string, name: string) => void
  loading: string | null
  systemKilled: boolean
}) {
  const isLoading = loading === workflow.n8n_workflow_id
  const disabled = systemKilled

  // Determine workflow category for color coding
  const getCategory = (name: string) => {
    if (name.startsWith('INGEST')) return { color: 'text-blue-400', bg: 'bg-blue-500/10' }
    if (name.startsWith('SCORE') || name.startsWith('ALEX') || name.startsWith('ENRICH'))
      return { color: 'text-green-400', bg: 'bg-green-500/10' }
    if (name.startsWith('SAM')) return { color: 'text-orange-400', bg: 'bg-orange-500/10' }
    if (name.startsWith('DOCS')) return { color: 'text-purple-400', bg: 'bg-purple-500/10' }
    if (name.startsWith('PAY')) return { color: 'text-yellow-400', bg: 'bg-yellow-500/10' }
    if (name.startsWith('CEO')) return { color: 'text-red-400', bg: 'bg-red-500/10' }
    if (name.startsWith('MATCH')) return { color: 'text-pink-400', bg: 'bg-pink-500/10' }
    if (name.startsWith('TRACK')) return { color: 'text-cyan-400', bg: 'bg-cyan-500/10' }
    return { color: 'text-zinc-400', bg: 'bg-zinc-500/10' }
  }

  const category = getCategory(workflow.workflow_name)

  return (
    <div
      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
        workflow.enabled
          ? 'bg-zinc-800/50 border-zinc-600'
          : 'bg-zinc-900/50 border-zinc-800'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Toggle
          enabled={workflow.enabled}
          onChange={() => onToggle(workflow.n8n_workflow_id, !workflow.enabled)}
          loading={isLoading}
          disabled={disabled}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${category.color}`}>
            {workflow.workflow_name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                workflow.n8n_active_state
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-zinc-700 text-zinc-500'
              }`}
            >
              N8N: {workflow.n8n_active_state ? 'ON' : 'OFF'}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded ${
                workflow.enabled
                  ? 'bg-blue-500/20 text-blue-400'
                  : 'bg-zinc-700 text-zinc-500'
              }`}
            >
              Gate: {workflow.enabled ? 'OPEN' : 'CLOSED'}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={() => onTrigger(workflow.n8n_workflow_id, workflow.workflow_name)}
        disabled={disabled || !workflow.enabled || isLoading}
        className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
          workflow.enabled && !disabled
            ? 'bg-blue-600 hover:bg-blue-500 text-white'
            : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
        }`}
      >
        {isLoading ? '...' : 'Trigger'}
      </button>
    </div>
  )
}

// ============================================================================
// MAIN CEO DASHBOARD
// ============================================================================

export default function CEODashboard() {
  const [state, setState] = useState<GovernanceState | null>(null)
  const [config, setConfig] = useState<SystemConfig>({ autonomy_level: 0, ralph_enabled: false, outreach_enabled: false })
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const [workflowFilter, setWorkflowFilter] = useState<string>('')

  // Fetch governance state and system config
  const fetchState = useCallback(async () => {
    try {
      // Fetch governance state and settings in parallel
      const [govRes, settingsRes] = await Promise.all([
        fetch('/api/governance'),
        fetch('/api/settings')
      ])

      if (!govRes.ok) throw new Error('Failed to fetch governance state')
      const govData = await govRes.json()
      setState(govData)

      // Extract RALPH state from governance gates
      const ralphGate = govData.governance_gates?.find(
        (g: GovernanceGate) => g.control_key === 'gate_ralph_execution'
      )

      // Get autonomy level from settings
      let autonomyLevel = 0
      let outreachEnabled = false
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json()
        autonomyLevel = parseInt(settingsData.config?.autonomy_level) || 0
        outreachEnabled = settingsData.config?.outreach_enabled === true || settingsData.config?.outreach_enabled === 'true'
      }

      setConfig({
        ralph_enabled: ralphGate?.enabled ?? false,
        autonomy_level: autonomyLevel,
        outreach_enabled: outreachEnabled
      })

      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchState()
    const interval = setInterval(fetchState, 10000)
    return () => clearInterval(interval)
  }, [fetchState])

  // Toggle RALPH (master automation)
  const toggleRalph = async () => {
    if (!state) return
    setActionLoading('ralph')

    try {
      const newEnabled = !config.ralph_enabled
      const res = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gate_type: 'system',
          gate_key: 'gate_ralph_execution',
          enabled: newEnabled
        })
      })

      const data = await res.json()

      if (res.ok) {
        setConfig((prev) => ({ ...prev, ralph_enabled: newEnabled }))
        setLastAction(`RALPH ${newEnabled ? 'enabled' : 'disabled'}`)
        await fetchState()
      } else {
        // Handle gate not found - provide helpful message
        setError(data.error || 'Failed to toggle RALPH. Gate may not exist in database.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle RALPH')
    } finally {
      setActionLoading(null)
    }
  }

  // Update autonomy level
  const updateAutonomy = async (level: number) => {
    setActionLoading('autonomy')

    try {
      // Update system_config in Supabase via a dedicated endpoint
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'autonomy_level',
          value: level.toString()
        })
      })

      if (res.ok) {
        setConfig((prev) => ({ ...prev, autonomy_level: level }))
        setLastAction(`Autonomy set to level ${level}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update autonomy')
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle system gate (Intake, Outreach, Contracts, Payments)
  const toggleSystemGate = async (gateKey: string, enabled: boolean) => {
    setActionLoading(gateKey)

    try {
      const res = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gate_type: 'system',
          gate_key: gateKey,
          enabled
        })
      })

      const data = await res.json()

      if (res.ok) {
        const friendlyName = gateKey.replace('gate_', '').replace('sam_', '').replace(/_/g, ' ')
        setLastAction(`${friendlyName} ${enabled ? 'enabled' : 'disabled'}`)
        await fetchState()
      } else {
        setError(data.error || `Failed to toggle ${gateKey}. Gate may not exist.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to toggle ${gateKey}`)
    } finally {
      setActionLoading(null)
    }
  }

  // Toggle N8N workflow gate
  const toggleWorkflow = async (workflowId: string, enabled: boolean) => {
    setActionLoading(workflowId)

    try {
      // First update the gate in Supabase
      const gateRes = await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gate_type: 'n8n',
          gate_key: workflowId,
          enabled
        })
      })

      const gateData = await gateRes.json()

      if (!gateRes.ok) {
        setError(gateData.error || 'Failed to update workflow gate')
        return
      }

      // Then sync to N8N (best effort - don't fail if N8N is unavailable)
      try {
        await fetch('/api/governance/n8n-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow_id: workflowId,
            enabled
          })
        })
      } catch {
        // N8N sync failed but gate state is saved
        console.warn('N8N sync failed, gate state saved locally')
      }

      const workflowName = gateData.workflow_name || workflowId
      setLastAction(`${workflowName} ${enabled ? 'enabled' : 'disabled'}`)
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle workflow')
    } finally {
      setActionLoading(null)
    }
  }

  // Trigger workflow manually
  const triggerWorkflow = async (workflowId: string, workflowName: string) => {
    setActionLoading(workflowId)

    try {
      // Find the webhook URL for this workflow
      const webhookMap: Record<string, string> = {
        'sKtZmeV1wIFrEPfL': '/webhook/pdf-processor',
        'wzMFvhMdrXy2yj8W': '/webhook/alex',
        'caLLOlDen0TpRXsy': '/webhook/eleanor-score',
        'BG7MCZzHvzfAR06k': '/webhook/skip-trace',
        'gDj3WEjWIGhxtOkk': '/webhook/sam-response'
      }

      const webhookPath = webhookMap[workflowId]

      if (webhookPath) {
        await fetch(`https://skooki.app.n8n.cloud${webhookPath}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger: 'manual',
            source: 'ceo_dashboard',
            timestamp: new Date().toISOString()
          })
        })
        setLastAction(`Triggered: ${workflowName}`)
      } else {
        setLastAction(`No webhook configured for: ${workflowName}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to trigger workflow')
    } finally {
      setActionLoading(null)
    }
  }

  // Kill/Revive system
  const toggleKillSwitch = async () => {
    if (!state) return
    setActionLoading('kill')

    const action = state.system_killed ? 'revive' : 'kill'
    let reason = ''

    if (action === 'kill') {
      reason = window.prompt('Reason for emergency shutdown:') || ''
      if (!reason) {
        setActionLoading(null)
        return
      }
    }

    try {
      await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      })

      setLastAction(action === 'kill' ? 'SYSTEM KILLED' : 'System revived')
      await fetchState()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kill switch failed')
    } finally {
      setActionLoading(null)
    }
  }

  // Sync N8N
  const syncN8N = async () => {
    setActionLoading('sync')
    try {
      await fetch('/api/governance/n8n-sync')
      setLastAction('N8N synced')
      await fetchState()
    } catch {
      setError('N8N sync failed')
    } finally {
      setActionLoading(null)
    }
  }

  // Get gate state by key
  const getGateState = (key: string) => {
    return state?.governance_gates.find((g) => g.control_key === key)?.enabled ?? false
  }

  // Filter workflows
  const filteredWorkflows = state?.workflow_controls.filter((wf) =>
    wf.workflow_name.toLowerCase().includes(workflowFilter.toLowerCase())
  )

  // Group workflows by category
  const groupedWorkflows = filteredWorkflows?.reduce(
    (acc, wf) => {
      const prefix = wf.workflow_name.split(' ')[0].replace('•', '').trim()
      if (!acc[prefix]) acc[prefix] = []
      acc[prefix].push(wf)
      return acc
    },
    {} as Record<string, WorkflowControl[]>
  )

  if (loading) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <div className="animate-spin w-8 h-8 border-2 border-zinc-500 border-t-blue-500 rounded-full mx-auto mb-4" />
        Loading CEO Dashboard...
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">CEO Control Center</h1>
          <p className="text-sm text-zinc-400">
            Master controls for MaxSam automation pipeline
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastAction && (
            <span className="text-xs text-green-400 bg-green-500/10 px-3 py-1 rounded">
              {lastAction}
            </span>
          )}
          <button
            onClick={syncN8N}
            disabled={actionLoading === 'sync'}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors disabled:opacity-50"
          >
            {actionLoading === 'sync' ? 'Syncing...' : 'Sync N8N'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-4 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Master Kill Switch */}
      <div
        className={`p-6 rounded-xl border-2 ${
          state?.system_killed
            ? 'bg-red-950 border-red-500'
            : 'bg-zinc-900 border-zinc-700'
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">MASTER KILL SWITCH</h2>
            <p className="text-sm text-zinc-400">
              {state?.system_killed
                ? 'SYSTEM KILLED - All automation halted'
                : 'System operational - Automations running'}
            </p>
          </div>
          <button
            onClick={toggleKillSwitch}
            disabled={actionLoading === 'kill'}
            className={`px-8 py-4 rounded-xl font-bold text-lg transition-all ${
              state?.system_killed
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            } ${actionLoading === 'kill' ? 'opacity-50' : ''}`}
          >
            {state?.system_killed ? 'REVIVE SYSTEM' : 'KILL SWITCH'}
          </button>
        </div>
      </div>

      {/* RALPH Control + Autonomy */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* RALPH Toggle */}
        <div className="p-6 rounded-xl border bg-zinc-900 border-zinc-700">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">RALPH Automation</h2>
              <p className="text-sm text-zinc-400">Master orchestration agent</p>
            </div>
            <Toggle
              enabled={config.ralph_enabled}
              onChange={toggleRalph}
              loading={actionLoading === 'ralph'}
              disabled={state?.system_killed}
              size="lg"
            />
          </div>
          <div
            className={`p-3 rounded-lg text-sm ${
              config.ralph_enabled
                ? 'bg-green-500/10 text-green-400'
                : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {config.ralph_enabled
              ? 'RALPH is actively orchestrating pipeline operations'
              : 'RALPH is paused - No automatic orchestration'}
          </div>
        </div>

        {/* Autonomy Level */}
        <div className="p-6 rounded-xl border bg-zinc-900 border-zinc-700">
          <h2 className="text-lg font-bold text-white mb-4">Autonomy Level</h2>
          <AutonomySlider
            value={config.autonomy_level}
            onChange={updateAutonomy}
            loading={actionLoading === 'autonomy'}
          />
        </div>
      </div>

      {/* Pipeline Controls */}
      <div className="p-6 rounded-xl border bg-zinc-900 border-zinc-700">
        <h2 className="text-lg font-bold text-white mb-4">Pipeline Gates</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <PipelineControlCard
            title="Intake"
            gateKey="gate_intake"
            enabled={getGateState('gate_intake')}
            loading={actionLoading === 'gate_intake'}
            onToggle={toggleSystemGate}
            description="PDF processing & lead import"
            icon="..."
          />
          <PipelineControlCard
            title="Outreach"
            gateKey="gate_sam_outreach"
            enabled={getGateState('gate_sam_outreach')}
            loading={actionLoading === 'gate_sam_outreach'}
            onToggle={toggleSystemGate}
            description="SAM SMS & email campaigns"
            icon="..."
          />
          <PipelineControlCard
            title="Contracts"
            gateKey="gate_sam_contracts"
            enabled={getGateState('gate_sam_contracts')}
            loading={actionLoading === 'gate_sam_contracts'}
            onToggle={toggleSystemGate}
            description="Document generation & signing"
            icon="..."
          />
          <PipelineControlCard
            title="Payments"
            gateKey="gate_sam_payments"
            enabled={getGateState('gate_sam_payments')}
            loading={actionLoading === 'gate_sam_payments'}
            onToggle={toggleSystemGate}
            description="Stripe invoicing & collection"
            icon="..."
          />
        </div>
      </div>

      {/* Workflow Control Panel */}
      <div className="p-6 rounded-xl border bg-zinc-900 border-zinc-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">N8N Workflow Control</h2>
          <input
            type="text"
            placeholder="Filter workflows..."
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
            className="px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          {groupedWorkflows &&
            Object.entries(groupedWorkflows).map(([category, workflows]) => (
              <div key={category}>
                <h3 className="text-sm font-semibold text-zinc-400 mb-2 sticky top-0 bg-zinc-900 py-1">
                  {category} ({workflows.length})
                </h3>
                <div className="space-y-2">
                  {workflows.map((wf) => (
                    <WorkflowRow
                      key={wf.n8n_workflow_id}
                      workflow={wf}
                      onToggle={toggleWorkflow}
                      onTrigger={triggerWorkflow}
                      loading={actionLoading}
                      systemKilled={state?.system_killed ?? false}
                    />
                  ))}
                </div>
              </div>
            ))}

          {(!filteredWorkflows || filteredWorkflows.length === 0) && (
            <div className="text-center py-8 text-zinc-500">
              {workflowFilter
                ? 'No workflows match your filter'
                : 'No workflows synced. Click "Sync N8N" to fetch workflows.'}
            </div>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
          <div className="text-2xl font-bold text-white">
            {state?.workflow_controls.filter((w) => w.enabled).length || 0}
          </div>
          <div className="text-xs text-zinc-400">Gates Open</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
          <div className="text-2xl font-bold text-white">
            {state?.workflow_controls.filter((w) => w.n8n_active_state).length || 0}
          </div>
          <div className="text-xs text-zinc-400">N8N Active</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
          <div className="text-2xl font-bold text-white">
            {state?.governance_gates.filter((g) => g.enabled).length || 0}
          </div>
          <div className="text-xs text-zinc-400">System Gates Open</div>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700">
          <div className="text-2xl font-bold text-green-400">
            {state?.system_killed ? 'KILLED' : 'ONLINE'}
          </div>
          <div className="text-xs text-zinc-400">System Status</div>
        </div>
      </div>
    </div>
  )
}
