'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function QuickActionsBar() {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);

  const handleImportLeads = () => {
    router.push('/import');
  };

  const handleRunSkipTrace = async () => {
    setLoading('skip-trace');
    try {
      const response = await fetch('https://skooki.app.n8n.cloud/webhook/skip-trace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_skip_trace',
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        alert('Skip trace initiated successfully!');
      } else {
        throw new Error('Failed to initiate skip trace');
      }
    } catch (error) {
      alert('Error initiating skip trace');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleSendBatchSMS = async () => {
    setLoading('batch-sms');
    try {
      const response = await fetch('https://skooki.app.n8n.cloud/webhook/sam-initial-outreach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'batch_outreach',
          timestamp: new Date().toISOString()
        })
      });
      
      if (response.ok) {
        alert('Batch SMS initiated successfully!');
      } else {
        throw new Error('Failed to initiate batch SMS');
      }
    } catch (error) {
      alert('Error initiating batch SMS');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleGenerateReport = () => {
    router.push('/reports');
  };

  const handleScanGoldenLeads = async () => {
    setLoading('golden-scan');
    try {
      const response = await fetch('https://skooki.app.n8n.cloud/webhook/zillow-scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'scan_golden_leads',
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        alert('Golden Lead scan initiated!');
      } else {
        throw new Error('Failed to initiate scan');
      }
    } catch (error) {
      alert('Error initiating Golden Lead scan');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleImportNow = async () => {
    setLoading('import-now');
    try {
      const response = await fetch('/api/cron/import-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual_trigger',
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Import complete: ${data.imported || 0} leads imported`);
      } else {
        throw new Error(data.error || 'Failed to import');
      }
    } catch (error) {
      alert('Error running import');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  const handleScoreAll = async () => {
    setLoading('score-all');
    try {
      const response = await fetch('/api/eleanor/score-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: 'manual_trigger',
          timestamp: new Date().toISOString()
        })
      });

      const data = await response.json();
      if (response.ok) {
        alert(`Scoring complete: ${data.scored || data.processed || 0} leads scored`);
      } else {
        throw new Error(data.error || 'Failed to score');
      }
    } catch (error) {
      alert('Error running scoring');
      console.error(error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="pharaoh-card">
      <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
        <span>⚡</span> Quick Actions
      </h3>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={handleImportLeads}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>📁</span>
          <span>{loading === 'import' ? 'Importing...' : 'Import Leads'}</span>
        </button>
        
        <button
          onClick={handleRunSkipTrace}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>🔍</span>
          <span>{loading === 'skip-trace' ? 'Running...' : 'Run Skip Trace'}</span>
        </button>
        
        <button
          onClick={handleSendBatchSMS}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>💬</span>
          <span>{loading === 'batch-sms' ? 'Sending...' : 'Send Batch SMS'}</span>
        </button>
        
        <button
          onClick={handleGenerateReport}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>📊</span>
          <span>{loading === 'report' ? 'Generating...' : 'Generate Report'}</span>
        </button>

        <button
          onClick={handleScanGoldenLeads}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>🏆</span>
          <span>{loading === 'golden-scan' ? 'Scanning...' : 'Scan Golden Leads'}</span>
        </button>

        <button
          onClick={handleImportNow}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>📥</span>
          <span>{loading === 'import-now' ? 'Importing...' : 'Import Now'}</span>
        </button>

        <button
          onClick={handleScoreAll}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-pink-600 hover:bg-pink-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          disabled={loading !== null}
        >
          <span>🎯</span>
          <span>{loading === 'score-all' ? 'Scoring...' : 'Score All'}</span>
        </button>
      </div>
    </div>
  );
}
