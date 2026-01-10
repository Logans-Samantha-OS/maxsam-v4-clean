'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import UploadZone from '@/components/dashboard/UploadZone';
import QuickStatsHeader from '@/components/dashboard/QuickStatsHeader';
import AnalyticsOverview from '@/components/dashboard/AnalyticsOverview';
import FilterPanel from '@/components/dashboard/FilterPanel';
import LeadTable from '@/components/dashboard/LeadTable';
import BulkActionsBar from '@/components/dashboard/BulkActionsBar';
import { Lead } from '@/lib/dashboard-utils';
import { useToast } from '@/components/Toast';

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  // Selection State
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Filter State
  const [minAmount, setMinAmount] = useState(0);
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState('score_desc');
  const [hasPhone, setHasPhone] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load leads on mount
  useEffect(() => {
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('leads-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maxsam_leads' }, (payload) => {
        console.log('Real-time update:', payload);
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maxsam_leads')
        .select('*')
        .neq('status', 'deleted')
        .order('eleanor_score', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
      addToast('error', 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  // Filter & Sort Logic
  const filteredLeads = useMemo(() => {
    let result = leads.filter(l => {
      if ((l.excess_funds_amount || 0) < minAmount) return false;
      if ((l.eleanor_score || 0) < minScore) return false;
      if (hasPhone && !l.phone_1 && !l.phone_2) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!l.owner_name?.toLowerCase().includes(q) &&
          !l.property_address?.toLowerCase().includes(q) &&
          !l.phone_1?.includes(q)) {
          return false;
        }
      }
      return true;
    });

    result.sort((a, b) => {
      switch (sortBy) {
        case 'score_desc': return (b.eleanor_score || 0) - (a.eleanor_score || 0);
        case 'amount_desc': return (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0);
        case 'deadline_asc': return (a.days_until_expiration || 999) - (b.days_until_expiration || 999);
        case 'created_desc': return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default: return 0;
      }
    });

    return result;
  }, [leads, minAmount, minScore, sortBy, hasPhone, searchQuery]);

  // Selection Handlers
  const handleToggleSelect = (id: string, shiftKey: boolean = false) => {
    const newSelected = new Set(selectedLeads);

    if (shiftKey && lastSelectedId) {
      const currentIndex = filteredLeads.findIndex(l => l.id === id);
      const lastIndex = filteredLeads.findIndex(l => l.id === lastSelectedId);

      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        for (let i = start; i <= end; i++) {
          newSelected.add(filteredLeads[i].id);
        }
      }
    } else {
      if (newSelected.has(id)) {
        newSelected.delete(id);
      } else {
        newSelected.add(id);
      }
    }

    setSelectedLeads(newSelected);
    setLastSelectedId(id);
  };

  const handleToggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
    }
  };

  // Lead Update Handler (for inline edits)
  const handleLeadUpdate = (updatedLead: Lead) => {
    setLeads(leads.map(l => l.id === updatedLead.id ? updatedLead : l));
  };

  const handleResetFilters = () => {
    setMinAmount(0);
    setMinScore(0);
    setSortBy('score_desc');
    setHasPhone(false);
    setSearchQuery('');
  };

  const totalSelectedValue = useMemo(() => {
    return leads
      .filter(l => selectedLeads.has(l.id))
      .reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0);
  }, [leads, selectedLeads]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center graphene-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold mx-auto mb-4"></div>
          <p className="text-zinc-500 font-mono text-sm">Loading Command Center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] flex graphene-bg text-zinc-100 font-sans">
      <Sidebar />

      <main className="flex-1 overflow-y-auto h-screen p-8">
        <div className="max-w-7xl mx-auto pb-24">

          {/* Header */}
          <div className="flex justify-between items-end mb-8">
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight mb-2">Command Center</h1>
              <p className="text-zinc-500">Manage pipeline • Automate outreach • Close deals</p>
            </div>
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search leads..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm w-64 focus:outline-none focus:border-gold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
              </div>

              <div className="text-right">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Pipeline</div>
                <div className="text-2xl font-black text-gold">
                  ${leads.reduce((s, l) => s + (l.excess_funds_amount || 0), 0).toLocaleString()}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <QuickStatsHeader leads={leads} />

          {/* Upload Zone */}
          <UploadZone />

          {/* Analytics */}
          <AnalyticsOverview leads={leads} />

          {/* Filters */}
          <FilterPanel
            minAmount={minAmount} setMinAmount={setMinAmount}
            minScore={minScore} setMinScore={setMinScore}
            sortBy={sortBy} setSortBy={setSortBy}
            hasPhone={hasPhone} setHasPhone={setHasPhone}
            onReset={handleResetFilters}
          />

          {/* Results Count */}
          <div className="mb-4 flex justify-between items-center text-sm text-zinc-500 px-2">
            <div>
              Showing <span className="text-white font-bold">{filteredLeads.length}</span> of {leads.length} leads
            </div>
            <div>
              {selectedLeads.size > 0 && (
                <span className="text-gold">{selectedLeads.size} selected</span>
              )}
            </div>
          </div>

          {/* Lead Table */}
          <LeadTable
            leads={filteredLeads}
            selectedLeads={selectedLeads}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onLeadUpdate={handleLeadUpdate}
          />
        </div>
      </main>

      {/* Bulk Actions */}
      <BulkActionsBar
        selectedIds={Array.from(selectedLeads)}
        totalValue={totalSelectedValue}
        onClear={() => setSelectedLeads(new Set())}
        onSuccess={fetchData}
      />
    </div>
  );
}
