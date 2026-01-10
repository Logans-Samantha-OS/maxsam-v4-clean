'use client';

import { Lead } from "@/lib/dashboard-utils";

interface QuickStatsHeaderProps {
    leads: Lead[];
}

export default function QuickStatsHeader({ leads }: QuickStatsHeaderProps) {
    const stats = {
        readyToBlast: leads.filter(l => (l.status === 'new' || !l.status) && (l.phone_1 || l.phone_2)).length,
        awaitingResponse: leads.filter(l => l.status === 'contacted').length,
        hotResponses: leads.filter(l => l.status === 'qualified').length,
        agreementsSent: leads.filter(l => l.status === 'contract_sent').length,
        signedThisWeek: leads.filter(l => {
            if (l.status !== 'contract_signed' && l.status !== 'closed') return false;
            // Simple mock for "This Week" - would need real date logic
            return true;
        }).length,
    };

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-full text-blue-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <div>
                    <div className="text-2xl font-black text-white leading-none">{stats.readyToBlast}</div>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wide mt-1">Ready to Blast</div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-full text-yellow-500">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <div className="text-2xl font-black text-white leading-none">{stats.awaitingResponse}</div>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wide mt-1">Pending Reply</div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-center gap-3 relative overflow-hidden">
                <div className="absolute inset-0 bg-red-600/5 animate-pulse"></div>
                <div className="p-2 bg-red-500/10 rounded-full text-red-500 relative z-10">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
                </div>
                <div className="relative z-10">
                    <div className="text-2xl font-black text-red-500 leading-none">{stats.hotResponses}</div>
                    <div className="text-[10px] text-red-500/70 uppercase tracking-wide mt-1">Hot Responses</div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-full text-purple-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                </div>
                <div>
                    <div className="text-2xl font-black text-white leading-none">{stats.agreementsSent}</div>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wide mt-1">Sent Contracts</div>
                </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-700/50 rounded-lg p-3 flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-full text-emerald-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <div>
                    <div className="text-2xl font-black text-emerald-400 leading-none">{stats.signedThisWeek}</div>
                    <div className="text-[10px] text-zinc-400 uppercase tracking-wide mt-1">Signed</div>
                </div>
            </div>
        </div>
    );
}
