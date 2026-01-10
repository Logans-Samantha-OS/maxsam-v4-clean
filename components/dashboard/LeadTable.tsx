'use client';

import { useState } from 'react';
import { Lead, formatCurrency, formatPhone, getEleanorGrade, getRelativeTime, STATUS_COLORS, STATUS_LABELS } from '@/lib/dashboard-utils';

interface LeadTableProps {
    leads: Lead[];
    selectedLeads: Set<string>;
    onToggleSelect: (id: string, shiftKey?: boolean) => void;
    onToggleSelectAll: () => void;
    onTextLead: (lead: Lead) => void;
    onUpdateStatus: (id: string, status: string) => void;
}

export default function LeadTable({
    leads,
    selectedLeads,
    onToggleSelect,
    onToggleSelectAll,
    onTextLead,
    onUpdateStatus
}: LeadTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    if (leads.length === 0) {
        return (
            <div className="text-center py-20 text-zinc-500 bg-zinc-900/30 rounded-lg border border-zinc-800 border-dashed">
                <p className="text-lg">No leads match your criteria</p>
                <p className="text-sm">Try adjusting filters or import new leads</p>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-zinc-950/50 text-zinc-400 text-xs uppercase tracking-wider border-b border-zinc-800">
                            <th className="p-4 w-10">
                                <input
                                    type="checkbox"
                                    checked={leads.length > 0 && selectedLeads.size === leads.length}
                                    onChange={onToggleSelectAll}
                                    className="rounded border-zinc-700 bg-zinc-800 text-gold focus:ring-0 focus:ring-offset-0"
                                />
                            </th>
                            <th className="p-4">Owner / Property</th>
                            <th className="p-4 text-right">Amount</th>
                            <th className="p-4 text-center">Score</th>
                            <th className="p-4 text-center">Status</th>
                            <th className="p-4 text-center">Contact</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {leads.map((lead) => {
                            const isSelected = selectedLeads.has(lead.id);
                            const isExpanded = expandedId === lead.id;
                            const grade = getEleanorGrade(lead.eleanor_score);
                            const statusColor = STATUS_COLORS[lead.status] || 'text-zinc-400 bg-zinc-800';
                            const isExpiring = (lead.days_until_expiration || 999) <= 30;

                            return (
                                <div key={lead.id} className="contents group">
                                    <tr
                                        className={`transition-colors hover:bg-zinc-800/50 
                            ${isSelected ? 'bg-blue-900/10' : ''} 
                            ${lead.golden_lead ? 'bg-yellow-900/5' : ''}
                        `}
                                    >
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => onToggleSelect(lead.id, (e.nativeEvent as any).shiftKey)}
                                                className="rounded border-zinc-600 bg-zinc-700 text-gold focus:ring-0 focus:ring-offset-0"
                                            />
                                        </td>
                                        <td className="p-4 cursor-pointer" onClick={() => toggleExpand(lead.id)}>
                                            <div className="flex items-center gap-2">
                                                <div className="font-medium text-white group-hover:text-gold transition-colors">{lead.owner_name}</div>
                                                {isExpiring && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">EXP {lead.days_until_expiration}d</span>}
                                                {lead.golden_lead && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded font-bold">GOLD</span>}
                                            </div>
                                            <div className="text-xs text-zinc-500 truncate max-w-[250px]">{lead.property_address}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono text-emerald-400 font-bold">
                                            {formatCurrency(lead.excess_funds_amount)}
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border ${grade === 'A+' || grade === 'A' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                                    grade === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                }`}>
                                                {lead.eleanor_score}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border ${statusColor}`}>
                                                {STATUS_LABELS[lead.status] || lead.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <div className="text-xs text-zinc-300">{formatPhone(lead.phone_1)}</div>
                                            <div className="text-[10px] text-zinc-500">
                                                {lead.call_attempts > 0 ? `${lead.call_attempts} attempts` : 'No attempts'}
                                            </div>
                                            {lead.last_call_date && <div className="text-[10px] text-zinc-600">{getRelativeTime(lead.last_call_date)}</div>}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    onClick={() => onTextLead(lead)}
                                                    className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 transition-colors"
                                                    title="Send Text"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => toggleExpand(lead.id)}
                                                    className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Detail Row */}
                                    {isExpanded && (
                                        <tr className="bg-zinc-900/50">
                                            <td colSpan={7} className="p-0">
                                                <div className="p-6 border-b border-zinc-800 bg-zinc-950/30 shadow-inner">
                                                    <div className="grid grid-cols-3 gap-6">
                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Lead Details</h4>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between"><span className="text-zinc-500">Owner:</span> <span className="text-white">{lead.owner_name}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">Address:</span> <span className="text-white">{lead.property_address}, {lead.city}, {lead.state}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">Case #:</span> <span className="text-white">{lead.case_number || 'N/A'}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">Expires:</span> <span className="text-red-400">{lead.days_until_expiration} days ({new Date(lead.expiration_date || '').toLocaleDateString()})</span></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Financials</h4>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between"><span className="text-zinc-500">Excess Funds:</span> <span className="text-emerald-400 font-bold">{formatCurrency(lead.excess_funds_amount)}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">Est. Equity:</span> <span className="text-white">{formatCurrency(lead.estimated_equity || 0)}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">ARV:</span> <span className="text-white">{formatCurrency(lead.arv_calculated || 0)}</span></div>
                                                                <div className="flex justify-between border-t border-zinc-700 pt-1 mt-1"><span className="text-gold">Potential Fee (25%):</span> <span className="text-gold font-bold">{formatCurrency(lead.excess_funds_amount * 0.25)}</span></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Actions</h4>
                                                            <div className="flex flex-col gap-2">
                                                                <select
                                                                    value={lead.status}
                                                                    onChange={(e) => onUpdateStatus(lead.id, e.target.value)}
                                                                    className="bg-zinc-800 border border-zinc-700 text-xs rounded p-2 text-white"
                                                                >
                                                                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                                                        <option key={val} value={val}>{label}</option>
                                                                    ))}
                                                                </select>
                                                                <a
                                                                    href={`tel:${lead.phone_1 || lead.phone_2}`}
                                                                    className="flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs py-2 rounded transition-colors"
                                                                >
                                                                    📞 Call Now
                                                                </a>
                                                                <a
                                                                    href={`/contracts?leadId=${lead.id}`}
                                                                    className="flex items-center justify-center gap-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 border border-purple-500/30 text-xs py-2 rounded transition-colors"
                                                                >
                                                                    📄 Generate Contract
                                                                </a>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {lead.notes && (
                                                        <div className="mt-4 pt-4 border-t border-zinc-800">
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-1">Notes</h4>
                                                            <p className="text-sm text-zinc-300 italic">{lead.notes}</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </div>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
