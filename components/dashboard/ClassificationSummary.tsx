'use client';

/**
 * Classification Summary Panel - READ-ONLY
 * Phase 13.3 - Economic Lead Classification
 *
 * Displays class A/B/C breakdown with expected values.
 * No mutation controls - pure visibility.
 */

import { useEffect, useState } from 'react';

interface ClassSummary {
  timestamp: string;
  big_fish_threshold: number;
  by_class: {
    A: { count: number; total_expected_value: number; avg_expected_value: number };
    B: { count: number; total_expected_value: number; avg_expected_value: number };
    C: { count: number; total_expected_value: number; avg_expected_value: number };
  };
  unclassified: number;
  total_viable_leads: number;
  total_expected_value: number;
}

export default function ClassificationSummary() {
  const [data, setData] = useState<ClassSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSummary() {
      try {
        const res = await fetch('/api/classification/summary');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        setData(json);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchSummary();
    // Refresh every 60 seconds
    const interval = setInterval(fetchSummary, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="bg-zinc-900 rounded-xl p-4 text-zinc-400">
        Loading classification data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-800 rounded-xl p-4">
        <div className="text-sm text-zinc-500">Classification data unavailable</div>
        <div className="text-xs text-zinc-600 mt-1">Run backfill to populate</div>
      </div>
    );
  }

  if (!data) return null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="bg-zinc-900 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Lead Classification</h3>
        <span className="text-xs text-zinc-500">
          Big Fish: {formatCurrency(data.big_fish_threshold)}+
        </span>
      </div>

      {/* Class Cards */}
      <div className="grid grid-cols-3 gap-3">
        {/* Class A */}
        <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 rounded-lg p-3 border border-red-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-red-400">CLASS A</span>
            <span className="text-xs text-zinc-500">DUAL DEAL</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.by_class.A.count}</div>
          <div className="text-xs text-zinc-400 mt-1">
            {formatCurrency(data.by_class.A.total_expected_value)} total
          </div>
          <div className="text-xs text-zinc-500">
            avg: {formatCurrency(data.by_class.A.avg_expected_value)}
          </div>
        </div>

        {/* Class B */}
        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/10 rounded-lg p-3 border border-orange-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-orange-400">CLASS B</span>
            <span className="text-xs text-zinc-500">BIG FISH</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.by_class.B.count}</div>
          <div className="text-xs text-zinc-400 mt-1">
            {formatCurrency(data.by_class.B.total_expected_value)} total
          </div>
          <div className="text-xs text-zinc-500">
            avg: {formatCurrency(data.by_class.B.avg_expected_value)}
          </div>
        </div>

        {/* Class C */}
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 rounded-lg p-3 border border-blue-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-blue-400">CLASS C</span>
            <span className="text-xs text-zinc-500">STANDARD</span>
          </div>
          <div className="text-2xl font-bold text-white">{data.by_class.C.count}</div>
          <div className="text-xs text-zinc-400 mt-1">
            {formatCurrency(data.by_class.C.total_expected_value)} total
          </div>
          <div className="text-xs text-zinc-500">
            avg: {formatCurrency(data.by_class.C.avg_expected_value)}
          </div>
        </div>
      </div>

      {/* Total Pipeline */}
      <div className="bg-zinc-800 rounded-lg p-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-zinc-400">Total Pipeline Value</div>
          <div className="text-xl font-bold text-green-400">
            {formatCurrency(data.total_expected_value)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-zinc-400">Viable Leads</div>
          <div className="text-xl font-bold text-white">{data.total_viable_leads}</div>
        </div>
        {data.unclassified > 0 && (
          <div className="text-right">
            <div className="text-sm text-zinc-400">Unclassified</div>
            <div className="text-xl font-bold text-yellow-400">{data.unclassified}</div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="text-xs text-zinc-600 space-y-1">
        <div>A: Excess + wholesale potential (dual revenue)</div>
        <div>B: $75K+ excess (big fish, recovery only)</div>
        <div>C: $5K-$75K excess (standard recovery)</div>
      </div>
    </div>
  );
}
