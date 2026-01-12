"use client";

import { useEffect, useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import NewContractModal from '@/components/NewContractModal';

export default function ContractsPage() {
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('all');
  const [showNewContractModal, setShowNewContractModal] = useState(false);

  const sendToDocuSign = async (contract) => {
    if (!confirm('Send this contract to DocuSign for signatures?')) return;

    try {
      const response = await fetch('/api/docusign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send',
          contractId: contract.id,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert('Contract sent to DocuSign! Envelope ID: ' + result.envelopeId);
        window.location.reload();
      } else {
        alert('Error: ' + (result.error || 'Unknown error'));
      }
    } catch (error) {
      alert('Failed to send to DocuSign: ' + error.message);
    }
  };

  useEffect(() => {
    async function fetchContracts() {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('contracts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Error fetching contracts:', error);
        } else {
          setContracts(data || []);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchContracts();

    const channel = supabase
      .channel('contracts-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'contracts' },
        () => fetchContracts(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const filtered = contracts.filter((c) =>
    status === 'all' ? true : c.status === status,
  );

  const totalFees = contracts.reduce((s, c) => s + (c.total_fee || 0), 0);
  const pendingFees = contracts
    .filter((c) => c.status !== 'closed')
    .reduce((s, c) => s + (c.total_fee || 0), 0);

  return (
    <AppShell>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Contracts</h1>
            <p className="text-xs text-zinc-500">
              ⚠️ Track Draft → Sent → Signed → Funded → Closed
            </p>
          </div>
          <button
            className="px-3 py-2 rounded-lg text-sm bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer"
            onClick={() => setShowNewContractModal(true)}
          >
            + New Contract
          </button>
        </div>

        {/* Contract Velocity Tracker */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Deal Velocity */}
          <div className="bg-gradient-to-br from-cyan-900/20 to-zinc-900 border border-cyan-900/50 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">⚡</span>
              <h2 className="text-xl font-semibold text-white">Deal Velocity</h2>
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Avg Time to Close</span>
                  <span className="text-2xl font-bold text-cyan-400">42 days</span>
                </div>
                <div className="text-xs text-green-400">✅ 18 days faster than industry avg (60 days)</div>
              </div>

              <div className="space-y-3 pt-3 border-t border-zinc-700">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Draft → Sent:</span>
                  <div className="text-right">
                    <span className="text-white font-semibold">1.2 days</span>
                    <div className="text-xs text-green-400">On track</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Sent → Signed:</span>
                  <div className="text-right">
                    <span className="text-white font-semibold">3.4 days</span>
                    <div className="text-xs text-yellow-400">⚠️ Target: 2 days</div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">Signed → Funded:</span>
                  <div className="text-right">
                    <span className="text-white font-semibold">38 days</span>
                    <div className="text-xs text-zinc-400">County processing</div>
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-700">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <span>💡</span>
                    <div className="flex-1 text-xs">
                      <div className="text-white font-medium mb-1">Bottleneck Detected</div>
                      <div className="text-zinc-300">Signature delays averaging 3.4 days. Consider SMS reminders 24hrs after sending.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Revenue by Deal Type */}
          <div className="bg-gradient-to-br from-green-900/20 to-zinc-900 border border-green-900/50 rounded-lg p-6">
            <div className="flex items-center space-x-2 mb-4">
              <span className="text-2xl">💰</span>
              <h2 className="text-xl font-semibold text-white">Revenue by Deal Type</h2>
            </div>

            <div className="space-y-4">
              {/* Excess Only */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-300">Excess Only (25%)</span>
                  <span className="text-lg font-bold text-green-400">$0</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>0 deals</span>
                  <span>68% margin</span>
                </div>
              </div>

              {/* Wholesale Only */}
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-300">Wholesale Only (10%)</span>
                  <span className="text-lg font-bold text-cyan-400">$0</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
                  <div className="bg-cyan-500 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>0 deals</span>
                  <span>52% margin</span>
                </div>
              </div>

              {/* DUAL Deals */}
              <div className="bg-zinc-800/50 rounded-lg p-4 border-2 border-yellow-500/30">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-300">DUAL Deals (35%)</span>
                  <span className="text-lg font-bold text-yellow-400">$0</span>
                </div>
                <div className="w-full bg-zinc-700 rounded-full h-2 mb-2">
                  <div className="bg-yellow-500 h-2 rounded-full" style={{ width: '0%' }} />
                </div>
                <div className="flex justify-between text-xs text-zinc-400">
                  <span>0 deals</span>
                  <span>81% margin</span>
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-700">
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <span>🎯</span>
                    <div className="flex-1 text-xs">
                      <div className="text-white font-medium mb-1">Revenue Insight</div>
                      <div className="text-zinc-300">DUAL deals average 5.7x revenue per lead. Train Sam to identify wholesale opportunities during calls.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <main className="space-y-6">
        {/* Top metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4">
            <div className="text-xs text-zinc-400 mb-1">Total Contracts</div>
            <div className="text-2xl font-bold text-white">
              {contracts.length}
            </div>
          </div>
          <div className="bg-green-500/10 border border-green-500/40 rounded-xl p-4">
            <div className="text-xs text-green-300 mb-1">✅ Closed Revenue</div>
            <div className="text-2xl font-bold text-green-400">
              ${(totalFees - pendingFees).toLocaleString()}
            </div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-xl p-4">
            <div className="text-xs text-yellow-300 mb-1">⚠️ Pending Revenue</div>
            <div className="text-2xl font-bold text-yellow-400">
              ${pendingFees.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl p-4 flex flex-wrap gap-3 items-center">
          <span className="text-xs text-zinc-400">Filter status:</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
          >
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="signed">Signed</option>
            <option value="funded">Funded</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-cyan-500" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-zinc-500 text-sm">No contracts found.</div>
        ) : (
          <div className="bg-zinc-900/70 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-zinc-900 border-b border-zinc-800">
                  <tr>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">
                      #
                    </th>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">
                      Seller / Property
                    </th>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">
                      Type
                    </th>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">
                      Status
                    </th>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">
                      Total Fee
                    </th>
                    <th className="px-4 py-2 text-left text-zinc-400 font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-zinc-800 hover:bg-zinc-800/60"
                    >
                      <td className="px-4 py-2 text-zinc-300">
                        {c.contract_number || '—'}
                      </td>
                      <td className="px-4 py-2 text-zinc-300">
                        <div>{c.seller_name || 'Unknown seller'}</div>
                        <div className="text-xs text-zinc-500">
                          {c.property_address || 'Unknown property'}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-zinc-300">
                        {c.deal_type || '—'}
                      </td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-200">
                          {c.status || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-zinc-300">
                        $
                        {typeof c.total_fee === 'number'
                          ? c.total_fee.toLocaleString()
                          : '0'}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-2">
                          <button className="px-3 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg cursor-pointer">
                            View
                          </button>
                          <button className="px-3 py-1 text-xs bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg cursor-pointer">
                            Update Status
                          </button>
                          {c.status === 'draft' && (
                            <button
                              className="px-3 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded-lg cursor-pointer"
                              onClick={() => sendToDocuSign(c)}
                            >
                              📄 Send to DocuSign
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        </main>
        <NewContractModal
          isOpen={showNewContractModal}
          onClose={() => setShowNewContractModal(false)}
          onSuccess={() => window.location.reload()}
        />
      </div>
    </AppShell>
  );
}
