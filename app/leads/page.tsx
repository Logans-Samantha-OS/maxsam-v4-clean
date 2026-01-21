'use client';

import { useState, useEffect, useCallback } from 'react';

// ============================================================================
// TYPES
// ============================================================================

interface Lead {
  id: string;
  owner_name: string;
  property_address: string;
  city: string;
  state: string;
  zip_code: string;
  excess_funds_amount: number;
  eleanor_score: number;
  deal_grade: string;
  contact_priority: string;
  deal_type: string;
  potential_revenue: number;
  phone: string | null;
  phone_1: string | null;
  phone_2: string | null;
  email: string | null;
  status: string;
  contact_attempts: number;
  last_contact_date: string | null;
  case_number: string | null;
  created_at: string;
  updated_at: string;
  // New fields for Golden Lead tracking
  is_golden?: boolean;
  is_ultra_golden?: boolean;
  excess_funds_case_number?: string;
  excess_funds_expiry_date?: string;
  sale_date?: string;
  source?: string;
  notes?: string;
}

interface LeadStats {
  total: number;
  classA: number;
  classB: number;
  classC: number;
  golden: number;
  totalExcess: number;
  totalRevenue: number;
  withPhone: number;
  expiringSoon: number; // < 90 days
}

type LeadClass = 'all' | 'A' | 'B' | 'C' | 'golden';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getDaysUntilExpiry(expiryDate: string | null | undefined): number | null {
  if (!expiryDate) return null;
  const expiry = new Date(expiryDate);
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getLeadClass(lead: Lead): 'A' | 'B' | 'C' | 'GOLDEN' {
  // Golden leads take priority
  if (lead.is_golden || lead.is_ultra_golden) return 'GOLDEN';

  const score = lead.eleanor_score || 0;
  const amount = lead.excess_funds_amount || 0;
  const daysLeft = getDaysUntilExpiry(lead.excess_funds_expiry_date);

  // Class A: High value (>$10k) AND urgent (<90 days) OR score >= 75
  if ((amount > 10000 && daysLeft !== null && daysLeft < 90 && daysLeft > 0) || score >= 75) {
    return 'A';
  }

  // Class B: Medium value OR medium urgency OR score >= 45
  if (amount >= 2000 || (daysLeft !== null && daysLeft >= 90 && daysLeft <= 180) || score >= 45) {
    return 'B';
  }

  return 'C';
}

function getClassColor(cls: 'A' | 'B' | 'C' | 'GOLDEN'): string {
  switch (cls) {
    case 'GOLDEN': return 'text-yellow-400';
    case 'A': return 'text-green-400';
    case 'B': return 'text-blue-400';
    case 'C': return 'text-zinc-400';
  }
}

function getClassBgColor(cls: 'A' | 'B' | 'C' | 'GOLDEN'): string {
  switch (cls) {
    case 'GOLDEN': return 'bg-yellow-500/20 border-yellow-500/30';
    case 'A': return 'bg-green-500/20 border-green-500/30';
    case 'B': return 'bg-blue-500/20 border-blue-500/30';
    case 'C': return 'bg-zinc-500/20 border-zinc-500/30';
  }
}

function getUrgencyBadge(daysLeft: number | null): { text: string; color: string } | null {
  if (daysLeft === null) return null;
  if (daysLeft <= 0) return { text: 'EXPIRED', color: 'bg-red-600 text-white' };
  if (daysLeft <= 30) return { text: `${daysLeft}d CRITICAL`, color: 'bg-red-500 text-white animate-pulse' };
  if (daysLeft <= 90) return { text: `${daysLeft}d URGENT`, color: 'bg-orange-500 text-white' };
  if (daysLeft <= 180) return { text: `${daysLeft}d`, color: 'bg-yellow-500/20 text-yellow-400' };
  return { text: `${daysLeft}d`, color: 'bg-zinc-700 text-zinc-400' };
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'new': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'contacted': return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30';
    case 'qualified': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'contract_sent': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    case 'signed': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
    case 'not_interested': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
    case 'invalid': return 'bg-red-500/20 text-red-400 border-red-500/30';
    default: return 'bg-zinc-700/20 text-zinc-500 border-zinc-700/30';
  }
}

