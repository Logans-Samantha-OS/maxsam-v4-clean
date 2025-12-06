/**
 * ExpirationCountdown Component - Egyptian Pharaoh Edition
 * Displays time remaining until lead expiration with urgency styling
 * Part of THE GOLDEN FILTER system
 */

'use client';

import React from 'react';

interface ExpirationCountdownProps {
  daysUntilExpiration: number | null | undefined;
  expirationDate?: string | null;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

// Get urgency tier based on days remaining
function getUrgencyTier(days: number): {
  tier: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glow: string;
  animate: boolean;
} {
  if (days <= 3) {
    return {
      tier: 'IMMEDIATE',
      color: '#ff0000',
      bgColor: 'rgba(255, 0, 0, 0.15)',
      borderColor: 'rgba(255, 0, 0, 0.5)',
      glow: '0 0 20px rgba(255, 0, 0, 0.6), 0 0 40px rgba(255, 0, 0, 0.3)',
      animate: true
    };
  } else if (days <= 7) {
    return {
      tier: 'CRITICAL',
      color: '#ff4444',
      bgColor: 'rgba(255, 68, 68, 0.12)',
      borderColor: 'rgba(255, 68, 68, 0.4)',
      glow: '0 0 15px rgba(255, 68, 68, 0.5)',
      animate: true
    };
  } else if (days <= 14) {
    return {
      tier: 'URGENT',
      color: '#ff8800',
      bgColor: 'rgba(255, 136, 0, 0.10)',
      borderColor: 'rgba(255, 136, 0, 0.3)',
      glow: '0 0 12px rgba(255, 136, 0, 0.4)',
      animate: true
    };
  } else if (days <= 30) {
    return {
      tier: 'WARNING',
      color: '#ffaa00',
      bgColor: 'rgba(255, 170, 0, 0.08)',
      borderColor: 'rgba(255, 170, 0, 0.3)',
      glow: '0 0 10px rgba(255, 170, 0, 0.3)',
      animate: false
    };
  } else if (days <= 60) {
    return {
      tier: 'MONITOR',
      color: '#ffd700',
      bgColor: 'rgba(255, 215, 0, 0.06)',
      borderColor: 'rgba(255, 215, 0, 0.2)',
      glow: 'none',
      animate: false
    };
  } else if (days <= 90) {
    return {
      tier: 'NORMAL',
      color: '#00ff88',
      bgColor: 'rgba(0, 255, 136, 0.05)',
      borderColor: 'rgba(0, 255, 136, 0.2)',
      glow: 'none',
      animate: false
    };
  } else {
    return {
      tier: 'SAFE',
      color: '#00f0ff',
      bgColor: 'rgba(0, 240, 255, 0.04)',
      borderColor: 'rgba(0, 240, 255, 0.15)',
      glow: 'none',
      animate: false
    };
  }
}

// Size configurations
const sizeConfig = {
  sm: {
    container: 'px-2 py-1 text-xs',
    days: 'text-sm font-bold',
    label: 'text-[10px]'
  },
  md: {
    container: 'px-3 py-2 text-sm',
    days: 'text-lg font-bold',
    label: 'text-xs'
  },
  lg: {
    container: 'px-4 py-3 text-base',
    days: 'text-2xl font-black',
    label: 'text-sm'
  }
};

export function ExpirationCountdown({
  daysUntilExpiration,
  expirationDate,
  size = 'md',
  showLabel = true,
  className = ''
}: ExpirationCountdownProps) {
  // Calculate days if only date provided
  let days = daysUntilExpiration;
  if (days === null || days === undefined) {
    if (expirationDate) {
      const expDate = new Date(expirationDate);
      const today = new Date();
      const diffTime = expDate.getTime() - today.getTime();
      days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } else {
      return (
        <span className={`inline-flex items-center text-gray-500 ${sizeConfig[size].container}`}>
          No expiration
        </span>
      );
    }
  }

  const urgency = getUrgencyTier(days);
  const sizeStyles = sizeConfig[size];

  // Format display
  const displayDays = days <= 0 ? 'EXPIRED' : days === 1 ? '1 DAY' : `${days} DAYS`;

  return (
    <div
      className={`
        inline-flex flex-col items-center justify-center rounded-lg
        ${sizeStyles.container}
        ${urgency.animate ? 'animate-pulse' : ''}
        ${className}
      `}
      style={{
        backgroundColor: urgency.bgColor,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: urgency.borderColor,
        boxShadow: urgency.glow
      }}
    >
      {showLabel && (
        <span
          className={`uppercase tracking-wider opacity-80 ${sizeStyles.label}`}
          style={{ color: urgency.color }}
        >
          {urgency.tier}
        </span>
      )}
      <span
        className={sizeStyles.days}
        style={{ color: urgency.color }}
      >
        {displayDays}
      </span>
      {days > 0 && (
        <span
          className={`opacity-60 ${sizeStyles.label}`}
          style={{ color: urgency.color }}
        >
          remaining
        </span>
      )}
    </div>
  );
}

// Inline version for tables
export function ExpirationBadge({
  daysUntilExpiration,
  className = ''
}: {
  daysUntilExpiration: number | null | undefined;
  className?: string;
}) {
  if (daysUntilExpiration === null || daysUntilExpiration === undefined) {
    return <span className="text-gray-500 text-xs">—</span>;
  }

  const urgency = getUrgencyTier(daysUntilExpiration);
  const displayText = daysUntilExpiration <= 0
    ? 'EXPIRED'
    : `${daysUntilExpiration}d`;

  return (
    <span
      className={`
        inline-flex items-center justify-center
        px-2 py-0.5 rounded text-xs font-bold
        ${urgency.animate ? 'animate-pulse' : ''}
        ${className}
      `}
      style={{
        color: urgency.color,
        backgroundColor: urgency.bgColor,
        border: `1px solid ${urgency.borderColor}`,
        boxShadow: urgency.animate ? urgency.glow : 'none'
      }}
    >
      {displayText}
    </span>
  );
}

// Progress bar version
export function ExpirationProgress({
  daysUntilExpiration,
  maxDays = 90,
  className = ''
}: {
  daysUntilExpiration: number | null | undefined;
  maxDays?: number;
  className?: string;
}) {
  if (daysUntilExpiration === null || daysUntilExpiration === undefined) {
    return null;
  }

  const urgency = getUrgencyTier(daysUntilExpiration);
  const percentage = Math.min(100, Math.max(0, (daysUntilExpiration / maxDays) * 100));

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between items-center mb-1">
        <span
          className="text-xs font-bold uppercase"
          style={{ color: urgency.color }}
        >
          {urgency.tier}
        </span>
        <span
          className="text-xs"
          style={{ color: urgency.color }}
        >
          {daysUntilExpiration} days
        </span>
      </div>
      <div
        className="h-2 rounded-full overflow-hidden"
        style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${urgency.animate ? 'animate-pulse' : ''}`}
          style={{
            width: `${100 - percentage}%`,
            backgroundColor: urgency.color,
            boxShadow: urgency.glow
          }}
        />
      </div>
    </div>
  );
}

export default ExpirationCountdown;
