'use client';

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/components/Toast';

// ============================================================================
// TYPES
// ============================================================================

interface GoldenLead {
  id: string;
  owner_name: string;
  property_address: string;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  excess_funds_amount: number;
  is_golden: boolean;
  eleanor_score: number;
  status: string;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  created_at: string;
  updated_at: string;
}

interface GoldenStats {
  total: number;
  total_excess: number;
  avg_eleanor_score: number;
}

interface HuntRun {
  id: string;
  status: string;
  leads_scanned: number;
  zillow_matches_found: number;
  golden_leads_identified: number;
  started_at: string;
  completed_at: string | null;
}

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    sold: 'bg-red-500/20 text-red-400 border-red-500/30',
    off_market: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    unknown: 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30',
  };

  const icons: Record<string, string> = {
    active: '🟢',
    pending: '🟡',
    sold: '🔴',
    off_market: '⚫',
    unknown: '❓',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.unknown}`}>
      {icons[status] || icons.unknown} {status || 'Unknown'}
    </span>
  );
}

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

function StatsCard({
  label,
  value,
  subValue,
  color = 'cyan',
  icon,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  icon?: React.ReactNode;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
  };

  const textColors: Record<string, string> = {
    cyan: 'text-cyan-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
  };

  return (
    <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 text-sm">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
    </div>
  );
}

// ============================================================================
// LEAD ROW COMPONENT
// ============================================================================

function LeadRow({
  lead,
  onSelect,
  isSelected,
}: {
  lead: GoldenLead;
  onSelect: (lead: GoldenLead) => void;
  isSelected: boolean;
}) {
  return (
    <tr
      onClick={() => onSelect(lead)}
      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors ${
        isSelected ? 'bg-yellow-500/10' : ''
      }`}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-yellow-500">⭐</span>
          <span className="font-medium text-white">{lead.eleanor_score}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="font-medium text-white">{lead.owner_name}</p>
          <p className="text-xs text-zinc-500">{lead.property_address}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-green-400 font-semibold">
          ${(lead.excess_funds_amount || 0).toLocaleString()}
        </span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={lead.status || 'unknown'} />
      </td>
      <td className="px-4 py-3">
        <span className="text-cyan-400">{lead.phone || '-'}</span>
      </td>
      <td className="px-4 py-3">
        <span className="text-purple-400 font-semibold">
          ${((lead.excess_funds_amount || 0) * 0.25).toLocaleString()}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-zinc-500 text-xs">
          {new Date(lead.created_at).toLocaleDateString()}
        </span>
      </td>
    </tr>
  );
}

// ============================================================================
// LEAD DETAIL PANEL
// ============================================================================

