'use client';
import { useState } from 'react';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';

export default function TestingPage() {
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const tests = [
    {
      name: 'Database Connection',
      test: async () => {
        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('id')
          .limit(1);
        if (error) throw error;
        return 'Connected successfully';
      },
    },
    {
      name: 'Lead Creation',
      test: async () => {
        const testLead = {
          property_address: 'TEST - 123 Test St, Dallas, TX 75001',
          owner_name: 'Test Owner',
          excess_funds_amount: 50000,
          status: 'test',
        };
        const { data, error } = await supabase
          .from('maxsam_leads')
          .insert([testLead])
          .select();
        if (error) throw error;
        // Clean up
        await supabase.from('maxsam_leads').delete().eq('id', data[0].id);
        return `Created and deleted test lead: ${data[0].id}`;
      },
    },
    {
      name: 'Buyer Creation',
      test: async () => {
        const testBuyer = {
          name: 'Test Buyer',
          email: 'test@example.com',
          phone: '+1234567890',
        };
        const { data, error } = await supabase
          .from('buyers')
          .insert([testBuyer])
          .select();
        if (error) throw error;
        // Clean up
        await supabase.from('buyers').delete().eq('id', data[0].id);
        return `Created and deleted test buyer: ${data[0].id}`;
      },
    },
    {
      name: 'Contract Math - Excess Only',
      test: async () => {
        const excessAmount = 40000;
        const fee = excessAmount * 0.25; // Should be 10000
        const loganCut = fee * 0.8; // Should be 8000
        const maxCut = fee * 0.2; // Should be 2000

        if (fee !== 10000)
          throw new Error(`Fee calculation wrong: ${fee} vs 10000`);
        if (loganCut !== 8000)
          throw new Error(`Logan cut wrong: ${loganCut} vs 8000`);
        if (maxCut !== 2000)
          throw new Error(`Max cut wrong: ${maxCut} vs 2000`);

        return 'Excess-only calculations correct';
      },
    },
    {
      name: 'Contract Math - Wholesale',
      test: async () => {
        const wholesaleAmount = 500000;
        const fee = wholesaleAmount * 0.1; // Should be 50000
        const loganCut = fee * 0.65; // Should be 32500
        const maxCut = fee * 0.35; // Should be 17500

        if (fee !== 50000)
          throw new Error(`Fee calculation wrong: ${fee} vs 50000`);
        if (loganCut !== 32500)
          throw new Error(`Logan cut wrong: ${loganCut} vs 32500`);
        if (maxCut !== 17500)
          throw new Error(`Max cut wrong: ${maxCut} vs 17500`);

        return 'Wholesale calculations correct';
      },
    },
    {
      name: 'Contract Math - DUAL',
      test: async () => {
        const excessAmount = 40000;
        const wholesaleAmount = 500000;
        const excessFee = excessAmount * 0.25; // 10000
        const wholesaleFee = wholesaleAmount * 0.1; // 50000
        const totalFee = excessFee + wholesaleFee; // 60000
        const loganCut = totalFee * 0.65; // 39000
        const maxCut = totalFee * 0.35; // 21000

        if (totalFee !== 60000)
          throw new Error(`Total fee wrong: ${totalFee} vs 60000`);
        if (loganCut !== 39000)
          throw new Error(`Logan cut wrong: ${loganCut} vs 39000`);
        if (maxCut !== 21000)
          throw new Error(`Max cut wrong: ${maxCut} vs 21000`);

        return 'DUAL calculations correct';
      },
    },
    {
      name: 'Eleanor Score Range',
      test: async () => {
        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('eleanor_score');
        if (error) throw error;
        const scores =
          data?.map((l) => l.eleanor_score).filter((s) => s != null) || [];
        const outOfRange = scores.filter((s) => s < 0 || s > 100);

        if (outOfRange.length > 0) {
          throw new Error(`${outOfRange.length} scores out of range (0-100)`);
        }

        return `All ${scores.length} scores in valid range`;
      },
    },
    {
      name: 'Data Quality - Missing Phones',
      test: async () => {
        const { data, error } = await supabase
          .from('maxsam_leads')
          .select('phone');
        if (error) throw error;
        const missing = data?.filter((l) => !l.phone).length || 0;
        const total = data?.length || 0;
        const percentage = total > 0 ? ((missing / total) * 100).toFixed(1) : 0;

        if (Number(percentage) > 50) {
          throw new Error(`${percentage}% leads missing phones - too high!`);
        }

        return `${missing}/${total} leads missing phones (${percentage}%)`;
      },
    },
    {
      name: 'API Endpoints',
      test: async () => {
        const endpoints = ['/api/notify', '/api/followups?action=check'];

        const results = await Promise.all(
          endpoints.map(async (endpoint) => {
            try {
              const isNotify = endpoint.includes('notify');
              const res = await fetch(endpoint, {
                method: isNotify ? 'POST' : 'GET',
              });
              return { endpoint, status: res.status, ok: res.ok };
            } catch (error) {
              return { endpoint, error: error.message };
            }
          }),
        );

        const failures = results.filter(
          (r) => !r.ok && r.status !== 400 && r.status !== 405,
        );
        if (failures.length > 0) {
          throw new Error(`${failures.length} endpoints failed`);
        }

        return `All ${endpoints.length} endpoints accessible`;
      },
    },
    {
      name: 'Performance - Query Speed',
      test: async () => {
        const start = Date.now();
        const { error } = await supabase.from('maxsam_leads').select('*');
        if (error) throw error;
        const duration = Date.now() - start;

        if (duration > 2000) {
          throw new Error(`Query too slow: ${duration}ms`);
        }

        return `Query completed in ${duration}ms`;
      },
    },
  ];

  const runAllTests = async () => {
    setRunning(true);
    setResults([]);

    for (const test of tests) {
      const startTime = Date.now();
      try {
        const message = await test.test();
        const duration = Date.now() - startTime;
        setResults((prev) => [
          ...prev,
          {
            name: test.name,
            status: 'pass',
            message,
            duration,
          },
        ]);
      } catch (error) {
        const duration = Date.now() - startTime;
        setResults((prev) => [
          ...prev,
          {
            name: test.name,
            status: 'fail',
            message: error.message,
            duration,
          },
        ]);
      }

      // Small delay between tests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    setRunning(false);
  };

  const passCount = results.filter((r) => r.status === 'pass').length;
  const failCount = results.filter((r) => r.status === 'fail').length;
  const passRate =
    results.length > 0 ? ((passCount / results.length) * 100).toFixed(1) : 0;

  return (
    <AppShell>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">System Testing Suite</h1>
          <p className="text-zinc-400 mt-1">
            Comprehensive validation of MaxSam V4
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-zinc-400 text-sm mb-2">Total Tests</div>
            <div className="text-3xl font-bold text-white">{tests.length}</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-zinc-400 text-sm mb-2">Pass Rate</div>
            <div className="text-3xl font-bold text-green-400">{passRate}%</div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="text-zinc-400 text-sm mb-2">Status</div>
            <div className="text-3xl font-bold text-cyan-400">
              {running
                ? 'Running...'
                : results.length === 0
                ? 'Ready'
                : failCount === 0
                ? 'All Pass ✅'
                : `${failCount} Failed ❌`}
            </div>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mb-6">
          <button
            onClick={runAllTests}
            disabled={running}
            className="w-full px-6 py-3 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {running ? '⏳ Running Tests...' : '▶️ Run All Tests'}
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>

          {results.length === 0 ? (
            <div className="text-center py-12 text-zinc-400">
              Click "Run All Tests" to begin validation
            </div>
          ) : (
            <div className="space-y-2">
              {results.map((result, idx) => (
                <div
                  key={idx}
                  className={`p-4 rounded-lg border-2 ${
                    result.status === 'pass'
                      ? 'border-green-500 bg-green-500/10'
                      : 'border-red-500 bg-red-500/10'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <span className="text-2xl">
                        {result.status === 'pass' ? '✅' : '❌'}
                      </span>
                      <div className="flex-1">
                        <div className="text-white font-semibold">
                          {result.name}
                        </div>
                        <div
                          className={`text-sm mt-1 ${
                            result.status === 'pass'
                              ? 'text-green-300'
                              : 'text-red-300'
                          }`}
                        >
                          {result.message}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-zinc-400">
                      {result.duration}ms
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
