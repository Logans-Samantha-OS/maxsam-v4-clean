'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { GemBadgeInline, getGradeFromScore } from '@/components/GemBadge';
import { CSSGem, CSSGemInline } from '@/components/CSSGem';
import { ExpirationBadge } from '@/components/ExpirationCountdown';
import { CriticalLeadsSection } from '@/components/CriticalLeadsSection';
import LeadImportStation from '@/components/LeadImportStation';
import N8NControlCenter from '@/components/N8NControlCenter';

interface Lead {
  id: string;
  property_address: string;
  city: string;
  state?: string;
  owner_name: string;
  phone_1: string;
  phone_2: string;
  excess_funds_amount: number;
  eleanor_score: number;
  deal_grade: string;
  contact_priority: string;
  deal_type: string;
  status: string;
  call_attempts: number;
  last_call_date: string | null;
  created_at: string;
  notes: string;
  potential_revenue?: number;
  estimated_equity?: number;
  days_until_expiration?: number;
  expiration_date?: string;
  is_cross_referenced?: boolean;
}

interface PipelineStage {
  name: string;
  count: number;
  value: number;
  color: string;
}

export default function Dashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [showImportStation, setShowImportStation] = useState(false);
  const [showN8NControls, setShowN8NControls] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('*')
          .order('eleanor_score', { ascending: false });

        if (error) {
          console.error('Fetch error:', error);
        } else {
          setLeads(data || []);
        }

        setLastUpdated(new Date());
        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setLoading(false);
      }
    }

    fetchData();

    const channel = supabase
      .channel('leads-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maxsam_leads' }, () => {
        fetchData();
      })
      .subscribe();

    const interval = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  // Calculate profit for a lead
  function calculateProfit(lead: Lead): number {
    const excess = lead.excess_funds_amount || 0;
    const equity = lead.estimated_equity || (excess * 2);
    const excessFee = excess * 0.25;
    const wholesaleFee = lead.deal_type === 'dual' || lead.deal_type === 'wholesale' ? equity * 0.10 : 0;
    return excessFee + wholesaleFee;
  }

  // Computed metrics
  const totalLeads = leads.length;
  const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0);
  const projectedRevenue = leads.reduce((sum, l) => sum + calculateProfit(l), 0);

  const leadsToday = leads.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    return l.created_at?.startsWith(today);
  }).length;

  const avgScore = totalLeads > 0
    ? leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / totalLeads
    : 0;

  // Gem distribution
  const gemDistribution = {
    diamond: leads.filter(l => (l.eleanor_score || 0) >= 90).length,
    emerald: leads.filter(l => (l.eleanor_score || 0) >= 80 && (l.eleanor_score || 0) < 90).length,
    sapphire: leads.filter(l => (l.eleanor_score || 0) >= 70 && (l.eleanor_score || 0) < 80).length,
    amber: leads.filter(l => (l.eleanor_score || 0) >= 60 && (l.eleanor_score || 0) < 70).length,
    ruby: leads.filter(l => (l.eleanor_score || 0) < 60).length,
  };

  // Pipeline stages
  const pipeline: PipelineStage[] = [
    {
      name: 'New',
      count: leads.filter(l => l.status === 'new' || !l.status).length,
      value: leads.filter(l => l.status === 'new' || !l.status).reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'from-blue-500 to-blue-600'
    },
    {
      name: 'Contacted',
      count: leads.filter(l => l.status === 'contacted').length,
      value: leads.filter(l => l.status === 'contacted').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'from-cyan-500 to-cyan-600'
    },
    {
      name: 'Negotiating',
      count: leads.filter(l => l.status === 'negotiating').length,
      value: leads.filter(l => l.status === 'negotiating').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'from-yellow-500 to-yellow-600'
    },
    {
      name: 'Contract',
      count: leads.filter(l => l.status === 'contract_sent').length,
      value: leads.filter(l => l.status === 'contract_sent').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'from-purple-500 to-purple-600'
    },
    {
      name: 'Closed',
      count: leads.filter(l => l.status === 'closed').length,
      value: leads.filter(l => l.status === 'closed').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'from-green-500 to-green-600'
    },
  ];

  const closedRevenue = pipeline[4].value * 0.25;
  const hotLeads = leads.filter(l => (l.eleanor_score || 0) >= 70).slice(0, 6);
  const pendingCalls = leads.filter(l => l.status === 'new' || l.status === 'pending_call').length;

  function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }

  function formatPhone(phone: string | null): string {
    if (!phone) return 'No phone';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  function getRelativeTime(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  // Critical leads (expiring within 14 days)
  const criticalLeads = leads
    .filter(l => l.days_until_expiration !== null && l.days_until_expiration !== undefined && l.days_until_expiration <= 14)
    .map(l => ({
      ...l,
      days_until_expiration: l.days_until_expiration || 0,
      potential_revenue: l.potential_revenue || calculateProfit(l)
    }));

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030305] flex items-center justify-center graphene-bg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-gold">Loading MaxSam V4...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030305] flex graphene-bg">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header - Egyptian Pharaoh Style */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-black text-gold-shine flex items-center gap-3">
                <CSSGem grade="A+" size="lg" />
                Command Center
              </h2>
              <p className="text-zinc-500 mt-1">Dallas County Excess Funds • Last updated {getRelativeTime(lastUpdated.toISOString())}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setShowImportStation(!showImportStation)}
                className={`btn-pharaoh-cyan ${showImportStation ? 'glow-cyan' : ''}`}
              >
                Import Leads
              </button>
              <button
                onClick={() => setShowN8NControls(!showN8NControls)}
                className={`btn-pharaoh ${showN8NControls ? 'glow-gold' : ''}`}
              >
                Automations
              </button>
              <div className="text-right pharaoh-card-mini">
                <div className="text-zinc-500 text-xs uppercase tracking-wider">Your Revenue</div>
                <div className="text-3xl font-black text-gold-shine">{formatCurrency(projectedRevenue)}</div>
              </div>
            </div>
          </div>

          {/* CRITICAL LEADS SECTION - TOP OF DASHBOARD */}
          {criticalLeads.length > 0 && (
            <div className="mb-8 animate-fadeIn">
              <CriticalLeadsSection
                leads={criticalLeads}
                onCallLead={(lead) => window.location.href = `tel:${lead.phone_1}`}
                onViewLead={(lead) => console.log('View lead:', lead.id)}
              />
            </div>
          )}

          {/* Import Station (Collapsible) */}
          {showImportStation && (
            <div className="mb-8 animate-fadeIn">
              <LeadImportStation />
            </div>
          )}

          {/* N8N Controls (Collapsible) */}
          {showN8NControls && (
            <div className="mb-8 animate-fadeIn">
              <N8NControlCenter />
            </div>
          )}

          {/* Top Metrics Row - Pharaoh Style */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <div className="stat-card hover-glow-cyan">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-cyan-400 text-4xl font-black">{totalLeads}</div>
                  <div className="text-zinc-400 text-sm mt-1">Total Leads</div>
                </div>
                <CSSGem grade="B" size="sm" />
              </div>
              <div className="mt-3 text-xs text-cyan-400/70">+{leadsToday} today</div>
            </div>

            <div className="stat-card hover-glow">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-gold text-4xl font-black">{formatCurrency(projectedRevenue)}</div>
                  <div className="text-zinc-400 text-sm mt-1">Your Revenue</div>
                </div>
                <CSSGem grade="A+" size="sm" />
              </div>
              <div className="mt-3 text-xs text-yellow-400/70">25% excess + 10% wholesale</div>
            </div>

            <div className="stat-card hover-glow">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-emerald-400 text-4xl font-black">{formatCurrency(totalPipelineValue)}</div>
                  <div className="text-zinc-400 text-sm mt-1">Pipeline Value</div>
                </div>
                <CSSGem grade="A" size="sm" />
              </div>
              <div className="mt-3 text-xs text-emerald-400/70">Total excess funds</div>
            </div>

            <div className="stat-card hover-glow">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-purple-400 text-4xl font-black">{avgScore.toFixed(0)}</div>
                  <div className="text-zinc-400 text-sm mt-1">Avg Score</div>
                </div>
                <CSSGem grade="B" size="sm" />
              </div>
              <div className="mt-3 text-xs text-purple-400/70">Eleanor AI</div>
            </div>

            <div className="stat-card stat-card-critical hover-glow">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-red-400 text-4xl font-black">{pendingCalls}</div>
                  <div className="text-zinc-400 text-sm mt-1">Pending Calls</div>
                </div>
                <CSSGem grade="CRITICAL" size="sm" />
              </div>
              <div className="mt-3 text-xs text-red-400/70">Ready for outreach</div>
            </div>
          </div>

          {/* Gem Distribution - Pharaoh Style */}
          <div className="pharaoh-card mb-8">
            <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
              <CSSGem grade="A+" size="sm" />
              Lead Quality Distribution
            </h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <CSSGem grade="A+" size="md" showLabel />
                  <p className="text-2xl font-black text-white mt-2">{gemDistribution.diamond}</p>
                </div>
                <div className="text-center">
                  <CSSGem grade="A" size="md" showLabel />
                  <p className="text-2xl font-black text-white mt-2">{gemDistribution.emerald}</p>
                </div>
                <div className="text-center">
                  <CSSGem grade="B" size="md" showLabel />
                  <p className="text-2xl font-black text-white mt-2">{gemDistribution.sapphire}</p>
                </div>
                <div className="text-center">
                  <CSSGem grade="C" size="md" showLabel />
                  <p className="text-2xl font-black text-white mt-2">{gemDistribution.amber}</p>
                </div>
                <div className="text-center">
                  <CSSGem grade="D" size="md" showLabel />
                  <p className="text-2xl font-black text-white mt-2">{gemDistribution.ruby}</p>
                </div>
              </div>
              <div className="text-right pharaoh-card-mini">
                <p className="text-zinc-400 text-sm uppercase tracking-wider">Hot Leads</p>
                <p className="text-4xl font-black text-gold-shine">{gemDistribution.diamond + gemDistribution.emerald}</p>
                <p className="text-xs text-zinc-500">Diamonds + Emeralds</p>
              </div>
            </div>
          </div>

          {/* Pipeline Funnel - Pharaoh Style */}
          <div className="pharaoh-card mb-8">
            <h3 className="text-lg font-bold text-gold mb-4">Deal Pipeline</h3>
            <div className="flex gap-3">
              {pipeline.map((stage, i) => (
                <div key={stage.name} className="flex-1">
                  <div className={`bg-gradient-to-br ${stage.color} rounded-lg p-4 text-center relative overflow-hidden hover:scale-105 transition-transform card-tilt`}>
                    <div className="relative z-10">
                      <div className="text-white text-3xl font-black">{stage.count}</div>
                      <div className="text-white/80 text-xs mt-1 uppercase tracking-wider">{stage.name}</div>
                    </div>
                    {i < pipeline.length - 1 && (
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 text-white/50 text-xl z-20">→</div>
                    )}
                  </div>
                  <div className="text-center mt-2">
                    <span className="text-zinc-500 text-xs">{formatCurrency(stage.value)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-yellow-500/20 flex justify-between items-center">
              <span className="text-zinc-400 text-sm uppercase tracking-wider">Closed Revenue</span>
              <span className="text-gold-shine font-black text-2xl">{formatCurrency(closedRevenue)}</span>
            </div>
          </div>

          {/* Hot Leads Table - Pharaoh Style */}
          <div className="pharaoh-card overflow-hidden mb-8">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gold flex items-center gap-2">
                <CSSGem grade="A+" size="sm" /> Hot Leads
              </h3>
              <span className="text-zinc-400 text-sm">{hotLeads.length} leads</span>
            </div>
            {hotLeads.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No hot leads yet. Import leads and run Eleanor scoring to identify opportunities.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="pharaoh-table">
                  <thead>
                    <tr>
                      <th>Gem</th>
                      <th>Expires</th>
                      <th>Property</th>
                      <th>Owner</th>
                      <th className="text-right">Excess</th>
                      <th className="text-right">Your Profit</th>
                      <th className="text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hotLeads.map((lead) => {
                      const grade = lead.deal_grade || getGradeFromScore(lead.eleanor_score || 0);
                      const profit = calculateProfit(lead);

                      return (
                        <tr key={lead.id}>
                          <td>
                            <CSSGemInline grade={grade} size="xs" />
                          </td>
                          <td>
                            <ExpirationBadge daysUntilExpiration={lead.days_until_expiration} />
                          </td>
                          <td>
                            <div className="text-white font-medium truncate max-w-[200px]">
                              {lead.property_address || 'No address'}
                            </div>
                            <div className="text-zinc-500 text-xs">{lead.city}</div>
                          </td>
                          <td className="text-zinc-300">{lead.owner_name || 'Unknown'}</td>
                          <td className="text-right text-emerald-400 font-bold">
                            {formatCurrency(lead.excess_funds_amount || 0)}
                          </td>
                          <td className="text-right">
                            <span className="text-gold font-bold">{formatCurrency(profit)}</span>
                            {lead.deal_type && (
                              <div className="text-zinc-500 text-xs uppercase">{lead.deal_type.replace('_', ' ')}</div>
                            )}
                          </td>
                          <td className="text-center">
                            <a
                              href={`tel:${lead.phone_1 || lead.phone_2}`}
                              className="btn-pharaoh-cyan px-3 py-1 text-sm inline-block"
                            >
                              Call
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* AI Agents Status - Pharaoh Style */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="stat-card hover-glow-cyan">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <CSSGem grade="B" size="xs" />
                  <span className="text-white font-bold">Sam AI</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-bold">Active</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-400 text-sm">Queue:</span>
                <span className="text-cyan-400 font-black">{pendingCalls}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full progress-glow" style={{ width: pendingCalls > 0 ? '30%' : '0%' }}></div>
              </div>
              <p className="text-zinc-500 text-xs">SMS & Voice Outreach</p>
            </div>

            <div className="stat-card hover-glow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <CSSGem grade="A+" size="xs" />
                  <span className="text-white font-bold">Eleanor AI</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-bold">Active</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-400 text-sm">Scored:</span>
                <span className="text-purple-400 font-black">{totalLeads}</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                <div className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full progress-glow" style={{ width: `${Math.min(avgScore, 100)}%` }}></div>
              </div>
              <p className="text-zinc-500 text-xs">Avg Score: {avgScore.toFixed(1)}/100</p>
            </div>

            <div className="stat-card hover-glow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <CSSGem grade="A" size="xs" />
                  <span className="text-white font-bold">N8N Pipeline</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-bold">Active</span>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-zinc-400 text-sm">Workflows:</span>
                <span className="text-blue-400 font-black">8</span>
              </div>
              <div className="w-full bg-zinc-800 rounded-full h-2 mb-2 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 to-blue-400 h-2 rounded-full progress-glow" style={{ width: '100%' }}></div>
              </div>
              <p className="text-zinc-500 text-xs">All Systems Operational</p>
            </div>
          </div>

          {/* Footer - Pharaoh Style */}
          <div className="mt-8 text-center">
            <p className="text-gold-shine font-bold text-lg">MaxSam V4 - Egyptian Pharaoh Edition</p>
            <p className="text-zinc-500 text-sm mt-1">Logan Toups (Sole Owner) • 100% Revenue • 25% Excess / 10% Wholesale</p>
          </div>
        </div>
      </main>
    </div>
  );
}
