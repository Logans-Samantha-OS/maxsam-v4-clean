/**
 * CSSGem Component - Egyptian Pharaoh Edition
 * Hyper-realistic CSS gem components replacing emoji gems
 * Part of THE GOLDEN FILTER system
 *
 * Gem Tiers:
 * - CRITICAL: Blood Diamond (Red, Pulsing)
 * - A+: Ultra Diamond (Cyan/White, Brilliant)
 * - A: Emerald (Green, Luxurious)
 * - B: Sapphire (Blue, Deep)
 * - C: Amber (Golden Yellow)
 * - D: Ruby (Deep Red)
 */

'use client';

import React from 'react';

type GemGrade = 'CRITICAL' | 'A+' | 'A' | 'B' | 'C' | 'D';

interface CSSGemProps {
  grade: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showLabel?: boolean;
  animate?: boolean;
  className?: string;
}

// Gem configurations
const GEM_CONFIG: Record<GemGrade, {
  name: string;
  primaryColor: string;
  secondaryColor: string;
  glowColor: string;
  facetColors: string[];
  borderColor: string;
}> = {
  'CRITICAL': {
    name: 'BLOOD DIAMOND',
    primaryColor: '#ff0000',
    secondaryColor: '#990000',
    glowColor: 'rgba(255, 0, 0, 0.8)',
    facetColors: ['#ff4444', '#ff0000', '#cc0000', '#990000', '#ff6666'],
    borderColor: '#ff4444'
  },
  'A+': {
    name: 'ULTRA DIAMOND',
    primaryColor: '#00f0ff',
    secondaryColor: '#ffffff',
    glowColor: 'rgba(0, 240, 255, 0.8)',
    facetColors: ['#ffffff', '#e0ffff', '#00f0ff', '#00d4e0', '#b0ffff'],
    borderColor: '#00f0ff'
  },
  'A': {
    name: 'EMERALD',
    primaryColor: '#00ff88',
    secondaryColor: '#00aa55',
    glowColor: 'rgba(0, 255, 136, 0.6)',
    facetColors: ['#00ff88', '#00dd77', '#00bb66', '#009955', '#44ffaa'],
    borderColor: '#00ff88'
  },
  'B': {
    name: 'SAPPHIRE',
    primaryColor: '#0066ff',
    secondaryColor: '#0044aa',
    glowColor: 'rgba(0, 102, 255, 0.6)',
    facetColors: ['#4488ff', '#0066ff', '#0055dd', '#0044aa', '#6699ff'],
    borderColor: '#4488ff'
  },
  'C': {
    name: 'AMBER',
    primaryColor: '#ffaa00',
    secondaryColor: '#cc8800',
    glowColor: 'rgba(255, 170, 0, 0.6)',
    facetColors: ['#ffcc44', '#ffaa00', '#ee9900', '#cc8800', '#ffdd66'],
    borderColor: '#ffaa00'
  },
  'D': {
    name: 'RUBY',
    primaryColor: '#ff4466',
    secondaryColor: '#cc2244',
    glowColor: 'rgba(255, 68, 102, 0.6)',
    facetColors: ['#ff6688', '#ff4466', '#ee3355', '#cc2244', '#ff8899'],
    borderColor: '#ff4466'
  }
};

// Size configurations
const SIZE_CONFIG = {
  xs: { gem: 16, font: 8 },
  sm: { gem: 24, font: 10 },
  md: { gem: 36, font: 12 },
  lg: { gem: 48, font: 14 },
  xl: { gem: 64, font: 16 }
};

