'use client';

import { useState, useCallback } from 'react';
import { Lead, formatCurrency, formatPhone, getEleanorGrade, getRelativeTime, STATUS_COLORS, STATUS_LABELS } from '@/lib/dashboard-utils';
import { useToast } from '@/components/Toast';

interface LeadTableProps {
    leads: Lead[];
    selectedLeads: Set<string>;
    onToggleSelect: (id: string, shiftKey?: boolean) => void;
    onToggleSelectAll: () => void;
    onLeadUpdate: (lead: Lead) => void;
}

export default function LeadTable({
    leads,
    selectedLeads,
    onToggleSelect,
    onToggleSelectAll,
    onLeadUpdate
}: LeadTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [editingField, setEditingField] = useState<{ id: string; field: string } | null>(null);
    const [editValue, setEditValue] = useState('');
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [skipTracingId, setSkipTracingId] = useState<string | null>(null);
    const { addToast } = useToast();

    const toggleExpand = (id: string) => {
        setExpandedId(expandedId === id ? null : id);
    };

    // Inline Edit
    const startEdit = (lead: Lead, field: string) => {
        setEditingField({ id: lead.id, field });
        const value = lead[field as keyof Lead];
        setEditValue(String(value ?? ''));
    };

    const saveEdit = async () => {
        if (!editingField) return;

        try {
            const res = await fetch(`/api/leads/${editingField.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [editingField.field]: editValue })
            });

            if (res.ok) {
                const updated = await res.json();
                onLeadUpdate(updated);
                addToast('success', 'Field updated');
            } else {
                addToast('error', 'Failed to update');
            }
        } catch {
            addToast('error', 'Network error');
        }

        setEditingField(null);
    };

    // Status Change
    const updateStatus = async (id: string, status: string) => {
        try {
            const res = await fetch(`/api/leads/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                const updated = await res.json();
                onLeadUpdate(updated);
                addToast('success', `Status → ${STATUS_LABELS[status] || status}`);
            }
        } catch {
            addToast('error', 'Failed to update status');
        }
    };

    // Send SMS
    const sendSms = async (lead: Lead) => {
        if (!lead.phone_1 && !lead.phone_2) {
            addToast('warning', 'No phone number');
            return;
        }

        setSendingId(lead.id);

        try {
            const res = await fetch(`/api/leads/${lead.id}/sms`, { method: 'POST' });
            const data = await res.json();

            if (res.ok) {
                addToast('success', `SMS sent to ${lead.owner_name}`);
                // Update local state
                onLeadUpdate({ ...lead, sms_count: (lead.sms_count || 0) + 1, status: 'contacted' });
            } else {
                addToast('error', data.error || 'Failed to send SMS');
            }
        } catch {
            addToast('error', 'Network error');
        }

        setSendingId(null);
    };

    // Skip Trace via N8N webhook
    const skipTrace = async (lead: Lead) => {
        setSkipTracingId(lead.id);

        try {
            const res = await fetch('https://skooki.app.n8n.cloud/webhook/skip-trace', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    lead_id: lead.id,
                    owner_name: lead.owner_name,
                    property_address: lead.property_address,
                    city: lead.city,
                    state: lead.state || 'TX',
                })
            });

            const data = await res.json();

            if (res.ok) {
                addToast('success', `Skip trace started for ${lead.owner_name}`);
                // If webhook returns phone data immediately, update the lead
                if (data.phone_1 || data.phone_2) {
                    onLeadUpdate({
                        ...lead,
                        phone_1: data.phone_1 || lead.phone_1,
                        phone_2: data.phone_2 || lead.phone_2,
                    });
                }
            } else {
                addToast('error', data.error || 'Skip trace failed');
            }
        } catch {
            addToast('error', 'Network error - skip trace failed');
        }

        setSkipTracingId(null);
    };

    // Render editable cell
    const EditableCell = ({ lead, field, children, className = '' }: { lead: Lead; field: string; children: React.ReactNode; className?: string }) => {
        const isEditing = editingField?.id === lead.id && editingField?.field === field;

        if (isEditing) {
            return (
                <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={saveEdit}
                    onKeyDown={(e) => e.key === 'Enter' && saveEdit()}
                    className="bg-zinc-800 border border-gold/50 rounded px-2 py-1 text-white w-full"
                />
            );
        }

        return (
            <div
                onClick={() => startEdit(lead, field)}
                className={`cursor-pointer hover:text-gold transition-colors ${className}`}
                title="Click to edit"
            >
                {children}
            </div>
        );
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
                                    className="rounded border-zinc-700 bg-zinc-800 text-gold focus:ring-0"
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
                            const isExpiring = (lead.days_until_expiration || 999) <= 14;
                            const isSending = sendingId === lead.id;

                            return (
                                <>
                                    <tr
                                        key={lead.id}
                                        className={`transition-colors hover:bg-zinc-800/50 
                      ${isSelected ? 'bg-blue-900/20' : ''} 
                      ${lead.golden_lead ? 'bg-yellow-900/10' : ''}
                      ${lead.status === 'qualified' ? 'bg-green-900/10' : ''}
                      ${isExpiring ? 'bg-red-900/10' : ''}
                    `}
                                    >
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={(e) => onToggleSelect(lead.id, (e.nativeEvent as MouseEvent).shiftKey)}
                                                className="rounded border-zinc-600 bg-zinc-700 text-gold focus:ring-0"
                                            />
                                        </td>

                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                <EditableCell lead={lead} field="owner_name" className="font-medium text-white">
                                                    {lead.owner_name}
                                                </EditableCell>
                                                {isExpiring && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">⏰ {lead.days_until_expiration}d</span>}
                                                {lead.golden_lead && <span className="text-[10px] bg-gold/20 text-gold px-1.5 py-0.5 rounded font-bold">⭐</span>}
                                            </div>
                                            <a
                                                href={`https://www.google.com/maps/search/${encodeURIComponent(lead.property_address + ', ' + lead.city)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-xs text-zinc-500 truncate max-w-[250px] hover:text-cyan-400 flex items-center gap-1"
                                            >
                                                📍 {lead.property_address}
                                            </a>
                                        </td>

                                        <td className="p-4 text-right">
                                            <EditableCell lead={lead} field="excess_funds_amount" className="font-mono text-emerald-400 font-bold">
                                                {formatCurrency(lead.excess_funds_amount)}
                                            </EditableCell>
                                        </td>

                                        <td className="p-4 text-center">
                                            <div
                                                className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm border cursor-help ${grade === 'A+' || grade === 'A' ? 'bg-purple-500/10 text-purple-400 border-purple-500/30' :
                                                    grade === 'B' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' :
                                                        'bg-zinc-800 text-zinc-400 border-zinc-700'
                                                    }`}
                                                title={`Eleanor Score: ${lead.eleanor_score} (Grade: ${grade})`}
                                            >
                                                {lead.eleanor_score}
                                            </div>
                                        </td>

                                        <td className="p-4 text-center">
                                            <select
                                                value={lead.status || 'new'}
                                                onChange={(e) => updateStatus(lead.id, e.target.value)}
                                                className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide border bg-transparent cursor-pointer ${statusColor}`}
                                            >
                                                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                                                    <option key={val} value={val} className="bg-zinc-900 text-white">{label}</option>
                                                ))}
                                            </select>
                                        </td>

                                        <td className="p-4 text-center">
                                            {lead.phone_1 ? (
                                                <div className="flex flex-col items-center gap-1">
                                                    <a
                                                        href={`tel:${lead.phone_1}`}
                                                        className="text-xs text-zinc-300 hover:text-cyan-400"
                                                        title="Click to call"
                                                    >
                                                        📞 {formatPhone(lead.phone_1)}
                                                    </a>
                                                    {lead.sms_count > 0 && (
                                                        <span className="text-[10px] text-zinc-500">{lead.sms_count} SMS • {getRelativeTime(lead.last_contacted_at)}</span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-zinc-600 text-xs">No phone</span>
                                            )}
                                        </td>

                                        <td className="p-4 text-right">
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => sendSms(lead)}
                                                    disabled={isSending || (!lead.phone_1 && !lead.phone_2)}
                                                    className={`p-2 rounded transition-colors ${isSending ? 'bg-gold/20 text-gold animate-pulse' :
                                                        !lead.phone_1 && !lead.phone_2 ? 'text-zinc-700 cursor-not-allowed' :
                                                            'hover:bg-cyan-500/20 text-zinc-400 hover:text-cyan-400'
                                                        }`}
                                                    title={isSending ? 'Sending...' : 'Send SMS'}
                                                >
                                                    {isSending ? '⏳' : '💬'}
                                                </button>
                                                <button
                                                    onClick={() => toggleExpand(lead.id)}
                                                    className="p-2 rounded hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                                                >
                                                    <svg className={`w-4 h-4 transform transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>

                                    {/* Expanded Row */}
                                    {isExpanded && (
                                        <tr className="bg-zinc-950/50">
                                            <td colSpan={7} className="p-0">
                                                <div className="p-6 border-b border-zinc-800">
                                                    <div className="grid grid-cols-4 gap-6">
                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Details</h4>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between"><span className="text-zinc-500">Case #:</span> <span className="text-white">{lead.case_number || 'N/A'}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">City:</span> <span className="text-white">{lead.city}, {lead.state}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">Source:</span> <span className="text-white">{lead.source_county || 'Unknown'}</span></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Financials</h4>
                                                            <div className="space-y-1 text-sm">
                                                                <div className="flex justify-between"><span className="text-zinc-500">Excess:</span> <span className="text-emerald-400 font-bold">{formatCurrency(lead.excess_funds_amount)}</span></div>
                                                                <div className="flex justify-between"><span className="text-zinc-500">Est. Equity:</span> <span className="text-white">{formatCurrency(lead.estimated_equity || 0)}</span></div>
                                                                <div className="flex justify-between border-t border-zinc-700 pt-1"><span className="text-gold">Fee (25%):</span> <span className="text-gold font-bold">{formatCurrency(lead.excess_funds_amount * 0.25)}</span></div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Contact</h4>
                                                            <div className="flex flex-col gap-2">
                                                                <a href={`tel:${lead.phone_1}`} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center gap-2">📞 {formatPhone(lead.phone_1)}</a>
                                                                {lead.phone_2 && <a href={`tel:${lead.phone_2}`} className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-xs flex items-center gap-2">📞 {formatPhone(lead.phone_2)}</a>}
                                                                <button
                                                                    onClick={() => skipTrace(lead)}
                                                                    disabled={skipTracingId === lead.id}
                                                                    className={`px-3 py-2 rounded text-xs flex items-center justify-center gap-2 transition-colors ${
                                                                        skipTracingId === lead.id
                                                                            ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/30 animate-pulse'
                                                                            : 'bg-orange-900/30 hover:bg-orange-900/50 text-orange-400 border border-orange-500/30'
                                                                    }`}
                                                                >
                                                                    {skipTracingId === lead.id ? '⏳ Tracing...' : '🔍 Skip Trace'}
                                                                </button>
                                                                <a href={`/contracts?leadId=${lead.id}`} className="px-3 py-2 bg-purple-900/30 hover:bg-purple-900/50 text-purple-400 border border-purple-500/30 rounded text-xs text-center">📄 Generate Contract</a>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h4 className="text-xs font-bold text-zinc-500 uppercase mb-2">Notes</h4>
                                                            <EditableCell lead={lead} field="notes">
                                                                <p className="text-sm text-zinc-300 italic">{lead.notes || 'Click to add notes...'}</p>
                                                            </EditableCell>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
