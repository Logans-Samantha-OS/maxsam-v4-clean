"use client";

import { useEffect, useMemo, useState } from 'react';
import AppShell from '@/components/AppShell';
import EleanorAccuracyTracker from '@/components/EleanorAccuracyTracker';
import EleanorInsights from '@/components/EleanorInsights';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { supabase } from '@/lib/supabase';

const REVENUE_COLORS = ['#22c55e', '#38bdf8', '#a855f7'];
const DEAL_TYPE_COLORS = {
  excess_only: '#22c55e',
  wholesale: '#38bdf8',
  dual: '#facc15',
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('90d');
  const [contracts, setContracts] = useState([]);
  const [leads, setLeads] = useState([]);
  const [calls, setCalls] = useState([]);

  useEffect(() => {
    async function fetchAll() {
      try {
        setLoading(true);
        const [{ data: contractsData }, { data: leadsData }, { data: callsData }] =
          await Promise.all([
            supabase.from('contracts').select('*'),
            supabase.from('maxsam_leads').select('*'),
            supabase.from('sam_calls').select('*'),
          ]);

        setContracts(contractsData || []);
        setLeads(leadsData || []);
        setCalls(callsData || []);
      } catch (err) {
        console.error('Analytics fetch error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchAll();

    const contractsChannel = supabase
      .channel('contracts-analytics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts' },
        () => fetchAll(),
      )
      .subscribe();

    const leadsChannel = supabase
      .channel('leads-analytics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'maxsam_leads' },
        () => fetchAll(),
      )
      .subscribe();

    const callsChannel = supabase
      .channel('calls-analytics')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sam_calls' },
        () => fetchAll(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(contractsChannel);
      supabase.removeChannel(leadsChannel);
      supabase.removeChannel(callsChannel);
    };
  }, [range]);

  const fmtMoney = (n) =>
    typeof n === 'number' ? `$${n.toLocaleString()}` : '$0';
  const fmtPct = (n) =>
    Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '0.0%';

  const inRange = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    if (range === '30d') return diffDays <= 30;
    if (range === '90d') return diffDays <= 90;
    if (range === '365d') return diffDays <= 365;
    return true;
  };

  const rangedContracts = useMemo(
    () => contracts.filter((c) => inRange(c.created_at)),
    [contracts, range],
  );
  const rangedLeads = useMemo(
    () => leads.filter((l) => inRange(l.created_at)),
    [leads, range],
  );
  const rangedCalls = useMemo(
    () => calls.filter((c) => inRange(c.created_at)),
    [calls, range],
  );

  const closedContracts = rangedContracts.filter((c) => c.status === 'closed');

  const totalRevenue = closedContracts.reduce(
    (s, c) => s + (c.total_fee || 0),
    0,
  );
  const projectedRevenue = rangedContracts
    .filter((c) => c.status !== 'closed')
    .reduce((s, c) => s + (c.total_fee || 0), 0);

  const revenueByDealType = ['excess_only', 'wholesale', 'dual'].map((type) => ({
    type,
    label:
      type === 'excess_only'
        ? 'Excess Only'
        : type === 'wholesale'
        ? 'Wholesale'
        : 'DUAL',
    value: closedContracts
      .filter((c) => c.deal_type === type)
      .reduce((s, c) => s + (c.total_fee || 0), 0),
  }));

  const avgFeePerDeal =
    closedContracts.length > 0 ? totalRevenue / closedContracts.length : 0;

  const loganCut = closedContracts.reduce(
    (s, c) => s + (c.logan_cut || 0),
    0,
  );
  const maxCut = closedContracts.reduce((s, c) => s + (c.max_cut || 0), 0);

  const monthlyRevenue = useMemo(() => {
    const map = {};
    closedContracts.forEach((c) => {
      if (!c.closed_date) return;
      const d = new Date(c.closed_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0',
      )}`;
      map[key] = (map[key] || 0) + (c.total_fee || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([month, revenue]) => ({ month, revenue }));
  }, [closedContracts]);

  const stageCounts = {
    new: rangedLeads.filter((l) => !l.status || l.status === 'new').length,
    contacted: rangedLeads.filter((l) => l.status === 'contacted').length,
    negotiating: rangedLeads.filter((l) => l.status === 'negotiating').length,
    contract: rangedLeads.filter((l) => l.status === 'contract_sent').length,
    closed: rangedLeads.filter((l) => l.status === 'closed').length,
  };

  const totalFunnel = stageCounts.new || 1;
  const funnelData = [
    { stage: 'New', count: stageCounts.new },
    { stage: 'Contacted', count: stageCounts.contacted },
    { stage: 'Negotiating', count: stageCounts.negotiating },
    { stage: 'Contract', count: stageCounts.contract },
    { stage: 'Closed', count: stageCounts.closed },
  ].map((s, i, arr) => ({
    ...s,
    convFromPrev:
      i === 0 || arr[i - 1].count === 0
        ? 1
        : s.count / (arr[i - 1].count || 1),
    convFromNew: s.count / totalFunnel,
  }));

  const hotLeads = rangedLeads.filter((l) => (l.eleanor_score || 0) >= 70);
  const hotValue = hotLeads.reduce(
    (s, l) => s + (Number(l.excess_funds_amount) || 0),
    0,
  );

  const scoreBuckets = [0, 20, 40, 60, 80, 100].map((start, idx, arr) => {
    const end = idx === arr.length - 1 ? 100 : arr[idx + 1];
    const label = `${start}-${end}`;
    const leadsInBucket = rangedLeads.filter((l) => {
      const score = l.eleanor_score || 0;
      return score >= start && score < end;
    });
    const closedInBucket = leadsInBucket.filter(
      (l) => l.status === 'closed',
    ).length;
    return {
      bucket: label,
      count: leadsInBucket.length,
      closeRate:
        leadsInBucket.length > 0
          ? closedInBucket / leadsInBucket.length
          : 0,
    };
  });

  const leadSourceMap = {};
  rangedLeads.forEach((l) => {
    const src = l.lead_source || 'Unknown';
    if (!leadSourceMap[src]) {
      leadSourceMap[src] = { source: src, leads: 0, closed: 0 };
    }
    leadSourceMap[src].leads += 1;
    if (l.status === 'closed') leadSourceMap[src].closed += 1;
  });
  const leadSourceData = Object.values(leadSourceMap).map((s) => ({
    ...s,
    closeRate: s.leads > 0 ? s.closed / s.leads : 0,
  }));

  const totalCalls = rangedCalls.length;
  const connectedCalls = rangedCalls.filter((c) => c.connected).length;
  const interestedCalls = rangedCalls.filter((c) => c.interested).length;
  const connectionRate =
    totalCalls > 0 ? connectedCalls / totalCalls : 0;
  const interestRate =
    totalCalls > 0 ? interestedCalls / totalCalls : 0;

  const hourMap = {};
  rangedCalls.forEach((c) => {
    if (!c.created_at) return;
    const d = new Date(c.created_at);
    const h = d.getHours();
    const key = `${h}`;
    if (!hourMap[key]) {
      hourMap[key] = { hour: `${h}:00`, calls: 0, interested: 0 };
    }
    hourMap[key].calls += 1;
    if (c.interested) hourMap[key].interested += 1;
  });
  const bestTimeData = Object.values(hourMap)
    .map((h) => ({
      ...h,
      interestRate: h.calls > 0 ? h.interested / h.calls : 0,
    }))
    .sort((a, b) => b.interestRate - a.interestRate);

  const velocityContracts = closedContracts.filter(
    (c) => c.created_at && c.closed_date,
  );
  const daysToCloseArr = velocityContracts.map((c) => {
    const created = new Date(c.created_at);
    const closed = new Date(c.closed_date);
    return (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
  });

  const avg = (a) =>
    a.length > 0 ? a.reduce((s, d) => s + d, 0) / a.length : 0;

  const avgDaysToClose = avg(daysToCloseArr);
  const fastest = daysToCloseArr.length > 0 ? Math.min(...daysToCloseArr) : 0;
  const slowest = daysToCloseArr.length > 0 ? Math.max(...daysToCloseArr) : 0;

  const geoMap = {};
  closedContracts.forEach((c) => {
    const area = c.neighborhood || c.city || 'Unknown';
    if (!geoMap[area]) {
      geoMap[area] = { area, deals: 0, revenue: 0 };
    }
    geoMap[area].deals += 1;
    geoMap[area].revenue += c.total_fee || 0;
  });
  const geoData = Object.values(geoMap).sort(
    (a, b) => b.revenue - a.revenue,
  );

  const topDeals = [...closedContracts]
    .sort((a, b) => (b.total_fee || 0) - (a.total_fee || 0))
    .slice(0, 5);

  const bestLeads = [...hotLeads]
    .sort((a, b) => (b.eleanor_score || 0) - (a.eleanor_score || 0))
    .slice(0, 5);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Analytics Command Center</h1>
            <p className="text-xs text-zinc-500">
              ✅ Revenue, funnel, Eleanor, and Sam performance at a glance
            </p>
          </div>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="365d">Last 12 months</option>
            <option value="all">All time</option>
          </select>
        </div>

        <main className="space-y-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500" />
          </div>
        ) : (
          <>
            {/* Eleanor AI Accuracy Tracker */}
            <EleanorAccuracyTracker />
            <div className="mt-4">
              <EleanorInsights />
            </div>

            {/* REVENUE INTELLIGENCE TOP ROW */}
            <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">
                  Total Revenue (Closed)
                </div>
                <div className="text-2xl font-bold text-green-400">
                  {fmtMoney(totalRevenue)}
                </div>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4">
                <div className="text-xs text-yellow-300 mb-1">
                  ⚠ Projected Revenue (Pipeline)
                </div>
                <div className="text-2xl font-bold text-yellow-400">
                  {fmtMoney(projectedRevenue)}
                </div>
              </div>
              <div className="bg-cyan-500/10 border border-cyan-500/40 rounded-xl p-4">
                <div className="text-xs text-cyan-300 mb-1">
                  Logan vs Max Split
                </div>
                <div className="text-sm text-zinc-300">
                  Logan:{' '}
                  <span className="text-cyan-400 mr-2">
                    {fmtMoney(loganCut)}
                  </span>
                  Max:{' '}
                  <span className="text-purple-400">{fmtMoney(maxCut)}</span>
                </div>
              </div>
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <div className="text-xs text-zinc-400 mb-1">Avg Fee Per Deal</div>
                <div className="text-2xl font-bold text-white">
                  {fmtMoney(avgFeePerDeal)}
                </div>
              </div>
            </section>

            {/* REVENUE CHARTS */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 lg:col-span-2 h-72">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Monthly Revenue Trend
                </h2>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyRevenue}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="month" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                      }}
                      labelStyle={{ color: '#e4e4e7' }}
                    />
                    <Bar dataKey="revenue" fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 h-72">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Revenue by Deal Type
                </h2>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueByDealType}
                      dataKey="value"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label
                    >
                      {revenueByDealType.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={
                            DEAL_TYPE_COLORS[entry.type] ||
                            REVENUE_COLORS[index % REVENUE_COLORS.length]
                          }
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                      }}
                      labelStyle={{ color: '#e4e4e7' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* CONVERSION FUNNEL + ELEANOR */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Conversion Funnel
                </h2>
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  {funnelData.map((s, i) => (
                    <div key={s.stage} className="flex-1">
                      <div className="bg-gradient-to-t from-zinc-900 to-zinc-800 rounded-lg p-3 text-center">
                        <div className="text-zinc-400 text-xs mb-1">
                          {s.stage}
                        </div>
                        <div className="text-white text-xl font-bold">
                          {s.count}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-1">
                          {fmtPct(s.convFromPrev)} from prev •{' '}
                          {fmtPct(s.convFromNew)} from New
                        </div>
                      </div>
                      {i < funnelData.length - 1 && (
                        <div className="text-center text-zinc-600 mt-1">
                          ↓
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Eleanor Score Distribution &amp; Close Rate
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={scoreBuckets}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="bucket" stroke="#a1a1aa" />
                    <YAxis yAxisId="left" stroke="#a1a1aa" />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      stroke="#a1a1aa"
                      tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                      }}
                      labelStyle={{ color: '#e4e4e7' }}
                    />
                    <Bar
                      yAxisId="left"
                      dataKey="count"
                      fill="#38bdf8"
                      name="Leads"
                    />
                    <Bar
                      yAxisId="right"
                      dataKey="closeRate"
                      fill="#a855f7"
                      name="Close Rate"
                    />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-2 text-xs text-zinc-400">
                  🔥 Hot leads (70+):{' '}
                  <span className="text-red-400">
                    {hotLeads.length} leads
                  </span>{' '}
                  • Value:{' '}
                  <span className="text-green-400">
                    {fmtMoney(hotValue)}
                  </span>
                </div>
              </div>
            </section>

            {/* SAM AI, VELOCITY, LEAD SOURCE */}
            <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Sam AI Call Metrics
                </h2>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div>
                    Total calls:{' '}
                    <span className="text-zinc-100">{totalCalls}</span>
                  </div>
                  <div>
                    Connection rate:{' '}
                    <span className="text-cyan-400">
                      {fmtPct(connectionRate)}
                    </span>
                  </div>
                  <div>
                    Interest rate:{' '}
                    <span className="text-green-400">
                      {fmtPct(interestRate)}
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-xs text-zinc-400">
                  Best call windows (by interest rate):
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {bestTimeData.slice(0, 4).map((h) => (
                    <span
                      key={h.hour}
                      className="px-2 py-1 rounded-full bg-zinc-800 text-[10px] text-zinc-200"
                    >
                      {h.hour} • {fmtPct(h.interestRate)}
                    </span>
                  ))}
                  {bestTimeData.length === 0 && (
                    <span className="text-xs text-zinc-500">
                      Not enough call data yet.
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Deal Velocity
                </h2>
                <div className="space-y-1 text-xs text-zinc-400">
                  <div>
                    Avg days to close:{' '}
                    <span className="text-purple-400">
                      {avgDaysToClose.toFixed(1)}
                    </span>
                  </div>
                  <div>
                    Fastest deal:{' '}
                    <span className="text-green-400">
                      {fastest.toFixed(1)} days
                    </span>
                  </div>
                  <div>
                    Slowest deal:{' '}
                    <span className="text-yellow-400">
                      {slowest.toFixed(1)} days
                    </span>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-zinc-500">
                  For deeper velocity, add timestamps for first_contact &amp;
                  contract_sent to compute each stage time.
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Lead Source Effectiveness
                </h2>
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={leadSourceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="source" stroke="#a1a1aa" />
                    <YAxis stroke="#a1a1aa" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#18181b',
                        borderColor: '#27272a',
                      }}
                      labelStyle={{ color: '#e4e4e7' }}
                    />
                    <Bar dataKey="leads" fill="#38bdf8" name="Leads" />
                    <Bar
                      dataKey={(d) => d.closeRate * 100}
                      fill="#22c55e"
                      name="Close %"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            {/* GEO + TOP PERFORMERS */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Dallas Geographic Insights
                </h2>
                <div className="space-y-1 text-xs text-zinc-400 max-h-64 overflow-auto">
                  {geoData.length === 0 && (
                    <div className="text-zinc-500">No closed deals yet.</div>
                  )}
                  {geoData.map((g) => (
                    <div
                      key={g.area}
                      className="flex justify-between items-center py-1 border-b border-zinc-800/40 last:border-b-0"
                    >
                      <div>
                        <div className="text-zinc-100">{g.area}</div>
                        <div className="text-[11px] text-zinc-500">
                          Deals:{' '}
                          <span className="text-cyan-400">{g.deals}</span>
                        </div>
                      </div>
                      <div className="text-green-400 text-sm">
                        {fmtMoney(g.revenue)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
                <h2 className="text-sm font-semibold text-white mb-2">
                  Top Performing Deals &amp; Leads
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  <div>
                    <div className="text-zinc-400 mb-1">
                      Highest Value Deals
                    </div>
                    <div className="space-y-1">
                      {topDeals.length === 0 && (
                        <div className="text-zinc-500">No closed deals.</div>
                      )}
                      {topDeals.map((d) => (
                        <div
                          key={d.id}
                          className="flex justify-between items-center py-1 border-b border-zinc-800/40 last:border-b-0"
                        >
                          <div className="text-zinc-100 text-[11px]">
                            {d.property_address || 'Unknown property'}
                          </div>
                          <div className="text-green-400">
                            {fmtMoney(d.total_fee || 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-400 mb-1">
                      Best Eleanor-Scored Leads
                    </div>
                    <div className="space-y-1">
                      {bestLeads.length === 0 && (
                        <div className="text-zinc-500">
                          No high-score leads yet.
                        </div>
                      )}
                      {bestLeads.map((l) => (
                        <div
                          key={l.id}
                          className="flex justify-between items-center py-1 border-b border-zinc-800/40 last:border-b-0"
                        >
                          <div>
                            <div className="text-zinc-100 text-[11px]">
                              {l.owner_name || 'Unknown owner'}
                            </div>
                            <div className="text-[10px] text-zinc-500">
                              {l.property_address || 'Unknown property'}
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-cyan-400 text-xs">
                              {l.eleanor_score || 0}
                            </span>
                            <span className="text-[10px] text-zinc-500">
                              {fmtMoney(l.excess_funds_amount || 0)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
        </main>
      </div>
    </AppShell>
  );
}
