'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';
import GemBadge, { GemBadgeInline, getGradeFromScore } from '@/components/GemBadge';
import { CSSGem, CSSGemInline } from '@/components/CSSGem';
import { ExpirationBadge, ExpirationCountdown } from '@/components/ExpirationCountdown';

interface MorningBrief {
  date: string;
  summary: {
    new_leads_today: number;
    hot_leads: number;
    follow_ups_due: number;
    pending_contracts: number;
    pending_invoices: number;
    total_pipeline: number;
    estimated_revenue: number;
    closed_this_month: number;
  };
  hot_leads: Array<{
    id: string;
    owner_name: string;
    property_address: string;
    excess_funds: number;
    score: number;
    grade: string;
    phone: string;
    deal_type?: string;
    potential_revenue?: number;
    equity?: number;
    days_until_expiration?: number;
    is_cross_referenced?: boolean;
  }>;
  critical_leads?: Array<{
    id: string;
    owner_name: string;
    property_address: string;
    excess_funds: number;
    score: number;
    grade: string;
    phone: string;
    days_until_expiration: number;
    potential_revenue?: number;
    is_cross_referenced?: boolean;
  }>;
  follow_ups: Array<{
    id: string;
    owner_name: string;
    property_address: string;
    last_contact: string;
    attempts: number;
    score?: number;
    grade?: string;
  }>;
  pending_contracts: Array<{
    id: string;
    seller_name: string;
    property_address: string;
    total_fee: number;
    sent_at: string;
  }>;
  gem_portfolio?: {
    diamond: { count: number; value: number };
    emerald: { count: number; value: number };
    sapphire: { count: number; value: number };
    amber: { count: number; value: number };
    ruby: { count: number; value: number };
  };
}

