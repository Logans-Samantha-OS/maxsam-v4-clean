'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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

type SortField = 'eleanor_score' | 'excess_funds_amount' | 'created_at' | 'owner_name' | 'status';
type SortDirection = 'asc' | 'desc';

// ============================================================================
// STATUS BADGE COMPONENT
// ============================================================================

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-500/20 text-green-400 border-green-500/30',
    pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    sold: 'bg-red-500/20 text-red-400 border-red-500/30',
    off_market: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30',
    ready_for_outreach: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    contacted: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    agreement_sent: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    enriched: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
    scored: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    test: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
    unknown: 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30',
  };

  const icons: Record<string, string> = {
    active: '🟢',
    pending: '🟡',
    sold: '🔴',
    off_market: '⚫',
    ready_for_outreach: '📤',
    contacted: '📞',
    agreement_sent: '📄',
    enriched: '✨',
    scored: '⭐',
    test: '🧪',
    unknown: '❓',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${colors[status] || colors.unknown}`}>
      {icons[status] || icons.unknown} {status || 'Unknown'}
    </span>
  );
}

// ============================================================================
// SORTABLE HEADER COMPONENT
// ============================================================================

function SortableHeader({
  label,
  field,
  currentSort,
  currentDirection,
  onSort,
}: {
  label: string;
  field: SortField;
  currentSort: SortField;
  currentDirection: SortDirection;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentSort === field;

  return (
    <th
      className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase cursor-pointer hover:text-zinc-200 transition-colors select-none"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        <span className={`transition-opacity ${isActive ? 'opacity-100' : 'opacity-30'}`}>
          {isActive && currentDirection === 'asc' ? '↑' : '↓'}
        </span>
      </div>
    </th>
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
  isChecked,
  onCheck,
  onSendSMS,
  onSendAgreement,
  actionLoading,
}: {
  lead: GoldenLead;
  onSelect: (lead: GoldenLead) => void;
  isSelected: boolean;
  isChecked: boolean;
  onCheck: (leadId: string, checked: boolean) => void;
  onSendSMS: (leadId: string) => void;
  onSendAgreement: (leadId: string) => void;
  actionLoading: string | null;
}) {
  const getPhone = () => lead.phone || lead.phone_1 || lead.phone_2;
  const isLoading = actionLoading === lead.id;

  return (
    <tr
      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${
        isSelected ? 'bg-yellow-500/10' : ''
      }`}
    >
      {/* Checkbox */}
      <td className="px-3 py-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            onCheck(lead.id, e.target.checked);
          }}
          className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-zinc-900 cursor-pointer"
        />
      </td>
      {/* Score */}
      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelect(lead)}>
        <div className="flex items-center gap-2">
          <span className="text-yellow-500">⭐</span>
          <span className="font-medium text-white">{lead.eleanor_score}</span>
        </div>
      </td>
      {/* Owner / Property */}
      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelect(lead)}>
        <div>
          <p className="font-medium text-white">{lead.owner_name}</p>
          <p className="text-xs text-zinc-500">{lead.property_address || 'Unknown'}</p>
        </div>
      </td>
      {/* Excess Funds */}
      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelect(lead)}>
        <span className={`font-semibold ${(lead.excess_funds_amount || 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
          ${(lead.excess_funds_amount || 0).toLocaleString()}
        </span>
      </td>
      {/* Status */}
      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelect(lead)}>
        <StatusBadge status={lead.status || 'unknown'} />
      </td>
      {/* Phone */}
      <td className="px-4 py-3">
        {getPhone() ? (
          <a
            href={`tel:${getPhone()}`}
            className="text-cyan-400 hover:text-cyan-300 hover:underline"
            onClick={(e) => e.stopPropagation()}
          >
            {getPhone()}
          </a>
        ) : (
          <span className="text-zinc-600">-</span>
        )}
      </td>
      {/* Potential Fee */}
      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelect(lead)}>
        <span className={`font-semibold ${(lead.excess_funds_amount || 0) > 0 ? 'text-purple-400' : 'text-zinc-600'}`}>
          ${((lead.excess_funds_amount || 0) * 0.25).toLocaleString()}
        </span>
      </td>
      {/* Added */}
      <td className="px-4 py-3 cursor-pointer" onClick={() => onSelect(lead)}>
        <span className="text-zinc-500 text-xs">
          {new Date(lead.created_at).toLocaleDateString()}
        </span>
      </td>
      {/* Actions */}
      <td className="px-3 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendSMS(lead.id);
            }}
            disabled={isLoading || !getPhone()}
            className="px-2 py-1 text-xs bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 rounded border border-cyan-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={getPhone() ? 'Send SMS' : 'No phone number'}
          >
            {isLoading ? '...' : '💬'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSendAgreement(lead.id);
            }}
            disabled={isLoading}
            className="px-2 py-1 text-xs bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded border border-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send Agreement"
          >
            {isLoading ? '...' : '📄'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(lead);
            }}
            className="px-2 py-1 text-xs bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30 rounded border border-zinc-500/30 transition-colors"
            title="View Details"
          >
            👁️
          </button>
        </div>
      </td>
    </tr>
  );
}

// ============================================================================
// BULK ACTION BAR COMPONENT
// ============================================================================

function BulkActionBar({
  selectedCount,
  onSendSMS,
  onSendAgreement,
  onClearSelection,
  loading,
}: {
  selectedCount: number;
  onSendSMS: () => void;
  onSendAgreement: () => void;
  onClearSelection: () => void;
  loading: boolean;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-6 py-4 flex items-center gap-4">
        <span className="text-white font-medium">
          {selectedCount} lead{selectedCount !== 1 ? 's' : ''} selected
        </span>
        <div className="h-6 w-px bg-zinc-700" />
        <button
          onClick={onSendSMS}
          disabled={loading}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            '💬'
          )}
          Send SMS
        </button>
        <button
          onClick={onSendAgreement}
          disabled={loading}
          className="px-4 py-2 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {loading ? (
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
          ) : (
            '📄'
          )}
          Send Agreement
        </button>
        <div className="h-6 w-px bg-zinc-700" />
        <button
          onClick={onClearSelection}
          className="px-3 py-2 text-zinc-400 hover:text-white transition-colors"
        >
          ✕ Clear
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// LEAD DETAIL PANEL
// ============================================================================

function LeadDetailPanel({
  lead,
  onClose,
  onSendSMS,
  onSendAgreement,
  actionLoading,
}: {
  lead: GoldenLead;
  onClose: () => void;
  onSendSMS: (leadId: string) => void;
  onSendAgreement: (leadId: string) => void;
  actionLoading: string | null;
}) {
  const getPhone = () => lead.phone || lead.phone_1 || lead.phone_2;
  const isLoading = actionLoading === lead.id;

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
          <p className="text-zinc-400 text-sm">{lead.property_address || 'Unknown address'}</p>
          <p className="text-zinc-500 text-sm">{lead.city || ''}{lead.city && lead.state ? ', ' : ''}{lead.state || ''} {lead.zip_code || ''}</p>
          {getPhone() && (
            <a href={`tel:${getPhone()}`} className="text-cyan-400 text-sm mt-2 block hover:underline">
              📞 {getPhone()}
            </a>
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
          <p className={`text-2xl font-bold ${(lead.excess_funds_amount || 0) > 0 ? 'text-green-400' : 'text-zinc-500'}`}>
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
          <button
            onClick={() => onSendSMS(lead.id)}
            disabled={isLoading || !getPhone()}
            className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              '✉️'
            )}
            Send SMS
          </button>
          <button
            onClick={() => onSendAgreement(lead.id)}
            disabled={isLoading}
            className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              '📄'
            )}
            Send Agreement
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState<SortField>('eleanor_score');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
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

  // Sorted leads
  const sortedLeads = useMemo(() => {
    const sorted = [...leads].sort((a, b) => {
      let aVal: string | number | Date;
      let bVal: string | number | Date;

      switch (sortField) {
        case 'eleanor_score':
          aVal = a.eleanor_score || 0;
          bVal = b.eleanor_score || 0;
          break;
        case 'excess_funds_amount':
          aVal = a.excess_funds_amount || 0;
          bVal = b.excess_funds_amount || 0;
          break;
        case 'created_at':
          aVal = new Date(a.created_at).getTime();
          bVal = new Date(b.created_at).getTime();
          break;
        case 'owner_name':
          aVal = a.owner_name.toLowerCase();
          bVal = b.owner_name.toLowerCase();
          break;
        case 'status':
          aVal = a.status || '';
          bVal = b.status || '';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [leads, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleCheck = (leadId: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(leadId);
    } else {
      newSelected.delete(leadId);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(sortedLeads.map(l => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

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

  const sendSMS = async (leadId: string) => {
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'send-sms' }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'SMS sent successfully!');
        await fetchData();
      } else {
        addToast('error', data.error || 'Failed to send SMS');
      }
    } catch {
      addToast('error', 'Failed to send SMS');
    } finally {
      setActionLoading(null);
    }
  };

  const sendAgreement = async (leadId: string) => {
    setActionLoading(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-contract' }),
      });
      const data = await res.json();
      if (data.success) {
        addToast('success', 'Agreement sent successfully!');
        await fetchData();
      } else {
        addToast('error', data.error || 'Failed to send agreement');
      }
    } catch {
      addToast('error', 'Failed to send agreement');
    } finally {
      setActionLoading(null);
    }
  };

  const bulkSendSMS = async () => {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'send-sms' }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      addToast('success', `Sent SMS to ${successCount} lead${successCount !== 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      addToast('error', `Failed to send SMS to ${failCount} lead${failCount !== 1 ? 's' : ''}`);
    }

    setSelectedIds(new Set());
    setBulkLoading(false);
    await fetchData();
  };

  const bulkSendAgreement = async () => {
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let failCount = 0;

    for (const id of ids) {
      try {
        const res = await fetch(`/api/leads/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'generate-contract' }),
        });
        const data = await res.json();
        if (data.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch {
        failCount++;
      }
    }

    if (successCount > 0) {
      addToast('success', `Sent agreement to ${successCount} lead${successCount !== 1 ? 's' : ''}`);
    }
    if (failCount > 0) {
      addToast('error', `Failed to send agreement to ${failCount} lead${failCount !== 1 ? 's' : ''}`);
    }

    setSelectedIds(new Set());
    setBulkLoading(false);
    await fetchData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const allSelected = sortedLeads.length > 0 && selectedIds.size === sortedLeads.length;
  const someSelected = selectedIds.size > 0 && selectedIds.size < sortedLeads.length;

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
          <span className="text-zinc-500 ml-2">Click column headers to sort. Use checkboxes for bulk actions.</span>
        </p>
      </div>

      {/* Leads Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              {/* Select All Checkbox */}
              <th className="px-3 py-3 text-left">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-yellow-500 focus:ring-yellow-500 focus:ring-offset-zinc-900 cursor-pointer"
                />
              </th>
              <SortableHeader label="Score" field="eleanor_score" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Owner / Property" field="owner_name" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Excess Funds" field="excess_funds_amount" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <SortableHeader label="Status" field="status" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Phone</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Potential Fee</th>
              <SortableHeader label="Added" field="created_at" currentSort={sortField} currentDirection={sortDirection} onSort={handleSort} />
              <th className="px-3 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedLeads.length > 0 ? (
              sortedLeads.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  onSelect={setSelectedLead}
                  isSelected={selectedLead?.id === lead.id}
                  isChecked={selectedIds.has(lead.id)}
                  onCheck={handleCheck}
                  onSendSMS={sendSMS}
                  onSendAgreement={sendAgreement}
                  actionLoading={actionLoading}
                />
              ))
            ) : (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500">
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

      {/* Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        onSendSMS={bulkSendSMS}
        onSendAgreement={bulkSendAgreement}
        onClearSelection={() => setSelectedIds(new Set())}
        loading={bulkLoading}
      />

      {/* Detail Panel */}
      {selectedLead && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedLead(null)}
          />
          <LeadDetailPanel
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onSendSMS={sendSMS}
            onSendAgreement={sendAgreement}
            actionLoading={actionLoading}
          />
        </>
      )}
    </div>
  );
}
