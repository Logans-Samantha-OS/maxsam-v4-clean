'use client';

interface FilterPanelProps {
    minAmount: number;
    setMinAmount: (val: number) => void;
    minScore: number;
    setMinScore: (val: number) => void;
    sortBy: string;
    setSortBy: (val: string) => void;
    hasPhone: boolean;
    setHasPhone: (val: boolean) => void;
    onReset: () => void;
}

export default function FilterPanel({
    minAmount, setMinAmount,
    minScore, setMinScore,
    sortBy, setSortBy,
    hasPhone, setHasPhone,
    onReset
}: FilterPanelProps) {
    return (
        <div className="bg-zinc-900/80 border border-zinc-800 rounded-lg p-4 mb-6 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-6">

                {/* Min Amount Slider */}
                <div className="flex-1 min-w-[200px]">
                    <div className="flex justify-between mb-2">
                        <span className="text-zinc-400 text-xs uppercase tracking-wider">Min Value</span>
                        <span className="text-gold font-bold text-xs">${minAmount.toLocaleString()}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100000"
                        step="1000"
                        value={minAmount}
                        onChange={(e) => setMinAmount(parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-gold"
                    />
                </div>

                {/* Min Score Slider */}
                <div className="flex-1 min-w-[200px]">
                    <div className="flex justify-between mb-2">
                        <span className="text-zinc-400 text-xs uppercase tracking-wider">Min Score</span>
                        <span className="text-cyan-400 font-bold text-xs">{minScore}</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={minScore}
                        onChange={(e) => setMinScore(parseInt(e.target.value))}
                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
                    />
                </div>

                {/* Sort Dropdown */}
                <div className="w-[180px]">
                    <span className="text-zinc-400 text-xs uppercase tracking-wider block mb-2">Sort By</span>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-gold"
                    >
                        <option value="score_desc">Highest Score</option>
                        <option value="amount_desc">Highest Value</option>
                        <option value="deadline_asc">Expiring Soon</option>
                        <option value="created_desc">Newest First</option>
                    </select>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-2 pt-5">
                    <button
                        onClick={() => setHasPhone(!hasPhone)}
                        className={`px-3 py-1.5 rounded text-xs font-bold transition-all border ${hasPhone ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-500'}`}
                    >
                        Has Phone
                    </button>
                    <button
                        onClick={onReset}
                        className="px-3 py-1.5 rounded text-xs font-bold text-zinc-400 hover:text-white transition-colors"
                    >
                        Reset
                    </button>
                </div>
            </div>
        </div>
    );
}
