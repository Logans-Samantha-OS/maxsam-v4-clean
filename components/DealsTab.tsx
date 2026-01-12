'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CSSGem } from './CSSGem';

interface Deal {
  id: string;
  lead_id: string;
  property_address: string;
  city?: string;
  owner_name: string;
  excess_funds_amount: number;
  status: string;
  deal_stage: string;
  buyer_id?: string;
  buyer_name?: string;
  contract_sent_date?: string;
  contract_signed_date?: string;
  filing_date?: string;
  payment_received_date?: string;
  estimated_revenue: number;
  actual_revenue?: number;
  profit_margin: number;
  deal_type: string;
  created_at: string;
  last_updated: string;
  notes?: string;
  documents?: string[];
}

interface PipelineStage {
  name: string;
  count: number;
  value: number;
  revenue: number;
  color: string;
  deals: Deal[];
}

export default function DealsTab() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  useEffect(() => {
    async function fetchDeals() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('*')
          .not('status', 'eq', 'new')
          .order(sortBy, { ascending: sortOrder === 'asc' });

        if (error) throw error;
        
        // Transform leads into deals format
        const transformedDeals = (data || []).map(lead => ({
          ...lead,
          deal_stage: lead.status || 'new',
          estimated_revenue: (lead.excess_funds_amount || 0) * 0.25,
          profit_margin: 25,
          buyer_name: lead.assigned_buyer || 'Unassigned'
        }));
        
        setDeals(transformedDeals);
        setFilteredDeals(transformedDeals);
      } catch (error) {
        console.error('Error fetching deals:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchDeals();

    // Set up real-time subscription
    const channel = supabase
      .channel('deals-changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'maxsam_leads'
        }, 
        () => {
          fetchDeals();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sortBy, sortOrder]);

  // Apply filters and search
  useEffect(() => {
    let result = [...deals];
    
    // Apply stage filter
    if (stageFilter !== 'all') {
      result = result.filter(deal => deal.deal_stage === stageFilter);
    }
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(deal => 
        deal.property_address?.toLowerCase().includes(query) ||
        deal.owner_name?.toLowerCase().includes(query) ||
        deal.buyer_name?.toLowerCase().includes(query)
      );
    }
    
    setFilteredDeals(result);
  }, [deals, searchQuery, stageFilter]);

  // Pipeline stages
  const pipelineStages: PipelineStage[] = [
    {
      name: 'Contacted',
      count: filteredDeals.filter(d => d.deal_stage === 'contacted').length,
      value: filteredDeals.filter(d => d.deal_stage === 'contacted').reduce((sum, d) => sum + (d.excess_funds_amount || 0), 0),
      revenue: filteredDeals.filter(d => d.deal_stage === 'contacted').reduce((sum, d) => sum + (d.estimated_revenue || 0), 0),
      color: 'from-cyan-500 to-cyan-600',
      deals: filteredDeals.filter(d => d.deal_stage === 'contacted')
    },
    {
      name: 'Interested',
      count: filteredDeals.filter(d => d.deal_stage === 'interested').length,
      value: filteredDeals.filter(d => d.deal_stage === 'interested').reduce((sum, d) => sum + (d.excess_funds_amount || 0), 0),
      revenue: filteredDeals.filter(d => d.deal_stage === 'interested').reduce((sum, d) => sum + (d.estimated_revenue || 0), 0),
      color: 'from-blue-500 to-blue-600',
      deals: filteredDeals.filter(d => d.deal_stage === 'interested')
    },
    {
      name: 'Contract Sent',
      count: filteredDeals.filter(d => d.deal_stage === 'contract_sent' || d.deal_stage === 'signed').length,
      value: filteredDeals.filter(d => d.deal_stage === 'contract_sent' || d.deal_stage === 'signed').reduce((sum, d) => sum + (d.excess_funds_amount || 0), 0),
      revenue: filteredDeals.filter(d => d.deal_stage === 'contract_sent' || d.deal_stage === 'signed').reduce((sum, d) => sum + (d.estimated_revenue || 0), 0),
      color: 'from-purple-500 to-purple-600',
      deals: filteredDeals.filter(d => d.deal_stage === 'contract_sent' || d.deal_stage === 'signed')
    },
    {
      name: 'Filed',
      count: filteredDeals.filter(d => d.deal_stage === 'filed').length,
      value: filteredDeals.filter(d => d.deal_stage === 'filed').reduce((sum, d) => sum + (d.excess_funds_amount || 0), 0),
      revenue: filteredDeals.filter(d => d.deal_stage === 'filed').reduce((sum, d) => sum + (d.estimated_revenue || 0), 0),
      color: 'from-orange-500 to-orange-600',
      deals: filteredDeals.filter(d => d.deal_stage === 'filed')
    },
    {
      name: 'Paid',
      count: filteredDeals.filter(d => d.deal_stage === 'paid' || d.deal_stage === 'closed').length,
      value: filteredDeals.filter(d => d.deal_stage === 'paid' || d.deal_stage === 'closed').reduce((sum, d) => sum + (d.excess_funds_amount || 0), 0),
      revenue: filteredDeals.filter(d => d.deal_stage === 'paid' || d.deal_stage === 'closed').reduce((sum, d) => sum + (d.estimated_revenue || 0), 0),
      color: 'from-green-500 to-green-600',
      deals: filteredDeals.filter(d => d.deal_stage === 'paid' || d.deal_stage === 'closed')
    }
  ];

  // Get status badge color
  const getStageBadge = (stage: string) => {
    switch (stage) {
      case 'contacted':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
      case 'interested':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'contract_sent':
      case 'signed':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'filed':
        return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'paid':
      case 'closed':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header and Filters */}
      <div className="pharaoh-card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gold font-bold">📊 Deal Pipeline</span>
          <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
          <span className="text-purple-400 font-bold">{filteredDeals.length} Active Deals</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Search Deals</label>
            <input
              type="text"
              placeholder="Address, owner, buyer..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Stage Filter</label>
            <select
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="all">All Stages</option>
              <option value="contacted">Contacted</option>
              <option value="interested">Interested</option>
              <option value="contract_sent">Contract Sent</option>
              <option value="signed">Signed</option>
              <option value="filed">Filed</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Sort By</label>
            <div className="flex gap-2">
              <select
                className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="created_at">Date Created</option>
                <option value="excess_funds_amount">Deal Amount</option>
                <option value="estimated_revenue">Revenue</option>
                <option value="owner_name">Owner Name</option>
              </select>
              <button
                className="px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white hover:bg-zinc-700"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pipeline Overview */}
      <div className="pharaoh-card mb-6">
        <h3 className="text-lg font-bold text-gold mb-4">Pipeline Overview</h3>
        <div className="space-y-4">
          {pipelineStages.map((stage, index) => (
            <div key={stage.name} className="flex items-center gap-4">
              <div className="w-32">
                <div className={`text-white font-bold text-sm bg-gradient-to-r ${stage.color} px-3 py-2 rounded-lg text-center`}>
                  {stage.name}
                </div>
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-2">
                  <div className="text-white font-bold">{stage.count} deals</div>
                  <div className="text-emerald-400">{formatCurrency(stage.value)}</div>
                  <div className="text-gold">{formatCurrency(stage.revenue)} revenue</div>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`bg-gradient-to-r ${stage.color} h-3 rounded-full transition-all duration-500`}
                    style={{ width: `${Math.max((stage.count / Math.max(...pipelineStages.map(s => s.count))) * 100, 5)}%` }}
                  />
                </div>
              </div>
              
              {index < pipelineStages.length - 1 && (
                <div className="text-zinc-500 text-xl">→</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Deals Table */}
      <div className="pharaoh-card overflow-hidden">
        <h3 className="text-lg font-bold text-gold mb-4">Deal Details</h3>
        
        {filteredDeals.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <div className="text-6xl mb-4">📋</div>
            <p>No deals found matching your criteria.</p>
            <p className="text-sm mt-2">Try adjusting your filters or search terms.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium">Property</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium">Owner</th>
                  <th className="text-left py-3 px-4 text-zinc-400 font-medium">Buyer</th>
                  <th className="text-center py-3 px-4 text-zinc-400 font-medium">Stage</th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium">Excess Funds</th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium">Your Revenue</th>
                  <th className="text-right py-3 px-4 text-zinc-400 font-medium">Created</th>
                </tr>
              </thead>
              <tbody>
                {filteredDeals.map((deal) => (
                  <tr key={deal.id} className="border-b border-zinc-800 hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <div className="text-white font-medium">{deal.property_address || 'No Address'}</div>
                      <div className="text-zinc-500 text-sm">{deal.city}</div>
                    </td>
                    <td className="py-3 px-4 text-zinc-300">{deal.owner_name || 'Unknown'}</td>
                    <td className="py-3 px-4 text-zinc-300">{deal.buyer_name || 'Unassigned'}</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStageBadge(deal.deal_stage)}`}>
                        {deal.deal_stage?.replace('_', ' ') || 'Unknown'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-emerald-400 font-bold">
                      {formatCurrency(deal.excess_funds_amount || 0)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className="text-gold font-bold">{formatCurrency(deal.estimated_revenue || 0)}</span>
                      <div className="text-zinc-500 text-xs">{deal.profit_margin}% margin</div>
                    </td>
                    <td className="py-3 px-4 text-right text-zinc-400 text-sm">
                      {new Date(deal.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="pharaoh-card mt-8">
        <h3 className="text-lg font-bold text-gold mb-4">Deal Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-black text-purple-400">{filteredDeals.length}</div>
            <div className="text-zinc-400 text-sm">Total Deals</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-emerald-400">
              {formatCurrency(filteredDeals.reduce((sum, d) => sum + (d.excess_funds_amount || 0), 0))}
            </div>
            <div className="text-zinc-400 text-sm">Total Pipeline Value</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-gold">
              {formatCurrency(filteredDeals.reduce((sum, d) => sum + (d.estimated_revenue || 0), 0))}
            </div>
            <div className="text-zinc-400 text-sm">Projected Revenue</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-cyan-400">
              {filteredDeals.filter(d => d.deal_stage === 'paid' || d.deal_stage === 'closed').length}
            </div>
            <div className="text-zinc-400 text-sm">Closed Deals</div>
          </div>
        </div>
      </div>
    </div>
  );
}
