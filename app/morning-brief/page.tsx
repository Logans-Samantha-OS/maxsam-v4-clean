'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/Sidebar';

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
  }>;
  follow_ups: Array<{
    id: string;
    owner_name: string;
    property_address: string;
    last_contact: string;
    attempts: number;
  }>;
  pending_contracts: Array<{
    id: string;
    seller_name: string;
    property_address: string;
    total_fee: number;
    sent_at: string;
  }>;
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

  function getGradeColor(grade: string): string {
    switch (grade) {
      case 'A+': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50';
      case 'A': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'B': return 'bg-blue-500/20 text-blue-400 border-blue-500/50';
      case 'C': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      default: return 'bg-red-500/20 text-red-400 border-red-500/50';
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

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

      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-8">
          {/* Header */}
          <div className="text-center mb-12">
            <p className="text-cyan-400 text-lg mb-2">Good Morning, Logan</p>
            <h1 className="text-4xl font-bold text-white mb-2">{brief?.date || today}</h1>
            <p className="text-zinc-500">Here's your money-making plan for today</p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 rounded-xl p-5">
              <div className="text-blue-400 text-3xl font-bold">{brief?.summary.new_leads_today || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">New Leads Today</div>
            </div>
            <div className="bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30 rounded-xl p-5">
              <div className="text-red-400 text-3xl font-bold">{brief?.summary.hot_leads || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">Hot Leads Ready</div>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 border border-yellow-500/30 rounded-xl p-5">
              <div className="text-yellow-400 text-3xl font-bold">{brief?.summary.follow_ups_due || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">Follow-ups Due</div>
            </div>
            <div className="bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 rounded-xl p-5">
              <div className="text-purple-400 text-3xl font-bold">{brief?.summary.pending_contracts || 0}</div>
              <div className="text-zinc-400 text-sm mt-1">Contracts Pending</div>
            </div>
          </div>

          {/* Revenue Overview */}
          <div className="bg-gradient-to-r from-green-500/10 to-cyan-500/10 border border-green-500/30 rounded-xl p-6 mb-8">
            <div className="flex justify-between items-center">
              <div>
                <div className="text-zinc-400 text-sm">Pipeline Value</div>
                <div className="text-3xl font-bold text-green-400">{formatCurrency(brief?.summary.total_pipeline || 0)}</div>
              </div>
              <div className="text-right">
                <div className="text-zinc-400 text-sm">Estimated Revenue (25%)</div>
                <div className="text-3xl font-bold text-cyan-400">{formatCurrency((brief?.summary.total_pipeline || 0) * 0.25)}</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-green-500/20 text-center">
              <span className="text-zinc-500 text-sm">100% to Logan Toups</span>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {/* Hot Leads */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-red-400">🔥</span> Hot Leads to Call
                </h2>
                <span className="text-zinc-500 text-sm">{brief?.hot_leads?.length || 0} leads</span>
              </div>
              {brief?.hot_leads && brief.hot_leads.length > 0 ? (
                <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
                  {brief.hot_leads.map((lead) => (
                    <div key={lead.id} className="p-4 hover:bg-zinc-800/50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{lead.owner_name || 'Unknown'}</div>
                          <div className="text-zinc-500 text-sm truncate">{lead.property_address}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold border ${getGradeColor(lead.grade)}`}>
                          {lead.grade}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-green-400 font-bold">{formatCurrency(lead.excess_funds || 0)}</span>
                        <a
                          href={`tel:${lead.phone}`}
                          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-700 text-white rounded text-sm transition"
                        >
                          Call {lead.phone}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  No hot leads today. Run Eleanor scoring to identify opportunities.
                </div>
              )}
            </div>

            {/* Follow-ups */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-yellow-400">📞</span> Follow-ups Due
                </h2>
                <span className="text-zinc-500 text-sm">{brief?.follow_ups?.length || 0} due</span>
              </div>
              {brief?.follow_ups && brief.follow_ups.length > 0 ? (
                <div className="divide-y divide-zinc-800 max-h-96 overflow-y-auto">
                  {brief.follow_ups.map((lead) => (
                    <div key={lead.id} className="p-4 hover:bg-zinc-800/50 transition">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="text-white font-medium truncate">{lead.owner_name || 'Unknown'}</div>
                          <div className="text-zinc-500 text-sm truncate">{lead.property_address}</div>
                        </div>
                        <span className="text-zinc-400 text-xs">
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
          </div>

          {/* Pending Contracts */}
          {brief?.pending_contracts && brief.pending_contracts.length > 0 && (
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden mb-8">
              <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-purple-400">📝</span> Contracts Awaiting Signature
                </h2>
                <span className="text-zinc-500 text-sm">{brief.pending_contracts.length} pending</span>
              </div>
              <div className="divide-y divide-zinc-800">
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
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              href="/"
              className="px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg transition"
            >
              Open Dashboard
            </Link>
            <Link
              href="/sellers"
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition"
            >
              View All Leads
            </Link>
            <Link
              href="/contracts"
              className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg transition"
            >
              Contracts
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
