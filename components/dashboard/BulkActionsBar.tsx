'use client';

import { useState } from 'react';
import { useToast } from '@/components/Toast';

interface BulkActionsBarProps {
    selectedIds: string[];
    totalValue: number;
    onClear: () => void;
    onSuccess: () => void;
}

export default function BulkActionsBar({
    selectedIds,
    totalValue,
    onClear,
    onSuccess
}: BulkActionsBarProps) {
    const [sending, setSending] = useState(false);
    const [updating, setUpdating] = useState(false);
    const [showStatusMenu, setShowStatusMenu] = useState(false);
    const { addToast } = useToast();

    if (selectedIds.length === 0) return null;

    const handleBulkSms = async () => {
        if (!confirm(`Send SMS to ${selectedIds.length} leads?`)) return;

        setSending(true);
        try {
            const res = await fetch('/api/leads/bulk-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_ids: selectedIds })
            });

            const data = await res.json();

            if (res.ok) {
                addToast('success', data.message);
                onSuccess();
                onClear();
            } else {
                addToast('error', data.error || 'Failed to send SMS');
            }
        } catch {
            addToast('error', 'Network error');
        }
        setSending(false);
    };

    const handleBulkStatus = async (status: string) => {
        setUpdating(true);
        setShowStatusMenu(false);

        try {
            const res = await fetch('/api/leads/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_ids: selectedIds, updates: { status } })
            });

            const data = await res.json();

            if (res.ok) {
                addToast('success', data.message);
                onSuccess();
                onClear();
            } else {
                addToast('error', data.error || 'Failed to update');
            }
        } catch {
            addToast('error', 'Network error');
        }
        setUpdating(false);
    };

    const handleExport = () => {
        // Create CSV
        const headers = ['ID', 'Owner Name', 'Property Address', 'Phone', 'Excess Amount', 'Status'];
        const csv = [headers.join(',')].concat(
            selectedIds.map(id => `"${id}"`)
        ).join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads-export-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);

        addToast('success', `Exported ${selectedIds.length} leads`);
    };

    const handleDelete = async () => {
        if (!confirm(`Delete ${selectedIds.length} leads? This cannot be undone.`)) return;

        setUpdating(true);
        try {
            const res = await fetch('/api/leads/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lead_ids: selectedIds, updates: { status: 'deleted' } })
            });

            if (res.ok) {
                addToast('success', `Deleted ${selectedIds.length} leads`);
                onSuccess();
                onClear();
            } else {
                addToast('error', 'Failed to delete');
            }
        } catch {
            addToast('error', 'Network error');
        }
        setUpdating(false);
    };

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-900/95 border border-zinc-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-50 backdrop-blur-sm">
            <div className="flex items-center gap-4 border-r border-zinc-700 pr-6">
                <div className="flex flex-col">
                    <span className="text-white font-bold">{selectedIds.length} Leads</span>
                    <span className="text-[10px] text-zinc-400 font-mono">${totalValue.toLocaleString()}</span>
                </div>
                <button onClick={onClear} className="text-zinc-500 hover:text-white text-xs underline">
                    Clear
                </button>
            </div>

            <div className="flex items-center gap-2">
                {/* SMS Button */}
                <button
                    onClick={handleBulkSms}
                    disabled={sending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-all
            ${sending
                            ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white shadow-lg'
                        }
          `}
                >
                    {sending ? <span className="animate-spin h-3 w-3 border-2 border-white/50 border-t-white rounded-full" /> : '💬'}
                    {sending ? 'Sending...' : 'SMS All'}
                </button>

                {/* Status Dropdown */}
                <div className="relative">
                    <button
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        disabled={updating}
                        className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 hover:border-zinc-500 transition-colors"
                        title="Update Status"
                    >
                        {updating ? '⏳' : '📋'}
                    </button>

                    {showStatusMenu && (
                        <div className="absolute bottom-full mb-2 left-0 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden min-w-[140px]">
                            {['new', 'contacted', 'qualified', 'negotiating', 'contract_sent', 'dead'].map(status => (
                                <button
                                    key={status}
                                    onClick={() => handleBulkStatus(status)}
                                    className="w-full px-4 py-2 text-left text-xs text-white hover:bg-zinc-700 capitalize"
                                >
                                    {status.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Export Button */}
                <button
                    onClick={handleExport}
                    className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-emerald-400 border border-emerald-500/20 hover:border-emerald-500/50 transition-colors"
                    title="Export CSV"
                >
                    📥
                </button>

                {/* Delete Button */}
                <button
                    onClick={handleDelete}
                    disabled={updating}
                    className="p-2 rounded-full bg-zinc-800 hover:bg-red-900/50 text-red-400 border border-red-500/20 hover:border-red-500/50 transition-colors"
                    title="Delete Selected"
                >
                    🗑️
                </button>
            </div>
        </div>
    );
}
