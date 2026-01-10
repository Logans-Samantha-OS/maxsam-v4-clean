'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import UploadZone from '@/components/dashboard/UploadZone';
import QuickStatsHeader from '@/components/dashboard/QuickStatsHeader';
import AnalyticsOverview from '@/components/dashboard/AnalyticsOverview';
import FilterPanel from '@/components/dashboard/FilterPanel';
import LeadTable from '@/components/dashboard/LeadTable';
import BulkActionsBar from '@/components/dashboard/BulkActionsBar';
import { Lead } from '@/lib/dashboard-utils';

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection State
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  // Filter State
  const [minAmount, setMinAmount] = useState(5000); // Default $5k
  const [minScore, setMinScore] = useState(0);
  const [sortBy, setSortBy] = useState('score_desc'); // or amount_desc, deadline_asc
  const [hasPhone, setHasPhone] = useState(false);

  // Action State
  const [sendingSms, setSendingSms] = useState(false);

  useEffect(() => {
    fetchData();

    // Real-time subscription
    const channel = supabase
      .channel('leads-changes-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maxsam_leads' }, () => {
        fetchData();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchData() {
    try {
      const { data, error } = await supabase
        .from('maxsam_leads')
        .select('*');

      if (error) throw error;
      setLeads(data || []);
    } catch (err) {
      console.error('Error fetching leads:', err);
    } finally {
      setLoading(false);
    }
  }

  // Filter Logic
  const filteredLeads = useMemo(() => {
    let result = leads.filter(l => {
      if ((l.excess_funds_amount || 0) < minAmount) return false;
      if ((l.eleanor_score || 0) < minScore) return false;
      if (hasPhone && !l.phone_1 && !l.phone_2) return false;
      return true;
    });

    // Sort
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
  }, [leads, minAmount, minScore, sortBy, hasPhone]);

  // Handlers
  const handleToggleSelect = (id: string, shiftKey: boolean = false) => {
    const newSelected = new Set(selectedLeads);

    if (shiftKey && lastSelectedId) {
      // Simple range selection logic could rely on index
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

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    // Optimistic update
    setLeads(leads.map(l => l.id === id ? { ...l, status: newStatus } : l));

    await supabase.from('maxsam_leads').update({ status: newStatus }).eq('id', id);
  };

  const sendSmsToLead = async (leadId: string) => {
    try {
      await fetch('https://n8n.srv758673.hstgr.cloud/webhook/sam-initial-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_id: leadId })
      });
      return true;
    } catch (e) {
      console.error('Failed to send SMS', e);
      return false;
    }
  };

  const handleTextLead = async (lead: Lead) => {
    if (!lead.phone_1 && !lead.phone_2) {
      alert('No phone number for this lead');
      return;
    }
    if (!confirm(`Send SMS to ${lead.owner_name}?`)) return;

    const success = await sendSmsToLead(lead.id);
    if (success) {
      alert('SMS Sent!');
      handleUpdateStatus(lead.id, 'contacted');
    } else {
      alert('Failed to send SMS');
    }
  };

  const handleBulkText = async () => {
    if (!confirm(`Are you sure you want to send SMS to ${selectedLeads.size} leads?`)) return;

    setSendingSms(true);
    let successCount = 0;

    // In a real app we might batch this or send IDs to backend
    // For now we loop (limit this in production!)
    const ids = Array.from(selectedLeads);
    for (const id of ids) {
      const success = await sendSmsToLead(id);
      if (success) successCount++;
    }

    setSendingSms(false);
    alert(`Sent ${successCount} messages`);
    // Ideally refetch or update statuses
    fetchData();
    setSelectedLeads(new Set());
  };

  const handleResetFilters = () => {
    setMinAmount(0);
    setMinScore(0);
    setSortBy('score_desc');
    setHasPhone(false);
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
          <p className="text-zinc-500 font-mono text-sm">Initializing Command Center...</p>
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
              <p className="text-zinc-500">Manage your pipeline, automate outreach, and close deals.</p>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Total Pipeline</div>
              <div className="text-3xl font-black text-gold">
                ${leads.reduce((s, l) => s + (l.excess_funds_amount || 0), 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <QuickStatsHeader leads={leads} />

          {/* Upload Zone */}
          <UploadZone />

          {/* Analytics */}
          <AnalyticsOverview leads={leads} />

          {/* Controls */}
          <FilterPanel
            minAmount={minAmount} setMinAmount={setMinAmount}
            minScore={minScore} setMinScore={setMinScore}
            sortBy={sortBy} setSortBy={setSortBy}
            hasPhone={hasPhone} setHasPhone={setHasPhone}
            onReset={handleResetFilters}
          />

          {/* Data Table */}
          <div className="mb-4 flex justify-between items-center text-sm text-zinc-500 px-2">
            <div>Showing {filteredLeads.length} leads</div>
            <div>{selectedLeads.size > 0 ? `${selectedLeads.size} selected` : 'Select leads to perform actions'}</div>
          </div>

          <LeadTable
            leads={filteredLeads}
            selectedLeads={selectedLeads}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            onTextLead={handleTextLead}
            onUpdateStatus={handleUpdateStatus}
          />
        </div>
      </main>

      {/* Floating Action Bar */}
      <BulkActionsBar
        selectedCount={selectedLeads.size}
        totalValue={totalSelectedValue}
        sending={sendingSms}
        onClear={() => setSelectedLeads(new Set())}
        onBulkText={handleBulkText}
        onMarkPriority={() => alert('Priority marking not implemented yet')}
        onExport={() => alert('Export not implemented yet')}
      />
    </div>
  );
}
