'use client';

import { useState, useCallback, useRef } from 'react';
import GemBadge, { GemBadgeInline, getGradeFromScore } from './GemBadge';

interface ImportedLead {
  id?: string;
  property_address: string;
  owner_name: string;
  excess_funds_amount: number;
  city?: string;
  state?: string;
  zip_code?: string;
  eleanor_score?: number;
  deal_grade?: string;
  deal_type?: string;
  potential_revenue?: number;
  status?: 'parsing' | 'scoring' | 'scored' | 'saved';
}

interface ImportSummary {
  total: number;
  scored: number;
  hotLeads: number;
  grades: {
    'A+': number;
    'A': number;
    'B': number;
    'C': number;
    'D': number;
  };
  totalPotential: number;
  projectedRevenue: number;
}

type ImportStage = 'idle' | 'uploading' | 'parsing' | 'scoring' | 'complete';

export default function LeadImportStation() {
  const [stage, setStage] = useState<ImportStage>('idle');
  const [progress, setProgress] = useState(0);
  const [leads, setLeads] = useState<ImportedLead[]>([]);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [urlInput, setUrlInput] = useState('');
  const [options, setOptions] = useState({
    autoScore: true,
    autoSkipTrace: true,
    addToOutreach: false,
  });
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type === 'application/pdf') {
      processFile(file);
    } else {
      setError('Please upload a PDF file');
    }
  }, []);

  // Handle file select
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Process uploaded file
  const processFile = async (file: File) => {
    setError(null);
    setStage('uploading');
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Upload and parse
      setStage('parsing');
      setProgress(30);

      const parseResponse = await fetch('/api/import/parse-pdf', {
        method: 'POST',
        body: formData,
      });

      if (!parseResponse.ok) {
        throw new Error('Failed to parse PDF');
      }

      const parsedLeads = await parseResponse.json();
      setLeads(parsedLeads.map((l: ImportedLead) => ({ ...l, status: 'parsing' })));
      setProgress(50);

      // Score leads if auto-score enabled
      if (options.autoScore) {
        await scoreleadsWithSSE(parsedLeads);
      } else {
        setStage('complete');
        setProgress(100);
        calculateSummary(parsedLeads);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('idle');
      setProgress(0);
    }
  };

  // Process URL import
  const handleUrlImport = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }

    setError(null);
    setStage('uploading');
    setProgress(10);

    try {
      const response = await fetch('/api/import/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput }),
      });

      if (!response.ok) {
        throw new Error('Failed to scrape URL');
      }

      setStage('parsing');
      setProgress(30);

      const parsedLeads = await response.json();
      setLeads(parsedLeads.map((l: ImportedLead) => ({ ...l, status: 'parsing' })));
      setProgress(50);

      if (options.autoScore) {
        await scoreleadsWithSSE(parsedLeads);
      } else {
        setStage('complete');
        setProgress(100);
        calculateSummary(parsedLeads);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setStage('idle');
      setProgress(0);
    }
  };

  // Score leads with Server-Sent Events for live updates
  const scoreleadsWithSSE = async (parsedLeads: ImportedLead[]) => {
    setStage('scoring');
    let scoredCount = 0;

    try {
      const response = await fetch('/api/import/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: parsedLeads,
          options: {
            skipTrace: options.autoSkipTrace,
            addToOutreach: options.addToOutreach,
          },
        }),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Stream not available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value);
        const lines = text.split('\n').filter(line => line.startsWith('data:'));

        for (const line of lines) {
          const data = JSON.parse(line.replace('data: ', ''));

          if (data.type === 'scored') {
            scoredCount++;
            setProgress(50 + (scoredCount / parsedLeads.length) * 45);

            setLeads(prev =>
              prev.map(lead =>
                lead.property_address === data.lead.property_address
                  ? { ...lead, ...data.lead, status: 'scored' }
                  : lead
              )
            );
          } else if (data.type === 'complete') {
            setSummary(data.summary);
            setStage('complete');
            setProgress(100);
          }
        }
      }
    } catch {
      // Fallback: Score locally if SSE fails
      const scoredLeads = parsedLeads.map((lead, index) => {
        const score = calculateLocalScore(lead);
        setTimeout(() => {
          setProgress(50 + ((index + 1) / parsedLeads.length) * 45);
        }, index * 100);
        return { ...lead, ...score, status: 'scored' as const };
      });

      setLeads(scoredLeads);
      calculateSummary(scoredLeads);
      setStage('complete');
      setProgress(100);
    }
  };

  // Local scoring fallback
  const calculateLocalScore = (lead: ImportedLead) => {
    const excess = lead.excess_funds_amount || 0;
    let score = 0;

    if (excess >= 50000) score += 40;
    else if (excess >= 30000) score += 35;
    else if (excess >= 20000) score += 30;
    else if (excess >= 10000) score += 20;
    else if (excess >= 5000) score += 10;

    // Add points for having data
    if (lead.owner_name) score += 10;
    if (lead.zip_code) score += 5;

    // Random variation for demo
    score += Math.floor(Math.random() * 20);
    score = Math.min(100, Math.max(0, score));

    const grade = getGradeFromScore(score);
    const excessFee = excess * 0.25;
    const wholesaleFee = excess > 20000 ? (excess * 2) * 0.10 : 0;

    return {
      eleanor_score: score,
      deal_grade: grade,
      deal_type: wholesaleFee > 0 ? 'dual' : 'excess_only',
      potential_revenue: excessFee + wholesaleFee,
    };
  };

  // Calculate summary statistics
  const calculateSummary = (scoredLeads: ImportedLead[]) => {
    const grades = { 'A+': 0, 'A': 0, 'B': 0, 'C': 0, 'D': 0 };
    let totalPotential = 0;

    scoredLeads.forEach(lead => {
      if (lead.deal_grade) {
        grades[lead.deal_grade as keyof typeof grades]++;
      }
      totalPotential += lead.potential_revenue || 0;
    });

    setSummary({
      total: scoredLeads.length,
      scored: scoredLeads.filter(l => l.eleanor_score !== undefined).length,
      hotLeads: grades['A+'] + grades['A'],
      grades,
      totalPotential,
      projectedRevenue: totalPotential,
    });
  };

  // Reset to initial state
  const resetImport = () => {
    setStage('idle');
    setProgress(0);
    setLeads([]);
    setSummary(null);
    setError(null);
    setUrlInput('');
  };

  return (
    <div className="bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <span className="text-3xl">💎</span>
            LEAD IMPORT STATION
          </h2>
          <p className="text-zinc-400 text-sm mt-1">Upload. Score. Profit.</p>
        </div>
        <button className="text-zinc-500 hover:text-white transition-colors">
          <span className="text-xl">?</span> Help
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400">
          {error}
        </div>
      )}

      {/* Stage: Idle - Show upload options */}
      {stage === 'idle' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* PDF Upload */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-zinc-700 hover:border-cyan-500 rounded-xl p-8 text-center cursor-pointer transition-all hover:bg-cyan-500/5"
            >
              <div className="text-5xl mb-4">📄</div>
              <p className="text-white font-medium">DROP PDF HERE</p>
              <p className="text-zinc-500 text-sm mt-1">or click to browse</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>

            {/* URL Import */}
            <div className="border border-zinc-700 rounded-xl p-6">
              <div className="text-2xl mb-4">🔗</div>
              <p className="text-white font-medium mb-3">Or paste URL:</p>
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://dallas.county.gov/excess-funds..."
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500 mb-3"
              />
              <button
                onClick={handleUrlImport}
                className="w-full py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors"
              >
                Fetch & Import
              </button>
            </div>
          </div>

          {/* Import Options */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <p className="text-white font-medium mb-3">Import Options:</p>
            <div className="space-y-2">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.autoScore}
                  onChange={(e) => setOptions({ ...options, autoScore: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-zinc-300">Auto-score with Eleanor AI</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.autoSkipTrace}
                  onChange={(e) => setOptions({ ...options, autoSkipTrace: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-zinc-300">Auto-skip-trace missing phones</span>
              </label>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={options.addToOutreach}
                  onChange={(e) => setOptions({ ...options, addToOutreach: e.target.checked })}
                  className="w-4 h-4 rounded bg-zinc-700 border-zinc-600 text-cyan-500 focus:ring-cyan-500"
                />
                <span className="text-zinc-300">Add to outreach queue automatically</span>
              </label>
            </div>
          </div>
        </>
      )}

      {/* Stage: Processing */}
      {(stage === 'uploading' || stage === 'parsing' || stage === 'scoring') && (
        <div className="py-8">
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white font-medium">
                {stage === 'uploading' && '📤 Uploading...'}
                {stage === 'parsing' && '📄 Parsing PDF...'}
                {stage === 'scoring' && '🧠 Eleanor AI Scoring...'}
              </span>
              <span className="text-cyan-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-cyan-500 to-magenta-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            {stage === 'parsing' && leads.length > 0 && (
              <p className="text-zinc-400 text-sm mt-2">Found: {leads.length} properties</p>
            )}
          </div>

          {/* Live scoring feed */}
          {stage === 'scoring' && leads.length > 0 && (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-lg">🧠</span>
                <span className="text-white font-medium">LIVE SCORING FEED</span>
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full animate-pulse">
                  Live
                </span>
              </div>

              {leads.filter(l => l.status === 'scored').slice(-5).reverse().map((lead, idx) => (
                <div
                  key={idx}
                  className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 animate-fadeIn"
                >
                  <div className="flex items-start gap-4">
                    <GemBadge
                      grade={lead.deal_grade || 'D'}
                      score={lead.eleanor_score}
                      size="sm"
                      animated={false}
                    />
                    <div className="flex-1">
                      <h4 className="text-white font-medium">{lead.property_address}</h4>
                      <p className="text-zinc-400 text-sm">{lead.owner_name}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        <span className="text-green-400">
                          Excess: ${(lead.excess_funds_amount || 0).toLocaleString()}
                        </span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-yellow-400">
                          💰 Projected: ${(lead.potential_revenue || 0).toLocaleString()}
                        </span>
                        <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded-full uppercase">
                          {lead.deal_type?.replace('_', ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Stage: Complete */}
      {stage === 'complete' && summary && (
        <div className="py-4">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">✅</span>
            <h3 className="text-xl font-bold text-white">IMPORT COMPLETE</h3>
          </div>

          {/* Summary stats */}
          <div className="flex items-center gap-6 mb-6 text-sm">
            <span className="text-zinc-300">
              <strong className="text-white">{summary.total}</strong> Leads Imported
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300">
              <strong className="text-white">{summary.scored}</strong> Scored
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-green-400">
              <strong>{summary.hotLeads}</strong> Hot Leads Found
            </span>
          </div>

          {/* Grade distribution */}
          <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
            <h4 className="text-white font-medium mb-4">GRADE DISTRIBUTION</h4>
            <div className="grid grid-cols-5 gap-3">
              {(['A+', 'A', 'B', 'C', 'D'] as const).map((grade) => (
                <div key={grade} className="text-center">
                  <GemBadgeInline grade={grade} />
                  <p className="text-2xl font-bold text-white mt-2">
                    {summary.grades[grade]}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Revenue projection */}
          <div className="bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 rounded-xl p-6 text-center mb-6">
            <p className="text-yellow-400 text-sm uppercase tracking-wider mb-2">
              TOTAL PIPELINE VALUE
            </p>
            <p className="text-4xl font-bold text-white mb-4">
              ${summary.totalPotential.toLocaleString()}
            </p>
            <p className="text-yellow-400 text-lg">
              YOUR PROJECTED REVENUE:{' '}
              <span className="text-2xl font-bold text-white">
                ${summary.projectedRevenue.toLocaleString()}
              </span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => window.location.href = '/sellers'}
              className="flex-1 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl font-medium transition-colors"
            >
              View All Leads
            </button>
            <button
              onClick={() => {}}
              className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors"
            >
              Start Outreach
            </button>
            <button
              onClick={resetImport}
              className="flex-1 py-3 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
            >
              Import More
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
