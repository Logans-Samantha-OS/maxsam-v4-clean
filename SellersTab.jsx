'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SellersTab() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('eleanor_score'); // eleanor_score, excess_funds_amount, created_at
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch leads
  useEffect(() => {
    async function fetchLeads() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        
        setLeads(data || []);
        setFilteredLeads(data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching leads:', err);
        setLoading(false);
      }
    }

    fetchLeads();

    // Real-time subscription
    const channel = supabase
      .channel('sellers-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maxsam_leads' }, () => {
        fetchLeads();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Filter and sort leads
  useEffect(() => {
    let filtered = [...leads];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead => 
        (lead.owner_name?.toLowerCase().includes(query)) ||
        (lead.property_address?.toLowerCase().includes(query)) ||
        (lead.phone_1?.includes(query)) ||
        (lead.excess_funds_amount?.toString().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortBy] || 0;
      let bVal = b[sortBy] || 0;
      
      if (sortOrder === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });

    setFilteredLeads(filtered);
  }, [leads, searchQuery, statusFilter, sortBy, sortOrder]);

  // Helper functions
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  }

  function formatPhone(phone) {
    if (!phone) return 'No phone';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  function getGradeBadge(grade) {
    const colors = {
      'A': 'bg-green-500/20 text-green-400 border-green-500/50',
      'B': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'C': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      'D': 'bg-orange-500/20 text-orange-400 border-orange-500/50',
      'F': 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[grade?.toUpperCase()] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
  }

  function getPriorityBadge(priority) {
    const colors = {
      'hot': 'bg-red-500/20 text-red-400',
      'warm': 'bg-orange-500/20 text-orange-400',
      'cold': 'bg-blue-500/20 text-blue-400',
    };
    return colors[priority?.toLowerCase()] || 'bg-zinc-500/20 text-zinc-400';
  }

  function getStatusBadge(status) {
    const colors = {
      'new': 'bg-blue-500/20 text-blue-400',
      'contacted': 'bg-cyan-500/20 text-cyan-400',
      'negotiating': 'bg-yellow-500/20 text-yellow-400',
      'contract_sent': 'bg-purple-500/20 text-purple-400',
      'closed': 'bg-green-500/20 text-green-400',
      'lost': 'bg-red-500/20 text-red-400',
    };
    return colors[status] || 'bg-zinc-500/20 text-zinc-400';
  }

  function getRelativeTime(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
  }

  // Stats
  const stats = {
    total: leads.length,
    new: leads.filter(l => l.status === 'new').length,
    contacted: leads.filter(l => l.status === 'contacted').length,
    negotiating: leads.filter(l => l.status === 'negotiating').length,
    signed: leads.filter(l => l.status === 'contract_sent' || l.status === 'closed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-cyan-400">Loading sellers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Sellers (Property Owners)</h1>
        <p className="text-zinc-500">Manage all property owners with excess funds claims</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-1">Total Owners</div>
          <div className="text-white text-2xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-1">New</div>
          <div className="text-blue-400 text-2xl font-bold">{stats.new}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-1">Contacted</div>
          <div className="text-cyan-400 text-2xl font-bold">{stats.contacted}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-1">Negotiating</div>
          <div className="text-yellow-400 text-2xl font-bold">{stats.negotiating}</div>
        </div>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-sm mb-1">Signed/Closed</div>
          <div className="text-green-400 text-2xl font-bold">{stats.signed}</div>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2">
            <label className="text-zinc-400 text-sm mb-2 block">Search</label>
            <input
              type="text"
              placeholder="Search by name, address, phone, amount..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-zinc-400 text-sm mb-2 block">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="negotiating">Negotiating</option>
              <option value="contract_sent">Contract Sent</option>
              <option value="closed">Closed</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {/* Sort */}
          <div>
            <label className="text-zinc-400 text-sm mb-2 block">Sort By</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value="eleanor_score">Eleanor Score</option>
              <option value="excess_funds_amount">Amount</option>
              <option value="created_at">Date Added</option>
            </select>
          </div>
        </div>

        {/* Sort Order Toggle */}
        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-white text-sm transition"
          >
            {sortOrder === 'desc' ? '↓ Descending' : '↑ Ascending'}
          </button>
          <span className="text-zinc-500 text-sm">
            Showing {filteredLeads.length} of {leads.length} sellers
          </span>
        </div>
      </div>

      {/* Sellers List */}
      {filteredLeads.length === 0 ? (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-12 text-center">
          <div className="text-zinc-600 text-6xl mb-4">🔍</div>
          <p className="text-zinc-400 text-lg mb-2">No sellers found</p>
          <p className="text-zinc-600 text-sm">
            {searchQuery ? 'Try adjusting your search or filters' : 'Import leads from Dallas County to see sellers here'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredLeads.map((lead) => (
            <div key={lead.id} className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-6 hover:bg-zinc-800/50 transition">
              {/* Header Row */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-white text-lg font-semibold mb-1">
                    {lead.owner_name || 'Unknown Owner'}
                  </h3>
                  <p className="text-zinc-400 text-sm">{lead.property_address || 'No address'}</p>
                  <p className="text-zinc-600 text-xs">{lead.city || 'Dallas'}, TX</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-bold border ${getGradeBadge(lead.deal_grade)}`}>
                    Grade {lead.deal_grade || '?'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityBadge(lead.contact_priority)}`}>
                    {lead.contact_priority || 'Normal'}
                  </span>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                    {lead.status?.replace('_', ' ') || 'new'}
                  </span>
                </div>
              </div>

              {/* Metrics Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-zinc-800/50 rounded-lg">
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Excess Funds</div>
                  <div className="text-green-400 font-bold text-lg">{formatCurrency(lead.excess_funds_amount)}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Eleanor Score</div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 bg-zinc-700 rounded-full h-2">
                      <div 
                        className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full" 
                        style={{ width: `${Math.min(lead.eleanor_score || 0, 100)}%` }}
                      ></div>
                    </div>
                    <span className="text-cyan-400 font-bold text-sm">{lead.eleanor_score || 0}</span>
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Phone</div>
                  <div className="text-white text-sm">{formatPhone(lead.phone_1)}</div>
                </div>
                <div>
                  <div className="text-zinc-500 text-xs mb-1">Added</div>
                  <div className="text-zinc-400 text-sm">{getRelativeTime(lead.created_at)}</div>
                </div>
              </div>

              {/* Actions Row */}
              <div className="flex gap-2">
                <button className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm font-medium transition">
                  📞 Call Now
                </button>
                <button className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition">
                  📧 Send Email
                </button>
                <button className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-medium transition">
                  📄 Send Contract
                </button>
                <button className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition">
                  View Details
                </button>
              </div>

              {/* Notes Section (if exists) */}
              {lead.notes && (
                <div className="mt-4 p-3 bg-zinc-800/50 rounded border-l-2 border-yellow-500">
                  <div className="text-yellow-400 text-xs font-medium mb-1">NOTES</div>
                  <p className="text-zinc-300 text-sm">{lead.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
