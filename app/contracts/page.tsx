'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Sidebar from '@/components/Sidebar';
import { calculateFees } from '@/lib/eleanor';

interface Contract {
  id: string;
  property_address: string;
  owner_name: string;
  deal_type: 'dual' | 'excess_only' | 'excess_funds' | 'wholesale';
  excess_amount: number;
  wholesale_equity: number;
  total_fee: number;
  status: 'draft' | 'sent' | 'signed' | 'completed' | 'cancelled';
  docusign_envelope_id: string | null;
  created_at: string;
  signed_at: string | null;
}

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCalculator, setShowCalculator] = useState(false);

  // Fee Calculator State
  const [calcDealType, setCalcDealType] = useState<'dual' | 'excess_only' | 'wholesale'>('excess_only');
  const [calcExcessAmount, setCalcExcessAmount] = useState<string>('');
  const [calcWholesaleEquity, setCalcWholesaleEquity] = useState<string>('');

  // Real-time fee calculation
  const calculatedFees = calculateFees(
    parseFloat(calcExcessAmount) || 0,
    parseFloat(calcWholesaleEquity) || 0,
    calcDealType
  );

  useEffect(() => {
    fetchContracts();
  }, []);

  async function fetchContracts() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch error:', error);
        setContracts([]);
      } else {
        setContracts(data || []);
      }
    } catch (err) {
      console.error('Error:', err);
      setContracts([]);
    } finally {
      setLoading(false);
    }
  }

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getStatusBadge(status: string) {
    const styles: Record<string, string> = {
      draft: 'bg-zinc-500/20 text-zinc-400',
      sent: 'bg-blue-500/20 text-blue-400',
      signed: 'bg-green-500/20 text-green-400',
      completed: 'bg-emerald-500/20 text-emerald-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return styles[status] || 'bg-zinc-500/20 text-zinc-400';
  }

  function getDealTypeBadge(dealType: string) {
    const styles: Record<string, string> = {
      dual: 'bg-purple-500/20 text-purple-400',
      excess_only: 'bg-cyan-500/20 text-cyan-400',
      excess_funds: 'bg-cyan-500/20 text-cyan-400',
      wholesale: 'bg-orange-500/20 text-orange-400',
    };
    return styles[dealType] || 'bg-zinc-500/20 text-zinc-400';
  }

  const totalRevenue = contracts
    .filter(c => c.status === 'completed' || c.status === 'signed')
    .reduce((sum, c) => sum + (c.total_fee || 0), 0);

  const pendingContracts = contracts.filter(c => c.status === 'sent').length;
  const signedContracts = contracts.filter(c => c.status === 'signed' || c.status === 'completed').length;

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
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Contracts</h1>
            <p className="text-zinc-500 mt-1">DocuSign contract management and fee calculator</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowCalculator(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Fee Calculator
            </button>
            <button className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition">
              + New Contract
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{contracts.length}</div>
            <div className="text-zinc-500 text-sm">Total Contracts</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-blue-400">{pendingContracts}</div>
            <div className="text-zinc-500 text-sm">Pending Signature</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{signedContracts}</div>
            <div className="text-zinc-500 text-sm">Signed</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{formatCurrency(totalRevenue)}</div>
            <div className="text-zinc-500 text-sm">Total Revenue</div>
          </div>
        </div>

        {/* Contracts Table */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-zinc-800/50">
              <tr>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Property</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Owner</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Deal Type</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Fee</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-zinc-400 text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                    <p className="text-lg mb-2">No contracts yet</p>
                    <p className="text-sm">Contracts will appear here when created via DocuSign</p>
                  </td>
                </tr>
              ) : (
                contracts.map((contract) => (
                  <tr key={contract.id} className="hover:bg-zinc-800/50 transition">
                    <td className="px-4 py-4">
                      <div className="text-white font-medium">{contract.property_address || 'N/A'}</div>
                    </td>
                    <td className="px-4 py-4 text-zinc-300">{contract.owner_name || 'N/A'}</td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getDealTypeBadge(contract.deal_type)}`}>
                        {contract.deal_type?.replace('_', ' ').toUpperCase() || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-green-400 font-medium">
                      {formatCurrency(contract.total_fee || 0)}
                    </td>
                    <td className="px-4 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadge(contract.status)}`}>
                        {contract.status || 'unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <button className="text-cyan-400 hover:text-cyan-300 text-sm mr-3">View</button>
                      <button className="text-zinc-400 hover:text-zinc-300 text-sm">Resend</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Fee Calculator Modal */}
        {showCalculator && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 w-full max-w-lg">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Fee Calculator</h2>
                <button
                  onClick={() => setShowCalculator(false)}
                  className="text-zinc-400 hover:text-white"
                >
                  X
                </button>
              </div>

              {/* Deal Type Selector */}
              <div className="mb-6">
                <label className="block text-zinc-400 text-sm mb-2">Deal Type</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setCalcDealType('excess_only')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      calcDealType === 'excess_only'
                        ? 'bg-cyan-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Excess Only
                  </button>
                  <button
                    onClick={() => setCalcDealType('wholesale')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      calcDealType === 'wholesale'
                        ? 'bg-orange-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Wholesale
                  </button>
                  <button
                    onClick={() => setCalcDealType('dual')}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                      calcDealType === 'dual'
                        ? 'bg-purple-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    Dual Deal
                  </button>
                </div>
              </div>

              {/* Excess Funds Input */}
              {(calcDealType === 'excess_only' || calcDealType === 'dual') && (
                <div className="mb-4">
                  <label className="block text-zinc-400 text-sm mb-2">Excess Funds Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="number"
                      value={calcExcessAmount}
                      onChange={(e) => setCalcExcessAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">25% fee on excess funds</p>
                </div>
              )}

              {/* Wholesale Equity Input */}
              {(calcDealType === 'wholesale' || calcDealType === 'dual') && (
                <div className="mb-6">
                  <label className="block text-zinc-400 text-sm mb-2">Wholesale Equity</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="number"
                      value={calcWholesaleEquity}
                      onChange={(e) => setCalcWholesaleEquity(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg focus:ring-2 focus:ring-cyan-500"
                    />
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">10% fee on wholesale equity</p>
                </div>
              )}

              {/* Results */}
              <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
                {(calcDealType === 'excess_only' || calcDealType === 'dual') && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Excess Fee (25%)</span>
                    <span className="text-cyan-400 font-medium">{formatCurrency(calculatedFees.excessFee)}</span>
                  </div>
                )}
                {(calcDealType === 'wholesale' || calcDealType === 'dual') && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Wholesale Fee (10%)</span>
                    <span className="text-orange-400 font-medium">{formatCurrency(calculatedFees.wholesaleFee)}</span>
                  </div>
                )}
                <div className="border-t border-zinc-700 pt-3 flex justify-between">
                  <span className="text-white font-medium">Total Fee</span>
                  <span className="text-green-400 font-bold text-xl">{formatCurrency(calculatedFees.totalFee)}</span>
                </div>
                <div className="flex justify-between pt-2">
                  <span className="text-zinc-500 text-sm">Revenue to Logan (100%)</span>
                  <span className="text-green-400 font-medium">{formatCurrency(calculatedFees.totalFee)}</span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => {
                    setCalcExcessAmount('');
                    setCalcWholesaleEquity('');
                  }}
                  className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition"
                >
                  Clear
                </button>
                <button
                  onClick={() => setShowCalculator(false)}
                  className="flex-1 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
