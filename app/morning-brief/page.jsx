'use client';
import { useState, useEffect } from 'react';
import AppShell from '@/components/AppShell';

export default function MorningBriefPage() {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBrief();
  }, []);

  const loadBrief = async () => {
    try {
      const response = await fetch('/api/morning-brief');
      const data = await response.json();
      setBrief(data);
    } catch (error) {
      console.error('Failed to load brief:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppShell>
        <div className="p-6">
          <div className="text-white">Loading morning brief...</div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">☀️ Morning Brief</h1>
          <p className="text-zinc-400 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/30 rounded-lg p-6">
            <div className="text-cyan-400 text-sm mb-2">New Leads Today</div>
            <div className="text-4xl font-bold text-white">
              {brief?.summary?.newLeadsToday || 0}
            </div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 border border-green-500/30 rounded-lg p-6">
            <div className="text-green-400 text-sm mb-2">Hot Leads Ready</div>
            <div className="text-4xl font-bold text-white">
              {brief?.summary?.hotLeadsReady || 0}
            </div>
          </div>
          <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-500/5 border border-yellow-500/30 rounded-lg p-6">
            <div className="text-yellow-400 text-sm mb-2">Follow-ups Due</div>
            <div className="text-4xl font-bold text-white">
              {brief?.summary?.followUpsDue || 0}
            </div>
          </div>
          <div className="bg-gradient-to-br from-purple-500/20 to-purple-500/5 border border-purple-500/30 rounded-lg p-6">
            <div className="text-purple-400 text-sm mb-2">Total Calls Today</div>
            <div className="text-4xl font-bold text-white">
              {brief?.summary?.totalCallsToday || 0}
            </div>
          </div>
        </div>

        {/* Top Priority */}
        {brief?.topPriority && (
          <div className="bg-gradient-to-r from-red-500/20 to-orange-500/20 border-2 border-red-500/50 rounded-lg p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center space-x-3 mb-3">
                  <span className="text-3xl">🔥</span>
                  <h2 className="text-2xl font-bold text-white">
                    TOP PRIORITY - CALL FIRST!
                  </h2>
                </div>
                <div className="space-y-2">
                  <div className="text-xl text-white font-semibold">
                    {brief.topPriority.owner_name}
                  </div>
                  <div className="text-zinc-300">
                    {brief.topPriority.property_address}
                  </div>
                  <div className="text-green-400 text-lg font-bold">
                    $
                    {(brief.topPriority.excess_funds_amount || 0).toLocaleString()}
                  </div>
                  <div className="flex items-center space-x-4 mt-3">
                    <span className="px-3 py-1 bg-emerald-500 text-white font-bold rounded">
                      Grade: {brief.topPriority.deal_grade}
                    </span>
                    <span className="px-3 py-1 bg-purple-500 text-white rounded">
                      Score: {brief.topPriority.eleanor_score}
                    </span>
                    <span className="text-cyan-400 font-semibold">
                      {brief.topPriority.phone}
                    </span>
                  </div>
                </div>
              </div>
              {brief.topPriority.phone && (
                <button
                  onClick={() =>
                    (window.location.href = `tel:${brief.topPriority.phone}`)
                  }
                  className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg text-lg"
                >
                  📞 CALL NOW
                </button>
              )}
            </div>
          </div>
        )}

        {/* Full Call List */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">
            📋 Today's Call List
          </h2>

          {!brief?.callList || brief.callList.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              No calls scheduled for today
            </div>
          ) : (
            <div className="space-y-3">
              {brief.callList.map((lead, idx) => (
                <div
                  key={lead.id || idx}
                  className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-cyan-500 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="text-2xl font-bold text-zinc-600">
                        #{idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-white font-semibold">
                            {lead.owner_name}
                          </span>
                          {lead.deal_grade && (
                            <span
                              className={`px-2 py-0.5 text-xs rounded text-white font-bold ${
                                lead.deal_grade?.startsWith('A')
                                  ? 'bg-emerald-500'
                                  : lead.deal_grade === 'B'
                                  ? 'bg-yellow-500'
                                  : 'bg-zinc-600'
                              }`}
                            >
                              {lead.deal_grade}
                            </span>
                          )}
                          {lead.priority === 'FOLLOW-UP' && (
                            <span className="px-2 py-0.5 text-xs bg-orange-500 text-white rounded font-bold">
                              FOLLOW-UP
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {lead.property_address}
                        </div>
                        <div className="text-sm text-green-400 mt-1">
                          $
                          {(lead.excess_funds_amount || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-zinc-500 mt-1">
                          {lead.reason}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-cyan-400 font-semibold">
                        {lead.phone || 'No phone'}
                      </div>
                      {lead.phone && (
                        <button
                          onClick={() =>
                            (window.location.href = `tel:${lead.phone}`)
                          }
                          className="mt-2 px-4 py-1 bg-cyan-500 hover:bg-cyan-600 text-white rounded text-sm"
                        >
                          📞 Call
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
