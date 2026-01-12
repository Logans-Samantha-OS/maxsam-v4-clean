'use client';

import { Lead, formatCurrency } from '@/lib/dashboard-utils';

interface AnalyticsOverviewProps {
    leads: Lead[];
}

export default function AnalyticsOverview({ leads }: AnalyticsOverviewProps) {
    const totalPipeline = leads.reduce((sum, l) => sum + (Number(l.excess_funds_amount) || 0), 0);
    const totalFees = totalPipeline * 0.25;

    const statusCounts = {
        new: leads.filter(l => l.status === 'new' || !l.status).length,
        contacted: leads.filter(l => l.status === 'contacted').length,
        responded: leads.filter(l => l.status === 'qualified').length, // 'qualified' = responded
        signed: leads.filter(l => l.status === 'contract_signed').length,
        closed: leads.filter(l => l.status === 'closed').length,
    };

    const scoreCounts = {
        critical: leads.filter(l => l.eleanor_score >= 90).length,
        high: leads.filter(l => l.eleanor_score >= 70 && l.eleanor_score < 90).length,
        medium: leads.filter(l => l.eleanor_score >= 50 && l.eleanor_score < 70).length,
        low: leads.filter(l => l.eleanor_score < 50).length,
    };

    const deadlineCounts = {
        days7: leads.filter(l => (l.days_until_expiration || 999) <= 7).length,
        days14: leads.filter(l => (l.days_until_expiration || 999) > 7 && (l.days_until_expiration || 999) <= 14).length,
        days30: leads.filter(l => (l.days_until_expiration || 999) > 14 && (l.days_until_expiration || 999) <= 30).length,
    };

    const MaxBar = Math.max(...Object.values(statusCounts));

    return (
        <div className="grid grid-cols-12 gap-6 mb-8">
            {/* Financials */}
            <div className="col-span-12 md:col-span-4 grid grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-gold/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-gold/20 transition-all"></div>
                    <div className="relative z-10">
                        <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Pipeline Value</h3>
                        <div className="text-3xl font-black text-white">{formatCurrency(totalPipeline)}</div>
                        <div className="text-xs text-green-400 mt-2 flex items-center gap-1">
                            <span>↑ 12%</span>
                            <span className="text-zinc-600">vs last week</span>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-cyan-500/20 transition-all"></div>
                    <div className="relative z-10">
                        <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-1">Potential Fees</h3>
                        <div className="text-3xl font-black text-cyan-400">{formatCurrency(totalFees)}</div>
                        <div className="text-xs text-zinc-500 mt-2">
                            Based on 25% avg. fee
                        </div>
                    </div>
                </div>

                {/* Deadline Summary */}
                <div className="col-span-2 bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex justify-between items-center">
                    <div className="text-center flex-1 border-r border-zinc-800">
                        <div className="text-red-500 font-black text-xl">{deadlineCounts.days7}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Exp 7 Days</div>
                    </div>
                    <div className="text-center flex-1 border-r border-zinc-800">
                        <div className="text-orange-400 font-black text-xl">{deadlineCounts.days14}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Exp 14 Days</div>
                    </div>
                    <div className="text-center flex-1">
                        <div className="text-yellow-400 font-black text-xl">{deadlineCounts.days30}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Exp 30 Days</div>
                    </div>
                </div>
            </div>

            {/* Status Breakdown - Visual Chart */}
            <div className="col-span-12 md:col-span-5 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-4">Pipeline Status</h3>
                <div className="space-y-3">
                    {Object.entries(statusCounts).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3">
                            <div className="w-24 text-xs text-zinc-400 capitalize text-right">{key.replace('_', ' ')}</div>
                            <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full ${key === 'new' ? 'bg-blue-500' :
                                            key === 'contacted' ? 'bg-cyan-500' :
                                                key === 'responded' ? 'bg-green-500' :
                                                    key === 'signed' ? 'bg-purple-500' :
                                                        'bg-gold'
                                        }`}
                                    style={{ width: `${(value / (MaxBar || 1)) * 100}%` }}
                                />
                            </div>
                            <div className="w-8 text-xs text-white font-bold text-right">{value}</div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Score Breakdown - Donut or Bars */}
            <div className="col-span-12 md:col-span-3 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-zinc-400 text-xs font-semibold uppercase tracking-wider mb-4">Lead Quality (Eleanor)</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-purple-900/10 border border-purple-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-purple-400">{scoreCounts.critical}</div>
                        <div className="text-[10px] text-purple-300/70 uppercase">Diamond (90+)</div>
                    </div>
                    <div className="bg-emerald-900/10 border border-emerald-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-emerald-400">{scoreCounts.high}</div>
                        <div className="text-[10px] text-emerald-300/70 uppercase">Emerald (70-89)</div>
                    </div>
                    <div className="bg-blue-900/10 border border-blue-500/20 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-blue-400">{scoreCounts.medium}</div>
                        <div className="text-[10px] text-blue-300/70 uppercase">Sapphire (50-69)</div>
                    </div>
                    <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 text-center">
                        <div className="text-2xl font-black text-zinc-400">{scoreCounts.low}</div>
                        <div className="text-[10px] text-zinc-500 uppercase">Ruby (&lt;50)</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