export function CSSGem({
  grade,
  size = 'md',
  showLabel = false,
  animate = true,
  className = ''
}: CSSGemProps) {
  const normalizedGrade = (grade?.toUpperCase() || 'D') as GemGrade;
  const config = GEM_CONFIG[normalizedGrade] || GEM_CONFIG['D'];
  const sizeConfig = SIZE_CONFIG[size];
  const isCritical = normalizedGrade === 'CRITICAL';

  return (
    <div className={`inline-flex flex-col items-center gap-1 ${className}`}>
      <div
        className={`relative ${animate && isCritical ? 'animate-pulse' : ''}`}
        style={{
          width: sizeConfig.gem,
          height: sizeConfig.gem
        }}
      >
        {/* Outer glow */}
        <div
          className="absolute inset-0 rounded-sm"
          style={{
            background: `radial-gradient(circle, ${config.glowColor} 0%, transparent 70%)`,
            filter: 'blur(4px)',
            transform: 'scale(1.5)'
          }}
        />

        {/* Main gem body - hexagonal shape */}
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          style={{
            filter: `drop-shadow(0 0 ${size === 'xl' ? '8px' : '4px'} ${config.glowColor})`
          }}
        >
          {/* Gem shape - octagon/diamond hybrid */}
          <defs>
            <linearGradient id={`gem-grad-${normalizedGrade}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={config.facetColors[0]} />
              <stop offset="25%" stopColor={config.facetColors[1]} />
              <stop offset="50%" stopColor={config.facetColors[2]} />
              <stop offset="75%" stopColor={config.facetColors[3]} />
              <stop offset="100%" stopColor={config.facetColors[4]} />
            </linearGradient>

            <linearGradient id={`gem-shine-${normalizedGrade}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
              <stop offset="50%" stopColor="rgba(255,255,255,0)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.2)" />
            </linearGradient>

            <filter id={`gem-glow-${normalizedGrade}`}>
              <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Main gem body */}
          <polygon
            points="50,5 85,25 95,50 85,75 50,95 15,75 5,50 15,25"
            fill={`url(#gem-grad-${normalizedGrade})`}
            stroke={config.borderColor}
            strokeWidth="2"
            filter={`url(#gem-glow-${normalizedGrade})`}
          />

          {/* Top facet */}
          <polygon
            points="50,5 85,25 50,35 15,25"
            fill={config.facetColors[0]}
            opacity="0.9"
          />

          {/* Left facet */}
          <polygon
            points="15,25 50,35 50,65 5,50"
            fill={config.facetColors[2]}
            opacity="0.7"
          />

          {/* Right facet */}
          <polygon
            points="85,25 95,50 50,65 50,35"
            fill={config.facetColors[1]}
            opacity="0.8"
          />

          {/* Bottom left facet */}
          <polygon
            points="5,50 50,65 50,95 15,75"
            fill={config.facetColors[3]}
            opacity="0.6"
          />

          {/* Bottom right facet */}
          <polygon
            points="95,50 85,75 50,95 50,65"
            fill={config.facetColors[4]}
            opacity="0.7"
          />

          {/* Center highlight */}
          <polygon
            points="50,35 70,45 50,65 30,45"
            fill={`url(#gem-shine-${normalizedGrade})`}
            opacity="0.5"
          />

          {/* Top shine */}
          <ellipse
            cx="40"
            cy="20"
            rx="10"
            ry="5"
            fill="rgba(255,255,255,0.6)"
          />

          {/* Small sparkle */}
          <circle
            cx="35"
            cy="25"
            r="3"
            fill="rgba(255,255,255,0.9)"
          />
        </svg>

        {/* Animated sparkle overlay for critical/diamond */}
        {(isCritical || normalizedGrade === 'A+') && animate && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.8) 50%, transparent 60%)',
              animation: 'shine 2s infinite'
            }}
          />
        )}
      </div>

      {showLabel && (
        <span
          className="font-bold uppercase tracking-wider text-center"
          style={{
            fontSize: sizeConfig.font,
            color: config.primaryColor,
            textShadow: `0 0 10px ${config.glowColor}`
          }}
        >
          {config.name}
        </span>
      )}
    </div>
  );
}

// Inline gem for tables/lists
export function CSSGemInline({
  grade,
  size = 'sm',
  className = ''
}: {
  grade: string;
  size?: 'xs' | 'sm' | 'md';
  className?: string;
}) {
  const normalizedGrade = (grade?.toUpperCase() || 'D') as GemGrade;
  const config = GEM_CONFIG[normalizedGrade] || GEM_CONFIG['D'];
  const sizeConfig = SIZE_CONFIG[size];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded ${className}`}
      style={{
        background: `linear-gradient(135deg, ${config.primaryColor}20, ${config.secondaryColor}10)`,
        border: `1px solid ${config.primaryColor}40`
      }}
    >
      <CSSGem grade={grade} size="xs" animate={false} />
      <span
        className="font-bold uppercase"
        style={{
          fontSize: sizeConfig.font,
          color: config.primaryColor
        }}
      >
        {normalizedGrade}
      </span>
    </span>
  );
}

// Gem with score display
export function CSSGemScore({
  grade,
  score,
  size = 'md',
  className = ''
}: {
  grade: string;
  score: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const normalizedGrade = (grade?.toUpperCase() || 'D') as GemGrade;
  const config = GEM_CONFIG[normalizedGrade] || GEM_CONFIG['D'];

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <CSSGem grade={grade} size={size} />
      <div
        className="mt-1 px-2 py-0.5 rounded text-xs font-bold"
        style={{
          background: `linear-gradient(135deg, ${config.primaryColor}30, ${config.secondaryColor}20)`,
          border: `1px solid ${config.primaryColor}50`,
          color: config.primaryColor
        }}
      >
        {score}/100
      </div>
    </div>
  );
}

// Grade to gem name helper
export function getGemName(grade: string): string {
  const normalizedGrade = (grade?.toUpperCase() || 'D') as GemGrade;
  return GEM_CONFIG[normalizedGrade]?.name || 'UNKNOWN';
}

export default CSSGem;
