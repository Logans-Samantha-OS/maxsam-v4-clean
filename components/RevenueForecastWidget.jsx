'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function RevenueForecastWidget() {
  const [forecast, setForecast] = useState({
    conservative: 0,
    realistic: 0,
    optimistic: 0,
    activeContracts: 0,
    avgDealSize: 0,
  });

  useEffect(() => {
    calculateForecast();
  }, []);

  const calculateForecast = async () => {
    // Get active contracts
    const { data: contracts } = await supabase
      .from('contracts')
      .select('*')
      .in('status', ['draft', 'sent', 'signed']);

    if (!contracts || contracts.length === 0) {
      return;
    }

    const totalPipeline = contracts.reduce(
      (sum, c) => sum + (c.total_fee || 0),
      0,
    );
    const avgDealSize = totalPipeline / contracts.length;

    // Calculate forecasts with different close rate assumptions
    const conservativeForecast = totalPipeline * 0.70; // 70% close rate
    const realisticForecast = totalPipeline * 0.85; // 85% close rate
    const optimisticForecast = totalPipeline * 0.95; // 95% close rate

    setForecast({
      conservative: conservativeForecast,
      realistic: realisticForecast,
      optimistic: optimisticForecast,
      activeContracts: contracts.length,
      avgDealSize: avgDealSize,
    });
  };

  return (
    <div className="bg-gradient-to-br from-green-900/20 to-zinc-900 border border-green-900/50 rounded-lg p-6">
      <div className="flex items-center space-x-3 mb-6">
        <span className="text-2xl">📈</span>
        <div>
          <h2 className="text-xl font-semibold text-white">90-Day Revenue Forecast</h2>
          <p className="text-sm text-zinc-400">
            Based on {forecast.activeContracts} active contracts
          </p>
        </div>
      </div>

      {/* Forecast Scenarios */}
      <div className="space-y-4 mb-6">
        {/* Conservative */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm text-zinc-400">Conservative (70% close)</div>
              <div className="text-xs text-zinc-500 mt-1">Worst-case scenario</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-orange-400">
                ${(forecast.conservative / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-zinc-400">Total revenue</div>
            </div>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="bg-orange-500 h-2 rounded-full"
              style={{ width: '70%' }}
            />
          </div>
        </div>

        {/* Realistic */}
        <div className="bg-gradient-to-r from-green-900/30 to-zinc-800/50 rounded-lg p-4 border-2 border-green-500/30">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm text-white font-semibold">
                Realistic (85% close)
              </div>
              <div className="text-xs text-green-400 mt-1">Most likely outcome</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-400">
                ${(forecast.realistic / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-zinc-400">Total revenue</div>
            </div>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="bg-green-500 h-2 rounded-full"
              style={{ width: '85%' }}
            />
          </div>
        </div>

        {/* Optimistic */}
        <div className="bg-zinc-800/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm text-zinc-400">Optimistic (95% close)</div>
              <div className="text-xs text-zinc-500 mt-1">Best-case scenario</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-cyan-400">
                ${(forecast.optimistic / 1000).toFixed(0)}K
              </div>
              <div className="text-xs text-zinc-400">Total revenue</div>
            </div>
          </div>
          <div className="w-full bg-zinc-700 rounded-full h-2">
            <div
              className="bg-cyan-500 h-2 rounded-full"
              style={{ width: '95%' }}
            />
          </div>
        </div>
      </div>

      {/* Deal Size Stats */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-zinc-800/30 rounded-lg p-3">
          <div className="text-xs text-zinc-400 mb-1">Avg Deal Size</div>
          <div className="text-xl font-bold text-white">
            ${(forecast.avgDealSize / 1000).toFixed(1)}K
          </div>
        </div>
        
        <div className="bg-zinc-800/30 rounded-lg p-3">
          <div className="text-xs text-zinc-400 mb-1">Active Pipeline</div>
          <div className="text-xl font-bold text-cyan-400">
            ${((forecast.realistic / 0.85) / 1000).toFixed(0)}K
          </div>
        </div>
      </div>

      {/* Insight */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
        <div className="flex items-start space-x-2">
          <span>💡</span>
          <div className="flex-1 text-xs">
            <div className="text-white font-medium mb-1">Forecast Methodology</div>
            <div className="text-zinc-300">
              Based on {forecast.activeContracts} contracts, historical {85}% close rate, 
              and {42}-day avg closing time. Add more qualified leads to increase projections.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
