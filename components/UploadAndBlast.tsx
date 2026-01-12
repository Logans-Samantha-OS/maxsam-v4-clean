// components/UploadAndBlast.tsx
"use client";

import { useState, useRef } from 'react';
import { Upload, Zap, Check, AlertCircle } from 'lucide-react';

export default function UploadAndBlast() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUploadAndBlast = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setUploading(true);
    setProgress('Uploading file...');
    setError('');
    setResult(null);

    try {
      const formData = new FormData(e.currentTarget);
      
      const response = await fetch('/api/leads/upload-blast', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      setProgress('');
      
      // Reset form
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setProgress('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-900 to-indigo-900 rounded-xl shadow-2xl">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">
          ⚡ Upload & Auto-Blast
        </h2>
        <p className="text-purple-200">
          One button. Eleanor scores. Sam blasts. Money flows.
        </p>
      </div>

      <form onSubmit={handleUploadAndBlast} className="space-y-4">
        {/* File Upload */}
        <div className="border-2 border-dashed border-purple-400 rounded-lg p-6 text-center hover:border-purple-300 transition-colors">
          <input
            ref={fileInputRef}
            type="file"
            name="file"
            accept=".csv,.pdf"
            required
            disabled={uploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload className="w-12 h-12 text-purple-300 mb-2" />
            <span className="text-white font-medium">
              Click to upload CSV or PDF
            </span>
            <span className="text-purple-300 text-sm mt-1">
              Dallas County Excess Funds List
            </span>
          </label>
        </div>

        {/* Auto-Blast Toggle */}
        <div className="flex items-center justify-between bg-purple-800/50 p-4 rounded-lg">
          <div>
            <label className="text-white font-medium">Auto-Blast</label>
            <p className="text-purple-300 text-sm">
              Sam texts leads immediately after import
            </p>
          </div>
          <input
            type="checkbox"
            name="autoBlast"
            value="true"
            defaultChecked
            className="w-6 h-6 text-purple-600 rounded"
          />
        </div>

        {/* Blast Limit */}
        <div className="bg-purple-800/50 p-4 rounded-lg">
          <label className="text-white font-medium block mb-2">
            Initial Blast Size
          </label>
          <select
            name="blastLimit"
            defaultValue="50"
            className="w-full bg-purple-900 text-white p-2 rounded border border-purple-600"
          >
            <option value="10">10 leads (test)</option>
            <option value="25">25 leads</option>
            <option value="50">50 leads (recommended)</option>
            <option value="100">100 leads (max)</option>
          </select>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={uploading}
          className="w-full bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold py-4 px-6 rounded-lg hover:from-yellow-300 hover:to-orange-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 text-lg"
        >
          {uploading ? (
            <>
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-black"></div>
              {progress}
            </>
          ) : (
            <>
              <Zap className="w-6 h-6" />
              UPLOAD & BLAST
            </>
          )}
        </button>
      </form>

      {/* Progress/Result Display */}
      {result && (
        <div className="mt-6 bg-green-900/50 border border-green-500 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-300 mb-3">
            <Check className="w-6 h-6" />
            <span className="font-bold text-lg">Success!</span>
          </div>
          <div className="space-y-2 text-white">
            <p className="text-xl font-bold">
              {result.stats.total} leads imported
            </p>
            <p className="text-yellow-300">
              🏆 {result.stats.golden} GOLDEN LEADS
            </p>
            <p className="text-purple-300">
              Avg Eleanor Score: {result.stats.avgScore}/100
            </p>
            {result.blastInitiated && (
              <p className="text-green-300 font-bold mt-3">
                ⚡ Sam is now texting leads! Check Telegram for updates.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mt-6 bg-red-900/50 border border-red-500 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-300">
            <AlertCircle className="w-6 h-6" />
            <span className="font-bold">{error}</span>
          </div>
        </div>
      )}
    </div>
  );
}
