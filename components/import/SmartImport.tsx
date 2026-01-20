'use client';

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/components/Toast';

// ============================================================================
// TYPES
// ============================================================================

type ImportMode = 'pdf' | 'csv' | 'url';

interface ImportResult {
  success: boolean;
  message: string;
  imported?: number;
  skipped?: number;
  total?: number;
  grades?: Record<string, number>;
  errors?: string[];
  leads?: Array<{
    owner_name: string;
    property_address: string;
    excess_funds_amount: number;
  }>;
}

interface County {
  id: string;
  name: string;
  state: string;
  sourceUrl?: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COUNTIES: County[] = [
  { id: 'dallas', name: 'Dallas County', state: 'TX', sourceUrl: 'https://www.dallascounty.org/departments/treasurer/excess-proceeds.php' },
  { id: 'tarrant', name: 'Tarrant County', state: 'TX', sourceUrl: 'https://www.tarrantcounty.com/en/tax/surplus-funds.html' },
  { id: 'collin', name: 'Collin County', state: 'TX', sourceUrl: 'https://www.collincountytx.gov/' },
  { id: 'denton', name: 'Denton County', state: 'TX', sourceUrl: 'https://www.dentoncounty.gov/' },
  { id: 'harris', name: 'Harris County', state: 'TX', sourceUrl: 'https://www.hctax.net/' },
  { id: 'bexar', name: 'Bexar County', state: 'TX', sourceUrl: 'https://www.bexar.org/' },
  { id: 'travis', name: 'Travis County', state: 'TX', sourceUrl: 'https://www.traviscountytx.gov/' },
  { id: 'el_paso', name: 'El Paso County', state: 'TX' },
  { id: 'hidalgo', name: 'Hidalgo County', state: 'TX' },
  { id: 'fort_bend', name: 'Fort Bend County', state: 'TX' },
  { id: 'other', name: 'Other', state: '' },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];

  // Parse header
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  // Parse rows
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header.trim()] = values[index]?.trim() || '';
    });

    rows.push(row);
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ============================================================================
// TAB BUTTON COMPONENT
// ============================================================================

