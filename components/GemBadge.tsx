'use client';

import { useState, useEffect } from 'react';

interface GemBadgeProps {
  grade: 'A+' | 'A' | 'B' | 'C' | 'D' | string;
  score?: number;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  showScore?: boolean;
  showProfit?: boolean;
  profit?: number;
}

// Gem definitions with colors and styles
const GEM_CONFIG = {
  'A+': {
    name: 'DIAMOND',
    emoji: '💎',
    color: 'from-white via-cyan-200 to-white',
    glow: 'shadow-[0_0_30px_rgba(255,255,255,0.8)]',
    textColor: 'text-white',
    bgColor: 'bg-gradient-to-br from-white/20 via-cyan-500/20 to-white/20',
    borderColor: 'border-white/50',
    pulseColor: 'bg-white',
  },
  'A': {
    name: 'EMERALD',
    emoji: '💚',
    color: 'from-emerald-400 via-green-500 to-emerald-600',
    glow: 'shadow-[0_0_25px_rgba(0,255,136,0.6)]',
    textColor: 'text-emerald-400',
    bgColor: 'bg-gradient-to-br from-emerald-500/20 to-green-600/20',
    borderColor: 'border-emerald-500/50',
    pulseColor: 'bg-emerald-400',
  },
  'B': {
    name: 'SAPPHIRE',
    emoji: '💙',
    color: 'from-blue-400 via-cyan-500 to-blue-600',
    glow: 'shadow-[0_0_20px_rgba(0,102,255,0.5)]',
    textColor: 'text-blue-400',
    bgColor: 'bg-gradient-to-br from-blue-500/20 to-cyan-600/20',
    borderColor: 'border-blue-500/50',
    pulseColor: 'bg-blue-400',
  },
  'C': {
    name: 'AMBER',
    emoji: '🧡',
    color: 'from-amber-400 via-orange-500 to-amber-600',
    glow: 'shadow-[0_0_15px_rgba(255,149,0,0.4)]',
    textColor: 'text-amber-400',
    bgColor: 'bg-gradient-to-br from-amber-500/20 to-orange-600/20',
    borderColor: 'border-amber-500/50',
    pulseColor: 'bg-amber-400',
  },
  'D': {
    name: 'RUBY',
    emoji: '❤️',
    color: 'from-red-400 via-rose-500 to-red-600',
    glow: 'shadow-[0_0_12px_rgba(255,59,48,0.3)]',
    textColor: 'text-red-400',
    bgColor: 'bg-gradient-to-br from-red-500/20 to-rose-600/20',
    borderColor: 'border-red-500/50',
    pulseColor: 'bg-red-400',
  },
};

// Size configurations
const SIZE_CONFIG = {
  sm: {
    container: 'w-16 h-16',
    emoji: 'text-xl',
    name: 'text-[8px]',
    score: 'text-[10px]',
    padding: 'p-1',
  },
  md: {
    container: 'w-24 h-24',
    emoji: 'text-3xl',
    name: 'text-[10px]',
    score: 'text-sm',
    padding: 'p-2',
  },
  lg: {
    container: 'w-32 h-32',
    emoji: 'text-5xl',
    name: 'text-xs',
    score: 'text-lg',
    padding: 'p-3',
  },
  xl: {
    container: 'w-40 h-40',
    emoji: 'text-6xl',
    name: 'text-sm',
    score: 'text-xl',
    padding: 'p-4',
  },
};

