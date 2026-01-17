'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'contract'
  | 'closed'
  | 'do_not_contact'
  | 'opted_out';

interface Lead {
  id: string;
  owner_name: string;
  property_address?: string;
  source_county?: string;
  phone_1?: string;
  phone_2?: string;
  excess_amount: number;
  status: LeadStatus;
  notes?: string;
  golden_lead?: boolean;
  created_at: string;
  updated_at: string;
}

interface LeadCardProps {
  lead: Lead;
  onStatusChange?: (leadId: string, status: LeadStatus) => void;
}

export default function LeadCard({ lead, onStatusChange }: LeadCardProps) {
  const router = useRouter();

  // UI state
  const [expanded, setExpanded] = useState(false);
  const [animating, setAnimating] = useState(false);
  const [saving, setSaving] = useState(false);

  // Keyboard focus
  const cardRef = useRef<HTMLDivElement>(null);

  const phone = lead.phone_1 || lead.phone_2;

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(n);

  // Persist status
  const updateStatus = async (status: LeadStatus) => {
    if (status === lead.status) return;

    setSaving(true);

    try {
      await fetch('/api/leads/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id, status }),
      });

      onStatusChange?.(lead.id, status);
    } finally {
      setSaving(false);
    }
  };

  // Keyboard shortcuts (operator power)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement !== cardRef.current) return;

      if (e.key === 'e') setExpanded((v) => !v);
      if (e.key === 'c' && phone) window.open(`tel:${phone}`);
      if (e.key === 's' && phone) handleSMS();
      if (e.key === 'k') handleContract();
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [phone]);

  const handleExpandToggle = () => {
    setAnimating(true);
    setExpanded((v) => !v);
    setTimeout(() => setAnimating(false), 200);
  };

  const handleSMS = () => {
    fetch('/api/sms/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id }),
    });
  };

  const handleContract = () => {
    router.push(`/contracts/new?lead_id=${lead.id}`);
  };

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      className={`rounded-xl border bg-zinc-900 p-4 space-y-3 transition
        focus:outline-none focus:ring-2 focus:ring-zinc-600
        ${lead.golden_lead ? 'border-yellow-500/60 ring-1 ring-yellow-500/40' : 'border-zinc-800'}
      `}
    >
      {/* HEADER */}
      <div className="flex justify-between items-start gap-3">
        <div>
          <h3 className="text-white font-semibold leading-tight">
            {lead.property_address || lead.source_county || 'Unknown Property'}
          </h3>
          <p className="text-sm text-zinc-400">{lead.owner_name}</p>
        </div>

        {/* STATUS — ALWAYS VISIBLE */}
        <div className="flex items-center gap-2">
          <select
            value={lead.status}
            disabled={saving}
            onChange={(e) => updateStatus(e.target.value as LeadStatus)}
            className={`text-xs rounded-md px-2 py-1 transition
              ${
                saving
                  ? 'bg-zinc-700 border border-zinc-600 text-zinc-400 animate-pulse'
                  : 'bg-zinc-800 border border-zinc-700 text-white hover:border-zinc-500'
              }
            `}
          >
            <option value="new">NEW</option>
            <option value="contacted">CONTACTED</option>
            <option value="contract">CONTRACT</option>
            <option value="closed">CLOSED</option>
            <option value="do_not_contact">DO NOT CONTACT</option>
            <option value="opted_out">OPTED OUT</option>
          </select>

          {saving && <span className="text-xs text-zinc-500">Saving…</span>}
        </div>
      </div>

      {/* SUMMARY */}
      <div className="flex justify-between items-center">
        <div className="text-green-400 font-bold">
          {formatCurrency(lead.excess_amount)}
        </div>

        <button
          onClick={handleExpandToggle}
          className="text-xs text-zinc-400 hover:text-white"
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* EXPANDED */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-out
          ${expanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}
          ${animating ? 'pointer-events-none' : ''}
        `}
      >
        <div className="pt-3 border-t border-zinc-800 space-y-3">
          {/* CONTACT */}
          <div className="flex gap-2">
            <button
              disabled={!phone}
              onClick={() => window.open(`tel:${phone}`)}
              className="px-3 py-1 text-xs rounded bg-cyan-700 text-white disabled:opacity-40"
            >
              Call
            </button>

            <button
              disabled={!phone}
              onClick={handleSMS}
              className="px-3 py-1 text-xs rounded bg-blue-700 text-white disabled:opacity-40"
            >
              SMS
            </button>

            <button
              onClick={handleContract}
              className="px-3 py-1 text-xs rounded bg-purple-700 text-white"
            >
              Contract
            </button>
          </div>

          {/* NOTES */}
          <div>
            <label className="text-xs text-zinc-400">Notes</label>
            <div className="mt-1 text-sm text-zinc-200">
              {lead.notes || 'No notes yet'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
