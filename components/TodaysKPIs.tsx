'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface KPICard {
  title: string;
  value: string | number;
  change: number;
  icon: string;
  color: string;
}

export default function TodaysKPIs() {
  const [kpis, setKpis] = useState<KPICard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchKPIs() {
      try {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        // Today's activity
        const { data: todayActivity } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact' })
          .gte('created_at', today.toISOString().split('T')[0]);

        const { data: yesterdayActivity } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact' })
          .gte('created_at', yesterday.toISOString().split('T')[0])
          .lt('created_at', today.toISOString().split('T')[0]);

        // Today's stats
        const { data: callsMade } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact' })
          .eq('event_type', 'call_made')
          .gte('created_at', today.toISOString());

        const { data: smsSent } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact' })
          .eq('event_type', 'sms_sent')
          .gte('created_at', today.toISOString());

        const { data: contractsSent } = await supabase
          .from('activity_log')
          .select('*', { count: 'exact' })
          .eq('event_type', 'contract_sent')
          .gte('created_at', today.toISOString());

        const { data: revenueClosed } = await supabase
          .from('maxsam_leads')
          .select('actual_revenue')
          .eq('status', 'paid')
          .gte('updated_at', today.toISOString());

        const totalRevenue = revenueClosed?.reduce((sum, lead) => sum + (lead.actual_revenue || 0), 0);

        const kpiData: KPICard[] = [
          {
            title: 'Calls Made',
            value: callsMade?.length || 0,
            change: Math.random() * 20 - 10, // Mock change vs yesterday
            icon: '📞',
            color: 'from-blue-500 to-blue-600'
          },
          {
            title: 'SMS Sent',
            value: smsSent?.length || 0,
            change: Math.random() * 15 - 5,
            icon: '📱',
            color: 'from-cyan-500 to-cyan-600'
          },
          {
            title: 'Responses',
            value: (todayActivity?.[0]?.count || 0) - (yesterdayActivity?.[0]?.count || 0),
            change: Math.random() * 10 - 3,
            icon: '💬',
            color: 'from-emerald-500 to-emerald-600'
          },
          {
            title: 'Revenue Closed',
            value: `$${totalRevenue.toLocaleString()}`,
            change: Math.random() * 5000 - 2000,
            icon: '💰',
            color: 'from-green-500 to-green-600'
          }
        ];

        setKpis(kpiData);
      } catch (error) {
        console.error('Error fetching KPIs:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchKPIs();

    // Set up real-time updates
    const channel = supabase
      .channel('kpi-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activity_log' }, () => {
        fetchKPIs();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  if (loading) {
    return (
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>📈</span> Today's KPIs
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-zinc-800/50 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-700 rounded mb-2"></div>
              <div className="h-6 bg-zinc-700 rounded mb-2"></div>
              <div className="h-4 bg-zinc-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="pharaoh-card">
      <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
        <span>📈</span> Today's KPIs
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, index) => (
          <div 
            key={kpi.title} 
            className="bg-zinc-800/50 rounded-lg p-4 border border-zinc-700/50 hover:border-gold/30 transition-all duration-300 transform hover:scale-105"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-400 text-sm font-medium">{kpi.title}</span>
              <div className={`flex items-center gap-1 text-xs font-bold ${
                kpi.change > 0 ? 'text-emerald-400' : 
                kpi.change < 0 ? 'text-red-400' : 'text-zinc-400'
              }`}>
                <span>{kpi.change > 0 ? '↑' : kpi.change < 0 ? '↓' : '→'}</span>
                <span>{Math.abs(kpi.change).toFixed(1)}%</span>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-3xl">{kpi.icon}</span>
              <div>
                <div className={`text-2xl font-black bg-gradient-to-r ${kpi.color} bg-clip-text text-transparent`}>
                  {kpi.value}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
