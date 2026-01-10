'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface GoldenLead {
  id: string;
  owner_name: string;
  property_address: string;
  excess_funds_amount: number;
  eleanor_score: number;
  contact_priority: string;
  buyer_match_count: number;
  city: string;
}

export default function GoldenLeadsSpotlight() {
  const [goldenLeads, setGoldenLeads] = useState<GoldenLead[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchGoldenLeads() {
      try {
        const { data: leads } = await supabase
          .from('maxsam_leads')
          .select('*')
          .eq('golden_lead', true)
          .order('excess_funds_amount', { ascending: false })
          .limit(5);

        // For each golden lead, count potential buyers
        const leadsWithMatches = await Promise.all(
          (leads || []).map(async (lead) => {
            const { count } = await supabase
              .from('buyers')
              .select('*', { count: 'exact' })
              .gte('min_deal_size', lead.excess_funds_amount * 0.7)
              .lte('max_deal_size', lead.excess_funds_amount * 1.3);

            return {
              ...lead,
              buyer_match_count: count || 0
            };
          })
        );

        setGoldenLeads(leadsWithMatches);
      } catch (error) {
        console.error('Error fetching golden leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchGoldenLeads();

    // Set up real-time updates
    const channel = supabase
      .channel('golden-leads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maxsam_leads' }, () => {
        fetchGoldenLeads();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400';
      case 'high': return 'text-orange-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-zinc-400';
    }
  };

  if (loading) {
    return (
      <div className="pharaoh-card border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>⭐</span> Golden Leads Spotlight
        </h3>
        <div className="flex justify-center items-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-yellow-500"></div>
        </div>
      </div>
    );
  }

  if (goldenLeads.length === 0) {
    return (
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>⭐</span> Golden Leads Spotlight
        </h3>
        <div className="text-center py-8 text-zinc-500">
          <div className="text-4xl mb-2">💎</div>
          <p>No golden leads identified yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pharaoh-card border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20">
      <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
        <span>⭐</span> Golden Leads Spotlight ({goldenLeads.length})
      </h3>
      
      <div className="space-y-4">
        {goldenLeads.map((lead, index) => (
          <div 
            key={lead.id} 
            className="p-4 bg-gradient-to-r from-yellow-500/10 to-amber-500/10 rounded-lg border border-yellow-500/30 hover:border-yellow-500/60 transition-all duration-300 transform hover:scale-[1.02]"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h4 className="text-gold font-bold text-lg">{lead.owner_name}</h4>
                <p className="text-zinc-400 text-sm">{lead.property_address}</p>
                <p className="text-zinc-500 text-xs">{lead.city}</p>
              </div>
              <div className="text-right">
                <div className={`px-2 py-1 rounded-full text-xs font-bold ${getPriorityColor(lead.contact_priority)} bg-zinc-800`}>
                  {lead.contact_priority?.toUpperCase()}
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Excess Amount</p>
                <p className="text-gold font-bold text-xl">
                  ${(lead.excess_funds_amount || 0).toLocaleString()}
                </p>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Your Take (32%)</p>
                <p className="text-emerald-400 font-bold text-xl">
                  ${Math.round((lead.excess_funds_amount || 0) * 0.32).toLocaleString()}
                </p>
              </div>
              
              <div className="bg-zinc-800/50 rounded-lg p-3">
                <p className="text-zinc-500 text-xs mb-1">Buyer Matches</p>
                <p className="text-cyan-400 font-bold text-xl">
                  {lead.buyer_match_count}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-4">
              <button className="flex-1 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-600 hover:to-amber-600 text-black font-bold rounded-lg transition-all duration-300 transform hover:scale-105">
                🎯 View Lead Details
              </button>
              <button className="flex-1 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white font-bold rounded-lg transition-all duration-300 transform hover:scale-105">
                📞 Call Now
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
