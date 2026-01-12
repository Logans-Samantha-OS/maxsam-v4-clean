'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';

export default function SimulatorPage() {
  const [scenario, setScenario] = useState({
    leadsPerMonth: 100,
    excessOnlyRate: 30,
    wholesaleRate: 20,
    dualRate: 50,
    avgExcessFunds: 45000,
    avgWholesalePrice: 475000,
    conversionRate: 15,
    callsPerDay: 20,
    daysPerMonth: 22,
  });

  const [results, setResults] = useState(null);

  const runSimulation = () => {
    const totalLeads = scenario.leadsPerMonth;
    
    // Calculate deal distribution
    const excessOnlyDeals = Math.round((totalLeads * scenario.excessOnlyRate / 100) * (scenario.conversionRate / 100));
    const wholesaleDeals = Math.round((totalLeads * scenario.wholesaleRate / 100) * (scenario.conversionRate / 100));
    const dualDeals = Math.round((totalLeads * scenario.dualRate / 100) * (scenario.conversionRate / 100));
    
    // Calculate fees
    const excessOnlyFees = excessOnlyDeals * (scenario.avgExcessFunds * 0.25);
    const wholesaleFees = wholesaleDeals * (scenario.avgWholesalePrice * 0.10);
    const dualFees = dualDeals * ((scenario.avgExcessFunds * 0.25) + (scenario.avgWholesalePrice * 0.10));
    
    const totalFees = excessOnlyFees + wholesaleFees + dualFees;
    
    // Calculate splits
    const loganExcessOnly = excessOnlyFees * 0.80;
    const loganWholesale = wholesaleFees * 0.65;
    const loganDual = dualFees * 0.65;
    const loganTotal = loganExcessOnly + loganWholesale + loganDual;
    
    const maxTotal = totalFees - loganTotal;
    
    // Calculate metrics
    const callsNeeded = scenario.callsPerDay * scenario.daysPerMonth;
    const totalDeals = excessOnlyDeals + wholesaleDeals + dualDeals || 1;
    const callsPerDeal = callsNeeded / totalDeals;
    const revenuePerCall = callsNeeded > 0 ? totalFees / callsNeeded : 0;
    const revenuePerLead = totalLeads > 0 ? totalFees / totalLeads : 0;

    setResults({
      deals: {
        excessOnly: excessOnlyDeals,
        wholesale: wholesaleDeals,
        dual: dualDeals,
        total: excessOnlyDeals + wholesaleDeals + dualDeals,
      },
      revenue: {
        excessOnlyFees,
        wholesaleFees,
        dualFees,
        totalFees,
        loganTotal,
        maxTotal,
      },
      metrics: {
        callsNeeded,
        callsPerDeal,
        revenuePerCall,
        revenuePerLead,
        avgDealSize: totalFees / totalDeals,
      },
    });
  };

  const formatCurrency = (value) => {
    if (!Number.isFinite(value)) return '$0';
    if (value >= 1000000) return `$${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
  };

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Business Simulator</h1>
          <p className="text-zinc-400 mt-1">Model different scenarios and optimize your strategy</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Scenario Inputs</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Leads Per Month
                </label>
                <input
                  type="number"
                  value={scenario.leadsPerMonth}
                  onChange={(e) => setScenario({
                    ...scenario,
                    leadsPerMonth: parseInt(e.target.value || '0', 10),
                  })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Excess Only %
                  </label>
                  <input
                    type="number"
                    value={scenario.excessOnlyRate}
                    onChange={(e) => setScenario({
                      ...scenario,
                      excessOnlyRate: parseInt(e.target.value || '0', 10),
                    })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Wholesale %
                  </label>
                  <input
                    type="number"
                    value={scenario.wholesaleRate}
                    onChange={(e) => setScenario({
                      ...scenario,
                      wholesaleRate: parseInt(e.target.value || '0', 10),
                    })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    DUAL %
                  </label>
                  <input
                    type="number"
                    value={scenario.dualRate}
                    onChange={(e) => setScenario({
                      ...scenario,
                      dualRate: parseInt(e.target.value || '0', 10),
                    })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Avg Excess Funds ($)
                </label>
                <input
                  type="number"
                  value={scenario.avgExcessFunds}
                  onChange={(e) => setScenario({
                    ...scenario,
                    avgExcessFunds: parseInt(e.target.value || '0', 10),
                  })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Avg Wholesale Price ($)
                </label>
                <input
                  type="number"
                  value={scenario.avgWholesalePrice}
                  onChange={(e) => setScenario({
                    ...scenario,
                    avgWholesalePrice: parseInt(e.target.value || '0', 10),
                  })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Conversion Rate (%)
                </label>
                <input
                  type="number"
                  value={scenario.conversionRate}
                  onChange={(e) => setScenario({
                    ...scenario,
                    conversionRate: parseInt(e.target.value || '0', 10),
                  })}
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Calls Per Day
                  </label>
                  <input
                    type="number"
                    value={scenario.callsPerDay}
                    onChange={(e) => setScenario({
                      ...scenario,
                      callsPerDay: parseInt(e.target.value || '0', 10),
                    })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Days Per Month
                  </label>
                  <input
                    type="number"
                    value={scenario.daysPerMonth}
                    onChange={(e) => setScenario({
                      ...scenario,
                      daysPerMonth: parseInt(e.target.value || '0', 10),
                    })}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={runSimulation}
                className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors"
              >
                🎯 Run Simulation
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Projected Results</h2>
            
            {!results ? (
              <div className="text-center text-zinc-400 py-12">
                Click "Run Simulation" to see results
              </div>
            ) : (
              <div className="space-y-6">
                {/* Deal Breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-3">Deal Breakdown</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300">Excess Only:</span>
                      <span className="text-white font-semibold">{results.deals.excessOnly} deals</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300">Wholesale:</span>
                      <span className="text-white font-semibold">{results.deals.wholesale} deals</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300">DUAL:</span>
                      <span className="text-emerald-400 font-semibold">{results.deals.dual} deals</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
                      <span className="text-white font-semibold">Total Deals:</span>
                      <span className="text-cyan-400 font-bold text-xl">{results.deals.total}</span>
                    </div>
                  </div>
                </div>

                {/* Revenue Breakdown */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-3">Revenue (Monthly)</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-300">Total Fees:</span>
                      <span className="text-green-400 font-bold text-xl">{formatCurrency(results.revenue.totalFees)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
                      <span className="text-cyan-300 font-semibold">Logan's Cut:</span>
                      <span className="text-cyan-400 font-bold text-lg">{formatCurrency(results.revenue.loganTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-purple-300 font-semibold">Max's Cut:</span>
                      <span className="text-purple-400 font-bold text-lg">{formatCurrency(results.revenue.maxTotal)}</span>
                    </div>
                  </div>
                </div>

                {/* Key Metrics */}
                <div>
                  <h3 className="text-sm font-medium text-zinc-400 mb-3">Key Metrics</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Avg Deal Size:</span>
                      <span className="text-white font-semibold">{formatCurrency(results.metrics.avgDealSize)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Revenue Per Lead:</span>
                      <span className="text-white font-semibold">{formatCurrency(results.metrics.revenuePerLead)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Revenue Per Call:</span>
                      <span className="text-white font-semibold">{formatCurrency(results.metrics.revenuePerCall)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Calls Per Deal:</span>
                      <span className="text-white font-semibold">{results.metrics.callsPerDeal.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-zinc-300">Total Calls Needed:</span>
                      <span className="text-white font-semibold">{results.metrics.callsNeeded}</span>
                    </div>
                  </div>
                </div>

                {/* Annual Projection */}
                <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-cyan-300 mb-2">12-Month Projection</h3>
                  <div className="flex justify-between items-center">
                    <span className="text-white">Annual Revenue (Logan):</span>
                    <span className="text-cyan-400 font-bold text-2xl">{formatCurrency(results.revenue.loganTotal * 12)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Insights */}
        {results && (
          <div className="mt-6 bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Strategic Insights</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4">
                <div className="text-emerald-400 font-semibold mb-2">💡 DUAL Deal Opportunity</div>
                <div className="text-sm text-zinc-300">
                  {results.deals.dual > 0 && results.deals.excessOnly > 0
                    ? `DUAL deals generate ${(
                        (results.revenue.dualFees / results.deals.dual) /
                        (results.revenue.excessOnlyFees / results.deals.excessOnly || 1)
                      ).toFixed(1)}x more revenue than excess-only. Focus on identifying wholesale opportunities!`
                    : 'Run scenarios with both DUAL and Excess deals to see comparative uplift.'}
                </div>
              </div>

              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                <div className="text-cyan-400 font-semibold mb-2">📞 Call Efficiency</div>
                <div className="text-sm text-zinc-300">
                  {`You need ${results.metrics.callsPerDeal.toFixed(
                    0,
                  )} calls per deal. Improve to 10 calls/deal to potentially double revenue with the same calling effort.`}
                </div>
              </div>

              <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <div className="text-purple-400 font-semibold mb-2">🎯 Scale Target</div>
                <div className="text-sm text-zinc-300">
                  {results.revenue.loganTotal > 0
                    ? `To hit $1M annual (Logan's cut), you need ${Math.ceil(
                        1000000 / (results.revenue.loganTotal * 12),
                      )} years at current rates, or increase your conversion rate toward ${(
                        (1000000 /
                          (results.revenue.loganTotal * 12) /
                          scenario.conversionRate) *
                        scenario.conversionRate
                      ).toFixed(0)}%.`
                    : 'Run a scenario with non-zero revenue to see scale targets.'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
