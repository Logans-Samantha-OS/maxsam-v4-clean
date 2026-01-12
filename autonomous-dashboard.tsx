// app/dashboard/page.tsx
"use client";

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import UploadAndBlast from '@/components/UploadAndBlast';
import { 
  DollarSign, 
  Users, 
  Zap, 
  TrendingUp, 
  Phone,
  MessageSquare,
  CheckCircle,
  Clock
} from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    goldenLeads: 0,
    totalPipeline: 0,
    potentialRevenue: 0,
    activeConversations: 0,
    hotLeads: 0,
    contractsPending: 0,
    revenueToday: 0,
    avgEleanorScore: 0,
    topLeads: [] as any[],
  });

  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
    loadRecentActivity();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadStats();
      loadRecentActivity();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const loadStats = async () => {
    try {
      // Get all leads
      const { data: leads } = await supabase
        .from('maxsam_leads')
        .select('*');

      // Get SMS conversations
      const { data: conversations } = await supabase
        .from('maxsam_sms_logs')
        .select('lead_id')
        .eq('direction', 'inbound')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      // Get contracts
      const { data: contracts } = await supabase
        .from('contracts')
        .select('*');

      const totalPipeline = leads?.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0) || 0;
      const goldenLeads = leads?.filter(l => l.is_golden) || [];
      const hotLeads = leads?.filter(l => l.eleanor_score >= 80) || [];
      
      const avgScore = leads?.length 
        ? Math.round(leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / leads.length)
        : 0;

      const topLeads = (leads || [])
        .sort((a, b) => (b.eleanor_score || 0) - (a.eleanor_score || 0))
        .slice(0, 5);

      const paidContracts = contracts?.filter(c => c.status === 'paid') || [];
      const revenueToday = paidContracts
        .filter(c => new Date(c.created_at).toDateString() === new Date().toDateString())
        .reduce((sum, c) => sum + (c.total_fee || 0), 0);

      setStats({
        totalLeads: leads?.length || 0,
        goldenLeads: goldenLeads.length,
        totalPipeline,
        potentialRevenue: totalPipeline * 0.25,
        activeConversations: new Set(conversations?.map(c => c.lead_id)).size,
        hotLeads: hotLeads.length,
        contractsPending: contracts?.filter(c => c.status === 'draft').length || 0,
        revenueToday,
        avgEleanorScore: avgScore,
        topLeads,
      });

      setLoading(false);
    } catch (error) {
      console.error('Stats error:', error);
      setLoading(false);
    }
  };

  const loadRecentActivity = async () => {
    try {
      const { data: smsLogs } = await supabase
        .from('maxsam_sms_logs')
        .select('*, maxsam_leads(owner_name)')
        .order('created_at', { ascending: false })
        .limit(5);

      const activity = (smsLogs || []).map(log => ({
        type: log.direction === 'inbound' ? 'reply' : 'sent',
        text: log.direction === 'inbound' 
          ? `${log.maxsam_leads?.owner_name || 'Lead'} replied: "${log.body?.substring(0, 50)}..."`
          : `Sam texted ${log.maxsam_leads?.owner_name || 'lead'}`,
        time: new Date(log.created_at).toLocaleTimeString(),
      }));

      setRecentActivity(activity);
    } catch (error) {
      console.error('Activity error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">
            MaxSam V4 Command Center
          </h1>
          <p className="text-purple-300 text-xl">
            Autonomous Revenue Generation System
          </p>
        </div>

        {/* Upload & Blast */}
        <UploadAndBlast />

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          
          {/* Total Pipeline */}
          <div className="bg-gradient-to-br from-green-600 to-emerald-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <DollarSign className="w-8 h-8 text-white" />
              <TrendingUp className="w-6 h-6 text-green-200" />
            </div>
            <div className="text-white text-3xl font-bold">
              ${(stats.totalPipeline).toLocaleString()}
            </div>
            <div className="text-green-100 text-sm">Total Pipeline</div>
            <div className="text-green-200 text-xs mt-2">
              ${(stats.potentialRevenue).toLocaleString()} potential revenue (25%)
            </div>
          </div>

          {/* Golden Leads */}
          <div className="bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <Zap className="w-8 h-8 text-white" />
              <span className="text-2xl">🏆</span>
            </div>
            <div className="text-white text-3xl font-bold">
              {stats.goldenLeads}
            </div>
            <div className="text-orange-100 text-sm">Golden Leads</div>
            <div className="text-orange-200 text-xs mt-2">
              {stats.totalLeads} total leads
            </div>
          </div>

          {/* Active Conversations */}
          <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <MessageSquare className="w-8 h-8 text-white" />
              <Users className="w-6 h-6 text-blue-200" />
            </div>
            <div className="text-white text-3xl font-bold">
              {stats.activeConversations}
            </div>
            <div className="text-blue-100 text-sm">Active Conversations</div>
            <div className="text-blue-200 text-xs mt-2">
              Last 24 hours
            </div>
          </div>

          {/* Hot Leads */}
          <div className="bg-gradient-to-br from-red-600 to-pink-700 rounded-xl p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-2">
              <Phone className="w-8 h-8 text-white" />
              <span className="text-2xl">🔥</span>
            </div>
            <div className="text-white text-3xl font-bold">
              {stats.hotLeads}
            </div>
            <div className="text-red-100 text-sm">Hot Leads (80+ Score)</div>
            <div className="text-red-200 text-xs mt-2">
              Ready to call NOW
            </div>
          </div>

        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          <div className="bg-purple-900/50 rounded-xl p-4 border border-purple-600">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-400" />
              <div>
                <div className="text-white text-2xl font-bold">
                  ${stats.revenueToday.toLocaleString()}
                </div>
                <div className="text-purple-300 text-sm">Revenue Today</div>
              </div>
            </div>
          </div>

          <div className="bg-purple-900/50 rounded-xl p-4 border border-purple-600">
            <div className="flex items-center gap-3">
              <Clock className="w-6 h-6 text-yellow-400" />
              <div>
                <div className="text-white text-2xl font-bold">
                  {stats.contractsPending}
                </div>
                <div className="text-purple-300 text-sm">Contracts Pending</div>
              </div>
            </div>
          </div>

          <div className="bg-purple-900/50 rounded-xl p-4 border border-purple-600">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6 text-blue-400" />
              <div>
                <div className="text-white text-2xl font-bold">
                  {stats.avgEleanorScore}/100
                </div>
                <div className="text-purple-300 text-sm">Avg Eleanor Score</div>
              </div>
            </div>
          </div>

        </div>

        {/* Recent Activity */}
        <div className="bg-purple-900/30 rounded-xl p-6 border border-purple-600">
          <h3 className="text-white text-xl font-bold mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center gap-3 text-purple-200">
                  <span className="text-2xl">
                    {activity.type === 'reply' ? '💬' : '📤'}
                  </span>
                  <div className="flex-1">
                    <span>{activity.text}</span>
                  </div>
                  <span className="text-purple-400 text-sm">{activity.time}</span>
                </div>
              ))
            ) : (
              <div className="text-purple-400 text-center py-4">
                No recent activity. Upload leads to get started!
              </div>
            )}
          </div>
        </div>

        {/* Top Leads */}
        <div className="bg-purple-900/30 rounded-xl p-6 border border-purple-600">
          <h3 className="text-white text-xl font-bold mb-4">Top 5 Leads by Score</h3>
          <div className="space-y-2">
            {stats.topLeads.map((lead, idx) => (
              <div key={idx} className="flex items-center justify-between bg-purple-800/50 p-3 rounded">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{idx + 1}</span>
                  <div>
                    <div className="text-white font-bold">{lead.owner_name}</div>
                    <div className="text-purple-300 text-sm">
                      ${(lead.excess_funds_amount || 0).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-yellow-400 font-bold">{lead.eleanor_score}/100</div>
                  <div className="text-purple-300 text-sm">{lead.eleanor_grade}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