function LeadDetailPanel({
  lead,
  onClose,
}: {
  lead: GoldenLead;
  onClose: () => void;
}) {
  const getPhone = () => lead.phone || lead.phone_1 || lead.phone_2;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-500">⭐</span> Golden Lead Dossier
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Owner Info */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">{lead.owner_name}</h3>
          <p className="text-zinc-400 text-sm">{lead.property_address}</p>
          <p className="text-zinc-500 text-sm">{lead.city || ''}{lead.city && lead.state ? ', ' : ''}{lead.state || ''} {lead.zip_code || ''}</p>
          {getPhone() && (
            <p className="text-cyan-400 text-sm mt-2">📞 {getPhone()}</p>
          )}
        </div>

        {/* Eleanor Score */}
        <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-yellow-400 font-medium">Eleanor Score</span>
            <span className="text-3xl font-bold text-yellow-400">{lead.eleanor_score}</span>
          </div>
          <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-yellow-500 to-orange-500"
              style={{ width: `${lead.eleanor_score}%` }}
            />
          </div>
        </div>

        {/* Excess Funds Section */}
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <h4 className="text-green-400 font-medium mb-2">💰 Excess Funds</h4>
          <p className="text-2xl font-bold text-green-400">
            ${(lead.excess_funds_amount || 0).toLocaleString()}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Potential Fee (25%): ${((lead.excess_funds_amount || 0) * 0.25).toLocaleString()}
          </p>
        </div>

        {/* Status Section */}
        <div className="mb-6 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
          <h4 className="text-cyan-400 font-medium mb-2">📋 Lead Status</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-zinc-400">Current Status</span>
              <StatusBadge status={lead.status || 'new'} />
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Added</span>
              <span className="text-white">{new Date(lead.created_at).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Updated</span>
              <span className="text-white">{new Date(lead.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {getPhone() && (
            <a
              href={`tel:${getPhone()}`}
              className="block w-full py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors text-center"
            >
              📞 Call Now
            </a>
          )}
          <button className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-colors">
            ✉️ Send SMS
          </button>
          <button className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors">
            📄 Generate Contract
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function GoldenLeadsDashboard() {
  const [leads, setLeads] = useState<GoldenLead[]>([]);
  const [stats, setStats] = useState<GoldenStats | null>(null);
  const [recentHunts, setRecentHunts] = useState<HuntRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [hunting, setHunting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<GoldenLead | null>(null);
  const { addToast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const [leadsRes, cronRes] = await Promise.all([
        fetch('/api/golden-leads'),
        fetch('/api/golden-leads/cron'),
      ]);

      if (leadsRes.ok) {
        const data = await leadsRes.json();
        setLeads(data.leads || []);
        setStats(data.stats || null);
      }

      if (cronRes.ok) {
        const cronData = await cronRes.json();
        setRecentHunts(cronData.recent_hunts || []);
      }
    } catch (err) {
      console.error('Failed to fetch golden leads:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const startHunt = async () => {
    setHunting(true);
    addToast('info', 'Starting Golden Lead Hunt...');

    try {
      const res = await fetch('/api/golden-leads/hunt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ min_excess_amount: 2000, max_leads: 25 }),
      });

      const data = await res.json();

      if (data.success) {
        addToast('success', `Found ${data.golden_found} golden leads from ${data.scanned} scanned!`);
        await fetchData();
      } else {
        addToast('error', data.error || 'Hunt failed');
      }
    } catch {
      addToast('error', 'Failed to start hunt');
    } finally {
      setHunting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-yellow-500">⭐</span> Golden Lead Hunter
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Cross-reference leads with Zillow to find the best opportunities
          </p>
        </div>
        <button
          onClick={startHunt}
          disabled={hunting}
          className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold rounded-xl transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {hunting ? (
            <>
              <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full" />
              Hunting...
            </>
          ) : (
            <>🎯 Hunt Golden Leads</>
          )}
        </button>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatsCard
            label="Golden Leads"
            value={stats.total}
            subValue={`Avg score: ${stats.avg_eleanor_score}`}
            color="yellow"
            icon="⭐"
          />
          <StatsCard
            label="Total Excess Funds"
            value={`$${(stats.total_excess / 1000).toFixed(0)}K`}
            subValue="Available to recover"
            color="green"
            icon="💰"
          />
          <StatsCard
            label="Potential Fee (25%)"
            value={`$${((stats.total_excess * 0.25) / 1000).toFixed(0)}K`}
            subValue="Revenue opportunity"
            color="cyan"
            icon="💵"
          />
          <StatsCard
            label="Avg Eleanor Score"
            value={stats.avg_eleanor_score}
            subValue="Lead quality"
            color="purple"
            icon="⭐"
          />
        </div>
      )}

      {/* Info Banner */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4">
        <p className="text-yellow-400 text-sm">
          <span className="font-semibold">Golden Leads</span> are high-value leads with Eleanor scores of 80+ that are ready for outreach.
        </p>
      </div>

      {/* Leads Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Score</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Owner / Property</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Excess Funds</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Potential Fee</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Added</th>
            </tr>
          </thead>
          <tbody>
            {leads.length > 0 ? (
              leads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onSelect={setSelectedLead}
                  isSelected={selectedLead?.id === lead.id}
                />
              ))
            ) : (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No golden leads found. Click "Hunt Golden Leads" to start scanning.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Hunts */}
      {recentHunts.length > 0 && (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Hunts</h3>
          <div className="space-y-2">
            {recentHunts.slice(0, 5).map((hunt) => (
              <div key={hunt.id} className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className={`w-2 h-2 rounded-full ${
                    hunt.status === 'completed' ? 'bg-green-500' :
                    hunt.status === 'running' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                  }`} />
                  <span className="text-zinc-300">
                    {new Date(hunt.started_at).toLocaleDateString()} {new Date(hunt.started_at).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-sm text-zinc-400">
                  {hunt.leads_scanned} scanned → {hunt.golden_leads_identified} golden
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detail Panel */}
      {selectedLead && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedLead(null)}
          />
          <LeadDetailPanel lead={selectedLead} onClose={() => setSelectedLead(null)} />
        </>
      )}
    </div>
  );
}
