'use client';

import { useState } from 'react';

export default function SmsBlastButton() {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');

    const handleBlast = async () => {
        if (!confirm('Are you sure you want to trigger the SMS blast? This will send messages to all eligible leads.')) {
            return;
        }

        setLoading(true);
        setStatus('idle');

        try {
            const response = await fetch('https://n8n.srv758673.hstgr.cloud/webhook/sam-initial-outreach', {
                method: 'POST',
            });

            if (response.ok) {
                setStatus('success');
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('Failed to trigger SMS blast:', error);
            setStatus('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={handleBlast}
                disabled={loading}
                className={`
          flex items-center gap-2 px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-xs transition-all
          ${loading ? 'bg-zinc-700 cursor-not-allowed opacity-75' :
                        status === 'success' ? 'bg-green-600 hover:bg-green-500 text-white' :
                            status === 'error' ? 'bg-red-600 hover:bg-red-500 text-white' :
                                'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg shadow-red-900/20'
                    }
        `}
            >
                {loading ? (
                    <>
                        <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Sending...
                    </>
                ) : status === 'success' ? (
                    <>
                        <span>✓</span> BLAST SENT
                    </>
                ) : status === 'error' ? (
                    <>
                        <span>⚠</span> FAILED
                    </>
                ) : (
                    <>
                        <span>🚀</span> Trigger SMS Blast
                    </>
                )}
            </button>

            {/* Tooltip for context */}
            <div className="absolute top-full right-0 mt-2 w-48 text-xs text-zinc-500 text-right opacity-0 hover:opacity-100 transition-opacity pointer-events-none group-hover:opacity-100">
                Triggers Sam AI initial outreach workflow
            </div>
        </div>
    );
}
