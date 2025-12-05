'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import { calculateEleanorScore, calculateFees, type Lead } from '@/lib/eleanor';

export default function SimulatorPage() {
  // Lead simulator state
  const [simulatedLead, setSimulatedLead] = useState<Partial<Lead>>({
    excess_funds_amount: 25000,
    estimated_arv: 200000,
    estimated_repair_cost: 30000,
    phone: '2145551234',
    email: 'test@example.com',
    owner_name: 'John Smith',
    zip_code: '75201',
    is_distressed: false,
  });

  // Calculate score based on simulated lead
  const scoringResult = calculateEleanorScore({
    id: 'sim-1',
    ...simulatedLead,
    excess_funds_amount: simulatedLead.excess_funds_amount || null,
  } as Lead);

  // Fee calculation state
  const [feeCalcType, setFeeCalcType] = useState<'dual' | 'excess_only' | 'wholesale'>('excess_only');
  const [feeExcessAmount, setFeeExcessAmount] = useState<number>(25000);
  const [feeWholesaleEquity, setFeeWholesaleEquity] = useState<number>(50000);

  const feeResult = calculateFees(feeExcessAmount, feeWholesaleEquity, feeCalcType);

  function formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function getGradeColor(grade: string): string {
    switch (grade) {
      case 'A+': return 'text-emerald-400';
      case 'A': return 'text-green-400';
      case 'B': return 'text-blue-400';
      case 'C': return 'text-yellow-400';
      case 'D': return 'text-red-400';
      default: return 'text-zinc-400';
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Simulator</h1>
          <p className="text-zinc-500 mt-1">Test Eleanor AI scoring and fee calculations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Eleanor Scoring Simulator */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Eleanor Score Simulator</h2>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-zinc-400 text-sm mb-1">Excess Funds Amount</label>
                <input
                  type="number"
                  value={simulatedLead.excess_funds_amount || ''}
                  onChange={(e) => setSimulatedLead(s => ({ ...s, excess_funds_amount: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-sm mb-1">ARV</label>
                  <input
                    type="number"
                    value={simulatedLead.estimated_arv || ''}
                    onChange={(e) => setSimulatedLead(s => ({ ...s, estimated_arv: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-sm mb-1">Repair Cost</label>
                  <input
                    type="number"
                    value={simulatedLead.estimated_repair_cost || ''}
                    onChange={(e) => setSimulatedLead(s => ({ ...s, estimated_repair_cost: Number(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-zinc-400 text-sm mb-1">Zip Code</label>
                <input
                  type="text"
                  value={simulatedLead.zip_code || ''}
                  onChange={(e) => setSimulatedLead(s => ({ ...s, zip_code: e.target.value }))}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  placeholder="e.g., 75201"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-zinc-400 text-sm mb-1">Phone</label>
                  <input
                    type="text"
                    value={simulatedLead.phone || ''}
                    onChange={(e) => setSimulatedLead(s => ({ ...s, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-400 text-sm mb-1">Email</label>
                  <input
                    type="text"
                    value={simulatedLead.email || ''}
                    onChange={(e) => setSimulatedLead(s => ({ ...s, email: e.target.value }))}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-zinc-400 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={simulatedLead.is_distressed || false}
                    onChange={(e) => setSimulatedLead(s => ({ ...s, is_distressed: e.target.checked }))}
                    className="rounded border-zinc-600 bg-zinc-800"
                  />
                  Distressed Property
                </label>
              </div>
            </div>

            {/* Results */}
            <div className="bg-zinc-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <span className="text-zinc-400 text-sm">Eleanor Score</span>
                  <div className="text-4xl font-bold text-cyan-400">{scoringResult.eleanor_score}</div>
                </div>
                <div className="text-right">
                  <span className={`text-3xl font-bold ${getGradeColor(scoringResult.deal_grade)}`}>
                    {scoringResult.deal_grade}
                  </span>
                  <div className="text-zinc-500 text-sm capitalize">{scoringResult.contact_priority} priority</div>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Deal Type</span>
                  <span className="text-white capitalize">{scoringResult.deal_type.replace('_', ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Potential Revenue</span>
                  <span className="text-green-400 font-medium">{formatCurrency(scoringResult.potential_revenue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Excess Fee (25%)</span>
                  <span className="text-cyan-400">{formatCurrency(scoringResult.excess_fee)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Wholesale Fee (10%)</span>
                  <span className="text-orange-400">{formatCurrency(scoringResult.wholesale_fee)}</span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-zinc-700">
                <div className="text-zinc-400 text-xs mb-2">Scoring Breakdown:</div>
                <div className="max-h-32 overflow-y-auto text-xs text-zinc-500 space-y-1">
                  {scoringResult.reasoning.map((reason, i) => (
                    <div key={i}>{reason}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Fee Calculator */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-6">Fee Calculator</h2>

            {/* Deal Type Selector */}
            <div className="mb-6">
              <label className="block text-zinc-400 text-sm mb-2">Deal Type</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => setFeeCalcType('excess_only')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    feeCalcType === 'excess_only'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  Excess Only
                </button>
                <button
                  onClick={() => setFeeCalcType('wholesale')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    feeCalcType === 'wholesale'
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  Wholesale
                </button>
                <button
                  onClick={() => setFeeCalcType('dual')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    feeCalcType === 'dual'
                      ? 'bg-purple-600 text-white'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                  }`}
                >
                  Dual Deal
                </button>
              </div>
            </div>

            {/* Inputs */}
            <div className="space-y-4 mb-6">
              {(feeCalcType === 'excess_only' || feeCalcType === 'dual') && (
                <div>
                  <label className="block text-zinc-400 text-sm mb-1">Excess Funds Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="number"
                      value={feeExcessAmount}
                      onChange={(e) => setFeeExcessAmount(Number(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg"
                    />
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">25% fee applies</p>
                </div>
              )}

              {(feeCalcType === 'wholesale' || feeCalcType === 'dual') && (
                <div>
                  <label className="block text-zinc-400 text-sm mb-1">Wholesale Equity</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">$</span>
                    <input
                      type="number"
                      value={feeWholesaleEquity}
                      onChange={(e) => setFeeWholesaleEquity(Number(e.target.value) || 0)}
                      className="w-full pl-8 pr-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-lg"
                    />
                  </div>
                  <p className="text-zinc-500 text-xs mt-1">10% fee applies</p>
                </div>
              )}
            </div>

            {/* Results */}
            <div className="bg-zinc-800 rounded-lg p-4 space-y-3">
              {(feeCalcType === 'excess_only' || feeCalcType === 'dual') && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Excess Fee (25%)</span>
                  <span className="text-cyan-400 font-medium">{formatCurrency(feeResult.excessFee)}</span>
                </div>
              )}
              {(feeCalcType === 'wholesale' || feeCalcType === 'dual') && (
                <div className="flex justify-between">
                  <span className="text-zinc-400">Wholesale Fee (10%)</span>
                  <span className="text-orange-400 font-medium">{formatCurrency(feeResult.wholesaleFee)}</span>
                </div>
              )}
              <div className="border-t border-zinc-700 pt-3 flex justify-between">
                <span className="text-white font-medium">Total Fee</span>
                <span className="text-green-400 font-bold text-2xl">{formatCurrency(feeResult.totalFee)}</span>
              </div>
              <div className="flex justify-between pt-2">
                <span className="text-zinc-500 text-sm">Revenue to Logan (100%)</span>
                <span className="text-green-400 font-medium">{formatCurrency(feeResult.totalFee)}</span>
              </div>
            </div>

            {/* Quick Examples */}
            <div className="mt-6">
              <h3 className="text-zinc-400 text-sm mb-3">Quick Examples:</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setFeeCalcType('excess_only');
                    setFeeExcessAmount(50000);
                  }}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded text-sm hover:bg-zinc-700 transition"
                >
                  $50K Excess
                </button>
                <button
                  onClick={() => {
                    setFeeCalcType('wholesale');
                    setFeeWholesaleEquity(100000);
                  }}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded text-sm hover:bg-zinc-700 transition"
                >
                  $100K Wholesale
                </button>
                <button
                  onClick={() => {
                    setFeeCalcType('dual');
                    setFeeExcessAmount(30000);
                    setFeeWholesaleEquity(75000);
                  }}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded text-sm hover:bg-zinc-700 transition"
                >
                  Dual: $30K + $75K
                </button>
                <button
                  onClick={() => {
                    setFeeCalcType('excess_only');
                    setFeeExcessAmount(0);
                    setFeeWholesaleEquity(0);
                  }}
                  className="px-3 py-2 bg-zinc-800 text-zinc-300 rounded text-sm hover:bg-zinc-700 transition"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
