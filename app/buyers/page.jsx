"use client";

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import NewBuyerModal from '@/components/NewBuyerModal';

export default function BuyersPage() {
  const [buyers, setBuyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cashOnly, setCashOnly] = useState(false);
  const [showNewBuyerModal, setShowNewBuyerModal] = useState(false);

  useEffect(() => {
    async function fetchBuyers() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('buyers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching buyers:', error);
        } else {
          setBuyers(data || []);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchBuyers();

    const channel = supabase
      .channel('buyers-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'buyers' },
        () => fetchBuyers(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = buyers.filter((b) => {
    const q = search.toLowerCase();
    const matchesSearch =
      (b.name || '').toLowerCase().includes(q) ||
      (b.email || '').toLowerCase().includes(q) ||
      (b.phone || '').toLowerCase().includes(q) ||
      (b.company || '').toLowerCase().includes(q) ||
      (b.preferred_areas || '').toLowerCase().includes(q);

    const matchesCash = !cashOnly || !!b.cash_buyer;
    return matchesSearch && matchesCash;
  });

  const totalBuyers = buyers.length;
  const closedDeals = buyers.reduce((s, b) => s + (b.deals_closed || 0), 0);
  const avgClose =
    buyers.length > 0
      ? (
          buyers.reduce((s, b) => s + (b.avg_close_days || 0), 0) /
          buyers.length
        ).toFixed(1)
      : '0.0';

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Buyer Network</h1>
            <p className="text-xs text-zinc-500">
              🔥 Max&apos;s LowBallOffer.ai buyers with preferences &amp; deal stats
            </p>
          </div>
          <button
            className="px-3 py-2 rounded-lg text-sm bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
            onClick={() => setShowNewBuyerModal(true)}
          >
            + New Buyer
          </button>
        </div>

        {/* Buyer Performance Leaderboard */}
        <div className="bg-gradient-to-br from-purple-900/20 to-zinc-900 border border-purple-900/50 rounded-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🏆</span>
              <h2 className="text-xl font-semibold text-white">Buyer Performance Leaderboard</h2>
            </div>
            <span className="text-sm text-zinc-400">Last 90 days</span>
          </div>

          <div className="space-y-3">
            {buyers
              .slice() // avoid mutating original state
              .sort((a, b) => (b.deals_closed || 0) - (a.deals_closed || 0))
              .slice(0, 5)
              .map((buyer, index) => {
                const deals = buyer.deals_closed || 0;
                const closeRate = deals ? ((deals / (deals + 3)) * 100).toFixed(0) : 0;
                const medals = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];
                const performanceRaw = deals * 10 + (100 - (buyer.avg_close_days || 30));
                const performanceScore = Math.min(100, Math.max(0, performanceRaw));

                return (
                  <div
                    key={buyer.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-purple-500/50 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 flex-1">
                        <span className="text-2xl">{medals[index]}</span>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-white font-semibold">{buyer.name || 'Unnamed Buyer'}</h3>
                            {buyer.company && (
                              <span className="text-xs text-zinc-400">({buyer.company})</span>
                            )}
                            {buyer.cash_buyer && (
                              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full border border-green-500/30">
                                💵 Cash
                              </span>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-6 mt-2 text-sm">
                            <div>
                              <span className="text-zinc-400">Deals: </span>
                              <span className="text-white font-semibold">{deals}</span>
                            </div>
                            
                            <div>
                              <span className="text-zinc-400">Avg Close: </span>
                              <span className="text-cyan-400 font-semibold">{buyer.avg_close_days || 30} days</span>
                            </div>
                            
                            <div>
                              <span className="text-zinc-400">Close Rate: </span>
                              <span className="text-green-400 font-semibold">{closeRate}%</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xl font-bold text-purple-400">
                          {deals}
                        </div>
                        <div className="text-xs text-zinc-400">Total Deals</div>
                      </div>
                    </div>

                    {/* Performance Bar */}
                    <div className="mt-3">
                      <div className="flex items-center space-x-2 text-xs mb-1">
                        <span className="text-zinc-400">Performance Score:</span>
                        <span className="text-white font-semibold">
                          {performanceScore}/100
                        </span>
                      </div>
                      <div className="w-full bg-zinc-700 rounded-full h-2">
                        <div 
                          className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full"
                          style={{ width: `${performanceScore}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Insights */}
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
            <div className="flex items-start space-x-2">
              <span className="text-lg">💡</span>
              <div className="flex-1 text-sm">
                <div className="text-white font-medium mb-1">Smart Routing Recommendation</div>
                <div className="text-zinc-300">
                  {buyers.length > 0 && buyers[0] && (
                    <>
                      Route hot A+ leads to{' '}
                      <span className="text-purple-400 font-semibold">{buyers[0].name}</span>{' '}
                      for fastest close ({buyers[0].avg_close_days || 30} day average)
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-400 mb-1">Total Buyers</div>
            <div className="text-2xl font-bold text-white">{totalBuyers}</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4">
            <div className="text-xs text-green-300 mb-1">✅ Deals Closed</div>
            <div className="text-2xl font-bold text-green-400">{closedDeals}</div>
          </div>
          <div className="bg-purple-500/10 border border-purple-500/40 rounded-xl p-4">
            <div className="text-xs text-purple-300 mb-1">Avg Close Time (days)</div>
            <div className="text-2xl font-bold text-purple-400">{avgClose}</div>
          </div>
        </div>

        {/* Search + filters */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-col md:flex-row gap-4 md:items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search buyers by name, email, phone, company, or area..."
            className="flex-1 px-4 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={cashOnly}
              onChange={(e) => setCashOnly(e.target.checked)}
              className="accent-cyan-500"
            />
            Cash buyers only
          </label>
        </div>

        {/* Buyer cards */}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-zinc-500 text-sm">
            No buyers found. Add buyers or adjust your filters.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((buyer) => (
              <div
                key={buyer.id}
                className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white font-semibold">
                      {buyer.name || 'Unnamed Buyer'}
                    </div>
                    <div className="text-xs text-zinc-500">
                      {buyer.company || 'No company'}
                    </div>
                  </div>
                  {buyer.cash_buyer && (
                    <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-300">
                      💵 Cash Buyer
                    </span>
                  )}
                </div>

                <div className="text-xs text-zinc-400">
                  {buyer.phone || 'No phone'} • {buyer.email || 'No email'}
                </div>

                <div className="text-xs text-zinc-400">
                  Areas:{' '}
                  <span className="text-zinc-200">
                    {buyer.preferred_areas || 'Any'}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  Price range:{' '}
                  <span className="text-green-400">
                    $
                    {buyer.min_price
                      ? buyer.min_price.toLocaleString()
                      : '0'}{' '}
                    - $
                    {buyer.max_price
                      ? buyer.max_price.toLocaleString()
                      : 'Any'}
                  </span>
                </div>
                <div className="text-xs text-zinc-400">
                  Property types:{' '}
                  <span className="text-zinc-200">
                    {buyer.property_types || 'Any'}
                  </span>
                </div>

                <div className="flex gap-3 mt-2 text-xs text-zinc-400">
                  <span>
                    Deals:{' '}
                    <span className="text-cyan-400">
                      {buyer.deals_closed || 0}
                    </span>
                  </span>
                  <span>
                    Avg close:{' '}
                    <span className="text-purple-400">
                      {buyer.avg_close_days || 0} days
                    </span>
                  </span>
                </div>

                <div className="mt-3 flex gap-2">
                  <button className="px-3 py-1.5 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg cursor-pointer">
                    Send Deal
                  </button>
                  <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg cursor-pointer">
                    View Profile
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {/* New Buyer Modal */}
        <NewBuyerModal
          isOpen={showNewBuyerModal}
          onClose={() => setShowNewBuyerModal(false)}
          onSuccess={() => {
            // Simple refresh to pull latest buyers
            window.location.reload();
          }}
        />
      </div>
    </AppShell>
  );
}
