'use client';

import { useState, useEffect, useCallback } from 'react';

/**
 * WorkflowControlPanel - Unified Intent-Based Control Surface
 *
 * DESIGN PRINCIPLE: Control entire workflow classes, not individual steps.
 * The operator sets INTENT, the system executes autonomously.
 *
 * PIPELINE:
 *   Upload (PDF/CSV) → ORION (classification) → RALPH (queue + safeguards) → SAM (execution)
 *
 * TOGGLES:
 *   - Intake: Enable/disable data ingestion + ORION scoring
 *   - Outreach: Enable/disable SAM SMS/voice campaigns
 *   - Contracts: Enable/disable DocuSign contract generation
 *   - Payments: Enable/disable Stripe invoicing
 */

interface WorkflowState {
  intake_enabled: boolean;
  outreach_enabled: boolean;
  contracts_enabled: boolean;
  payments_enabled: boolean;
  autonomy_level: number;
  ralph_enabled: boolean;
  last_updated: string;
  updated_by: string;
  _warning?: string;
}

const WORKFLOW_CONFIG = [
  {
    key: 'intake_enabled' as const,
    label: 'Intake',
    icon: '📥',
    description: 'PDF/CSV upload + ORION scoring',
    color: 'cyan',
  },
  {
    key: 'outreach_enabled' as const,
    label: 'Outreach',
    icon: '📱',
    description: 'SAM SMS + voice campaigns',
    color: 'green',
  },
  {
    key: 'contracts_enabled' as const,
    label: 'Contracts',
    icon: '📝',
    description: 'DocuSign generation + signing',
    color: 'purple',
  },
  {
    key: 'payments_enabled' as const,
    label: 'Payments',
    icon: '💳',
    description: 'Stripe invoicing + collection',
    color: 'amber',
  },
];

const AUTONOMY_LEVELS = [
  { value: 0, label: 'STOPPED', description: 'All automation halted', color: 'red' },
  { value: 1, label: 'READ-ONLY', description: 'Can read, no changes', color: 'yellow' },
  { value: 2, label: 'SAFE', description: 'Safe changes only', color: 'blue' },
  { value: 3, label: 'FULL AUTO', description: 'Complete autonomy', color: 'green' },
];

