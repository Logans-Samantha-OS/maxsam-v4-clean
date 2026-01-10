'use client';

interface BulkActionsBarProps {
    selectedCount: number;
    totalValue: number;
    onClear: () => void;
    onBulkText: () => void;
    onMarkPriority: () => void;
    onExport: () => void;
    sending: boolean;
}

export default function BulkActionsBar({
    selectedCount,
    totalValue,
    onClear,
    onBulkText,
    onMarkPriority,
    onExport,
    sending
}: BulkActionsBarProps) {
    if (selectedCount === 0) return null;

    return (
        <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 bg-zinc-900 border border-zinc-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-6 z-50 animate-slideUp">
            <div className="flex items-center gap-4 border-r border-zinc-700 pr-6">
                <div className="flex flex-col">
                    <span className="text-white font-bold">{selectedCount} Leads Selected</span>
                    <span className="text-[10px] text-zinc-400 font-mono">${totalValue.toLocaleString()} Value</span>
                </div>
                <button
                    onClick={onClear}
                    className="text-zinc-500 hover:text-white text-xs underline"
                >
                    Clear
                </button>
            </div>

            <div className="flex items-center gap-2">
                <button
                    onClick={onBulkText}
                    disabled={sending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-bold text-xs transition-colors
                ${sending
                            ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-lg'
                        }
            `}
                >
                    {sending ? (
                        <>
                            <span className="animate-spin h-3 w-3 border-2 border-white/50 border-t-white rounded-full"></span>
                            Sending...
                        </>
                    ) : (
                        <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                            Send SMS Blast
                        </>
                    )}
                </button>

                <button
                    onClick={onMarkPriority}
                    className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-gold border border-gold/20 hover:border-gold/50 transition-colors"
                    title="Mark as Priority"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                </button>

                <button
                    onClick={onExport}
                    className="p-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-cyan-400 border border-cyan-500/20 hover:border-cyan-500/50 transition-colors"
                    title="Export Selected"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                </button>
            </div>
        </div>
    );
}