export default function MorningBriefPage() {
  const [brief, setBrief] = useState<MorningBrief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBrief();
  }, []);

  async function fetchBrief() {
    try {
      const response = await fetch('/api/morning-brief');
      if (response.ok) {
        const data = await response.json();
        setBrief(data);
      }
    } catch (error) {
      console.error('Failed to fetch morning brief:', error);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toLocaleString()}`;
  }

  function calculateProfit(excess: number, equity: number = 0, dealType: string = 'excess_only'): number {
    const excessFee = excess * 0.25;
    const wholesaleFee = dealType !== 'excess_only' ? equity * 0.10 : 0;
    return excessFee + wholesaleFee;
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Get top priority lead
  const topLead = brief?.hot_leads?.[0];

  // Calculate gem portfolio from leads if not provided
  const gemPortfolio = brief?.gem_portfolio || {
    diamond: { count: brief?.hot_leads?.filter(l => l.grade === 'A+').length || 0, value: brief?.hot_leads?.filter(l => l.grade === 'A+').reduce((sum, l) => sum + (l.potential_revenue || calculateProfit(l.excess_funds, l.equity, l.deal_type)), 0) || 0 },
    emerald: { count: brief?.hot_leads?.filter(l => l.grade === 'A').length || 0, value: brief?.hot_leads?.filter(l => l.grade === 'A').reduce((sum, l) => sum + (l.potential_revenue || calculateProfit(l.excess_funds, l.equity, l.deal_type)), 0) || 0 },
    sapphire: { count: brief?.hot_leads?.filter(l => l.grade === 'B').length || 0, value: brief?.hot_leads?.filter(l => l.grade === 'B').reduce((sum, l) => sum + (l.potential_revenue || calculateProfit(l.excess_funds, l.equity, l.deal_type)), 0) || 0 },
    amber: { count: brief?.hot_leads?.filter(l => l.grade === 'C').length || 0, value: brief?.hot_leads?.filter(l => l.grade === 'C').reduce((sum, l) => sum + (l.potential_revenue || calculateProfit(l.excess_funds, l.equity, l.deal_type)), 0) || 0 },
    ruby: { count: brief?.hot_leads?.filter(l => l.grade === 'D').length || 0, value: brief?.hot_leads?.filter(l => l.grade === 'D').reduce((sum, l) => sum + (l.potential_revenue || calculateProfit(l.excess_funds, l.equity, l.deal_type)), 0) || 0 },
  };

  const totalPipelineValue = Object.values(gemPortfolio).reduce((sum, g) => sum + g.value, 0) || (brief?.summary.total_pipeline || 0) * 0.25;

  // Get critical leads (expiring within 7 days)
  const criticalLeads = brief?.critical_leads || brief?.hot_leads?.filter(l =>
    l.days_until_expiration !== undefined && l.days_until_expiration <= 7
  ) || [];

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center graphene-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] flex graphene-bg">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-8">
          {/* Header - Pharaoh Style */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-3 px-6 py-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 rounded-full mb-4">
              <CSSGem grade="A+" size="sm" />
              <span className="text-gold font-bold uppercase tracking-wider">Morning Brief</span>
            </div>
            <p className="text-gold text-lg mb-2">Good Morning, Logan</p>
            <h1 className="text-4xl font-black text-gold-shine mb-2">{brief?.date || today}</h1>
            <p className="text-zinc-500">Here&apos;s your money-making plan for today</p>
          </div>

          {/* CRITICAL LEADS - EXPIRING SOON - FIRST SECTION */}
          {criticalLeads.length > 0 && (
            <div className="mb-8 pharaoh-card-critical rounded-2xl overflow-hidden">
              <div className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CSSGem grade="CRITICAL" size="md" />
                  <div>
                    <h2 className="text-xl font-black text-gradient-critical uppercase tracking-wider">
                      CRITICAL - EXPIRING SOON
                    </h2>
                    <p className="text-red-400/70 text-sm">{criticalLeads.length} leads need immediate attention</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {criticalLeads.slice(0, 3).map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-4 rounded-lg"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,0,0,0.15), rgba(255,0,0,0.05))',
                        border: '1px solid rgba(255,0,0,0.3)'
                      }}
                    >
                      <div className="flex items-center gap-4">
                        <ExpirationCountdown
                          daysUntilExpiration={lead.days_until_expiration}
                          size="sm"
                        />
                        <div>
                          <div className="font-bold text-white">{lead.owner_name}</div>
                          <div className="text-zinc-400 text-sm">{lead.property_address}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-gold font-bold">
                            {formatCurrency(lead.potential_revenue || calculateProfit(lead.excess_funds, 0, 'excess_only'))}
                          </div>
                          <div className="text-zinc-500 text-xs">potential revenue</div>
                        </div>
                        <a
                          href={`tel:${lead.phone}`}
                          className="btn-pharaoh-critical px-4 py-2 text-sm"
                        >
                          Call Now
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TOP PRIORITY - CALL FIRST */}
          {topLead && (
            <div className="mb-8 bg-gradient-to-br from-red-500/10 via-orange-500/10 to-yellow-500/10 border-2 border-red-500/40 rounded-2xl overflow-hidden relative">
              {/* Animated border glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-red-500/20 via-orange-500/20 to-red-500/20 animate-pulse" />

              <div className="relative p-6">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl animate-bounce">🔥</span>
                  <h2 className="text-xl font-bold text-red-400">TOP PRIORITY - CALL FIRST!</h2>
                </div>

                <div className="flex items-center gap-8">
                  {/* Gem Badge - Large */}
                  <div className="flex-shrink-0">
                    <GemBadge
                      grade={topLead.grade || getGradeFromScore(topLead.score)}
                      score={topLead.score}
                      size="lg"
                      animated={true}
                      showProfit={true}
                      profit={topLead.potential_revenue || calculateProfit(topLead.excess_funds, topLead.equity, topLead.deal_type)}
                    />
                  </div>

                  {/* Lead Details */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-white mb-1">{topLead.owner_name || 'Property Owner'}</h3>
                    <p className="text-zinc-400 mb-4">{topLead.property_address}</p>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-zinc-500 text-sm">Excess Funds</p>
                        <p className="text-2xl font-bold text-green-400">{formatCurrency(topLead.excess_funds)}</p>
                      </div>
                      {topLead.equity && topLead.equity > 0 && (
                        <div>
                          <p className="text-zinc-500 text-sm">Wholesale Equity</p>
                          <p className="text-2xl font-bold text-blue-400">{formatCurrency(topLead.equity)}</p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-yellow-400 text-xl">💰</span>
                      <span className="text-yellow-400 text-lg">YOUR PROFIT:</span>
                      <span className="text-3xl font-bold text-white">
                        {formatCurrency(topLead.potential_revenue || calculateProfit(topLead.excess_funds, topLead.equity, topLead.deal_type))}
                      </span>
                      {topLead.deal_type && (
                        <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 rounded-full text-sm font-medium uppercase">
                          {topLead.deal_type.replace('_', ' ')}
                        </span>
                      )}
                    </div>

                    <p className="text-zinc-400 mb-4">
                      <span className="text-lg mr-2">📞</span>
                      {topLead.phone || 'No phone - Skip trace needed'}
                    </p>

                    {/* Call Now Button */}
                    <a
                      href={`tel:${topLead.phone}`}
                      className="block w-full py-4 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-center text-xl font-bold rounded-xl transition-all shadow-lg shadow-green-500/30 hover:shadow-green-500/50 animate-pulse"
                    >
                      📞 CALL NOW
                    </a>

                    <div className="flex gap-3 mt-3">
                      <button className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition">
                        💬 Send SMS
                      </button>
                      <Link href={`/sellers?id=${topLead.id}`} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition text-center">
                        👁️ View Full Details
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-blue-500/30 rounded-xl p-5 hover:border-blue-500/50 transition-all hover:shadow-lg hover:shadow-blue-500/10">
              <div className="text-blue-400 text-4xl font-bold">{brief?.summary.new_leads_today || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">New Leads Today</div>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-red-500/30 rounded-xl p-5 hover:border-red-500/50 transition-all hover:shadow-lg hover:shadow-red-500/10">
              <div className="text-red-400 text-4xl font-bold">{brief?.summary.hot_leads || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">Hot Leads Ready</div>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-yellow-500/30 rounded-xl p-5 hover:border-yellow-500/50 transition-all hover:shadow-lg hover:shadow-yellow-500/10">
              <div className="text-yellow-400 text-4xl font-bold">{brief?.summary.follow_ups_due || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">Follow-ups Due</div>
            </div>
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-purple-500/30 rounded-xl p-5 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10">
              <div className="text-purple-400 text-4xl font-bold">{brief?.summary.pending_contracts || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">Contracts Pending</div>
            </div>
          </div>

          {/* GEM PORTFOLIO */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6 mb-8">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
              <span className="text-2xl">💎</span>
              TODAY&apos;S GEM PORTFOLIO
            </h2>

            <div className="grid grid-cols-5 gap-4 mb-6">
              {/* Diamond */}
              <div className="text-center">
                <GemBadgeInline grade="A+" showName />
                <p className="text-3xl font-bold text-white mt-2">{gemPortfolio.diamond.count}</p>
                <p className="text-white/60 text-sm">{formatCurrency(gemPortfolio.diamond.value)}</p>
              </div>
              {/* Emerald */}
              <div className="text-center">
                <GemBadgeInline grade="A" showName />
                <p className="text-3xl font-bold text-white mt-2">{gemPortfolio.emerald.count}</p>
                <p className="text-white/60 text-sm">{formatCurrency(gemPortfolio.emerald.value)}</p>
              </div>
              {/* Sapphire */}
              <div className="text-center">
                <GemBadgeInline grade="B" showName />
                <p className="text-3xl font-bold text-white mt-2">{gemPortfolio.sapphire.count}</p>
                <p className="text-white/60 text-sm">{formatCurrency(gemPortfolio.sapphire.value)}</p>
              </div>
              {/* Amber */}
              <div className="text-center">
                <GemBadgeInline grade="C" showName />
                <p className="text-3xl font-bold text-white mt-2">{gemPortfolio.amber.count}</p>
                <p className="text-white/60 text-sm">{formatCurrency(gemPortfolio.amber.value)}</p>
              </div>
              {/* Ruby */}
              <div className="text-center">
                <GemBadgeInline grade="D" showName />
                <p className="text-3xl font-bold text-white mt-2">{gemPortfolio.ruby.count}</p>
                <p className="text-white/60 text-sm">{formatCurrency(gemPortfolio.ruby.value)}</p>
              </div>
            </div>

            {/* Total Revenue */}
            <div className="border-t border-zinc-700 pt-6">
              <div className="flex items-center justify-center gap-4">
                <span className="text-yellow-400 text-2xl">💰</span>
                <span className="text-zinc-400 text-lg">YOUR PROJECTED REVENUE:</span>
                <span className="text-4xl font-bold text-white">{formatCurrency(totalPipelineValue)}</span>
              </div>
            </div>
          </div>

          {/* TODAY'S CALL LIST */}
          <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden mb-8">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="text-cyan-400">📋</span> TODAY&apos;S CALL LIST
              </h2>
              <span className="text-zinc-500 text-sm">{brief?.hot_leads?.length || 0} leads</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-zinc-800/50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Gem</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Property</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Profit</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-zinc-400 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {brief?.hot_leads?.slice(0, 10).map((lead, idx) => (
                    <tr key={lead.id} className="hover:bg-zinc-800/30 transition">
                      <td className="px-4 py-3 whitespace-nowrap">
                        {idx === 0 && <span className="text-xl">🥇</span>}
                        {idx === 1 && <span className="text-xl">🥈</span>}
                        {idx === 2 && <span className="text-xl">🥉</span>}
                        {idx > 2 && <span className="text-zinc-500">{idx + 1}</span>}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <GemBadgeInline grade={lead.grade || getGradeFromScore(lead.score)} score={lead.score} />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-white font-medium">
                        {lead.owner_name || 'Unknown'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-400 text-sm max-w-xs truncate">
                        {lead.property_address}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <span className="text-yellow-400 font-bold">
                          {formatCurrency(lead.potential_revenue || calculateProfit(lead.excess_funds, lead.equity, lead.deal_type))}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-center">
                        <a
                          href={`tel:${lead.phone}`}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition inline-block"
                        >
                          📞 Call
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(!brief?.hot_leads || brief.hot_leads.length === 0) && (
              <div className="p-8 text-center text-zinc-500">
                No hot leads today. Import leads and run Eleanor scoring to identify opportunities.
              </div>
            )}
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Follow-ups */}
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-yellow-400">📞</span> Follow-ups Due
                </h2>
                <span className="text-zinc-500 text-sm">{brief?.follow_ups?.length || 0} due</span>
              </div>
              {brief?.follow_ups && brief.follow_ups.length > 0 ? (
                <div className="divide-y divide-zinc-800 max-h-80 overflow-y-auto">
                  {brief.follow_ups.map((lead) => (
                    <div key={lead.id} className="p-4 hover:bg-zinc-800/50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-3">
                          {lead.grade && <GemBadgeInline grade={lead.grade} />}
                          <div>
                            <div className="text-white font-medium">{lead.owner_name || 'Unknown'}</div>
                            <div className="text-zinc-500 text-sm truncate max-w-[200px]">{lead.property_address}</div>
                          </div>
                        </div>
                        <span className="text-zinc-400 text-xs bg-zinc-800 px-2 py-1 rounded">
                          Attempt {lead.attempts}/5
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        Last contact: {new Date(lead.last_contact).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  No follow-ups due today. Great work!
                </div>
              )}
            </div>

            {/* Pending Contracts */}
            <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-purple-400">📝</span> Contracts Pending
                </h2>
                <span className="text-zinc-500 text-sm">{brief?.pending_contracts?.length || 0} pending</span>
              </div>
              {brief?.pending_contracts && brief.pending_contracts.length > 0 ? (
                <div className="divide-y divide-zinc-800 max-h-80 overflow-y-auto">
                  {brief.pending_contracts.map((contract) => (
                    <div key={contract.id} className="p-4 hover:bg-zinc-800/50 transition flex justify-between items-center">
                      <div>
                        <div className="text-white font-medium">{contract.seller_name}</div>
                        <div className="text-zinc-500 text-sm">{contract.property_address}</div>
                        <div className="text-xs text-zinc-600">Sent: {new Date(contract.sent_at).toLocaleDateString()}</div>
                      </div>
                      <div className="text-green-400 font-bold text-xl">
                        {formatCurrency(contract.total_fee || 0)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  No contracts pending. Send some contracts!
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/"
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-xl font-medium transition-all shadow-lg shadow-cyan-500/20"
            >
              🏠 Open Dashboard
            </Link>
            <Link
              href="/sellers"
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition border border-zinc-700"
            >
              👥 View All Leads
            </Link>
            <Link
              href="/contracts"
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition border border-zinc-700"
            >
              📄 Contracts
            </Link>
            <Link
              href="/buyers"
              className="px-8 py-4 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium transition border border-zinc-700"
            >
              💼 Buyer Network
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-zinc-600 text-sm">
            100% of all revenue goes to Logan Toups (sole owner)
          </div>
        </div>
      </main>
    </div>
  );
}