// ============================================================================
// STATS CARD COMPONENT
// ============================================================================

function StatsCard({
  label,
  value,
  subValue,
  color = 'cyan',
  icon,
  onClick,
  active,
}: {
  label: string;
  value: string | number;
  subValue?: string;
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    cyan: 'from-cyan-500/20 to-cyan-600/10 border-cyan-500/30',
    yellow: 'from-yellow-500/20 to-yellow-600/10 border-yellow-500/30',
    green: 'from-green-500/20 to-green-600/10 border-green-500/30',
    purple: 'from-purple-500/20 to-purple-600/10 border-purple-500/30',
    red: 'from-red-500/20 to-red-600/10 border-red-500/30',
    blue: 'from-blue-500/20 to-blue-600/10 border-blue-500/30',
  };

  const textColors: Record<string, string> = {
    cyan: 'text-cyan-400',
    yellow: 'text-yellow-400',
    green: 'text-green-400',
    purple: 'text-purple-400',
    red: 'text-red-400',
    blue: 'text-blue-400',
  };

  return (
    <div
      className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-4 ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''} ${active ? 'ring-2 ring-white/50' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-zinc-400 text-sm">{label}</span>
        {icon && <span className="text-xl">{icon}</span>}
      </div>
      <p className={`text-2xl font-bold ${textColors[color]}`}>{value}</p>
      {subValue && <p className="text-xs text-zinc-500 mt-1">{subValue}</p>}
    </div>
  );
}

// ============================================================================
// LEAD ROW COMPONENT
// ============================================================================

