'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

interface Lead {
  id: string;
  property_address: string;
  city: string;
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

  // Computed metrics
  const totalLeads = leads.length;
  const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0);

  // Calculate projected fees: 25% of excess funds
  const projectedExcessFees = totalPipelineValue * 0.25;

  const leadsToday = leads.filter(l => {
    const today = new Date().toISOString().split('T')[0];
    return l.created_at?.startsWith(today);
  }).length;

  const avgScore = totalLeads > 0
    ? leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / totalLeads
    : 0;

  // Pipeline stages
  const pipeline: PipelineStage[] = [
    {
      name: 'New',
      count: leads.filter(l => l.status === 'new' || !l.status).length,
      value: leads.filter(l => l.status === 'new' || !l.status).reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'bg-blue-500'
    },
    {
      name: 'Contacted',
      count: leads.filter(l => l.status === 'contacted').length,
      value: leads.filter(l => l.status === 'contacted').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'bg-cyan-500'
    },
    {
      name: 'Negotiating',
      count: leads.filter(l => l.status === 'negotiating').length,
      value: leads.filter(l => l.status === 'negotiating').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'bg-yellow-500'
    },
    {
      name: 'Contract',
      count: leads.filter(l => l.status === 'contract_sent').length,
      value: leads.filter(l => l.status === 'contract_sent').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'bg-purple-500'
    },
    {
      name: 'Closed',
      count: leads.filter(l => l.status === 'closed').length,
      value: leads.filter(l => l.status === 'closed').reduce((s, l) => s + (Number(l.excess_funds_amount) || 0), 0),
      color: 'bg-green-500'
    },
  ];

  // 25% of closed excess funds
  const closedRevenue = pipeline[4].value * 0.25;
  const hotLeads = leads.filter(l => (l.eleanor_score || 0) >= 70).slice(0, 5);
  const pendingCalls = leads.filter(l => l.status === 'new' || l.status === 'pending_call').length;
  const recentActivity = leads.slice(0, 8);

  function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }

  function formatPhone(phone: string | null): string {
    if (!phone) return 'No phone';
    return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
  }

  function getGradeBadge(grade: string) {
    const colors: Record<string, string> = {
      'A+': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50',
      'A': 'bg-green-500/20 text-green-400 border-green-500/50',
      'B': 'bg-blue-500/20 text-blue-400 border-blue-500/50',
      'C': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50',
      'D': 'bg-red-500/20 text-red-400 border-red-500/50',
    };
    return colors[grade?.toUpperCase()] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
  }

  function getPriorityBadge(priority: string) {
    const colors: Record<string, string> = {
      'hot': 'bg-red-500/20 text-red-400',
      'warm': 'bg-orange-500/20 text-orange-400',
      'cold': 'bg-blue-500/20 text-blue-400',
    };
    return colors[priority?.toLowerCase()] || 'bg-zinc-500/20 text-zinc-400';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-cyan-400">Loading MaxSam V4...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              <h2 className="text-3xl font-bold text-white">Command Center</h2>
              <p className="text-zinc-500 mt-1">Dallas County Excess Funds • Last updated {getRelativeTime(lastUpdated.toISOString())}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm"
              >
                Refresh
              </button>
              <div className="text-right">
                <div className="text-zinc-500 text-xs">PIPELINE VALUE</div>
                <div className="text-2xl font-bold text-green-400">{formatCurrency(totalPipelineValue)}</div>
              </div>
            </div>
          </div>

          {/* Top Metrics Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-cyan-400 text-3xl font-bold">{totalLeads}</div>
                  <div className="text-zinc-400 text-sm mt-1">Total Leads</div>
                </div>
                <div className="text-cyan-500 text-2xl">👥</div>
              </div>
              <div className="mt-3 text-xs text-cyan-400/70">+{leadsToday} today</div>
            </div>

            <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-green-400 text-3xl font-bold">{formatCurrency(projectedExcessFees)}</div>
                  <div className="text-zinc-400 text-sm mt-1">Projected Fees</div>
                </div>
                <div className="text-green-500 text-2xl">💰</div>
              </div>
              <div className="mt-3 text-xs text-green-400/70">25% of excess funds</div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-purple-400 text-3xl font-bold">{avgScore.toFixed(0)}</div>
                  <div className="text-zinc-400 text-sm mt-1">Avg Eleanor Score</div>
                </div>
                <div className="text-purple-500 text-2xl">🧠</div>
              </div>
              <div className="mt-3 text-xs text-purple-400/70">Out of 100</div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-5">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-yellow-400 text-3xl font-bold">{pendingCalls}</div>
                  <div className="text-zinc-400 text-sm mt-1">Pending Calls</div>
                </div>
                <div className="text-yellow-500 text-2xl">📞</div>
              </div>
              <div className="mt-3 text-xs text-yellow-400/70">Ready for Sam</div>
            </div>
          </div>

          {/* Pipeline Funnel */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4">Deal Pipeline</h3>
            <div className="flex gap-2">
              {pipeline.map((stage, i) => (
                <div key={stage.name} className="flex-1">
                  <div className={`${stage.color} rounded-lg p-4 text-center relative overflow-hidden`}>
                    <div className="relative z-10">
                      <div className="text-white text-2xl font-bold">{stage.count}</div>
                      <div className="text-white/80 text-xs mt-1">{stage.name}</div>
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
            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-between">
              <span className="text-zinc-500 text-sm">Closed Revenue (25% excess fee)</span>
              <span className="text-green-400 font-bold">{formatCurrency(closedRevenue)}</span>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Hot Leads */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-red-400">🔥</span> Hot Leads (Score 70+)
                </h3>
                <span className="text-zinc-500 text-sm">{hotLeads.length} leads</span>
              </div>
              {hotLeads.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  No hot leads yet. Run Eleanor scoring to identify opportunities.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {hotLeads.map((lead) => (
                    <div key={lead.id} className="p-4 hover:bg-zinc-800/50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{lead.property_address || 'No address'}</div>
                          <div className="text-zinc-500 text-sm truncate">{lead.owner_name || 'Unknown owner'}</div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getGradeBadge(lead.deal_grade)}`}>
                            {lead.deal_grade || '?'}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${getPriorityBadge(lead.contact_priority)}`}>
                            {lead.contact_priority || 'new'}
                          </span>
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-4">
                          <span className="text-green-400 font-bold">{formatCurrency(lead.excess_funds_amount || 0)}</span>
                          <span className="text-zinc-600">|</span>
                          <span className="text-zinc-400 text-sm">{formatPhone(lead.phone_1)}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-zinc-700 rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-cyan-500 to-purple-500 h-1.5 rounded-full"
                              style={{ width: `${Math.min(lead.eleanor_score || 0, 100)}%` }}
                            ></div>
                          </div>
                          <span className="text-cyan-400 text-xs font-bold w-6">{lead.eleanor_score || 0}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h3 className="text-lg font-semibold text-white">Recent Activity</h3>
                <span className="text-zinc-500 text-sm">Last 8</span>
              </div>
              {recentActivity.length === 0 ? (
                <div className="p-8 text-center text-zinc-500">
                  No activity yet. Import leads to see updates.
                </div>
              ) : (
                <div className="divide-y divide-zinc-800">
                  {recentActivity.map((lead) => (
                    <div key={lead.id} className="p-4 hover:bg-zinc-800/50 transition flex justify-between items-center">
                      <div className="flex-1 min-w-0">
                        <div className="text-zinc-300 text-sm truncate">
                          {lead.status === 'new' ? 'New lead: ' : lead.status === 'closed' ? 'Closed: ' : 'Updated: '}
                          {lead.property_address || 'Unknown property'}
                        </div>
                        <div className="text-zinc-600 text-xs">{lead.owner_name}</div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className="text-green-400 text-sm font-medium">{formatCurrency(lead.excess_funds_amount || 0)}</span>
                        <span className="text-zinc-500 text-xs">{getRelativeTime(lead.created_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Agents Status */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-cyan-400">🎙️</span>
                  <span className="text-white font-medium">Sam AI</span>
                </div>
                <span className="text-cyan-400 text-sm">{pendingCalls} in queue</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
                <div className="bg-cyan-500 h-2 rounded-full" style={{ width: pendingCalls > 0 ? '30%' : '0%' }}></div>
              </div>
              <p className="text-zinc-500 text-xs">Twilio A2P verified</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-purple-400">🧠</span>
                  <span className="text-white font-medium">Eleanor AI</span>
                </div>
                <span className="text-purple-400 text-sm">{totalLeads} scored</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
                <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min(avgScore, 100)}%` }}></div>
              </div>
              <p className="text-zinc-500 text-xs">Avg score: {avgScore.toFixed(1)}/100</p>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400">⚡</span>
                  <span className="text-white font-medium">Alex Pipeline</span>
                </div>
                <span className="text-green-400 text-sm">Active</span>
              </div>
              <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: '91%' }}></div>
              </div>
              <p className="text-zinc-500 text-xs">N8N orchestration ready</p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center text-zinc-600 text-sm">
            MaxSam V4 • Logan Toups • 100% Revenue • 25% Excess / 10% Wholesale
          </div>
        </div>
      </main>
    </div>
  );
}
