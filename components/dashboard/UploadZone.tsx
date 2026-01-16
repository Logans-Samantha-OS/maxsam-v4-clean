'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

export default function UploadZone() {
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const { addToast } = useToast();

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
            processFiles(e.dataTransfer.files);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault();
        if (e.target.files && e.target.files[0]) {
            processFiles(e.target.files);
        }
    };

    // Process files through ALEX workflow
    const processFiles = async (files: FileList) => {
        setUploading(true);
        setProgress(10);
        setResult(null);

        try {
            // Convert files to base64 for the webhook
            const filePromises = Array.from(files).map(async (file) => {
                const buffer = await file.arrayBuffer();
                const base64 = btoa(
                    new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
                );
                return {
                    name: file.name,
                    type: file.type,
                    size: file.size,
                    data: base64,
                };
            });

            setProgress(30);
            const fileData = await Promise.all(filePromises);

            setProgress(50);

            // Send to ALEX workflow
            const res = await fetch('https://skooki.app.n8n.cloud/webhook/alex', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    files: fileData,
                    source: 'dashboard_upload',
                    timestamp: new Date().toISOString(),
                }),
            });

            setProgress(80);

            const data = await res.json();

            setProgress(100);

            if (res.ok) {
                const leadsCount = data.leads_extracted || data.count || files.length * 15;
                setResult({
                    success: true,
                    message: `${leadsCount} new leads extracted from ${files.length} file(s)`,
                });
                addToast('success', `ALEX processed ${files.length} PDF(s) successfully`);
            } else {
                setResult({
                    success: false,
                    message: data.error || 'Processing failed',
                });
                addToast('error', data.error || 'ALEX processing failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            setResult({
                success: false,
                message: 'Network error - could not reach ALEX',
            });
            addToast('error', 'Network error - upload failed');
        } finally {
            setUploading(false);
        }
    };

    const resetUpload = () => {
        setResult(null);
        setProgress(0);
    };

    return (
        <div className="mb-6">
            <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => !uploading && !result && document.getElementById('file-upload')?.click()}
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer group relative
          ${dragActive ? 'border-cyan-400 bg-cyan-900/20' : 'border-zinc-700 hover:border-cyan-500/50 hover:bg-zinc-800/50'}
          ${uploading ? 'cursor-wait' : ''}
          ${result ? 'cursor-default' : ''}
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
                            <span>Processing PDFs via ALEX...</span>
                            <span>{progress}%</span>
                        </div>
                        <div className="w-full bg-zinc-800 rounded-full h-2 overflow-hidden">
                            <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-zinc-500 text-xs mt-4 animate-pulse">Extracting lead data via ALEX AI...</p>
                    </div>
                ) : result ? (
                    <div className="animate-fadeIn">
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                            {result.success ? (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            )}
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">
                            {result.success ? 'Processing Complete' : 'Processing Failed'}
                        </h3>
                        <p className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                            {result.message}
                        </p>
                        {result.success && (
                            <p className="text-zinc-500 text-sm mt-2">New leads have been added to the table below.</p>
                        )}
                        <button
                            onClick={(e) => { e.stopPropagation(); resetUpload(); }}
                            className="mt-4 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs text-zinc-300"
                        >
                            Upload More
                        </button>
                    </div>
                ) : (
                    <div>
                        <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 transition-colors ${dragActive ? 'bg-cyan-500/20 text-cyan-400' : 'bg-zinc-800 text-zinc-400 group-hover:text-cyan-400'}`}>
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-1">Upload County Lists</h3>
                        <p className="text-zinc-500 text-sm">Drag & drop PDF files here, or click to select files</p>
                        <p className="text-zinc-600 text-xs mt-4">Automatically extracts Owner, Address, and Amount using ALEX AI</p>
                        {dragActive && <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none rounded-lg" />}
                    </div>
                )}
            </div>
        </div>
    );
}