export default function GemBadge({
  grade,
  score,
  size = 'md',
  animated = true,
  showScore = true,
  showProfit = false,
  profit = 0,
}: GemBadgeProps) {
  const [sparkles, setSparkles] = useState<{ id: number; x: number; y: number }[]>([]);

  const gem = GEM_CONFIG[grade as keyof typeof GEM_CONFIG] || GEM_CONFIG['D'];
  const sizeConfig = SIZE_CONFIG[size];

  // Sparkle animation for diamonds
  useEffect(() => {
    if (!animated || grade !== 'A+') return;

    const interval = setInterval(() => {
      const newSparkle = {
        id: Date.now(),
        x: Math.random() * 100,
        y: Math.random() * 100,
      };
      setSparkles(prev => [...prev.slice(-5), newSparkle]);
    }, 500);

    return () => clearInterval(interval);
  }, [animated, grade]);

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      {/* Main gem container */}
      <div
        className={`
          relative ${sizeConfig.container} ${sizeConfig.padding}
          ${gem.bgColor} ${gem.borderColor}
          border rounded-xl
          flex flex-col items-center justify-center
          transition-all duration-300
          ${animated ? 'hover:scale-110' : ''}
          ${animated && grade === 'A+' ? 'animate-pulse' : ''}
          ${gem.glow}
        `}
      >
        {/* Animated background gradient */}
        {animated && (
          <div
            className={`
              absolute inset-0 rounded-xl opacity-30
              bg-gradient-to-br ${gem.color}
              ${grade === 'A+' ? 'animate-spin-slow' : ''}
            `}
            style={{ animationDuration: '8s' }}
          />
        )}

        {/* Sparkles for diamond */}
        {animated && grade === 'A+' && sparkles.map(sparkle => (
          <div
            key={sparkle.id}
            className="absolute w-1 h-1 bg-white rounded-full animate-ping"
            style={{
              left: `${sparkle.x}%`,
              top: `${sparkle.y}%`,
              animationDuration: '1s',
            }}
          />
        ))}

        {/* Gem emoji */}
        <span className={`${sizeConfig.emoji} relative z-10`}>
          {gem.emoji}
        </span>

        {/* Grade label */}
        <span className={`
          ${sizeConfig.name} font-bold tracking-wider
          ${gem.textColor} relative z-10 mt-1
        `}>
          {grade}
        </span>

        {/* Score */}
        {showScore && score !== undefined && (
          <span className={`
            ${sizeConfig.score} font-bold
            ${gem.textColor} relative z-10
          `}>
            {score}
          </span>
        )}

        {/* Shine effect */}
        {animated && (
          <div
            className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none"
          >
            <div
              className="absolute w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine"
              style={{ animationDuration: '3s' }}
            />
          </div>
        )}
      </div>

      {/* Gem name label */}
      <span className={`
        ${sizeConfig.name} font-semibold tracking-widest uppercase
        ${gem.textColor} opacity-80
      `}>
        {gem.name}
      </span>

      {/* Profit display */}
      {showProfit && profit > 0 && (
        <div className="flex items-center gap-1 mt-1">
          <span className="text-yellow-400 text-xs">💰</span>
          <span className="text-yellow-400 font-bold text-sm">
            ${profit.toLocaleString()}
          </span>
        </div>
      )}
    </div>
  );
}

// Inline gem badge for tables/lists
export function GemBadgeInline({
  grade,
  score,
  showName = false,
}: {
  grade: string;
  score?: number;
  showName?: boolean;
}) {
  const gem = GEM_CONFIG[grade as keyof typeof GEM_CONFIG] || GEM_CONFIG['D'];

  return (
    <div className={`
      inline-flex items-center gap-1.5 px-2 py-1 rounded-full
      ${gem.bgColor} ${gem.borderColor} border
    `}>
      <span className="text-sm">{gem.emoji}</span>
      <span className={`text-xs font-bold ${gem.textColor}`}>{grade}</span>
      {score !== undefined && (
        <span className={`text-xs ${gem.textColor} opacity-80`}>{score}</span>
      )}
      {showName && (
        <span className={`text-[10px] ${gem.textColor} opacity-60 uppercase tracking-wider`}>
          {gem.name}
        </span>
      )}
    </div>
  );
}

// Get grade from score
export function getGradeFromScore(score: number): 'A+' | 'A' | 'B' | 'C' | 'D' {
  if (score >= 90) return 'A+';
  if (score >= 80) return 'A';
  if (score >= 70) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// Get gem config for external use
export function getGemConfig(grade: string) {
  return GEM_CONFIG[grade as keyof typeof GEM_CONFIG] || GEM_CONFIG['D'];
}
