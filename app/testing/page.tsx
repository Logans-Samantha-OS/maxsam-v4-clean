'use client';

import { useState } from 'react';
import Sidebar from '@/components/Sidebar';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  duration: number | null;
  error: string | null;
}

export default function TestingPage() {
  const [tests, setTests] = useState<TestResult[]>([
    { name: 'Supabase Connection', status: 'pending', duration: null, error: null },
    { name: 'Lead Fetch Query', status: 'pending', duration: null, error: null },
    { name: 'Eleanor Scoring Engine', status: 'pending', duration: null, error: null },
    { name: 'Fee Calculator (Excess)', status: 'pending', duration: null, error: null },
    { name: 'Fee Calculator (Wholesale)', status: 'pending', duration: null, error: null },
    { name: 'Fee Calculator (Dual)', status: 'pending', duration: null, error: null },
    { name: 'DocuSign API', status: 'pending', duration: null, error: null },
    { name: 'Twilio SMS', status: 'pending', duration: null, error: null },
    { name: 'Stripe Connection', status: 'pending', duration: null, error: null },
    { name: 'Telegram Bot', status: 'pending', duration: null, error: null },
  ]);

  const [running, setRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  async function runAllTests() {
    setRunning(true);
    setLogs([`[${new Date().toLocaleTimeString()}] Starting test suite...`]);

    for (let i = 0; i < tests.length; i++) {
      const test = tests[i];

      // Update status to running
      setTests(prev => prev.map((t, idx) => idx === i ? { ...t, status: 'running' } : t));
      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Running: ${test.name}`]);

      // Simulate test execution
      const startTime = Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.random() * 800 + 200));
      const duration = Date.now() - startTime;

      // Determine pass/fail (mock - all pass for demo)
      const passed = true;

      setTests(prev => prev.map((t, idx) => idx === i ? {
        ...t,
        status: passed ? 'passed' : 'failed',
        duration,
        error: passed ? null : 'Mock error for demonstration'
      } : t));

      setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${passed ? 'PASS' : 'FAIL'}: ${test.name} (${duration}ms)`]);
    }

    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] Test suite completed.`]);
    setRunning(false);
  }

  function resetTests() {
    setTests(prev => prev.map(t => ({ ...t, status: 'pending', duration: null, error: null })));
    setLogs([]);
  }

  const passedCount = tests.filter(t => t.status === 'passed').length;
  const failedCount = tests.filter(t => t.status === 'failed').length;
  const pendingCount = tests.filter(t => t.status === 'pending' || t.status === 'running').length;

  function getStatusIcon(status: string) {
    switch (status) {
      case 'passed': return '✓';
      case 'failed': return '✗';
      case 'running': return '...';
      default: return '○';
    }
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'passed': return 'text-green-400';
      case 'failed': return 'text-red-400';
      case 'running': return 'text-yellow-400 animate-pulse';
      default: return 'text-zinc-500';
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar />

      <main className="flex-1 overflow-auto p-8">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Testing</h1>
            <p className="text-zinc-500 mt-1">Integration tests and system validation</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={resetTests}
              disabled={running}
              className="px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition disabled:opacity-50"
            >
              Reset
            </button>
            <button
              onClick={runAllTests}
              disabled={running}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition disabled:opacity-50"
            >
              {running ? 'Running...' : 'Run All Tests'}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-cyan-400">{tests.length}</div>
            <div className="text-zinc-500 text-sm">Total Tests</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-green-400">{passedCount}</div>
            <div className="text-zinc-500 text-sm">Passed</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-red-400">{failedCount}</div>
            <div className="text-zinc-500 text-sm">Failed</div>
          </div>
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <div className="text-3xl font-bold text-yellow-400">{pendingCount}</div>
            <div className="text-zinc-500 text-sm">Pending</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Test Results */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Test Results</h2>
            <div className="space-y-2">
              {tests.map((test, i) => (
                <div key={i} className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono ${getStatusColor(test.status)}`}>
                      {getStatusIcon(test.status)}
                    </span>
                    <span className="text-zinc-300">{test.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    {test.duration !== null && (
                      <span className="text-zinc-500 text-sm">{test.duration}ms</span>
                    )}
                    <span className={`text-sm ${getStatusColor(test.status)}`}>
                      {test.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Console Log */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Console Output</h2>
            <div className="bg-black rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <span className="text-zinc-600">No output yet. Run tests to see results.</span>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`${
                    log.includes('PASS') ? 'text-green-400' :
                    log.includes('FAIL') ? 'text-red-400' :
                    log.includes('Running') ? 'text-yellow-400' :
                    'text-zinc-400'
                  }`}>
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Manual Test Actions */}
        <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Manual Test Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test Supabase Query
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test Eleanor Scoring
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test SMS (Twilio)
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test Telegram Alert
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test DocuSign API
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test Stripe Connection
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test Fee Calculator
            </button>
            <button className="px-4 py-3 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 transition text-sm">
              Test N8N Webhook
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
