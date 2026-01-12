'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { CSSGem } from './CSSGem';

interface AIInsight {
  id: string;
  type: 'opportunity' | 'risk' | 'optimization' | 'prediction';
  title: string;
  description: string;
  confidence: number;
  impact: 'high' | 'medium' | 'low';
  actionable: boolean;
  suggested_action?: string;
  potential_value?: number;
  created_at: string;
}

interface PredictiveMetric {
  name: string;
  current_value: number;
  predicted_value: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  timeframe: string;
}

export default function AIAnalytics() {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [metrics, setMetrics] = useState<PredictiveMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAIAnalytics() {
      try {
        setLoading(true);

        // Fetch AI insights (mock data for now)
        const mockInsights: AIInsight[] = [
          {
            id: '1',
            type: 'opportunity',
            title: 'High-Value Lead Cluster Detected',
            description: 'AI has identified 3 leads in the same zip code with excess funds > $50K, indicating potential bulk deal opportunity.',
            confidence: 92,
            impact: 'high',
            actionable: true,
            suggested_action: 'Contact all 3 leads within 24 hours for potential multi-property package deal',
            potential_value: 37500,
            created_at: new Date().toISOString()
          },
          {
            id: '2',
            type: 'risk',
            title: 'Expiration Risk Alert',
            description: '2 leads with scores > 85 are expiring within 7 days. Immediate action recommended.',
            confidence: 88,
            impact: 'high',
            actionable: true,
            suggested_action: 'Prioritize outreach and consider expedited contract process',
            potential_value: 28000,
            created_at: new Date().toISOString()
          },
          {
            id: '3',
            type: 'optimization',
            title: 'Call Timing Optimization',
            description: 'Analysis shows best response times for this demographic are 6-8 PM on weekdays.',
            confidence: 76,
            impact: 'medium',
            actionable: true,
            suggested_action: 'Schedule calls for evening hours to increase contact rates by 35%',
            potential_value: 12000,
            created_at: new Date().toISOString()
          },
          {
            id: '4',
            type: 'prediction',
            title: 'Market Trend Prediction',
            description: 'AI predicts 15% increase in excess funds cases in Dallas County over next 30 days.',
            confidence: 81,
            impact: 'medium',
            actionable: true,
            suggested_action: 'Scale up marketing and lead generation efforts to capture increased market opportunity',
            potential_value: 45000,
            created_at: new Date().toISOString()
          }
        ];

        const mockMetrics: PredictiveMetric[] = [
          {
            name: 'Monthly Revenue',
            current_value: 125000,
            predicted_value: 145000,
            trend: 'up',
            confidence: 87,
            timeframe: '30 days'
          },
          {
            name: 'Lead Conversion Rate',
            current_value: 23.5,
            predicted_value: 28.2,
            trend: 'up',
            confidence: 79,
            timeframe: '30 days'
          },
          {
            name: 'Average Deal Size',
            current_value: 18500,
            predicted_value: 22000,
            trend: 'up',
            confidence: 73,
            timeframe: '60 days'
          },
          {
            name: 'Pipeline Velocity',
            current_value: 14.2,
            predicted_value: 16.8,
            trend: 'up',
            confidence: 82,
            timeframe: '30 days'
          }
        ];

        setInsights(mockInsights);
        setMetrics(mockMetrics);
      } catch (error) {
        console.error('Error fetching AI analytics:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchAIAnalytics();
  }, []);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity': return '💎';
      case 'risk': return '⚠️';
      case 'optimization': return '⚡';
      case 'prediction': return '🔮';
      default: return '📊';
    }
  };

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'opportunity': return 'from-emerald-500 to-emerald-600';
      case 'risk': return 'from-red-500 to-red-600';
      case 'optimization': return 'from-blue-500 to-blue-600';
      case 'prediction': return 'from-purple-500 to-purple-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const formatCurrency = (amount: number): string => {
    if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `$${(amount / 1000).toFixed(0)}K`;
    return `$${amount.toFixed(0)}`;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* AI Header */}
      <div className="pharaoh-card">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-3xl">🤖</span>
          <div>
            <h2 className="text-2xl font-black text-gold-shine">AI Analytics & Insights</h2>
            <p className="text-zinc-400 text-sm">Powered by MaxSam AI • Real-time analysis</p>
          </div>
        </div>
      </div>

      {/* Predictive Metrics */}
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>📈</span> Predictive Analytics
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric, index) => (
            <div key={index} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-zinc-400 text-xs uppercase tracking-wider">{metric.name}</p>
                  <p className="text-2xl font-black text-white">
                    {metric.name.includes('Rate') ? `${metric.current_value}%` : formatCurrency(metric.current_value)}
                  </p>
                </div>
                <div className={`text-2xl ${
                  metric.trend === 'up' ? 'text-emerald-400' : 
                  metric.trend === 'down' ? 'text-red-400' : 'text-yellow-400'
                }`}>
                  {metric.trend === 'up' ? '↗️' : metric.trend === 'down' ? '↘️' : '→'}
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 text-xs">Predicted ({metric.timeframe}):</span>
                  <span className="text-cyan-400 font-bold text-sm">
                    {metric.name.includes('Rate') ? `${metric.predicted_value}%` : formatCurrency(metric.predicted_value)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">Confidence:</span>
                  <div className="flex-1 bg-zinc-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-purple-400 h-2 rounded-full"
                      style={{ width: `${metric.confidence}%` }}
                    />
                  </div>
                  <span className="text-purple-400 text-xs font-bold">{metric.confidence}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insights */}
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>🧠</span> AI Insights & Recommendations
        </h3>
        
        <div className="space-y-4">
          {insights.map((insight) => (
            <div 
              key={insight.id} 
              className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden hover:border-purple-500/50 transition-all duration-300"
            >
              <div 
                className="p-4 cursor-pointer"
                onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{getInsightIcon(insight.type)}</div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-white">{insight.title}</h4>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium bg-gradient-to-r ${getInsightColor(insight.type)}`}>
                        {insight.type.toUpperCase()}
                      </span>
                      <span className={`text-xs font-bold ${getImpactColor(insight.impact)}`}>
                        {insight.impact.toUpperCase()} IMPACT
                      </span>
                    </div>
                    
                    <p className="text-zinc-300 text-sm mb-3">{insight.description}</p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-500 text-xs">Confidence:</span>
                          <div className="w-20 bg-zinc-700 rounded-full h-2">
                            <div 
                              className="bg-gradient-to-r from-cyan-500 to-cyan-400 h-2 rounded-full"
                              style={{ width: `${insight.confidence}%` }}
                            />
                          </div>
                          <span className="text-cyan-400 text-xs font-bold">{insight.confidence}%</span>
                        </div>
                        
                        {insight.potential_value && (
                          <div className="text-emerald-400 font-bold text-sm">
                            Value: {formatCurrency(insight.potential_value)}
                          </div>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {insight.actionable && (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full font-medium">
                            ✅ Actionable
                          </span>
                        )}
                        <span className="text-zinc-500 text-xs">
                          {new Date(insight.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                
                {expandedInsight === insight.id && insight.suggested_action && (
                  <div className="mt-4 pt-4 border-t border-zinc-700">
                    <div className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/30 rounded-lg p-3">
                      <p className="text-purple-400 text-xs font-bold mb-2">🎯 RECOMMENDED ACTION:</p>
                      <p className="text-white text-sm">{insight.suggested_action}</p>
                      
                      <div className="flex gap-2 mt-3">
                        <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm font-medium transition-colors">
                          Take Action
                        </button>
                        <button className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm font-medium transition-colors">
                          Dismiss
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Performance Stats */}
      <div className="pharaoh-card">
        <h3 className="text-lg font-bold text-gold mb-4 flex items-center gap-2">
          <span>⚡</span> AI Performance Metrics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-3xl font-black text-purple-400">94.2%</div>
            <div className="text-zinc-400 text-sm">Prediction Accuracy</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-emerald-400">2.3s</div>
            <div className="text-zinc-400 text-sm">Avg Response Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-cyan-400">1,247</div>
            <div className="text-zinc-400 text-sm">Insights Generated</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black text-gold">$487K</div>
            <div className="text-zinc-400 text-sm">Value Created</div>
          </div>
        </div>
      </div>
    </div>
  );
}
