'use client';

import { useState } from 'react';
import { CSSGem } from './CSSGem';

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  counts?: {
    dashboard?: number;
    sellers?: number;
    buyers?: number;
    deals?: number;
  };
}

export default function TabNavigation({ activeTab, onTabChange, counts }: TabNavigationProps) {
  const tabs = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: '🏛️',
      color: 'from-yellow-500 to-yellow-600',
      count: counts?.dashboard || 0
    },
    {
      id: 'sellers',
      label: 'Sellers',
      icon: '👥',
      color: 'from-cyan-500 to-cyan-600',
      count: counts?.sellers || 0
    },
    {
      id: 'buyers',
      label: 'Buyers',
      icon: '💎',
      color: 'from-emerald-500 to-emerald-600',
      count: counts?.buyers || 0
    },
    {
      id: 'deals',
      label: 'Deals',
      icon: '📊',
      color: 'from-purple-500 to-purple-600',
      count: counts?.deals || 0
    },
    {
      id: 'ai-analytics',
      label: 'AI Analytics',
      icon: '🤖',
      color: 'from-pink-500 to-pink-600',
      count: 0
    }
  ];

  return (
    <div className="pharaoh-card mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-gold-shine flex items-center gap-3">
          <CSSGem grade="A+" size="lg" />
          MaxSam V4 Command Center
        </h2>
        <div className="flex items-center gap-4">
          <div className="text-right pharaoh-card-mini">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Total Revenue</div>
            <div className="text-2xl font-black text-gold-shine">$2.4M</div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 p-1 bg-zinc-900/50 rounded-xl border border-zinc-800">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-3 px-6 py-3 rounded-lg font-bold text-sm
              transition-all duration-300 relative overflow-hidden group
              ${activeTab === tab.id
                ? `bg-gradient-to-r ${tab.color} text-white shadow-lg shadow-gold/20`
                : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'
              }
            `}
          >
            <span className="text-lg">{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span className={`
                px-2 py-0.5 rounded-full text-xs font-bold
                ${activeTab === tab.id
                  ? 'bg-white/20 text-white'
                  : 'bg-zinc-700 text-zinc-300'
                }
              `}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
            )}
          </button>
        ))}
      </div>

      {/* Active Tab Indicator */}
      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
          <span className="text-zinc-400 text-sm">System Online • Real-time Updates Active</span>
        </div>
        <div className="text-zinc-500 text-xs">
          Last sync: {new Date().toLocaleTimeString()}
        </div>
      </div>
    </div>
  );
}
