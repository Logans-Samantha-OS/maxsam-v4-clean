'use client';

import { useState } from 'react';

export default function UploadZone() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<string | null>(null);
    const [dragActive, setDragActive] = useState(false);

    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            simulateUpload(e.dataTransfer.files);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            simulateUpload(e.target.files);
        }
    };

    const simulateUpload = (files: FileList) => {
        setUploading(true);
        setProgress(0);
        setResult(null);

        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    setUploading(false);
                    setResult(`${files.length * 15} new leads extracted from ${files.length} file(s)`);
                    return 100;
                }
                return prev + 10;
            });
        }, 200);
    };

    return (
        <div className="mb-6">
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer group relative
          ${dragActive ? 'border-cyan-400 bg-cyan-900/20' : 'border-zinc-700 hover:border-cyan-500/50 hover:bg-zinc-800/50'}
        `}
            >
                <input
                    type="file"
                    id="file-upload"
                    className="hidden"
                    multiple
                    accept=".pdf"
                    onChange={handleChange}
                />

                {uploading ? (
                    <div className="max-w-md mx-auto">
                        <div className="flex justify-between text-xs text-zinc-400 mb-2">
                            <span>Processing PDFs...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-zinc-500 text-xs mt-4 animate-pulse">Extracting lead data via AI...</p>
                    </div>
                ) : result ? (
                    <div className="animate-fadeIn">
                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-500/20 text-green-400 mb-3">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Processing Complete</h3>
                        <p className="text-green-400 font-medium">{result}</p>
                        <p className="text-zinc-500 text-sm mt-2">New leads have been added to the table below.</p>
                    </div>
                ) : (
                    <div>
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 transition-colors ${dragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-cyan-400'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Upload County Lists</h3>
                        <p className="text-zinc-500 text-sm">Drag & drop PDF files here, or click to select files</p>
                        <p className="text-zinc-600 text-xs mt-4">Automatically extracts Owner, Address, and Amount using Eleanor AI</p>
                        {dragActive && <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none rounded-lg" />}
                    </div>
                )}
            </div>
        </div>
    );
}
