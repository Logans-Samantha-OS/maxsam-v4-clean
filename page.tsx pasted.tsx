'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Types
interface DashboardMetrics {
  total_leads: number;
  active_deals: number;
  conversion_rate: number;
  total_revenue: number;
  avg_eleanor_score: number;
  leads_today: number;
  calls_pending: number;
}

interface GoldenOpportunity {
  id: string;
  property_address: string;
  city: string;
  excess_funds_amount: number;
  eleanor_score: number;
  deal_grade: string;
  contact_priority: string;
  owner_name: string;
  phone_1: string;
  status: string;
  created_at: string;
}

interface CallQueueItem {
  id: string;
  property_address: string;
  owner_name: string;
  phone_1: string;
  eleanor_score: number;
  contact_priority: string;
  call_attempts: number;
  last_call_date: string | null;
  status: string;
}

interface RecentActivity {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export default function Page() {
  // State
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_leads: 0,
    active_deals: 0,
    conversion_rate: 0,
    total_revenue: 0,
    avg_eleanor_score: 0,
    leads_today: 0,
    calls_pending: 0,
  });
  const [goldenOpportunities, setGoldenOpportunities] = useState<GoldenOpportunity[]>([]);
  const [callQueue, setCallQueue] = useState<CallQueueItem[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch all dashboard data
  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setLoading(true);
        
        // Fetch metrics from dashboard_metrics view
        const { data: metricsData, error: metricsError } = await supabase
          .from('dashboard_metrics')
          .select('*')
          .single();

        if (metricsError && metricsError.code !== 'PGRST116') {
          console.error('Metrics error:', metricsError);
        }

        // Fetch golden opportunities (top scored leads)
        const { data: goldenData, error: goldenError } = await supabase
          .from('golden_opportunities')
          .select('*')
          .order('eleanor_score', { ascending: false })
          .limit(10);

        if (goldenError && goldenError.code !== 'PGRST116') {
          console.error('Golden opportunities error:', goldenError);
        }

        // Fetch call queue
        const { data: callData, error: callError } = await supabase
          .from('call_queue')
          .select('*')
          .order('eleanor_score', { ascending: false })
          .limit(10);

        if (callError && callError.code !== 'PGRST116') {
          console.error('Call queue error:', callError);
        }

        // Fetch recent leads for activity feed
        const { data: recentLeads, error: recentError } = await supabase
          .from('maxsam_leads')
          .select('id, property_address, owner_name, eleanor_score, status, created_at')
          .order('created_at', { ascending: false })
          .limit(10);

        if (recentError && recentError.code !== 'PGRST116') {
          console.error('Recent leads error:', recentError);
        }

        // Calculate metrics from leads if view doesn't exist
        if (!metricsData && recentLeads) {
          const { data: allLeads } = await supabase
            .from('maxsam_leads')
            .select('id, status, excess_funds_amount, eleanor_score, created_at');

          if (allLeads) {
            const total = allLeads.length;
            const activeDeals = allLeads.filter(l => 
              ['contacted', 'negotiating', 'contract_sent'].includes(l.status || '')
            ).length;
            const closedDeals = allLeads.filter(l => l.status === 'closed').length;
            const revenue = allLeads
              .filter(l => l.status === 'closed')
              .reduce((sum, l) => sum + (Number(l.excess_funds_amount) * 0.10 || 0), 0);
            const avgScore = allLeads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / (total || 1);
            
            const today = new Date().toISOString().split('T')[0];
            const leadsToday = allLeads.filter(l => 
              l.created_at?.startsWith(today)
            ).length;

            setMetrics({
              total_leads: total,
              active_deals: activeDeals,
              conversion_rate: total > 0 ? (closedDeals / total) * 100 : 0,
              total_revenue: revenue,
              avg_eleanor_score: avgScore,
              leads_today: leadsToday,
              calls_pending: allLeads.filter(l => l.status === 'new' || l.status === 'pending_call').length,
            });
          }
        } else if (metricsData) {
          setMetrics(metricsData);
        }

        // Set golden opportunities
        if (goldenData) {
          setGoldenOpportunities(goldenData);
        }

        // Set call queue
        if (callData) {
          setCallQueue(callData);
        }

        // Transform recent leads into activity feed
        if (recentLeads) {
          const activities: RecentActivity[] = recentLeads.map((lead, index) => ({
            id: lead.id || String(index),
            type: lead.status === 'new' ? 'new_lead' : lead.status === 'closed' ? 'deal_closed' : 'update',
            message: getActivityMessage(lead),
            timestamp: getRelativeTime(lead.created_at),
          }));
          setRecentActivity(activities);
        }

        setLoading(false);
      } catch (err) {
        console.error('Dashboard fetch error:', err);
        setError('Failed to load dashboard data');
        setLoading(false);
      }
    }

    fetchDashboardData();

    // Set up real-time subscription
    const channel = supabase
      .channel('dashboard-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => {
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper functions
  function getActivityMessage(lead: any): string {
    const address = lead.property_address || 'Unknown property';
    const owner = lead.owner_name || 'Unknown owner';
    
    switch (lead.status) {
      case 'new':
        return `New lead: ${address}`;
      case 'contacted':
        return `Contacted ${owner} about ${address}`;
      case 'negotiating':
        return `Negotiating deal for ${address}`;
      case 'contract_sent':
        return `Contract sent for ${address}`;
      case 'closed':
        return `Deal closed: ${address}`;
      default:
        return `Lead updated: ${address}`;
    }
  }

  function getRelativeTime(dateString: string | null): string {
    if (!dateString) return 'Unknown';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getGradeColor(grade: string): string {
    switch (grade?.toUpperCase()) {
      case 'A': return 'text-green-400 bg-green-400/20';
      case 'B': return 'text-blue-400 bg-blue-400/20';
      case 'C': return 'text-yellow-400 bg-yellow-400/20';
      case 'D': return 'text-orange-400 bg-orange-400/20';
      default: return 'text-zinc-400 bg-zinc-400/20';
    }
  }

  function getPriorityColor(priority: string): string {
    switch (priority?.toLowerCase()) {
      case 'hot': return 'text-red-400 bg-red-400/20';
      case 'warm': return 'text-orange-400 bg-orange-400/20';
      case 'cold': return 'text-blue-400 bg-blue-400/20';
      default: return 'text-zinc-400 bg-zinc-400/20';
    }
  }

  // Loading state
  if (loading) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-cyan-500 mx-auto mb-4"></div>
          <p className="text-cyan-400 text-xl">Loading MaxSam V4...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] p-8 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-red-400 text-xl">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="mt-4 px-6 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition"
          >
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a] p-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            MaxSam V4 Command Center
          </h1>
          <p className="text-zinc-500 mt-1">Dallas County Excess Funds • Live Data</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></span>
          <span className="text-green-400 text-sm">Connected to Supabase</span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-lg p-6 shadow-lg shadow-cyan-500/20">
          <div className="text-white/80 text-sm font-medium mb-2">Total Leads</div>
          <div className="text-white text-3xl font-bold">{metrics.total_leads.toLocaleString()}</div>
          <div className="text-white/60 text-xs mt-2">+{metrics.leads_today} today</div>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-6 shadow-lg shadow-green-500/20">
          <div className="text-white/80 text-sm font-medium mb-2">Active Deals</div>
          <div className="text-white text-3xl font-bold">{metrics.active_deals}</div>
          <div className="text-white/60 text-xs mt-2">{metrics.calls_pending} pending calls</div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-6 shadow-lg shadow-purple-500/20">
          <div className="text-white/80 text-sm font-medium mb-2">Avg Eleanor Score</div>
          <div className="text-white text-3xl font-bold">{metrics.avg_eleanor_score.toFixed(1)}</div>
          <div className="text-white/60 text-xs mt-2">Out of 100</div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-6 shadow-lg shadow-blue-500/20">
          <div className="text-white/80 text-sm font-medium mb-2">Projected Revenue</div>
          <div className="text-white text-3xl font-bold">{formatCurrency(metrics.total_revenue)}</div>
          <div className="text-white/60 text-xs mt-2">10% finder fee model</div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Golden Opportunities */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-yellow-400">⭐</span> Golden Opportunities
          </h2>
          <div className="bg-zinc-900 rounded-lg overflow-hidden">
            {goldenOpportunities.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No golden opportunities yet. Run Eleanor scoring to populate.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {goldenOpportunities.slice(0, 5).map((opp) => (
                  <div key={opp.id} className="p-4 hover:bg-zinc-800/50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-medium">{opp.property_address}</div>
                        <div className="text-zinc-500 text-sm">{opp.owner_name}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getGradeColor(opp.deal_grade)}`}>
                          {opp.deal_grade || 'N/A'}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(opp.contact_priority)}`}>
                          {opp.contact_priority || 'N/A'}
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-cyan-400 font-bold">
                        {formatCurrency(opp.excess_funds_amount || 0)}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-zinc-700 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-cyan-500 to-purple-500 h-2 rounded-full" 
                            style={{ width: `${Math.min(opp.eleanor_score || 0, 100)}%` }}
                          ></div>
                        </div>
                        <span className="text-zinc-400 text-sm w-8">{opp.eleanor_score || 0}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Call Queue */}
        <div>
          <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-green-400">📞</span> Call Queue (Sam)
          </h2>
          <div className="bg-zinc-900 rounded-lg overflow-hidden">
            {callQueue.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">
                No calls in queue. Process leads to populate.
              </div>
            ) : (
              <div className="divide-y divide-zinc-800">
                {callQueue.slice(0, 5).map((call) => (
                  <div key={call.id} className="p-4 hover:bg-zinc-800/50 transition">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="text-white font-medium">{call.owner_name}</div>
                        <div className="text-zinc-500 text-sm">{call.property_address}</div>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-bold ${getPriorityColor(call.contact_priority)}`}>
                        {call.contact_priority || 'Normal'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-zinc-400 text-sm">
                        {call.phone_1 || 'No phone'}
                      </div>
                      <div className="text-zinc-500 text-xs">
                        {call.call_attempts || 0} attempts
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Agents Section */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">AI Agents</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">🎙️ Sam (Voice AI)</span>
              <span className="text-cyan-400">{callQueue.length} in queue</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-cyan-500 h-2 rounded-full animate-pulse" style={{ width: '94%' }}></div>
            </div>
            <p className="text-zinc-500 text-xs mt-2">Twilio verification pending</p>
          </div>
          
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">🧠 Eleanor (Lead Scoring)</span>
              <span className="text-purple-400">{metrics.total_leads} scored</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-purple-500 h-2 rounded-full" style={{ width: `${Math.min((metrics.avg_eleanor_score / 100) * 100, 100)}%` }}></div>
            </div>
            <p className="text-zinc-500 text-xs mt-2">Avg score: {metrics.avg_eleanor_score.toFixed(1)}/100</p>
          </div>
          
          <div className="bg-zinc-900 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-white font-medium">⚡ Alex (Workflow)</span>
              <span className="text-blue-400">N8N Active</span>
            </div>
            <div className="w-full bg-zinc-700 rounded-full h-2">
              <div className="bg-blue-500 h-2 rounded-full" style={{ width: '91%' }}></div>
            </div>
            <p className="text-zinc-500 text-xs mt-2">Master pipeline ready</p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div>
        <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
        <div className="bg-zinc-900 rounded-lg divide-y divide-zinc-800">
          {recentActivity.length === 0 ? (
            <div className="p-8 text-center text-zinc-500">
              No recent activity. Import leads to see updates here.
            </div>
          ) : (
            recentActivity.slice(0, 8).map((activity) => (
              <div key={activity.id} className="flex justify-between p-4 hover:bg-zinc-800/50 transition">
                <span className="text-zinc-300">{activity.message}</span>
                <span className="text-zinc-500 text-sm">{activity.timestamp}</span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-zinc-600 text-sm">
        MaxSam V4 • Dallas County Excess Funds • 10% Finder Fee Model
      </div>
    </main>
  );
}
