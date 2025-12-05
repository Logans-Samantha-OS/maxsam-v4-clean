'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

interface Lead {
  id: string;
  property_address: string;
  city: string;
  owner_name: string;
  phone_1: string;
  phone_2: string;
  excess_funds_amount: number;
  eleanor_score: number;
  deal_grade: string;
  status: string;
  created_at: string;
  last_contacted_at: string;
}

export default function SellersPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('eleanor_score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchLeads();

    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => fetchLeads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sortBy, sortOrder]);

  async function fetchLeads() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('maxsam_leads')
        .select('*')
        .order(sortBy, { ascending: sortOrder === 'asc' });

      if (error) throw error;
      setLeads(data || []);
      setFilteredLeads(data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let result = [...leads];

    if (statusFilter !== 'all') {
      result = result.filter(lead => lead.status === statusFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(lead =>
        (lead.property_address?.toLowerCase().includes(query)) ||
        (lead.owner_name?.toLowerCase().includes(query)) ||
        (lead.phone_1?.includes(query)) ||
        (lead.phone_2?.includes(query))
      );
    }

    setFilteredLeads(result);
  }, [leads, searchQuery, statusFilter]);

  async function updateLeadStatus(leadId: string, newStatus: string) {
    try {
      const { error } = await supabase
        .from('maxsam_leads')
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;
      fetchLeads();
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  }

  function getStatusBadge(status: string): string {
    switch (status) {
      case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'contacted': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'negotiating': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'contract_sent': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'closed': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  }

  function getScoreBadge(score: number): string {
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 60) return 'bg-blue-500/20 text-blue-400';
    if (score >= 40) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  }

  function getScoreBarColor(score: number): string {
    if (score >= 80) return 'bg-green-500';
    if (score >= 60) return 'bg-blue-500';
    if (score >= 40) return 'bg-yellow-500';
    return 'bg-red-500';
  }

  function formatCurrency(amount: number): string {
    return '$' + (amount || 0).toLocaleString();
  }

  const totalLeads = leads.length;
  const totalValue = leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0);
  const avgScore = totalLeads > 0 ? leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / totalLeads : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Sellers</h1>
            <p className="text-zinc-500 mt-1">Lead management and outreach tracking</p>
          </div>
          <div className="text-right">
            <div className="text-zinc-500 text-sm">Total Pipeline Value</div>
            <div className="text-2xl font-bold text-green-400">{formatCurrency(totalValue)}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{totalLeads}</div>
            <div className="text-zinc-500 text-sm">Total Leads</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{formatCurrency(totalValue * 0.25)}</div>
            <div className="text-zinc-500 text-sm">Projected Fees (25%)</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-purple-400">{avgScore.toFixed(0)}</div>
            <div className="text-zinc-500 text-sm">Avg Eleanor Score</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{filteredLeads.length}</div>
            <div className="text-zinc-500 text-sm">Showing</div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by address, name, or phone..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <select
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="negotiating">Negotiating</option>
              <option value="contract_sent">Contract Sent</option>
              <option value="closed">Closed</option>
            </select>
            <select
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="eleanor_score">Sort by Score</option>
              <option value="excess_funds_amount">Sort by Amount</option>
              <option value="created_at">Sort by Date</option>
            </select>
            <button
              className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              {sortOrder === 'asc' ? '↑' : '↓'}
            </button>
          </div>
        </div>

        {/* Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-colors">
              <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {lead.property_address || 'No Address'}
                    </h3>
                    <p className="text-zinc-400 text-sm">{lead.city || 'Unknown City'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(lead.status)}`}>
                    {lead.status?.replace('_', ' ') || 'new'}
                  </span>
                </div>

                <div className="space-y-3 mt-4">
                  <div>
                    <p className="text-zinc-500 text-sm">Owner</p>
                    <p className="text-white">{lead.owner_name || 'Unknown'}</p>
                  </div>

                  <div>
                    <p className="text-zinc-500 text-sm">Excess Funds</p>
                    <p className="text-2xl font-bold text-green-400">
                      {formatCurrency(lead.excess_funds_amount)}
                    </p>
                    <p className="text-xs text-zinc-500">Fee (25%): {formatCurrency(lead.excess_funds_amount * 0.25)}</p>
                  </div>

                  <div>
                    <p className="text-zinc-500 text-sm">Eleanor Score</p>
                    <div className="flex items-center gap-2">
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${getScoreBarColor(lead.eleanor_score)}`}
                          style={{ width: `${Math.min(lead.eleanor_score || 0, 100)}%` }}
                        ></div>
                      </div>
                      <span className={`text-xs font-bold ${getScoreBadge(lead.eleanor_score)} px-2 py-0.5 rounded`}>
                        {lead.eleanor_score || 0}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <a
                      href={`tel:${lead.phone_1 || lead.phone_2}`}
                      className="px-3 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium text-center transition-colors"
                    >
                      Call
                    </a>
                    <button
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-sm font-medium transition-colors"
                      onClick={() => updateLeadStatus(lead.id, lead.status === 'new' ? 'contacted' : 'negotiating')}
                    >
                      {lead.status === 'new' ? 'Contact' : 'Advance'}
                    </button>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 mt-4">
                    <p className="text-zinc-500 text-xs">Last Contact</p>
                    <p className="text-zinc-400 text-sm">
                      {new Date(lead.last_contacted_at || lead.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredLeads.length === 0 && !loading && (
          <div className="text-center py-12 bg-zinc-900/50 border border-zinc-800 rounded-xl">
            <p className="text-zinc-500 text-lg">No leads found matching your criteria.</p>
            <p className="text-zinc-600 text-sm mt-2">Try adjusting your filters or search query.</p>
          </div>
        )}
      </main>
    </div>
  );
}
