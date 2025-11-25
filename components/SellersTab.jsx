'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SellersTab() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('eleanor_score');
  const [sortOrder, setSortOrder] = useState('desc');

  // Fetch leads
  useEffect(() => {
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

    fetchLeads();

    // Set up real-time subscription
    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'maxsam_leads'
        }, 
        (payload) => {
          fetchLeads();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sortBy, sortOrder]);

  // Apply filters and search
  useEffect(() => {
    let result = [...leads];
    
    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter(lead => lead.status === statusFilter);
    }
    
    // Apply search
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

  // Handle status update
  const updateLeadStatus = async (leadId, newStatus) => {
    try {
      const { error } = await supabase
        .from('maxsam_leads')
        .update({ status: newStatus })
        .eq('id', leadId);
      
      if (error) throw error;
      
      // Refresh leads
      const { data } = await supabase.from('maxsam_leads').select('*');
      setLeads(data || []);
    } catch (error) {
      console.error('Error updating lead status:', error);
    }
  };

  // Get badge color based on status
  const getStatusBadge = (status) => {
    switch (status) {
      case 'new':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'contacted':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'negotiating':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'contract_sent':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'closed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Get badge color based on Eleanor score
  const getScoreBadge = (score) => {
    if (score >= 80) return 'bg-green-500/20 text-green-400';
    if (score >= 60) return 'bg-blue-500/20 text-blue-400';
    if (score >= 40) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-red-500/20 text-red-400';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <div>
                  <h3 className="text-lg font-semibold text-white truncate">
                    {lead.property_address || 'No Address'}
                  </h3>
                  <p className="text-zinc-400 text-sm">{lead.city || 'Unknown City'}</p>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                  {lead.status?.replace('_', ' ') || 'Unknown'}
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
                    ${(lead.excess_funds_amount || 0).toLocaleString()}
                  </p>
                </div>

                <div>
                  <p className="text-zinc-500 text-sm">Eleanor Score</p>
                  <div className="flex items-center gap-2">
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${getScoreBadge(lead.eleanor_score).replace('text-', 'bg-')}`}
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
                    onClick={() => updateLeadStatus(lead.id, 'contacted')}
                  >
                    {lead.status === 'new' ? 'Contact' : 'Update'}
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
        <div className="text-center py-12">
          <p className="text-zinc-500">No leads found matching your criteria.</p>
        </div>
      )}
    </div>
  );
}
