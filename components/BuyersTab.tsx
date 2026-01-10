'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CSSGem } from './CSSGem';

interface Buyer {
  id: string;
  name: string;
  company: string;
  price_range_min: number;
  price_range_max: number;
  reliability_rating: number;
  source_marketplace: string;
  phone: string;
  email: string;
  is_active: boolean;
  total_deals: number;
  total_volume: number;
  last_active: string;
  preferred_property_types: string[];
  response_time: string;
  funding_proof: boolean;
  matching_leads?: number;
}

export default function BuyersTab() {
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [filteredBuyers, setFilteredBuyers] = useState<Buyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [minPriceFilter, setMinPriceFilter] = useState(0);
  const [ratingFilter, setRatingFilter] = useState(0);

  useEffect(() => {
    async function fetchBuyers() {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('buyers')
          .select('*')
          .eq('is_active', true)
          .order('reliability_rating', { ascending: false });

        if (error) throw error;
        
        setBuyers(data || []);
        setFilteredBuyers(data || []);
      } catch (error) {
        console.error('Error fetching buyers:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchBuyers();

    // Set up real-time subscription
    const channel = supabase
      .channel('buyers-changes')
      .on('postgres_changes', 
        { 
          event: '*',
          schema: 'public',
          table: 'buyers'
        }, 
        () => {
          fetchBuyers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Apply filters and search
  useEffect(() => {
    let result = [...buyers];
    
    // Apply search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(buyer => 
        buyer.name.toLowerCase().includes(query) ||
        buyer.company.toLowerCase().includes(query) ||
        buyer.email.toLowerCase().includes(query) ||
        buyer.source_marketplace.toLowerCase().includes(query)
      );
    }
    
    // Apply price filter
    if (minPriceFilter > 0) {
      result = result.filter(buyer => buyer.price_range_max >= minPriceFilter);
    }
    
    // Apply rating filter
    if (ratingFilter > 0) {
      result = result.filter(buyer => buyer.reliability_rating >= ratingFilter);
    }
    
    setFilteredBuyers(result);
  }, [buyers, searchQuery, minPriceFilter, ratingFilter]);

  // Get reliability stars
  const getReliabilityStars = (rating: number) => {
    const stars = [];
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    
    for (let i = 0; i < fullStars; i++) {
      stars.push(<span key={i} className="text-yellow-400">★</span>);
    }
    
    if (hasHalfStar) {
      stars.push(<span key="half" className="text-yellow-400">☆</span>);
    }
    
    const emptyStars = 5 - Math.ceil(rating);
    for (let i = 0; i < emptyStars; i++) {
      stars.push(<span key={`empty-${i}`} className="text-zinc-600">★</span>);
    }
    
    return stars;
  };

  // Get status badge color
  const getStatusBadge = (buyer: Buyer) => {
    if (buyer.last_active && new Date(buyer.last_active) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
      return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    }
    return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  };

  // Handle contact actions
  const handleCall = (phone: string) => {
    window.location.href = `tel:${phone}`;
  };

  const handleEmail = (email: string) => {
    window.location.href = `mailto:${email}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters and Search */}
      <div className="pharaoh-card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-gold font-bold">💎 Buyer Network</span>
          <div className="flex-1 h-px bg-gradient-to-r from-yellow-500/20 to-transparent" />
          <span className="text-emerald-400 font-bold">{filteredBuyers.length} Active Buyers</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Search Buyers</label>
            <input
              type="text"
              placeholder="Name, company, email..."
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Min Deal Size (${minPriceFilter.toLocaleString()})</label>
            <input
              type="range"
              min="0"
              max="1000000"
              step="10000"
              className="w-full"
              value={minPriceFilter}
              onChange={(e) => setMinPriceFilter(Number(e.target.value))}
            />
          </div>
          
          <div>
            <label className="block text-zinc-400 text-sm mb-2">Min Rating ({ratingFilter}+ stars)</label>
            <input
              type="range"
              min="0"
              max="5"
              step="0.5"
              className="w-full"
              value={ratingFilter}
              onChange={(e) => setRatingFilter(Number(e.target.value))}
            />
          </div>
        </div>
      </div>

      {/* Buyers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredBuyers.map((buyer) => (
          <div key={buyer.id} className="pharaoh-card hover:border-emerald-500/50 transition-all duration-300 hover:scale-105">
            <div className="p-6">
              {/* Header with Rating */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">{buyer.name}</h3>
                  <p className="text-emerald-400 font-medium">{buyer.company}</p>
                </div>
                <div className="flex items-center gap-1">
                  {getReliabilityStars(buyer.reliability_rating)}
                  <span className="ml-2 px-2 py-1 bg-emerald-500/20 text-emerald-400 border-emerald-500/30 rounded-full text-xs font-bold">
                    {buyer.reliability_rating.toFixed(1)}/5
                  </span>
                </div>
              </div>

              {/* Budget and Counties */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-zinc-400 text-sm">💰</span>
                  <span className="text-white font-medium">Budget: ${buyer.price_range_min.toLocaleString()} - ${buyer.price_range_max.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-400 text-sm">📍</span>
                  <span className="text-white font-medium">Counties: {buyer.preferred_property_types.join(', ')}</span>
                </div>
              </div>

              {/* Property Types */}
              <div className="mb-4">
                <span className="text-zinc-400 text-sm">🏠</span>
                <span className="text-white font-medium">Property Types: {buyer.preferred_property_types.join(', ')}</span>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                  <div className="text-lg font-bold text-emerald-400">{buyer.matching_leads || 0}</div>
                  <div className="text-xs text-zinc-400">Matching Leads</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                  <div className="text-lg font-bold text-gold">{buyer.total_deals || 0}</div>
                  <div className="text-xs text-zinc-400">Total Deals</div>
                </div>
                <div className="text-center p-3 bg-zinc-800/50 rounded-lg">
                  <div className="text-lg font-bold text-cyan-400">{((buyer.total_volume || 0) / 1000000).toFixed(1)}M</div>
                  <div className="text-xs text-zinc-400">Total Volume</div>
                </div>
              </div>

              {/* Contact Actions */}
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => handleCall(buyer.phone)}
                  className="px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  📞 Call
                </button>
                <button
                  onClick={() => handleEmail(buyer.email)}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  📧 Email
                </button>
                <button
                  className="px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                >
                  🎯 Send Matches
                </button>
              </div>

              {/* Contact Info */}
              <div className="mt-4 pt-4 border-t border-zinc-700">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>📱 {buyer.phone}</div>
                  <div>📧 {buyer.email}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredBuyers.length === 0 && !loading && (
        <div className="text-center py-12">
          <div className="text-zinc-500 mb-4">
            <div className="text-6xl mb-4">🔍</div>
            <p>No buyers found matching your criteria.</p>
            <p className="text-sm mt-2">Try adjusting your filters or search terms.</p>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="pharaoh-card mt-8">
        <h3 className="text-lg font-bold text-gold mb-4">Buyer Network Analytics</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-black text-emerald-400">{buyers.length}</div>
            <div className="text-zinc-400 text-sm">Total Buyers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-gold">
              {buyers.filter(b => b.reliability_rating >= 4).length}
            </div>
            <div className="text-zinc-400 text-sm">Top Rated (4+)</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-cyan-400">
              ${Math.round(buyers.reduce((sum, b) => sum + (b.price_range_max || 0), 0) / 1000000)}M
            </div>
            <div className="text-zinc-400 text-sm">Total Buying Power</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-purple-400">
              {buyers.reduce((sum, b) => sum + (b.total_deals || 0), 0)}
            </div>
            <div className="text-zinc-400 text-sm">Combined Deals</div>
          </div>
        </div>
      </div>
    </div>
  );
}
