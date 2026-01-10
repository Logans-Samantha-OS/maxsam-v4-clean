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
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [minAmount, setMinAmount] = useState(1);

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
    
    // Apply priority filter
    if (priorityFilter !== 'all') {
      result = result.filter(lead => lead.contact_priority === priorityFilter);
    }
    
    // Apply min amount filter
    result = result.filter(lead => (lead.excess_funds_amount || 0) >= minAmount);
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(lead => 
        (lead.property_address?.toLowerCase().includes(query)) ||
        (lead.owner_name?.toLowerCase().includes(query)) ||
        (lead.case_number?.toLowerCase().includes(query)) ||
        (lead.phone_1?.includes(query)) ||
        (lead.phone_2?.includes(query))
      );
    }
    
    setFilteredLeads(result);
  }, [leads, searchQuery, statusFilter, priorityFilter, minAmount]);

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

  // Handle SMS sending
  const sendSMS = async (leadId) => {
    try {
      const response = await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lead_id: leadId,
          timestamp: new Date().toISOString()
        }),
      });

      if (response.ok) {
        console.log('SMS sent successfully for lead:', leadId);
        // You might want to show a success message or update the UI
      } else {
        console.error('Failed to send SMS');
      }
    } catch (error) {
      console.error('Error sending SMS:', error);
    }
  };

  // Handle contract sending
  const sendContract = async (leadId) => {
    try {
      const response = await fetch('/api/contracts/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lead_id: leadId }),
      });
      
      if (!response.ok) throw new Error('Contract sending failed');
      
      alert('Contract sent successfully!');
    } catch (error) {
      console.error('Error sending contract:', error);
      alert('Failed to send contract');
    }
  };

  // Get badge color based on priority
  const getPriorityBadge = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'high':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
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
      <div className="pharaoh-card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gold font-bold">🔍 Advanced Filters</span>
          <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Search</label>
            <input
              type="text"
              placeholder="Name, case, address, phone..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Status</label>
            <select
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="signed">Signed</option>
              <option value="filed">Filed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Priority</label>
            <select
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Min Amount (${minAmount.toLocaleString()})</label>
            <input
              type="range"
              min="1"
              max="50000"
              step="100"
              className="w-full"
              value={minAmount}
              onChange={(e) => setMinAmount(Number(e.target.value))}
            />
          </div>
        </div>
        
        <div className="flex gap-2 mt-4">
          <select
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="eleanor_score">Sort by Score</option>
            <option value="excess_funds_amount">Sort by Amount</option>
            <option value="created_at">Sort by Date</option>
            <option value="owner_name">Sort by Name</option>
          </select>
          <button
            className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700"
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑ Ascending' : '↓ Descending'}
          </button>
        </div>
      </div>

      {/* Leads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-cyan-500/50 transition-colors">
            <div className="p-5">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white truncate">
                      {lead.property_address || 'No Address'}
                    </h3>
                    <p className="text-zinc-400 text-sm">{lead.city || 'Unknown City'}</p>
                    {lead.case_number && (
                      <p className="text-zinc-500 text-xs">Case: {lead.case_number}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusBadge(lead.status)}`}>
                      {lead.status?.replace('_', ' ') || 'Unknown'}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityBadge(lead.contact_priority)}`}>
                      {lead.contact_priority || 'medium'}
                    </span>
                  </div>
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

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <a 
                    href={`tel:${lead.phone_1 || lead.phone_2}`}
                    className={`px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
                      lead.phone_1 || lead.phone_2
                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                    }`}
                    disabled={!lead.phone_1 && !lead.phone_2}
                  >
                    📞 Call
                  </a>
                  <button 
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    onClick={() => sendSMS(lead.id)}
                  >
                    💬 SMS
                  </button>
                  <button 
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    onClick={() => sendContract(lead.id)}
                  >
                    📄 Contract
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
