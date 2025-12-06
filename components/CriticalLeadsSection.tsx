/**
 * Critical Leads Section - Egyptian Pharaoh Edition
 * TOP OF DASHBOARD - Shows expiring leads that need immediate attention
 * Part of THE GOLDEN FILTER system
 */

'use client';

import React from 'react';
import { ExpirationCountdown, ExpirationBadge } from './ExpirationCountdown';
import { CSSGem } from './CSSGem';

interface CriticalLead {
  id: string;
  property_address: string;
  owner_name: string;
  city?: string;
  state?: string;
  excess_funds_amount: number;
  days_until_expiration: number;
  expiration_date?: string;
  deal_grade: string;
  eleanor_score: number;
  potential_revenue: number;
  phone_1?: string;
  is_cross_referenced?: boolean;
}

interface CriticalLeadsSectionProps {
  leads: CriticalLead[];
  onCallLead?: (lead: CriticalLead) => void;
  onViewLead?: (lead: CriticalLead) => void;
  className?: string;
}

export function CriticalLeadsSection({
  leads,
  onCallLead,
  onViewLead,
  className = ''
}: CriticalLeadsSectionProps) {
  // Filter to critical leads only (expiring within 14 days)
  const criticalLeads = leads
    .filter(lead => lead.days_until_expiration !== null && lead.days_until_expiration <= 14)
    .sort((a, b) => (a.days_until_expiration || 999) - (b.days_until_expiration || 999))
    .slice(0, 5);

  if (criticalLeads.length === 0) {
    return null;
  }

  const totalAtRisk = criticalLeads.reduce((sum, lead) => sum + lead.potential_revenue, 0);
  const immediateCount = criticalLeads.filter(l => l.days_until_expiration <= 3).length;

  return (
    <div className={`pharaoh-card relative overflow-hidden ${className}`}>
      {/* Animated border glow */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,0,0,0.1), transparent)',
          animation: 'shimmer 3s infinite'
        }}
      />

      {/* Header */}
      <div className="relative flex items-center justify-between mb-4 pb-4 border-b border-red-500/20">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div
              className="w-12 h-12 rounded-lg flex items-center justify-center animate-pulse"
              style={{
                background: 'linear-gradient(135deg, rgba(255,0,0,0.3), rgba(255,68,68,0.2))',
                border: '1px solid rgba(255,0,0,0.5)',
                boxShadow: '0 0 20px rgba(255,0,0,0.4)'
              }}
            >
              <span className="text-2xl">⚠️</span>
            </div>
            {immediateCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold text-white animate-pulse"
                style={{ backgroundColor: '#ff0000' }}
              >
                {immediateCount}
              </span>
            )}
          </div>
          <div>
            <h2
              className="text-xl font-black uppercase tracking-wider"
              style={{
                background: 'linear-gradient(90deg, #ff4444, #ff0000, #ff4444)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Critical Leads
            </h2>
            <p className="text-xs text-red-400/70">
              {criticalLeads.length} leads expiring within 14 days
            </p>
          </div>
        </div>

        <div className="text-right">
          <div className="text-xs text-red-400/70 uppercase tracking-wider">Revenue at Risk</div>
          <div
            className="text-2xl font-black animate-pulse"
            style={{ color: '#ff4444' }}
          >
            ${totalAtRisk.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Critical Leads List */}
      <div className="space-y-3">
        {criticalLeads.map((lead) => (
          <div
            key={lead.id}
            className="relative rounded-lg p-3 transition-all hover:scale-[1.01]"
            style={{
              background: lead.days_until_expiration <= 3
                ? 'linear-gradient(135deg, rgba(255,0,0,0.15), rgba(255,0,0,0.05))'
                : 'linear-gradient(135deg, rgba(255,68,68,0.10), rgba(255,68,68,0.03))',
              border: `1px solid ${lead.days_until_expiration <= 3 ? 'rgba(255,0,0,0.4)' : 'rgba(255,68,68,0.2)'}`,
              boxShadow: lead.days_until_expiration <= 3 ? '0 0 15px rgba(255,0,0,0.2)' : 'none'
            }}
          >
            <div className="flex items-center gap-4">
              {/* Expiration Countdown */}
              <ExpirationCountdown
                daysUntilExpiration={lead.days_until_expiration}
                size="sm"
                showLabel={false}
              />

              {/* Gem */}
              <CSSGem grade={lead.deal_grade} size="sm" />

              {/* Lead Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white truncate">
                    {lead.owner_name}
                  </span>
                  {lead.is_cross_referenced && (
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,215,0,0.3), rgba(255,215,0,0.1))',
                        color: '#ffd700',
                        border: '1px solid rgba(255,215,0,0.4)'
                      }}
                    >
                      Cross-Ref
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-400 truncate">
                  {lead.property_address}, {lead.city}
                </div>
              </div>

              {/* Excess Amount */}
              <div className="text-right">
                <div className="text-xs text-gray-400">Excess</div>
                <div className="font-bold text-emerald-400">
                  ${lead.excess_funds_amount?.toLocaleString()}
                </div>
              </div>

              {/* Potential Revenue */}
              <div className="text-right">
                <div className="text-xs text-gray-400">Revenue</div>
                <div
                  className="font-bold"
                  style={{
                    background: 'linear-gradient(90deg, #ffd700, #ffaa00)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent'
                  }}
                >
                  ${lead.potential_revenue?.toLocaleString()}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {lead.phone_1 && onCallLead && (
                  <button
                    onClick={() => onCallLead(lead)}
                    className="p-2 rounded-lg transition-all hover:scale-110"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,255,136,0.1))',
                      border: '1px solid rgba(0,255,136,0.3)'
                    }}
                    title="Call Now"
                  >
                    <span>📞</span>
                  </button>
                )}
                {onViewLead && (
                  <button
                    onClick={() => onViewLead(lead)}
                    className="p-2 rounded-lg transition-all hover:scale-110"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,240,255,0.2), rgba(0,240,255,0.1))',
                      border: '1px solid rgba(0,240,255,0.3)'
                    }}
                    title="View Details"
                  >
                    <span>👁️</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer Stats */}
      <div className="mt-4 pt-4 border-t border-red-500/20 flex justify-between items-center">
        <div className="flex gap-4">
          <div className="text-center">
            <div className="text-xs text-red-400/70">Immediate</div>
            <div className="text-lg font-bold text-red-500">{immediateCount}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-orange-400/70">This Week</div>
            <div className="text-lg font-bold text-orange-500">
              {criticalLeads.filter(l => l.days_until_expiration <= 7).length}
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-yellow-400/70">Next Week</div>
            <div className="text-lg font-bold text-yellow-500">
              {criticalLeads.filter(l => l.days_until_expiration > 7).length}
            </div>
          </div>
        </div>
        <button
          className="px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all hover:scale-105"
          style={{
            background: 'linear-gradient(135deg, rgba(255,0,0,0.3), rgba(255,68,68,0.2))',
            border: '1px solid rgba(255,0,0,0.4)',
            color: '#ff4444'
          }}
        >
          View All Critical
        </button>
      </div>
    </div>
  );
}

// Compact version for sidebar
export function CriticalLeadsMini({
  leads,
  className = ''
}: {
  leads: CriticalLead[];
  className?: string;
}) {
  const criticalLeads = leads
    .filter(lead => lead.days_until_expiration !== null && lead.days_until_expiration <= 7)
    .sort((a, b) => (a.days_until_expiration || 999) - (b.days_until_expiration || 999))
    .slice(0, 3);

  if (criticalLeads.length === 0) {
    return null;
  }

  return (
    <div className={`pharaoh-card-mini ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="animate-pulse">🚨</span>
        <span className="text-sm font-bold text-red-400">
          {criticalLeads.length} Expiring Soon
        </span>
      </div>
      <div className="space-y-2">
        {criticalLeads.map((lead) => (
          <div
            key={lead.id}
            className="flex items-center justify-between text-xs"
          >
            <span className="text-gray-400 truncate flex-1">
              {lead.owner_name}
            </span>
            <ExpirationBadge daysUntilExpiration={lead.days_until_expiration} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default CriticalLeadsSection;
