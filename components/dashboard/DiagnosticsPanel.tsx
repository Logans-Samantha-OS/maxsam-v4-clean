'use client';

/**
 * Diagnostics Panel - READ-ONLY
 * Phase 13.3 - Data Source Diagnosis
 *
 * Displays:
 * - Supabase URL host (redacted)
 * - Tables queried
 * - Lead counts from DB vs UI
 * - Classification status
 *
 * NO MUTATION CONTROLS
 */

import { useEffect, useState } from 'react';

interface DiagnosticsData {
  timestamp: string;
  environment: string;
  supabase: {
    url_host: string;
    url_set: boolean;
    anon_key_set: boolean;
    service_key_set: boolean;
  };
  tables_queried: string[];
  lead_counts: {
    total: number;
    by_status: Record<string, number>;
    by_class: {
      A: number;
      B: number;
      C: number;
      unclassified: number;
    };
    with_phone: number;
    with_excess_funds: number;
  };
  classification_status: {
    backfill_complete: boolean;
    last_backfill_at: string | null;
    big_fish_threshold: number;
  };
  errors: string[];
}

export default function DiagnosticsPanel() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDiagnostics() {
      try {
        const res = await fetch('/api/diagnostics');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchDiagnostics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchDiagnostics, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 text-zinc-400">
        Loading diagnostics...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500 rounded-xl p-4 text-red-400">
        Diagnostics error: {error}
      </div>
    );
  }

  if (!data) return null;

  const classA = data.lead_counts.by_class.A;
  const classB = data.lead_counts.by_class.B;
  const classC = data.lead_counts.by_class.C;
  const unclassified = data.lead_counts.by_class.unclassified;

  return (
    <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">System Diagnostics</h3>
        <span className="text-xs text-zinc-500">
          {new Date(data.timestamp).toLocaleTimeString()}
        </span>
      </div>

      {/* Supabase Connection */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Supabase Host</div>
          <div className="font-mono text-sm text-cyan-400">
            {data.supabase.url_host}
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-3">
          <div className="text-xs text-zinc-500 mb-1">Environment</div>
          <div className="font-mono text-sm text-white">
            {data.environment}
          </div>
        </div>
      </div>

      {/* Lead Counts */}
      <div className="bg-zinc-800 rounded-lg p-3">
        <div className="text-xs text-zinc-500 mb-2">Lead Counts (from DB)</div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div>
            <div className="text-2xl font-bold text-white">{data.lead_counts.total}</div>
            <div className="text-xs text-zinc-500">Total</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-400">{data.lead_counts.with_phone}</div>
            <div className="text-xs text-zinc-500">With Phone</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-yellow-400">{data.lead_counts.with_excess_funds}</div>
            <div className="text-xs text-zinc-500">With Excess $</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-400">{unclassified}</div>
            <div className="text-xs text-zinc-500">Unclassified</div>
          </div>
        </div>
      </div>

      {/* Classification Status */}
      <div className="bg-zinc-800 rounded-lg p-3">
        <div className="text-xs text-zinc-500 mb-2">
          Classification (Big Fish ≥ ${data.classification_status.big_fish_threshold.toLocaleString()})
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-red-500/20 rounded p-2">
            <div className="text-xl font-bold text-red-400">{classA}</div>
            <div className="text-xs text-zinc-400">Class A</div>
            <div className="text-[10px] text-zinc-500">GOLDEN DUAL</div>
          </div>
          <div className="bg-orange-500/20 rounded p-2">
            <div className="text-xl font-bold text-orange-400">{classB}</div>
            <div className="text-xs text-zinc-400">Class B</div>
            <div className="text-[10px] text-zinc-500">BIG FISH</div>
          </div>
          <div className="bg-blue-500/20 rounded p-2">
            <div className="text-xl font-bold text-blue-400">{classC}</div>
            <div className="text-xs text-zinc-400">Class C</div>
            <div className="text-[10px] text-zinc-500">STANDARD</div>
          </div>
        </div>
        <div className="mt-2 text-xs text-zinc-500">
          {data.classification_status.backfill_complete
            ? `✓ Backfill complete: ${data.classification_status.last_backfill_at}`
            : '⚠ Backfill not run - leads unclassified'}
        </div>
      </div>

      {/* Errors */}
      {data.errors.length > 0 && (
        <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
          <div className="text-xs text-red-400 mb-1">Errors</div>
          {data.errors.map((err, i) => (
            <div key={i} className="text-sm text-red-300">{err}</div>
          ))}
        </div>
      )}

      {/* Tables Queried */}
      <div className="text-xs text-zinc-600">
        Tables: {data.tables_queried.join(', ')}
      </div>
    </div>
  );
}
