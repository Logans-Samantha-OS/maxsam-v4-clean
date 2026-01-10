'use client';

import { useState } from 'react';
import { useLeads } from '@/lib/hooks/useLeads';
import LeadCard from '@/components/LeadCard';

export default function SellersTab() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'all',
    priority: 'all',
    leadType: 'excess_funds',
    county: 'all',
    sortBy: 'excess_amount',
    sortOrder: 'desc'
  });

  const { leads, loading, error } = useLeads(filters);

  const handleStatusChange = (leadId, newStatus) => {
    // Update lead status via API
    fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    }).then(response => {
      if (response.ok) {
        // Refetch leads
        window.location.reload();
      } else {
        alert('Failed to update status');
      }
    }).catch(error => {
      console.error('Status update error:', error);
      alert('Error updating status');
    });
  };

  const handleContact = (leadId) => {
    // Increment contact count
    fetch(`/api/leads/${leadId}/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }).then(response => {
      if (response.ok) {
        window.location.reload();
      }
    }).catch(error => {
      console.error('Contact update error:', error);
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="pharaoh-card p-8 max-w-md">
          <h2 className="text-2xl font-bold text-red-400 mb-4">Error Loading Leads</h2>
          <p className="text-zinc-400">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-gold hover:bg-yellow-600 text-black rounded-lg font-medium"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-gold mb-2">Sellers</h1>
          <p className="text-zinc-400">Manage your excess funds and wholesale leads</p>
        </div>

        {/* Filters */}
        <div className="pharaoh-card mb-6 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Search</label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                placeholder="Search by name, address, case number..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold"
              />
            </div>
            
            <div>
              <label className="block text-zinc-400 text-sm mb-2">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold"
              >
                <option value="all">All Status</option>
                <option value="new">New</option>
                <option value="contacted">Contacted</option>
                <option value="contract">Contract</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-2">Lead Type</label>
              <select
                value={filters.leadType}
                onChange={(e) => setFilters(prev => ({ ...prev, leadType: e.target.value }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold"
              >
                <option value="all">All Types</option>
                <option value="excess_funds">Excess Funds</option>
                <option value="wholesale">Wholesale</option>
                <option value="golden">Golden Leads</option>
              </select>
            </div>

            <div>
              <label className="block text-zinc-400 text-sm mb-2">Sort By</label>
              <select
                value={filters.sortBy}
                onChange={(e) => setFilters(prev => ({ ...prev, sortBy: e.target.value }))}
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-gold"
              >
                <option value="excess_amount">Excess Amount</option>
                <option value="eleanor_score">Eleanor Score</option>
                <option value="created_at">Date Created</option>
                <option value="expiration_date">Expiration Date</option>
              </select>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="pharaoh-card p-4 text-center">
            <div className="text-3xl font-bold text-gold">{leads.length}</div>
            <div className="text-zinc-400 text-sm">Total Leads</div>
          </div>
          <div className="pharaoh-card p-4 text-center">
            <div className="text-3xl font-bold text-green-400">
              {leads.filter(l => l.status === 'new').length}
            </div>
            <div className="text-zinc-400 text-sm">New Leads</div>
          </div>
          <div className="pharaoh-card p-4 text-center">
            <div className="text-3xl font-bold text-blue-400">
              {leads.filter(l => l.golden_lead).length}
            </div>
            <div className="text-zinc-400 text-sm">Golden Leads</div>
          </div>
          <div className="pharaoh-card p-4 text-center">
            <div className="text-3xl font-bold text-purple-400">
              ${leads.reduce((sum, l) => sum + (l.excess_amount || 0), 0).toLocaleString()}
            </div>
            <div className="text-zinc-400 text-sm">Total Pipeline Value</div>
          </div>
        </div>

        {/* Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              variant="sellers"
              onStatusChange={handleStatusChange}
              onContact={handleContact}
            />
          ))}
        </div>

        {/* Empty State */}
        {leads.length === 0 && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-xl font-bold text-white mb-2">No leads found</h3>
            <p className="text-zinc-400">Try adjusting your filters or search terms</p>
          </div>
        )}
      </div>
    </div>
  );
}
