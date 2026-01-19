'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface GoldenLead {
  id: string;
  owner_name: string;
  property_address: string;
  excess_funds_amount: number;
  buyer_match_count: number;
  eleanor_score: number;
  created_at: string;
}

export default function GoldenLeadsSpotlight() {
  const [goldenLeads, setGoldenLeads] = useState<GoldenLead[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchGoldenLeads() {
      try {
        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('*')
          .eq('is_golden_lead', true)
          .order('excess_funds_amount', { ascending: false })
          .limit(5);

        if (error) throw error;

        // For now, set buyer_match_count to 0 since we don't have that table
        const leadsWithMatches = (data || []).map(lead => ({
          ...lead,
          buyer_match_count: 0
        }));

        setGoldenLeads(leadsWithMatches);
      } catch (error) {
        console.error('Error fetching golden leads:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchGoldenLeads();
  }, []);

  const handleViewLead = (leadId: string) => {
    router.push(`/sellers?lead=${leadId}`);
  };

  if (loading) {
    return (
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2">
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
        <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2">
          <span>⭐</span> Golden Leads Spotlight
        </h3>
        <div className="text-center py-8 text-zinc-500">
          <div className="text-4xl mb-2">🏆</div>
          <p>No golden leads available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="pharaoh-card border-2 border-yellow-500/50 shadow-lg shadow-yellow-500/20">
      <h3 className="text-lg font-bold text-yellow-500 mb-4 flex items-center gap-2">
        <span>⭐</span> Golden Leads Spotlight (Top 5)
      </h3>
      
      <div className="space-y-4">
        {goldenLeads.map((lead, index) => (
          <div 
            key={lead.id} 
            className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-500/10 to-transparent rounded-lg border border-yellow-500/30 hover:border-yellow-500/50 transition-all duration-300 cursor-pointer"
            onClick={() => handleViewLead(lead.id)}
          >
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold text-yellow-500">
                #{index + 1}
              </div>
              <div>
                <div className="text-white font-semibold">
                  {lead.owner_name}
                </div>
                <div className="text-zinc-400 text-sm">
                  {lead.property_address || 'No Address'}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-yellow-500 font-bold text-lg">
                ${(lead.excess_funds_amount || 0).toLocaleString()}
              </div>
              <div className="text-zinc-400 text-sm">
                {lead.buyer_match_count} buyers matched
              </div>
              <div className="text-xs text-zinc-500">
                Score: {lead.eleanor_score || 0}
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t border-zinc-700">
        <div className="flex justify-between items-center">
          <span className="text-zinc-400 text-sm">Total Golden Leads</span>
          <span className="text-yellow-500 font-bold">{goldenLeads.length}</span>
        </div>
      </div>
    </div>
  );
}