function LeadRow({
  lead,
  onSelect,
  isSelected,
}: {
  lead: Lead;
  onSelect: (lead: Lead) => void;
  isSelected: boolean;
}) {
  const leadClass = getLeadClass(lead);
  const phone = lead.phone || lead.phone_1 || lead.phone_2;
  const daysLeft = getDaysUntilExpiry(lead.excess_funds_expiry_date);
  const urgency = getUrgencyBadge(daysLeft);

  return (
    <tr
      onClick={() => onSelect(lead)}
      className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 cursor-pointer transition-colors ${
        isSelected ? 'bg-cyan-500/10' : ''
      } ${leadClass === 'GOLDEN' ? 'bg-yellow-500/5' : ''}`}
    >
      <td className="px-4 py-3">
        <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold ${getClassBgColor(leadClass)} ${getClassColor(leadClass)} border ${leadClass === 'GOLDEN' ? 'animate-pulse' : ''}`}>
          {leadClass === 'GOLDEN' ? '★' : leadClass}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className={`font-medium ${getClassColor(leadClass)}`}>{lead.eleanor_score || 0}</span>
          {lead.deal_grade && (
            <span className="text-xs text-zinc-500">({lead.deal_grade})</span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-white">{lead.owner_name || 'Unknown'}</p>
            {(lead.is_golden || lead.is_ultra_golden) && (
              <span className="text-[10px] px-1.5 py-0.5 bg-yellow-500/30 text-yellow-300 rounded font-bold">
                {lead.is_ultra_golden ? 'ULTRA GOLDEN' : 'GOLDEN'}
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 truncate max-w-[200px]">{lead.property_address}</p>
          {lead.case_number && (
            <p className="text-[10px] text-zinc-600 font-mono">{lead.case_number}</p>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-green-400 font-semibold">
          ${(lead.excess_funds_amount || 0).toLocaleString()}
        </span>
      </td>
      <td className="px-4 py-3">
        {urgency ? (
          <span className={`inline-flex items-center px-2 py-1 rounded text-[10px] font-bold ${urgency.color}`}>
            {urgency.text}
          </span>
        ) : (
          <span className="text-zinc-600 text-sm">-</span>
        )}
      </td>
      <td className="px-4 py-3">
        {phone ? (
          <span className="text-cyan-400 text-sm">{phone}</span>
        ) : (
          <span className="text-zinc-600 text-sm">No phone</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(lead.status)}`}>
          {lead.status?.replace('_', ' ') || 'new'}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-purple-400 font-semibold">
          ${((lead.potential_revenue || (lead.excess_funds_amount || 0) * 0.25)).toLocaleString()}
        </span>
      </td>
    </tr>
  );
}

// ============================================================================
// LEAD DETAIL PANEL
// ============================================================================

function LeadDetailPanel({
  lead,
  onClose,
  onStatusUpdate,
}: {
  lead: Lead;
  onClose: () => void;
  onStatusUpdate: (leadId: string, status: string) => void;
}) {
  const leadClass = getLeadClass(lead);
  const phone = lead.phone || lead.phone_1 || lead.phone_2;
  const daysLeft = getDaysUntilExpiry(lead.excess_funds_expiry_date);
  const urgency = getUrgencyBadge(daysLeft);
  const [updating, setUpdating] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const handleStatusChange = async (newStatus: string) => {
    setUpdating(true);
    await onStatusUpdate(lead.id, newStatus);
    setUpdating(false);
  };

  // Generate outreach script
  const firstName = lead.owner_name?.split(' ')[0] || 'there';
  const script = `Hi ${firstName}, this is Sam from MaxSam Recovery.

I'm reaching out regarding property records in ${lead.city || 'Dallas'} County.

Our audit shows there are excess funds of $${(lead.excess_funds_amount || 0).toLocaleString()} held ${lead.case_number ? `under Case #${lead.case_number}` : 'by the District Clerk'}.

${daysLeft && daysLeft > 0 ? `The deadline to claim this is ${lead.excess_funds_expiry_date} (${daysLeft} days).` : ''}

We specialize in the District Clerk's retrieval process. Are you the correct person to speak with about recovering these funds?

Reply YES to learn more, or STOP to opt out.

- Sam
(844) 963-2549`;

  return (
    <div className="fixed inset-y-0 right-0 w-[420px] bg-zinc-900 border-l border-zinc-800 shadow-2xl z-50 overflow-y-auto">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${getClassBgColor(leadClass)} ${getClassColor(leadClass)} border ${leadClass === 'GOLDEN' ? 'animate-pulse' : ''}`}>
              {leadClass === 'GOLDEN' ? '★' : leadClass}
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {leadClass === 'GOLDEN' ? 'Golden' : `Class ${leadClass}`} Lead
              </h2>
              {urgency && (
                <span className={`text-xs px-2 py-0.5 rounded ${urgency.color}`}>
                  {urgency.text}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
            <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Owner Info */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-3">{lead.owner_name || 'Unknown Owner'}</h3>
          <p className="text-zinc-400 text-sm">{lead.property_address}</p>
          {(lead.city || lead.state || lead.zip_code) && (
            <p className="text-zinc-500 text-sm">{lead.city}, {lead.state} {lead.zip_code}</p>
          )}
          {lead.case_number && (
            <p className="text-zinc-500 text-sm font-mono mt-1">Case: {lead.case_number}</p>
          )}
          {phone && (
            <a href={`tel:${phone}`} className="text-cyan-400 text-sm mt-2 block hover:text-cyan-300">
              📞 {phone}
            </a>
          )}
          {lead.email && (
            <a href={`mailto:${lead.email}`} className="text-cyan-400 text-sm mt-1 block hover:text-cyan-300">
              ✉️ {lead.email}
            </a>
          )}
        </div>

        {/* Excess Funds Section */}
        <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
          <h4 className="text-green-400 font-medium mb-2">💰 Excess Funds</h4>
          <p className="text-3xl font-bold text-green-400">
            ${(lead.excess_funds_amount || 0).toLocaleString()}
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-zinc-500">25% Fee:</span>
              <span className="text-green-400 ml-1">${((lead.excess_funds_amount || 0) * 0.25).toLocaleString()}</span>
            </div>
            {lead.excess_funds_expiry_date && (
              <div>
                <span className="text-zinc-500">Expires:</span>
                <span className="text-yellow-400 ml-1">{lead.excess_funds_expiry_date}</span>
              </div>
            )}
          </div>
        </div>

        {/* Eleanor Score */}
        <div className={`mb-6 p-4 ${getClassBgColor(leadClass)} border rounded-xl`}>
          <div className="flex items-center justify-between">
            <span className={`${getClassColor(leadClass)} font-medium`}>Eleanor Score</span>
            <span className={`text-3xl font-bold ${getClassColor(leadClass)}`}>{lead.eleanor_score || 0}</span>
          </div>
          <div className="mt-2 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${leadClass === 'GOLDEN' ? 'bg-gradient-to-r from-yellow-500 to-orange-500' : leadClass === 'A' ? 'bg-gradient-to-r from-green-500 to-emerald-500' : leadClass === 'B' ? 'bg-gradient-to-r from-blue-500 to-cyan-500' : 'bg-gradient-to-r from-zinc-500 to-zinc-400'}`}
              style={{ width: `${lead.eleanor_score || 0}%` }}
            />
          </div>
        </div>

        {/* Outreach Script */}
        <div className="mb-6">
          <button
            onClick={() => setShowScript(!showScript)}
            className="w-full flex items-center justify-between p-3 bg-zinc-800 rounded-lg hover:bg-zinc-700 transition"
          >
            <span className="text-zinc-300 font-medium">📝 Outreach Script</span>
            <span className="text-zinc-500">{showScript ? '▼' : '▶'}</span>
          </button>
          {showScript && (
            <div className="mt-2 p-4 bg-zinc-950 rounded-lg border border-zinc-800">
              <pre className="text-xs text-zinc-300 whitespace-pre-wrap font-mono">{script}</pre>
              <button
                onClick={() => navigator.clipboard.writeText(script)}
                className="mt-3 w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded transition"
              >
                Copy to Clipboard
              </button>
            </div>
          )}
        </div>

        {/* Quick Status Update */}
        <div className="mb-6">
          <h4 className="text-zinc-300 font-medium mb-3">Quick Status Update</h4>
          <div className="grid grid-cols-2 gap-2">
            {['contacted', 'qualified', 'not_interested', 'invalid'].map((status) => (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={updating || lead.status === status}
                className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                  lead.status === status
                    ? 'bg-zinc-700 text-zinc-400 cursor-not-allowed'
                    : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {phone && (
            <a
              href={`tel:${phone}`}
              className="block w-full py-3 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors text-center"
            >
              📞 Call Now
            </a>
          )}
          <a
            href={`/dashboard/messages?lead_id=${lead.id}`}
            className="block w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-white font-semibold rounded-lg transition-colors text-center"
          >
            ✉️ Send SMS
          </a>
          <button className="w-full py-3 bg-purple-500 hover:bg-purple-400 text-white font-semibold rounded-lg transition-colors">
            📄 Generate Contract
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// ENHANCED UPLOAD MODAL - Supports Gemini CSV Format
// ============================================================================

function UploadModal({
  onClose,
  onUpload,
}: {
  onClose: () => void;
  onUpload: (leads: Partial<Lead>[]) => void;
}) {
  const [csvText, setCsvText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Partial<Lead>[]>([]);

  const handleParse = () => {
    setParsing(true);
    setError(null);
    setPreview([]);

    try {
      const lines = csvText.trim().split('\n');
      if (lines.length < 2) {
        setError('CSV must have header row and at least one data row');
        setParsing(false);
        return;
      }

      const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
      const leads: Partial<Lead>[] = [];

      for (let i = 1; i < lines.length; i++) {
        // Handle quoted values with commas
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (const char of lines[i]) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());

        const lead: Record<string, string | number | boolean> = {};

        headers.forEach((header, idx) => {
          const value = (values[idx] || '').replace(/"/g, '').trim();

          // Map Gemini export format and common variations
          if (header.includes('owner') || header === 'owner_name') {
            lead['owner_name'] = value;
          } else if (header.includes('case') || header === 'case_number') {
            lead['case_number'] = value;
          } else if (header.includes('property') || header.includes('address')) {
            lead['property_address'] = value;
          } else if (header === 'excess_funds_amount' || header.includes('amount') || header.includes('funds')) {
            lead['excess_funds_amount'] = parseFloat(value.replace(/[$,]/g, '')) || 0;
          } else if (header === 'phone' || header === 'phone_1' || header.includes('phone')) {
            lead['phone'] = value || null;
          } else if (header.includes('email')) {
            lead['email'] = value || null;
          } else if (header === 'city') {
            lead['city'] = value;
          } else if (header === 'state') {
            lead['state'] = value || 'TX';
          } else if (header === 'zip' || header === 'zip_code') {
            lead['zip_code'] = value;
          } else if (header === 'county') {
            // Store county info
            lead['county'] = value;
          } else if (header === 'sale_date') {
            lead['sale_date'] = value;
          } else if (header === 'expiration_date' || header.includes('expir')) {
            lead['excess_funds_expiry_date'] = value;
          } else if (header === 'source') {
            lead['source'] = value;
          } else if (header === 'notes') {
            lead['notes'] = value;
          } else if (header === 'deal_grade' || header === 'grade') {
            lead['deal_grade'] = value;
          } else if (header === 'is_golden' || header.includes('golden')) {
            lead['is_golden'] = value.toLowerCase() === 'true' || value.includes('GOLDEN');
          }
        });

        // Check if notes contain GOLDEN indicator
        if (typeof lead['notes'] === 'string' && lead['notes'].includes('GOLDEN')) {
          lead['is_golden'] = true;
        }

        if (lead['owner_name'] || lead['property_address']) {
          leads.push(lead as Partial<Lead>);
        }
      }

      if (leads.length === 0) {
        setError('No valid leads found in CSV');
        setParsing(false);
        return;
      }

      setPreview(leads);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = () => {
    if (preview.length > 0) {
      onUpload(preview);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-zinc-800">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">📤 Import Leads (Gemini/CSV Compatible)</h2>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-lg">
              <svg className="w-5 h-5 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-zinc-400 text-sm mt-2">
            Paste CSV from Gemini export or any spreadsheet. Supports: case_number, owner_name, property_address,
            excess_funds_amount, expiration_date, phone, city, state, zip_code, notes
          </p>
        </div>

        <div className="flex-1 overflow-auto p-6">
          {preview.length === 0 ? (
            <>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder={`case_number,owner_name,property_address,city,county,state,zip_code,excess_funds_amount,phone,phone_1,phone_2,email,sale_date,expiration_date,source,notes
TX-22-00155,Steven Scharf,4527 Cabell Drive,Dallas,Dallas,TX,75204,104168.04,NULL,NULL,NULL,NULL,2024-04-02,2026-04-02,dallas_excess_funds_2026-01,"GOLDEN LEAD. CLASS A."
TX-24-01475,Sharon Denise Wright,2932 Percheron Dr,Mesquite,Dallas,TX,75150,105529.81,NULL,NULL,NULL,NULL,2025-11-04,2027-11-04,dallas_excess_funds_2026-01,"CLASS B. Distressed match."`}
                className="w-full h-64 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-600 font-mono text-xs focus:outline-none focus:border-cyan-500 resize-none"
              />

              {error && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-500/50 rounded-lg text-red-200 text-sm">
                  {error}
                </div>
              )}
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-medium">Preview: {preview.length} leads found</h3>
                <button
                  onClick={() => setPreview([])}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  ← Back to Edit
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-700 text-zinc-400 text-xs">
                      <th className="text-left p-2">Case #</th>
                      <th className="text-left p-2">Owner</th>
                      <th className="text-left p-2">Address</th>
                      <th className="text-right p-2">Amount</th>
                      <th className="text-left p-2">Expires</th>
                      <th className="text-left p-2">Golden</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.slice(0, 10).map((lead, i) => (
                      <tr key={i} className="border-b border-zinc-800">
                        <td className="p-2 font-mono text-xs text-zinc-400">{lead.case_number || '-'}</td>
                        <td className="p-2 text-white">{lead.owner_name || '-'}</td>
                        <td className="p-2 text-zinc-400 text-xs max-w-[150px] truncate">{lead.property_address || '-'}</td>
                        <td className="p-2 text-right text-green-400">${(lead.excess_funds_amount || 0).toLocaleString()}</td>
                        <td className="p-2 text-xs text-yellow-400">{lead.excess_funds_expiry_date || '-'}</td>
                        <td className="p-2">{lead.is_golden ? <span className="text-yellow-400">★</span> : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {preview.length > 10 && (
                  <p className="text-zinc-500 text-sm mt-2">...and {preview.length - 10} more</p>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
          >
            Cancel
          </button>
          {preview.length === 0 ? (
            <button
              onClick={handleParse}
              disabled={!csvText.trim() || parsing}
              className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
            >
              {parsing ? 'Parsing...' : 'Parse CSV'}
            </button>
          ) : (
            <button
              onClick={handleUpload}
              className="px-6 py-2 bg-green-500 hover:bg-green-400 text-white font-semibold rounded-lg transition-colors"
            >
              Import {preview.length} Leads
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [classFilter, setClassFilter] = useState<LeadClass>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.set('page', page.toString());
      params.set('limit', '100');
      params.set('sortBy', 'eleanor_score');
      params.set('sortOrder', 'desc');

      if (statusFilter !== 'all') {
        params.set('status', statusFilter);
      }

      if (searchQuery) {
        params.set('search', searchQuery);
      }

      const res = await fetch(`/api/leads?${params.toString()}`);
      if (!res.ok) throw new Error('Failed to fetch leads');

      const data = await res.json();
      let fetchedLeads: Lead[] = data.leads || [];

      // Apply class filter client-side (since we need to calculate class)
      if (classFilter !== 'all') {
        fetchedLeads = fetchedLeads.filter((l: Lead) => {
          const cls = getLeadClass(l);
          if (classFilter === 'golden') return cls === 'GOLDEN';
          return cls === classFilter;
        });
      }

      // Sort: Golden first, then by amount
      fetchedLeads.sort((a, b) => {
        const clsA = getLeadClass(a);
        const clsB = getLeadClass(b);
        if (clsA === 'GOLDEN' && clsB !== 'GOLDEN') return -1;
        if (clsB === 'GOLDEN' && clsA !== 'GOLDEN') return 1;
        return (b.excess_funds_amount || 0) - (a.excess_funds_amount || 0);
      });

      setLeads(fetchedLeads);
      setTotalPages(data.totalPages || 1);

      // Calculate stats from ALL leads
      const allLeads: Lead[] = data.leads || [];
      const newStats: LeadStats = {
        total: data.total || allLeads.length,
        golden: allLeads.filter((l: Lead) => l.is_golden || l.is_ultra_golden).length,
        classA: allLeads.filter((l: Lead) => getLeadClass(l) === 'A').length,
        classB: allLeads.filter((l: Lead) => getLeadClass(l) === 'B').length,
        classC: allLeads.filter((l: Lead) => getLeadClass(l) === 'C').length,
        totalExcess: allLeads.reduce((sum: number, l: Lead) => sum + (l.excess_funds_amount || 0), 0),
        totalRevenue: allLeads.reduce((sum: number, l: Lead) => sum + ((l.potential_revenue || (l.excess_funds_amount || 0) * 0.25)), 0),
        withPhone: allLeads.filter((l: Lead) => l.phone || l.phone_1 || l.phone_2).length,
        expiringSoon: allLeads.filter((l: Lead) => {
          const days = getDaysUntilExpiry(l.excess_funds_expiry_date);
          return days !== null && days > 0 && days <= 90;
        }).length,
      };
      setStats(newStats);

    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [classFilter, statusFilter, searchQuery, page]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleStatusUpdate = async (leadId: string, status: string) => {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) throw new Error('Failed to update status');

      await fetchLeads();

      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, status });
      }
    } catch (err) {
      console.error('Failed to update lead status:', err);
    }
  };

  const handleUpload = async (newLeads: Partial<Lead>[]) => {
    try {
      let successCount = 0;
      for (const lead of newLeads) {
        const res = await fetch('/api/leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...lead,
            status: 'new',
            state: lead.state || 'TX',
            source: lead.source || 'csv_import',
          }),
        });
        if (res.ok) successCount++;
      }

      setShowUpload(false);
      alert(`Successfully imported ${successCount} of ${newLeads.length} leads!`);
      await fetchLeads();
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Failed to upload leads');
    }
  };

  if (loading && leads.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            📋 Lead Intelligence
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Golden, Class A, B, C categorized leads with urgency tracking
          </p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="px-6 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-400 hover:to-orange-400 text-black font-bold rounded-xl transition-all flex items-center gap-2"
        >
          📤 Import Leads
        </button>
      </div>

      {/* Stats Grid - Clickable Filters */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatsCard
            label="Total Leads"
            value={stats.total}
            subValue={`${stats.withPhone} with phone`}
            color="cyan"
            icon="📋"
            onClick={() => setClassFilter('all')}
            active={classFilter === 'all'}
          />
          <StatsCard
            label="Golden"
            value={stats.golden}
            subValue="Cross-referenced"
            color="yellow"
            icon="⭐"
            onClick={() => setClassFilter('golden')}
            active={classFilter === 'golden'}
          />
          <StatsCard
            label="Class A"
            value={stats.classA}
            subValue="High priority"
            color="green"
            icon="🔥"
            onClick={() => setClassFilter('A')}
            active={classFilter === 'A'}
          />
          <StatsCard
            label="Class B"
            value={stats.classB}
            subValue="Medium priority"
            color="blue"
            icon="⚡"
            onClick={() => setClassFilter('B')}
            active={classFilter === 'B'}
          />
          <StatsCard
            label="Class C"
            value={stats.classC}
            subValue="Lower priority"
            color="purple"
            icon="❄️"
            onClick={() => setClassFilter('C')}
            active={classFilter === 'C'}
          />
          <StatsCard
            label="Expiring < 90d"
            value={stats.expiringSoon}
            subValue="Urgent action"
            color="red"
            icon="⏰"
          />
          <StatsCard
            label="Total Value"
            value={`$${(stats.totalExcess / 1000).toFixed(0)}K`}
            subValue={`$${(stats.totalRevenue / 1000).toFixed(0)}K potential`}
            color="green"
            icon="💰"
          />
        </div>
      )}

      {/* Filters Row */}
      <div className="flex flex-wrap gap-4 items-center">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300 focus:outline-none focus:border-cyan-500"
        >
          <option value="all">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="qualified">Qualified</option>
          <option value="contract_sent">Contract Sent</option>
          <option value="signed">Signed</option>
          <option value="not_interested">Not Interested</option>
        </select>

        {/* Search */}
        <div className="flex-1 max-w-md">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, address, case #, or phone..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        {/* Refresh */}
        <button
          onClick={fetchLeads}
          disabled={loading}
          className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors"
        >
          {loading ? '...' : '🔄 Refresh'}
        </button>
      </div>

      {/* Leads Table */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 bg-zinc-900">
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Class</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Score</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Owner / Property</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Excess $</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Expires</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {leads.length > 0 ? (
                leads.map((lead) => (
                  <LeadRow
                    key={lead.id}
                    lead={lead}
                    onSelect={setSelectedLead}
                    isSelected={selectedLead?.id === lead.id}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-zinc-500">
                    {loading ? 'Loading leads...' : 'No leads found. Import some leads to get started!'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-zinc-800">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-300 rounded-lg transition-colors"
            >
              ← Previous
            </button>
            <span className="text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:bg-zinc-900 disabled:text-zinc-600 text-zinc-300 rounded-lg transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedLead && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={() => setSelectedLead(null)}
          />
          <LeadDetailPanel
            lead={selectedLead}
            onClose={() => setSelectedLead(null)}
            onStatusUpdate={handleStatusUpdate}
          />
        </>
      )}

      {/* Upload Modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUpload={handleUpload}
        />
      )}
    </div>
  );
}
