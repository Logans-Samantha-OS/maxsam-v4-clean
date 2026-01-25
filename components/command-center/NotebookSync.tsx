'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToast } from '@/components/Toast'

interface CountySyncResult {
  county: string
  notebook: string
  region: string
  extraction_id?: string
  leads_extracted: number
  leads_imported: number
  leads_updated: number
  leads_skipped: number
  status: 'success' | 'error'
  error?: string
}

interface SyncResponse {
  sync_id: string
  query_type: string
  sync_type: string
  auto_import: boolean
  counties_processed: number
  counties_successful: number
  counties_failed: number
  total_extracted: number
  total_imported: number
  total_updated: number
  total_skipped: number
  results: CountySyncResult[]
  timestamp: string
}

interface SyncStats {
  period_days: number
  period_stats: {
    extractions: number
    leads_extracted: number
    leads_imported: number
    leads_updated: number
    leads_skipped: number
    successful: number
    failed: number
  }
  county_stats: Array<{
    county: string
    notebook_name: string
    total_extractions: number
    total_leads_extracted: number
    total_leads_imported: number
    last_extraction: string
  }>
  recent_extractions: Array<{
    id: string
    county: string
    notebook_name: string
    leads_count: number
    leads_imported: number
    import_status: string
    created_at: string
  }>
  supported_counties: string[]
}

const SUPPORTED_COUNTIES = [
  'Dallas', 'Tarrant', 'Collin', 'Denton', 'Harris', 'Fort Bend',
  'Travis', 'Williamson', 'Bexar', 'Hidalgo', 'El Paso'
]

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

