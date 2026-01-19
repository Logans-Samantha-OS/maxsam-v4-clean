'use client';

import { useState, useEffect, useCallback } from 'react';

interface GovernanceGate {
  id: string;
  control_key: string;
  enabled: boolean;
  disabled_by: string | null;
  disabled_at: string | null;
  disabled_reason: string | null;
}

interface WorkflowControl {
  id: string;
  n8n_workflow_id: string;
  workflow_name: string;
  enabled: boolean;
  n8n_active_state: boolean | null;
  last_synced_at: string | null;
}

interface GovernanceState {
  system_killed: boolean;
  governance_gates: GovernanceGate[];
  workflow_controls: WorkflowControl[];
}

export default function CommandCenter() {
  const [state, setState] = useState<GovernanceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchState = useCallback(async () => {
    try {
      const res = await fetch('/api/governance');
      if (!res.ok) throw new Error('Failed to fetch governance state');
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchState();
    const interval = setInterval(fetchState, 5000);
    return () => clearInterval(interval);
  }, [fetchState]);

  const handleKillSwitch = async () => {
    if (!state) return;

    const action = state.system_killed ? 'revive' : 'kill';
    let reason = '';

    if (action === 'kill') {
      reason = window.prompt('Reason for emergency shutdown:') || '';
      if (!reason) return;
    } else {
      reason = 'Manual system revive';
    }

    try {
      await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason })
      });
      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle kill switch');
    }
  };

  const handleGateToggle = async (gate_key: string, currentState: boolean) => {
    if (state?.system_killed) return;

    try {
      await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gate_type: 'system',
          gate_key,
          enabled: !currentState
        })
      });
      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle gate');
    }
  };

  const handleWorkflowToggle = async (n8n_workflow_id: string, currentState: boolean) => {
    if (state?.system_killed) return;

    try {
      // Update gate in Supabase
      await fetch('/api/governance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gate_type: 'n8n',
          gate_key: n8n_workflow_id,
          enabled: !currentState
        })
      });

      // Sync to n8n
      await fetch('/api/governance/n8n-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: n8n_workflow_id,
          enabled: !currentState
        })
      });

      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to toggle workflow');
    }
  };

  const handleN8nSync = async () => {
    setSyncing(true);
    try {
      await fetch('/api/governance/n8n-sync');
      await fetchState();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync n8n');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-gray-400">
        Loading governance state...
      </div>
    );
  }

  if (!state) {
    return (
      <div className="p-8 text-center text-red-400">
        Failed to load governance state: {error}
      </div>
    );
  }

  const agentGates = state.governance_gates.filter(c =>
    ['gate_orion_scoring', 'gate_ralph_execution', 'gate_sam_outreach', 'gate_sam_voice', 'gate_sam_contracts', 'gate_sam_payments'].includes(c.control_key)
  );

  const pipelineGates = state.governance_gates.filter(c =>
    ['gate_intake', 'gate_skip_trace'].includes(c.control_key)
  );

  const formatGateName = (key: string) => {
    return key.replace('gate_', '').replace(/_/g, ' ').toUpperCase();
  };

  return (
    <div className={`p-6 rounded-lg ${state.system_killed ? 'bg-red-950 border-2 border-red-500' : 'bg-gray-900'}`}>
      {error && (
        <div className="mb-4 p-3 rounded bg-red-900 text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* MASTER KILL SWITCH */}
      <div className="mb-8 p-4 rounded-lg bg-black border border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">MASTER KILL SWITCH</h2>
            <p className="text-sm text-gray-400">
              {state.system_killed ? 'SYSTEM KILLED - All execution halted' : 'System operational'}
            </p>
          </div>
          <button
            onClick={handleKillSwitch}
            className={`px-6 py-3 rounded-lg font-bold text-lg transition-all ${
              state.system_killed
                ? 'bg-green-600 hover:bg-green-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            }`}
          >
            {state.system_killed ? 'REVIVE SYSTEM' : 'KILL SWITCH'}
          </button>
        </div>
      </div>

      {/* AGENT GATES */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Agent Gates</h3>
        <div className="grid grid-cols-2 gap-3">
          {agentGates.map(gate => (
            <div
              key={gate.control_key}
              className={`p-3 rounded border ${
                state.system_killed ? 'opacity-50 cursor-not-allowed' : ''
              } ${gate.enabled ? 'border-green-500 bg-green-950' : 'border-red-500 bg-red-950'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">
                  {formatGateName(gate.control_key)}
                </span>
                <button
                  onClick={() => !state.system_killed && handleGateToggle(gate.control_key, gate.enabled)}
                  disabled={state.system_killed}
                  className={`px-3 py-1 rounded text-xs font-bold ${
                    gate.enabled
                      ? 'bg-green-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {gate.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* PIPELINE GATES */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-white mb-3">Pipeline Gates</h3>
        <div className="grid grid-cols-2 gap-3">
          {pipelineGates.map(gate => (
            <div
              key={gate.control_key}
              className={`p-3 rounded border ${
                state.system_killed ? 'opacity-50 cursor-not-allowed' : ''
              } ${gate.enabled ? 'border-green-500 bg-green-950' : 'border-red-500 bg-red-950'}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm text-white">
                  {formatGateName(gate.control_key)}
                </span>
                <button
                  onClick={() => !state.system_killed && handleGateToggle(gate.control_key, gate.enabled)}
                  disabled={state.system_killed}
                  className={`px-3 py-1 rounded text-xs font-bold ${
                    gate.enabled
                      ? 'bg-green-600 text-white'
                      : 'bg-red-600 text-white'
                  }`}
                >
                  {gate.enabled ? 'ON' : 'OFF'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* N8N WORKFLOW GATES */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">N8N Workflow Gates</h3>
          <button
            onClick={handleN8nSync}
            disabled={syncing}
            className="px-3 py-1 rounded bg-blue-600 text-white text-xs hover:bg-blue-500 disabled:opacity-50"
          >
            {syncing ? 'Syncing...' : 'Sync N8N'}
          </button>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {state.workflow_controls.length === 0 ? (
            <div className="text-gray-400 text-sm text-center py-4">
              No workflows synced. Click &quot;Sync N8N&quot; to fetch workflows.
            </div>
          ) : (
            state.workflow_controls.map(wf => (
              <div
                key={wf.n8n_workflow_id}
                className={`p-3 rounded border ${
                  state.system_killed ? 'opacity-50 cursor-not-allowed' : ''
                } ${wf.enabled ? 'border-green-500 bg-green-950' : 'border-gray-600 bg-gray-900'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-white">{wf.workflow_name}</span>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        wf.n8n_active_state ? 'bg-green-800 text-green-200' : 'bg-gray-700 text-gray-300'
                      }`}>
                        N8N: {wf.n8n_active_state ? 'Active' : 'Inactive'}
                      </span>
                      {wf.last_synced_at && (
                        <span className="text-xs text-gray-500">
                          Synced: {new Date(wf.last_synced_at).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => !state.system_killed && handleWorkflowToggle(wf.n8n_workflow_id, wf.enabled)}
                    disabled={state.system_killed}
                    className={`px-3 py-1 rounded text-xs font-bold ${
                      wf.enabled
                        ? 'bg-green-600 text-white'
                        : 'bg-red-600 text-white'
                    }`}
                  >
                    {wf.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
