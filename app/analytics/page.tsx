'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';

interface AnalyticsData {
  totalLeads: number;
  totalRevenue: number;
  avgEleanorScore: number;
  conversionRate: number;
  leadsByGrade: Record<string, number>;
  leadsByStatus: Record<string, number>;
  revenueByMonth: { month: string; revenue: number }[];
  topZipCodes: { zip: string; count: number; value: number }[];
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalLeads: 0,
    totalRevenue: 0,
    avgEleanorScore: 0,
    conversionRate: 0,
    leadsByGrade: {},
    leadsByStatus: {},
    revenueByMonth: [],
    topZipCodes: [],
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);

      const { data: leads, error } = await supabase
        .from('maxsam_leads')
        .select('*');

      if (error) {
        console.error('Error:', error);
        return;
      }

      if (!leads || leads.length === 0) {
        setLoading(false);
        return;
      }

      // Calculate analytics
      const totalLeads = leads.length;
      const totalPipelineValue = leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0);
      const totalRevenue = totalPipelineValue * 0.25; // 25% excess fee
      const avgScore = leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / totalLeads;

      const closedLeads = leads.filter(l => l.status === 'closed').length;
      const conversionRate = totalLeads > 0 ? (closedLeads / totalLeads) * 100 : 0;

      // Group by grade
      const leadsByGrade: Record<string, number> = {};
      leads.forEach(l => {
        const grade = l.deal_grade || 'Ungraded';
        leadsByGrade[grade] = (leadsByGrade[grade] || 0) + 1;
      });

      // Group by status
      const leadsByStatus: Record<string, number> = {};
      leads.forEach(l => {
        const status = l.status || 'new';
        leadsByStatus[status] = (leadsByStatus[status] || 0) + 1;
      });

      // Group by zip code
      const zipData: Record<string, { count: number; value: number }> = {};
      leads.forEach(l => {
        const zip = l.zip_code || 'Unknown';
        if (!zipData[zip]) zipData[zip] = { count: 0, value: 0 };
        zipData[zip].count++;
        zipData[zip].value += Number(l.excess_funds_amount) || 0;
      });
      const topZipCodes = Object.entries(zipData)
        .map(([zip, data]) => ({ zip, ...data }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      setAnalytics({
        totalLeads,
        totalRevenue,
        avgEleanorScore: avgScore,
        conversionRate,
        leadsByGrade,
        leadsByStatus,
        revenueByMonth: [],
        topZipCodes,
      });
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  }

  const gradeColors: Record<string, string> = {
    'A+': 'bg-emerald-500',
    'A': 'bg-green-500',
    'B': 'bg-blue-500',
    'C': 'bg-yellow-500',
    'D': 'bg-red-500',
    'Ungraded': 'bg-zinc-500',
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Analytics</h1>
          <p className="text-zinc-500 mt-1">Performance metrics and insights</p>
        </div>

        {/* Top Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{analytics.totalLeads}</div>
            <div className="text-zinc-400 text-sm mt-1">Total Leads</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-600/10 border border-green-500/30 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{formatCurrency(analytics.totalRevenue)}</div>
            <div className="text-zinc-400 text-sm mt-1">Projected Revenue</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-5">
            <div className="text-3xl font-bold text-purple-400">{analytics.avgEleanorScore.toFixed(0)}</div>
            <div className="text-zinc-400 text-sm mt-1">Avg Eleanor Score</div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{analytics.conversionRate.toFixed(1)}%</div>
            <div className="text-zinc-400 text-sm mt-1">Conversion Rate</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Lead Distribution by Grade */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Lead Distribution by Grade</h3>
            <div className="space-y-3">
              {Object.entries(analytics.leadsByGrade)
                .sort(([a], [b]) => {
                  const order = ['A+', 'A', 'B', 'C', 'D', 'Ungraded'];
                  return order.indexOf(a) - order.indexOf(b);
                })
                .map(([grade, count]) => {
                  const percentage = analytics.totalLeads > 0 ? (count / analytics.totalLeads) * 100 : 0;
                  return (
                    <div key={grade}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-zinc-300">Grade {grade}</span>
                        <span className="text-zinc-400">{count} ({percentage.toFixed(0)}%)</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-3">
                        <div
                          className={`${gradeColors[grade] || 'bg-zinc-500'} h-3 rounded-full transition-all`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              {Object.keys(analytics.leadsByGrade).length === 0 && (
                <div className="text-zinc-500 text-center py-8">No lead data available</div>
              )}
            </div>
          </div>

          {/* Lead Status Distribution */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Lead Status Distribution</h3>
            <div className="space-y-3">
              {Object.entries(analytics.leadsByStatus).map(([status, count]) => {
                const percentage = analytics.totalLeads > 0 ? (count / analytics.totalLeads) * 100 : 0;
                const statusColors: Record<string, string> = {
                  new: 'bg-blue-500',
                  contacted: 'bg-cyan-500',
                  negotiating: 'bg-yellow-500',
                  contract_sent: 'bg-purple-500',
                  closed: 'bg-green-500',
                };
                return (
                  <div key={status}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-zinc-300 capitalize">{status.replace('_', ' ')}</span>
                      <span className="text-zinc-400">{count} ({percentage.toFixed(0)}%)</span>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-3">
                      <div
                        className={`${statusColors[status] || 'bg-zinc-500'} h-3 rounded-full transition-all`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              {Object.keys(analytics.leadsByStatus).length === 0 && (
                <div className="text-zinc-500 text-center py-8">No lead data available</div>
              )}
            </div>
          </div>
        </div>

        {/* Top Zip Codes */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Top Performing Zip Codes</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-zinc-400 text-sm">
                  <th className="text-left py-2">Zip Code</th>
                  <th className="text-left py-2">Lead Count</th>
                  <th className="text-left py-2">Total Value</th>
                  <th className="text-left py-2">Projected Fee (25%)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {analytics.topZipCodes.map((zip) => (
                  <tr key={zip.zip} className="text-zinc-300">
                    <td className="py-3 font-medium">{zip.zip}</td>
                    <td className="py-3">{zip.count}</td>
                    <td className="py-3">{formatCurrency(zip.value)}</td>
                    <td className="py-3 text-green-400">{formatCurrency(zip.value * 0.25)}</td>
                  </tr>
                ))}
                {analytics.topZipCodes.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-zinc-500">No zip code data available</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-zinc-600 text-sm">
          100% Revenue to Logan Toups • 25% Excess Fee / 10% Wholesale Fee
        </div>
      </main>
    </div>
  );
}
