'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function SellersTab() {
  const [leads, setLeads] = useState([]);
  const [filteredLeads, setFilteredLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('excess_amount');
  const [sortOrder, setSortOrder] = useState('desc');
  const [leadType, setLeadType] = useState('excess_funds');

  // Fee calculation functions
  const calculateExcessFee = (excessAmount) => {
    return excessAmount * 0.25; // 25% fee
  };

  const calculateAssignmentFee = (arv, mao) => {
    return Math.max(arv * 0.10, mao * 0.10); // 10% of max(ARV, MAO)
  };

  // Fetch leads
  useEffect(() => {
    async function fetchLeads() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('leads')
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
          table: 'leads'
        }, 
        () => {
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
    
    // Apply lead type filter
    if (leadType === 'golden') {
      result = result.filter(lead => lead.golden_lead);
    } else if (leadType === 'excess_funds') {
      result = result.filter(lead => lead.lead_type === 'excess_funds' || lead.lead_type === 'both');
    } else if (leadType === 'wholesale') {
      result = result.filter(lead => lead.lead_type === 'wholesale' || lead.lead_type === 'both');
    }
    
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
        (lead.phone?.includes(query)) ||
        (lead.case_number?.toLowerCase().includes(query))
      );
    }
    
    setFilteredLeads(result);
  }, [leads, searchQuery, statusFilter, leadType]);

  // Send SMS
  const sendSMS = async (leadId) => {
    try {
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          message: 'Hello! I found your excess funds claim and wanted to reach out about helping you recover your money.',
          template: 'initial_outreach'
        })
      });

      if (response.ok) {
        alert('SMS sent successfully!');
      }
    } catch (error) {
      alert('Failed to send SMS');
    }
  };

  // Send contract
  const sendContract = async (leadId) => {
    try {
      const response = await fetch('/api/contracts/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: leadId,
          document_type: 'assignment_agreement'
        })
      });

      if (response.ok) {
        alert('Contract sent successfully!');
      }
    } catch (error) {
      alert('Failed to send contract');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Lead Type Toggle */}
      <div className="pharaoh-card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gold font-bold">🏠 Lead Type</span>
          <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
          <span className="text-gold font-bold">{filteredLeads.length} Leads</span>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={() => setLeadType('excess_funds')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              leadType === 'excess_funds'
                ? 'bg-gold text-black'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            💰 Excess Funds
          </button>
          <button
            onClick={() => setLeadType('wholesale')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              leadType === 'wholesale'
                ? 'bg-cyan-600 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            🏠 Wholesale
          </button>
          <button
            onClick={() => setLeadType('golden')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              leadType === 'golden'
                ? 'bg-yellow-500 text-black'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            ⭐ Golden Leads
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="pharaoh-card">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Search</label>
            <input
              type="text"
              placeholder="Name, address, case..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Status</label>
            <select
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="new">New</option>
              <option value="contacted">Contacted</option>
              <option value="contract">Contract</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Sort By</label>
            <select
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="excess_amount">Excess Amount</option>
              <option value="owner_name">Owner Name</option>
              <option value="created_at">Date Added</option>
            </select>
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Order</label>
            <select
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-gold"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-gold">{filteredLeads.length}</div>
          <div className="text-zinc-400 text-sm">Total Leads</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-green-400">
            {leadType === 'wholesale' 
              ? `$${filteredLeads.reduce((sum, lead) => sum + calculateAssignmentFee(lead.arv_calculated || 0, lead.mao_75 || lead.mao_70 || 0), 0).toLocaleString()}`
              : `$${filteredLeads.reduce((sum, lead) => sum + calculateExcessFee(lead.excess_funds_amount || 0), 0).toLocaleString()}`
            }
          </div>
          <div className="text-zinc-400 text-sm">Potential Fees</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-cyan-400">
            {filteredLeads.filter(lead => lead.golden_lead || (lead.excess_funds_amount > 25000 && lead.property_address)).length}
          </div>
          <div className="text-zinc-400 text-sm">Golden Leads</div>
        </div>
      </div>

      {/* Leads Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLeads.map((lead) => (
          <div key={lead.id} className="pharaoh-card hover:border-gold/50 transition-all duration-300 hover:scale-105">
            <div className="p-6">
              {/* Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-white mb-1">
                    {lead.property_address || lead.case_number}
                  </h3>
                  <p className="text-zinc-400 text-sm">
                    {lead.property_city || `${lead.source_county}, TX`}
                  </p>
                </div>
                {lead.golden_lead && (
                  <div className="text-yellow-500 text-2xl">⭐</div>
                )}
              </div>

              {/* Lead Type Specific Content */}
              {leadType === 'wholesale' ? (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">ARV:</span>
                    <span className="text-white font-medium">${(lead.arv_calculated || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">MAO 70%:</span>
                    <span className="text-white font-medium">${(lead.mao_70 || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">MAO 75%:</span>
                    <span className="text-white font-medium">${(lead.mao_75 || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Repairs:</span>
                    <span className="text-white font-medium">${(lead.estimated_repairs || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Assignment Fee:</span>
                    <span className="text-gold font-bold">
                      ${calculateAssignmentFee(lead.arv_calculated || 0, lead.mao_75 || lead.mao_70 || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Excess Amount:</span>
                    <span className="text-gold font-bold">${(lead.excess_funds_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Your Fee (25%):</span>
                    <span className="text-green-400 font-bold">
                      ${calculateExcessFee(lead.excess_funds_amount || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400 text-sm">Expiration:</span>
                    <span className="text-white font-medium">
                      {lead.expiration_date ? new Date(lead.expiration_date).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>
              )}

              {/* Owner Info */}
              <div className="mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Owner:</span>
                  <span className="text-white font-medium">{lead.owner_name?.split(' ')[0]}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400 text-sm">Phone:</span>
                  <span className="text-white font-medium">{lead.phone || 'No Phone'}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  className={`px-3 py-2 rounded-lg text-sm font-medium text-center transition-colors ${
                    lead.phone
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white'
                      : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  }`}
                  disabled={!lead.phone}
                  onClick={() => lead.phone && window.open(`tel:${lead.phone}`)}
                >
                  📞 Call
                </button>
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

              {/* Last Contact */}
              <div className="pt-3 border-t border-zinc-800 mt-4">
                <p className="text-zinc-500 text-xs">Last Contact</p>
                <p className="text-zinc-400 text-sm">
                  {new Date(lead.last_contacted_at || lead.created_at).toLocaleDateString()}
                </p>
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