export default function NotebookSync() {
  const { addToast } = useToast()
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<SyncResponse | null>(null)
  const [stats, setStats] = useState<SyncStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [selectedCounties, setSelectedCounties] = useState<string[]>([])
  const [queryType, setQueryType] = useState<'excess_funds' | 'foreclosures' | 'tax_sales'>('excess_funds')
  const [autoImport, setAutoImport] = useState(true)

  // Load stats on mount
  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const res = await fetch('/api/alex/notebook-sync?days=7')
      const data = await res.json()
      if (res.ok) {
        setStats(data)
      }
    } catch (error) {
      console.error('Failed to load sync stats:', error)
    } finally {
      setLoadingStats(false)
    }
  }

  const runSync = useCallback(async () => {
    setSyncing(true)
    setSyncResult(null)

    try {
      const body: {
        counties?: string[]
        query_type: string
        sync_type: string
        triggered_by: string
        auto_import: boolean
      } = {
        query_type: queryType,
        sync_type: 'manual',
        triggered_by: 'dashboard',
        auto_import: autoImport,
      }

      // Only include counties if some are selected (otherwise sync all)
      if (selectedCounties.length > 0) {
        body.counties = selectedCounties
      }

      const res = await fetch('/api/alex/notebook-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data: SyncResponse = await res.json()

      if (!res.ok) {
        throw new Error((data as unknown as { error: string }).error || 'Sync failed')
      }

      setSyncResult(data)

      if (data.total_imported > 0) {
        addToast('success', `Sync complete! ${data.total_imported} leads imported from ${data.counties_successful} counties`)
      } else if (data.total_extracted > 0) {
        addToast('info', `Sync complete! ${data.total_extracted} leads extracted (${data.total_updated} updated, ${data.total_skipped} skipped)`)
      } else {
        addToast('info', 'Sync complete - no new leads found')
      }

      // Refresh stats
      loadStats()
    } catch (error) {
      addToast('error', error instanceof Error ? error.message : 'Sync failed')
    } finally {
      setSyncing(false)
    }
  }, [selectedCounties, queryType, autoImport, addToast])

  const toggleCounty = (county: string) => {
    setSelectedCounties(prev =>
      prev.includes(county)
        ? prev.filter(c => c !== county)
        : [...prev, county]
    )
  }

  const selectAllCounties = () => {
    setSelectedCounties(SUPPORTED_COUNTIES)
  }

  const deselectAllCounties = () => {
    setSelectedCounties([])
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🔄</span>
          <div>
            <h2 className="text-lg font-semibold text-white">NotebookLM Sync</h2>
            <p className="text-xs text-zinc-500">Sync leads from your knowledge base</p>
          </div>
        </div>
        <button
          onClick={loadStats}
          disabled={loadingStats}
          className="p-2 text-zinc-400 hover:text-white transition-colors"
          title="Refresh stats"
        >
          <span className={loadingStats ? 'animate-spin' : ''}>🔄</span>
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-white">
              {formatNumber(stats.period_stats.leads_extracted)}
            </div>
            <div className="text-xs text-zinc-500">Leads Extracted (7d)</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-400">
              {formatNumber(stats.period_stats.leads_imported)}
            </div>
            <div className="text-xs text-zinc-500">Leads Imported</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-400">
              {formatNumber(stats.period_stats.leads_updated)}
            </div>
            <div className="text-xs text-zinc-500">Leads Updated</div>
          </div>
          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-purple-400">
              {stats.period_stats.extractions}
            </div>
            <div className="text-xs text-zinc-500">Total Syncs</div>
          </div>
        </div>
      )}

      {/* Sync Controls */}
      <div className="space-y-4 mb-4">
        {/* County Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-zinc-300">
              Counties to Sync
              <span className="text-xs text-zinc-500 ml-2">
                ({selectedCounties.length === 0 ? 'All' : selectedCounties.length} selected)
              </span>
            </label>
            <div className="flex gap-2">
              <button
                onClick={selectAllCounties}
                className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded"
              >
                Select All
              </button>
              <button
                onClick={deselectAllCounties}
                className="px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {SUPPORTED_COUNTIES.map(county => (
              <button
                key={county}
                onClick={() => toggleCounty(county)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                  selectedCounties.includes(county)
                    ? 'bg-purple-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                }`}
              >
                {county}
              </button>
            ))}
          </div>
        </div>

        {/* Options Row */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-zinc-300 mb-1 block">Query Type</label>
            <select
              value={queryType}
              onChange={(e) => setQueryType(e.target.value as typeof queryType)}
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="excess_funds">Excess Funds</option>
              <option value="foreclosures">Foreclosures</option>
              <option value="tax_sales">Tax Sales</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoImport}
                onChange={(e) => setAutoImport(e.target.checked)}
                className="rounded bg-zinc-700 border-zinc-600 text-purple-500"
              />
              <span className="text-sm text-zinc-300">Auto-import leads</span>
            </label>
          </div>
        </div>

        {/* Sync Button */}
        <button
          onClick={runSync}
          disabled={syncing}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 disabled:from-zinc-700 disabled:to-zinc-700 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2"
        >
          {syncing ? (
            <>
              <span className="animate-spin">⏳</span>
              Syncing...
            </>
          ) : (
            <>
              🚀 Run Sync Now
            </>
          )}
        </button>
      </div>

      {/* Sync Result */}
      {syncResult && (
        <div className="mb-4 p-4 bg-zinc-800/50 rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-white">Sync Results</h3>
            <span className="text-xs text-zinc-500">{formatDate(syncResult.timestamp)}</span>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-3">
            <div className="text-center">
              <div className="text-xl font-bold text-green-400">{syncResult.total_imported}</div>
              <div className="text-xs text-zinc-500">Imported</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-blue-400">{syncResult.total_updated}</div>
              <div className="text-xs text-zinc-500">Updated</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-bold text-yellow-400">{syncResult.total_skipped}</div>
              <div className="text-xs text-zinc-500">Skipped</div>
            </div>
          </div>

          {/* Per-county results */}
          <details className="mt-3">
            <summary className="text-sm text-zinc-400 cursor-pointer hover:text-white">
              View county details ({syncResult.counties_successful}/{syncResult.counties_processed} successful)
            </summary>
            <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
              {syncResult.results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-2 rounded text-sm ${
                    result.status === 'success' ? 'bg-green-900/20' : 'bg-red-900/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-white">{result.county}</span>
                    <span className={result.status === 'success' ? 'text-green-400' : 'text-red-400'}>
                      {result.status === 'success' ? '✓' : '✗'}
                    </span>
                  </div>
                  {result.status === 'success' ? (
                    <div className="text-xs text-zinc-400">
                      {result.leads_extracted} extracted • {result.leads_imported} imported • {result.leads_updated} updated
                    </div>
                  ) : (
                    <div className="text-xs text-red-400">{result.error}</div>
                  )}
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Recent Extractions */}
      {stats && stats.recent_extractions.length > 0 && (
        <details className="bg-zinc-800/30 rounded-lg">
          <summary className="px-4 py-3 cursor-pointer text-sm text-zinc-400 hover:text-white">
            Recent Extractions ({stats.recent_extractions.length})
          </summary>
          <div className="px-4 pb-3">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-800">
                  <th className="pb-2">County</th>
                  <th className="pb-2">Leads</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_extractions.slice(0, 10).map((ext) => (
                  <tr key={ext.id} className="border-b border-zinc-800/50">
                    <td className="py-2 text-white">{ext.county}</td>
                    <td className="py-2 text-zinc-400">
                      {ext.leads_count} → {ext.leads_imported || 0}
                    </td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        ext.import_status === 'completed' ? 'bg-green-900/50 text-green-400' :
                        ext.import_status === 'failed' ? 'bg-red-900/50 text-red-400' :
                        'bg-yellow-900/50 text-yellow-400'
                      }`}>
                        {ext.import_status}
                      </span>
                    </td>
                    <td className="py-2 text-zinc-500 text-xs">{formatDate(ext.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {/* Loading State */}
      {loadingStats && !stats && (
        <div className="text-center py-8 text-zinc-500">
          <span className="animate-spin text-2xl">⏳</span>
          <p className="mt-2">Loading sync statistics...</p>
        </div>
      )}
    </div>
  )
}