function TabButton({
  active,
  onClick,
  icon,
  label,
  description,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 p-4 rounded-xl border-2 transition-all text-left ${
        active
          ? 'bg-cyan-500/10 border-cyan-500 text-white'
          : 'bg-zinc-900/50 border-zinc-800 text-zinc-400 hover:border-zinc-600'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
          active ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-500'
        }`}>
          {icon}
        </div>
        <div>
          <div className="font-semibold">{label}</div>
          <div className="text-xs text-zinc-500">{description}</div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// COUNTY SELECTOR
// ============================================================================

function CountySelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (county: string) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-zinc-300">County Source</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
      >
        <option value="">Select a county...</option>
        {COUNTIES.map((county) => (
          <option key={county.id} value={county.id}>
            {county.name}{county.state ? `, ${county.state}` : ''}
          </option>
        ))}
      </select>
      <p className="text-xs text-zinc-500">
        This will be saved with imported leads for tracking
      </p>
    </div>
  );
}

// ============================================================================
// PDF UPLOAD SECTION
// ============================================================================

function PDFUploadSection({
  county,
  onResult,
}: {
  county: string;
  onResult: (result: ImportResult) => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const { addToast } = useToast();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFiles = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    if (droppedFiles.length > 0) {
      setFiles((prev) => [...prev, ...droppedFiles]);
    } else {
      addToast('error', 'Please upload PDF files only');
    }
  }, [addToast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const processFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    setProgress(5);
    setProgressMessage('Preparing files...');

    try {
      const filePromises = files.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        return { name: file.name, type: file.type, size: file.size, data: base64 };
      });

      setProgress(20);
      setProgressMessage('Encoding PDF files...');
      const fileData = await Promise.all(filePromises);

      setProgress(40);
      setProgressMessage('Sending to ALEX PDF Processor...');

      const countyData = COUNTIES.find((c) => c.id === county);

      const res = await fetch('https://skooki.app.n8n.cloud/webhook/pdf-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: fileData,
          source: `pdf_import_${county || 'unknown'}`,
          county: countyData?.name || county || 'Unknown',
          document_type: 'excess_funds',
          timestamp: new Date().toISOString(),
        }),
      });

      setProgress(70);
      setProgressMessage('Processing PDF content...');

      const data = await res.json();

      setProgress(90);
      setProgressMessage('Extracting lead data...');
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProgress(100);
      setProgressMessage('Complete!');

      if (res.ok) {
        const leadsCount = data.leads_extracted || data.count || data.leads?.length || 0;
        onResult({
          success: true,
          message: `Extracted ${leadsCount} leads from ${files.length} PDF(s)`,
          imported: leadsCount,
          total: files.length,
        });
        addToast('success', `ALEX extracted ${leadsCount} leads`);
        setFiles([]);
      } else {
        onResult({
          success: false,
          message: data.error || 'PDF processing failed',
        });
        addToast('error', data.error || 'PDF processing failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      onResult({
        success: false,
        message: 'Network error - could not reach ALEX',
      });
      addToast('error', 'Network error - upload failed');
    } finally {
      setUploading(false);
      setProgress(0);
      setProgressMessage('');
    }
  };

  return (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => !uploading && document.getElementById('pdf-upload')?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer relative ${
          dragActive
            ? 'border-cyan-400 bg-cyan-900/20'
            : 'border-zinc-700 hover:border-cyan-500/50 hover:bg-zinc-800/30'
        } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          type="file"
          id="pdf-upload"
          className="hidden"
          multiple
          accept=".pdf,application/pdf"
          onChange={handleFileSelect}
          disabled={uploading}
        />

        <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${
          dragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400'
        }`}>
          <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z"/>
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-white mb-1">
          {dragActive ? 'Drop PDFs here' : 'Drag & Drop PDFs'}
        </h3>
        <p className="text-zinc-500 text-sm">or click to browse</p>
      </div>

      {files.length > 0 && !uploading && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-zinc-300">
            Selected Files ({files.length})
          </h4>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-red-500/20 rounded flex items-center justify-center">
                    <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-zinc-200 truncate max-w-[200px]">{file.name}</p>
                    <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(index); }}
                  className="p-1 hover:bg-zinc-700 rounded"
                >
                  <svg className="w-4 h-4 text-zinc-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={processFiles}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all"
          >
            Process {files.length} PDF{files.length > 1 ? 's' : ''} with ALEX
          </button>
        </div>
      )}

      {uploading && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">{progressMessage}</span>
            <span className="text-cyan-400 font-mono">{progress}%</span>
          </div>
          <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
            <div
              className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// CSV UPLOAD SECTION
// ============================================================================

function CSVUploadSection({
  county,
  onResult,
}: {
  county: string;
  onResult: (result: ImportResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Record<string, string>[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { addToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFile(droppedFile);
    } else {
      addToast('error', 'Please upload a CSV file');
    }
  }, [addToast]);

  const handleFile = async (selectedFile: File) => {
    setFile(selectedFile);
    const text = await selectedFile.text();
    const rows = parseCSV(text);
    setPreview(rows.slice(0, 5)); // Preview first 5 rows
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      handleFile(e.target.files[0]);
    }
  }, []);

  const processCSV = async () => {
    if (!file) return;

    setUploading(true);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        addToast('error', 'No data found in CSV');
        onResult({ success: false, message: 'No data found in CSV' });
        setUploading(false);
        return;
      }

      const res = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: rows,
          county: county || null,
          source: `csv_import_${county || 'manual'}`,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        onResult({
          success: true,
          message: data.message,
          imported: data.imported,
          skipped: data.skipped,
          total: data.total,
          grades: data.grades,
        });
        addToast('success', `Imported ${data.imported} leads from CSV`);
        setFile(null);
        setPreview(null);
      } else {
        onResult({
          success: false,
          message: data.error || 'CSV import failed',
          errors: data.errors,
        });
        addToast('error', data.error || 'CSV import failed');
      }
    } catch (error) {
      console.error('CSV import error:', error);
      onResult({ success: false, message: 'Failed to process CSV file' });
      addToast('error', 'Failed to process CSV');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {!file && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            dragActive
              ? 'border-green-400 bg-green-900/20'
              : 'border-zinc-700 hover:border-green-500/50 hover:bg-zinc-800/30'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".csv,text/csv"
            onChange={handleFileSelect}
          />

          <div className={`inline-flex items-center justify-center w-14 h-14 rounded-full mb-3 ${
            dragActive ? 'bg-green-500/20 text-green-400' : 'bg-zinc-800 text-zinc-400'
          }`}>
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <h3 className="text-lg font-semibold text-white mb-1">
            {dragActive ? 'Drop CSV here' : 'Upload CSV File'}
          </h3>
          <p className="text-zinc-500 text-sm">or click to browse</p>
        </div>
      )}

      {file && preview && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-medium">{file.name}</p>
                <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
              </div>
            </div>
            <button
              onClick={() => { setFile(null); setPreview(null); }}
              className="p-2 hover:bg-zinc-700 rounded-lg text-zinc-400 hover:text-red-400"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-2">Preview (first 5 rows)</h4>
            <div className="overflow-x-auto bg-zinc-900 rounded-lg border border-zinc-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800">
                    {Object.keys(preview[0] || {}).slice(0, 5).map((key) => (
                      <th key={key} className="px-3 py-2 text-left text-zinc-400 font-medium">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      {Object.values(row).slice(0, 5).map((val, j) => (
                        <td key={j} className="px-3 py-2 text-zinc-300 truncate max-w-[150px]">
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            onClick={processCSV}
            disabled={uploading}
            className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {uploading ? 'Importing...' : 'Import CSV to Database'}
          </button>
        </div>
      )}

      <div className="p-3 bg-zinc-800/50 rounded-lg">
        <h4 className="text-xs font-medium text-zinc-400 mb-2">Expected Columns:</h4>
        <div className="flex flex-wrap gap-2">
          {['owner_name', 'property_address', 'excess_funds_amount', 'city', 'state', 'zip_code'].map((col) => (
            <span key={col} className="text-[10px] px-2 py-1 bg-zinc-700 text-zinc-300 rounded">
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// URL SCRAPE SECTION
// ============================================================================

function URLScrapeSection({
  county,
  onResult,
}: {
  county: string;
  onResult: (result: ImportResult) => void;
}) {
  const [url, setUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const { addToast } = useToast();

  // Auto-fill URL when county is selected
  const countyData = COUNTIES.find((c) => c.id === county);

  const handleScrape = async () => {
    if (!url.trim()) {
      addToast('error', 'Please enter a URL');
      return;
    }

    setScraping(true);

    try {
      // First scrape the URL
      const scrapeRes = await fetch('/api/import/scrape-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });

      const scrapeData = await scrapeRes.json();

      if (!scrapeRes.ok || !scrapeData.success) {
        onResult({
          success: false,
          message: scrapeData.error || 'Failed to scrape URL',
        });
        addToast('error', scrapeData.error || 'Scrape failed');
        setScraping(false);
        return;
      }

      if (!scrapeData.leads || scrapeData.leads.length === 0) {
        onResult({
          success: false,
          message: 'No leads found on this page',
        });
        addToast('warning', 'No leads found');
        setScraping(false);
        return;
      }

      // Now import the scraped leads
      const importRes = await fetch('/api/import/csv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leads: scrapeData.leads,
          county: county || null,
          source: `url_scrape_${county || 'unknown'}`,
        }),
      });

      const importData = await importRes.json();

      if (importRes.ok && importData.success) {
        onResult({
          success: true,
          message: `Scraped and imported ${importData.imported} leads`,
          imported: importData.imported,
          total: scrapeData.leads.length,
          grades: importData.grades,
        });
        addToast('success', `Imported ${importData.imported} leads from URL`);
        setUrl('');
      } else {
        onResult({
          success: false,
          message: importData.error || 'Failed to import scraped leads',
        });
        addToast('error', 'Import failed');
      }
    } catch (error) {
      console.error('URL scrape error:', error);
      onResult({ success: false, message: 'Network error' });
      addToast('error', 'Network error');
    } finally {
      setScraping(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-sm font-medium text-zinc-300">County Website URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://county.gov/excess-funds"
            className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500 transition-colors"
          />
          <button
            onClick={handleScrape}
            disabled={scraping || !url.trim()}
            className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white font-semibold rounded-lg transition-all disabled:opacity-50"
          >
            {scraping ? 'Scraping...' : 'Scrape'}
          </button>
        </div>
      </div>

      {countyData?.sourceUrl && (
        <button
          onClick={() => setUrl(countyData.sourceUrl!)}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Use {countyData.name} default URL
        </button>
      )}

      {scraping && (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="animate-spin w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full" />
          <span className="text-zinc-400">ALEX is scraping and extracting data...</span>
        </div>
      )}

      <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
        <div className="flex items-start gap-2">
          <svg className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-purple-200">
            <p className="font-medium">How URL Scraping Works</p>
            <p className="text-purple-300/70 mt-1">
              ALEX uses AI to extract property owner names, addresses, and excess fund amounts from county websites.
              Works best with official government surplus/excess funds pages.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// RESULT DISPLAY
// ============================================================================

function ResultDisplay({
  result,
  onReset,
}: {
  result: ImportResult;
  onReset: () => void;
}) {
  return (
    <div className={`rounded-xl p-6 ${
      result.success
        ? 'bg-green-500/10 border border-green-500/30'
        : 'bg-red-500/10 border border-red-500/30'
    }`}>
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
          result.success ? 'bg-green-500/20' : 'bg-red-500/20'
        }`}>
          {result.success ? (
            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <h3 className={`text-lg font-semibold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
            {result.success ? 'Import Complete' : 'Import Failed'}
          </h3>
          <p className="text-zinc-300 mt-1">{result.message}</p>

          {result.success && result.imported !== undefined && (
            <div className="mt-4 grid grid-cols-3 gap-4">
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-cyan-400">{result.imported}</p>
                <p className="text-xs text-zinc-500">Imported</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-yellow-400">{result.skipped || 0}</p>
                <p className="text-xs text-zinc-500">Skipped</p>
              </div>
              <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                <p className="text-2xl font-bold text-purple-400">{result.total || result.imported}</p>
                <p className="text-xs text-zinc-500">Total</p>
              </div>
            </div>
          )}

          {result.grades && (
            <div className="mt-4">
              <h4 className="text-xs font-medium text-zinc-400 mb-2">Grade Distribution</h4>
              <div className="flex gap-2">
                {Object.entries(result.grades).map(([grade, count]) => (
                  count > 0 && (
                    <span key={grade} className={`text-xs px-2 py-1 rounded ${
                      grade === 'A+' || grade === 'A' ? 'bg-green-500/20 text-green-400' :
                      grade === 'B' ? 'bg-blue-500/20 text-blue-400' :
                      grade === 'C' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-zinc-700 text-zinc-400'
                    }`}>
                      {grade}: {count}
                    </span>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <button
          onClick={onReset}
          className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          Import More
        </button>
        {result.success && (
          <a
            href="/leads"
            className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-center"
          >
            View Leads
          </a>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// MAIN SMART IMPORT COMPONENT
// ============================================================================

export default function SmartImport() {
  const [mode, setMode] = useState<ImportMode>('pdf');
  const [county, setCounty] = useState('dallas');
  const [result, setResult] = useState<ImportResult | null>(null);

  const handleResult = (importResult: ImportResult) => {
    setResult(importResult);
  };

  const resetResult = () => {
    setResult(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Smart Import</h1>
        <p className="text-gray-400 text-sm mt-1">
          Import leads from PDFs, CSV files, or scrape directly from county websites
        </p>
      </div>

      {/* Import Mode Tabs */}
      <div className="flex gap-3">
        <TabButton
          active={mode === 'pdf'}
          onClick={() => { setMode('pdf'); resetResult(); }}
          icon={
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4z"/>
            </svg>
          }
          label="PDF Upload"
          description="Extract via ALEX"
        />
        <TabButton
          active={mode === 'csv'}
          onClick={() => { setMode('csv'); resetResult(); }}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          }
          label="CSV Import"
          description="Direct database import"
        />
        <TabButton
          active={mode === 'url'}
          onClick={() => { setMode('url'); resetResult(); }}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
          label="URL Scrape"
          description="ALEX extracts from web"
        />
      </div>

      {/* Main Import Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        {/* County Selector - Always visible */}
        <div className="mb-6">
          <CountySelector value={county} onChange={setCounty} />
        </div>

        <div className="border-t border-zinc-800 pt-6">
          {result ? (
            <ResultDisplay result={result} onReset={resetResult} />
          ) : (
            <>
              {mode === 'pdf' && <PDFUploadSection county={county} onResult={handleResult} />}
              {mode === 'csv' && <CSVUploadSection county={county} onResult={handleResult} />}
              {mode === 'url' && <URLScrapeSection county={county} onResult={handleResult} />}
            </>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">How it works</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-cyan-400 font-bold">1</span>
            </div>
            <div>
              <h4 className="font-medium text-zinc-200">Choose Method</h4>
              <p className="text-sm text-zinc-500 mt-1">
                Upload PDFs, CSV files, or paste a county website URL
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-cyan-400 font-bold">2</span>
            </div>
            <div>
              <h4 className="font-medium text-zinc-200">ALEX Processes</h4>
              <p className="text-sm text-zinc-500 mt-1">
                AI extracts owner names, addresses, and excess amounts
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-cyan-400 font-bold">3</span>
            </div>
            <div>
              <h4 className="font-medium text-zinc-200">Eleanor Scores</h4>
              <p className="text-sm text-zinc-500 mt-1">
                Leads are automatically scored and graded A+ through D
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
