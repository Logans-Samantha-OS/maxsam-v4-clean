'use client';

import { useState, useCallback } from 'react';
import { useToast } from '@/components/Toast';

interface UploadResult {
  success: boolean;
  leadsExtracted: number;
  message: string;
  details?: {
    filename: string;
    leads: number;
    status: string;
  }[];
}

export default function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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

    const files = Array.from(e.dataTransfer.files).filter(
      (file) => file.type === 'application/pdf'
    );

    if (files.length > 0) {
      setSelectedFiles((prev) => [...prev, ...files]);
    } else {
      addToast('error', 'Please upload PDF files only');
    }
  }, [addToast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
  }, []);

  const removeFile = useCallback((index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const processFiles = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setProgress(5);
    setProgressMessage('Preparing files for upload...');
    setResult(null);

    try {
      // Convert files to base64
      const filePromises = selectedFiles.map(async (file) => {
        const buffer = await file.arrayBuffer();
        const base64 = btoa(
          new Uint8Array(buffer).reduce(
            (data, byte) => data + String.fromCharCode(byte),
            ''
          )
        );
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          data: base64,
        };
      });

      setProgress(20);
      setProgressMessage('Encoding PDF files...');
      const fileData = await Promise.all(filePromises);

      setProgress(40);
      setProgressMessage('Sending to ALEX PDF Processor...');

      // Send to ALEX PDF Processor workflow
      const res = await fetch('https://skooki.app.n8n.cloud/webhook/pdf-processor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: fileData,
          source: 'dashboard_upload_page',
          county: 'Dallas',
          document_type: 'excess_funds',
          timestamp: new Date().toISOString(),
        }),
      });

      setProgress(70);
      setProgressMessage('Processing PDF content...');

      const data = await res.json();

      setProgress(90);
      setProgressMessage('Extracting lead data...');

      // Simulate extraction progress
      await new Promise((resolve) => setTimeout(resolve, 500));

      setProgress(100);
      setProgressMessage('Complete!');

      if (res.ok) {
        const leadsCount = data.leads_extracted || data.count || data.leads?.length || 0;
        setResult({
          success: true,
          leadsExtracted: leadsCount,
          message: `Successfully extracted ${leadsCount} leads from ${selectedFiles.length} PDF(s)`,
          details: data.details || selectedFiles.map((f) => ({
            filename: f.name,
            leads: Math.floor(leadsCount / selectedFiles.length),
            status: 'processed',
          })),
        });
        addToast('success', `ALEX extracted ${leadsCount} leads from ${selectedFiles.length} PDF(s)`);
        setSelectedFiles([]);
      } else {
        setResult({
          success: false,
          leadsExtracted: 0,
          message: data.error || data.message || 'Processing failed',
        });
        addToast('error', data.error || 'PDF processing failed');
      }
    } catch (error) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        leadsExtracted: 0,
        message: 'Network error - could not reach ALEX PDF Processor',
      });
      addToast('error', 'Network error - upload failed');
    } finally {
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setResult(null);
    setProgress(0);
    setProgressMessage('');
    setSelectedFiles([]);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">PDF Upload</h1>
        <p className="text-gray-400 text-sm mt-1">
          Upload Dallas County excess funds PDFs for automatic lead extraction via ALEX
        </p>
      </div>

      {/* Upload Zone */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => !uploading && document.getElementById('pdf-upload')?.click()}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer relative
            ${dragActive
              ? 'border-cyan-400 bg-cyan-900/20'
              : 'border-zinc-700 hover:border-cyan-500/50 hover:bg-zinc-800/30'}
            ${uploading ? 'pointer-events-none opacity-60' : ''}
          `}
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

          <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 transition-colors
            ${dragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400'}
          `}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>

          <h3 className="text-xl font-semibold text-white mb-2">
            {dragActive ? 'Drop PDFs here' : 'Drag & Drop PDFs'}
          </h3>
          <p className="text-zinc-400 mb-4">
            or click to browse files
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 rounded-lg text-sm text-zinc-400">
            <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 2l5 5h-5V4zM8.5 18v-1h7v1h-7zm0-3v-1h7v1h-7zm0-3v-1h7v1h-7z"/>
            </svg>
            Dallas County Excess Funds PDFs
          </div>

          {dragActive && (
            <div className="absolute inset-0 bg-cyan-500/10 rounded-xl pointer-events-none" />
          )}
        </div>

        {/* Selected Files List */}
        {selectedFiles.length > 0 && !uploading && !result && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-zinc-300 mb-3">
              Selected Files ({selectedFiles.length})
            </h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between bg-zinc-800/50 rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"/>
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-200 truncate max-w-xs">
                        {file.name}
                      </p>
                      <p className="text-xs text-zinc-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="p-1 hover:bg-zinc-700 rounded transition-colors"
                  >
                    <svg className="w-5 h-5 text-zinc-500 hover:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={processFiles}
              className="mt-4 w-full py-3 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Process {selectedFiles.length} PDF{selectedFiles.length > 1 ? 's' : ''} with ALEX
            </button>
          </div>
        )}

        {/* Upload Progress */}
        {uploading && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">{progressMessage}</span>
              <span className="text-cyan-400 font-mono">{progress}%</span>
            </div>
            <div className="w-full bg-zinc-800 rounded-full h-3 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full rounded-full transition-all duration-300 relative"
                style={{ width: `${progress}%` }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
              </div>
            </div>
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse" />
              ALEX is extracting lead data from your PDFs...
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="mt-6">
            <div className={`rounded-xl p-6 ${result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${result.success ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
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
                    {result.success ? 'Processing Complete' : 'Processing Failed'}
                  </h3>
                  <p className="text-zinc-300 mt-1">{result.message}</p>

                  {result.success && result.leadsExtracted > 0 && (
                    <div className="mt-4 grid grid-cols-3 gap-4">
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-cyan-400">{result.leadsExtracted}</p>
                        <p className="text-xs text-zinc-500 mt-1">Leads Extracted</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-green-400">{result.details?.length || 0}</p>
                        <p className="text-xs text-zinc-500 mt-1">PDFs Processed</p>
                      </div>
                      <div className="bg-zinc-800/50 rounded-lg p-4 text-center">
                        <p className="text-3xl font-bold text-purple-400">Pending</p>
                        <p className="text-xs text-zinc-500 mt-1">Skip Trace Status</p>
                      </div>
                    </div>
                  )}

                  {result.details && result.details.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-zinc-400 mb-2">File Details</h4>
                      <div className="space-y-2">
                        {result.details.map((detail, i) => (
                          <div key={i} className="flex items-center justify-between bg-zinc-800/30 rounded px-3 py-2 text-sm">
                            <span className="text-zinc-300 truncate max-w-xs">{detail.filename}</span>
                            <span className="text-cyan-400">{detail.leads} leads</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={resetUpload}
                  className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
                >
                  Upload More PDFs
                </button>
                {result.success && (
                  <a
                    href="/dashboard"
                    className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors text-center"
                  >
                    View Leads
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instructions Card */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">How it works</h3>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-cyan-400 font-bold">1</span>
            </div>
            <div>
              <h4 className="font-medium text-zinc-200">Upload PDFs</h4>
              <p className="text-sm text-zinc-500 mt-1">
                Drag and drop Dallas County excess funds PDF lists
              </p>
            </div>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <span className="text-cyan-400 font-bold">2</span>
            </div>
            <div>
              <h4 className="font-medium text-zinc-200">ALEX Extracts Data</h4>
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
              <h4 className="font-medium text-zinc-200">Leads Ready</h4>
              <p className="text-sm text-zinc-500 mt-1">
                New leads appear in dashboard, ready for skip trace
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