export default function WorkflowControlPanel() {
  const [state, setState] = useState<WorkflowState | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch current state
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/workflow-control');
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch workflow state');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    // Refresh every 30 seconds
    const interval = setInterval(fetchState, 30000);
    return () => clearInterval(interval);
  }, [fetchState]);

  // Toggle a workflow
  const toggleWorkflow = async (key: string, currentValue: boolean) => {
    setUpdating(key);
    try {
      const res = await fetch('/api/workflow-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: !currentValue }),
      });

      if (!res.ok) throw new Error('Failed to update');

      // Optimistic update
      setState(prev => prev ? { ...prev, [key]: !currentValue } : null);
    } catch (err) {
      setError('Failed to update workflow');
      console.error(err);
      fetchState(); // Revert on error
    } finally {
      setUpdating(null);
    }
  };

  // Set autonomy level
  const setAutonomyLevel = async (level: number) => {
    setUpdating('autonomy_level');
    try {
      const res = await fetch('/api/workflow-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autonomy_level: level }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setState(prev => prev ? { ...prev, autonomy_level: level } : null);
    } catch (err) {
      setError('Failed to update autonomy level');
      console.error(err);
      fetchState();
    } finally {
      setUpdating(null);
    }
  };

  // Emergency stop
  const emergencyStop = async () => {
    if (!confirm('EMERGENCY STOP: This will disable ALL automation. Continue?')) {
      return;
    }

    setUpdating('emergency');
    try {
      const res = await fetch('/api/workflow-control', { method: 'PUT' });
      if (!res.ok) throw new Error('Failed to stop');
      await fetchState();
    } catch (err) {
      setError('Emergency stop failed');
      console.error(err);
    } finally {
      setUpdating(null);
    }
  };

  // Master toggle (Ralph)
  const toggleMaster = async () => {
    if (!state) return;

    setUpdating('ralph_enabled');
    try {
      const res = await fetch('/api/workflow-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ralph_enabled: !state.ralph_enabled }),
      });

      if (!res.ok) throw new Error('Failed to update');

      setState(prev => prev ? { ...prev, ralph_enabled: !prev.ralph_enabled } : null);
    } catch (err) {
      setError('Failed to toggle master switch');
      console.error(err);
      fetchState();
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div className="animate-pulse flex items-center gap-2">
          <div className="h-6 w-6 bg-zinc-700 rounded"></div>
          <div className="h-6 w-48 bg-zinc-700 rounded"></div>
        </div>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-xl p-6">
        <p className="text-red-400">Failed to load workflow state</p>
      </div>
    );
  }

  const currentLevel = AUTONOMY_LEVELS.find(l => l.value === state.autonomy_level) || AUTONOMY_LEVELS[0];
  const allEnabled = state.ralph_enabled && state.intake_enabled && state.outreach_enabled && state.contracts_enabled && state.payments_enabled;
  const anyEnabled = state.intake_enabled || state.outreach_enabled || state.contracts_enabled || state.payments_enabled;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header with Master Switch */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎛️</span>
          <div>
            <h2 className="text-lg font-semibold text-white">Workflow Control</h2>
            <p className="text-zinc-500 text-xs">Set intent. System executes.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Master Switch */}
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm">RALPH</span>
            <button
              onClick={toggleMaster}
              disabled={updating === 'ralph_enabled'}
              className={`
                relative w-14 h-7 rounded-full transition-all duration-300
                ${state.ralph_enabled ? 'bg-green-600' : 'bg-zinc-700'}
                ${updating === 'ralph_enabled' ? 'opacity-50' : ''}
              `}
            >
              <span
                className={`
                  absolute top-1 w-5 h-5 bg-white rounded-full transition-all duration-300 shadow-lg
                  ${state.ralph_enabled ? 'left-8' : 'left-1'}
                `}
              />
            </button>
          </div>

          {/* Emergency Stop */}
          <button
            onClick={emergencyStop}
            disabled={updating === 'emergency'}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition flex items-center gap-1"
          >
            <span>🛑</span>
            STOP
          </button>
        </div>
      </div>

      {/* Warning if Ralph is disabled */}
      {!state.ralph_enabled && anyEnabled && (
        <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
          <p className="text-yellow-400 text-sm">
            ⚠️ Ralph is disabled. Workflows are enabled but NOT executing.
          </p>
        </div>
      )}

      {/* Autonomy Level */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-zinc-400 text-sm">Autonomy Level</span>
          <span className={`text-sm font-medium text-${currentLevel.color}-400`}>
            {currentLevel.label}
          </span>
        </div>
        <div className="flex gap-2">
          {AUTONOMY_LEVELS.map((level) => (
            <button
              key={level.value}
              onClick={() => setAutonomyLevel(level.value)}
              disabled={updating === 'autonomy_level'}
              className={`
                flex-1 py-2 px-3 rounded-lg text-xs font-medium transition-all
                ${state.autonomy_level === level.value
                  ? `bg-${level.color}-600/20 text-${level.color}-400 border border-${level.color}-600/50`
                  : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700 border border-transparent'
                }
                ${updating === 'autonomy_level' ? 'opacity-50' : ''}
              `}
              title={level.description}
            >
              {level.value}
            </button>
          ))}
        </div>
        <p className="text-zinc-600 text-xs mt-2 text-center">{currentLevel.description}</p>
      </div>

      {/* Workflow Toggles Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-zinc-800">
        {WORKFLOW_CONFIG.map((workflow) => {
          const isEnabled = state[workflow.key];
          const isUpdating = updating === workflow.key;

          return (
            <button
              key={workflow.key}
              onClick={() => toggleWorkflow(workflow.key, isEnabled)}
              disabled={isUpdating}
              className={`
                p-4 transition-all duration-300
                ${isEnabled
                  ? 'bg-zinc-900'
                  : 'bg-zinc-900/50'
                }
                hover:bg-zinc-800/80
                ${isUpdating ? 'opacity-50' : ''}
              `}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{workflow.icon}</span>
                <div
                  className={`
                    w-3 h-3 rounded-full transition-all
                    ${isEnabled ? `bg-${workflow.color}-500` : 'bg-zinc-600'}
                    ${isEnabled && state.ralph_enabled ? 'animate-pulse' : ''}
                  `}
                />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${isEnabled ? 'text-white' : 'text-zinc-500'}`}>
                    {workflow.label}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${isEnabled ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-500'}`}>
                    {isEnabled ? 'ON' : 'OFF'}
                  </span>
                </div>
                <p className="text-zinc-600 text-xs mt-1">{workflow.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Status Footer */}
      <div className="p-3 bg-zinc-950/50 border-t border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span
              className={`
                w-2 h-2 rounded-full
                ${allEnabled && state.ralph_enabled ? 'bg-green-500 animate-pulse' : 'bg-zinc-600'}
              `}
            />
            <span className="text-zinc-500 text-xs">
              {allEnabled && state.ralph_enabled
                ? 'Fully Autonomous'
                : anyEnabled && state.ralph_enabled
                  ? 'Partially Active'
                  : 'Standby'
              }
            </span>
          </div>
        </div>
        <span className="text-zinc-600 text-xs">
          Updated: {new Date(state.last_updated).toLocaleTimeString()}
        </span>
      </div>

      {/* Error Toast */}
      {error && (
        <div className="absolute bottom-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2">×</button>
        </div>
      )}
    </div>
  );
}
