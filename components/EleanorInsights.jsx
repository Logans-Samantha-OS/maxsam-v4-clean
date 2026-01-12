'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export default function EleanorInsights() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    generateInsights();
  }, []);

  const generateInsights = async () => {
    try {
      // Fetch all leads and contracts
      const [leadsResult, contractsResult] = await Promise.all([
        supabase.from('maxsam_leads').select('*'),
        supabase.from('contracts').select('*, maxsam_leads(deal_grade, eleanor_score, city)'),
      ]);

      const leads = leadsResult.data || [];
      const contracts = contractsResult.data || [];

      const newInsights = [];

      // INSIGHT 1: Grade Performance Analysis
      const gradeStats = {};
      ['A+', 'A', 'B', 'C', 'D', 'F'].forEach((grade) => {
        const gradeLeads = leads.filter((l) => l.deal_grade === grade);
        const gradeContracts = contracts.filter(
          (c) => c.maxsam_leads?.deal_grade === grade
        );
        const conversionRate =
          gradeLeads.length > 0
            ? (gradeContracts.length / gradeLeads.length) * 100
            : 0;

        gradeStats[grade] = {
          total: gradeLeads.length,
          converted: gradeContracts.length,
          rate: conversionRate,
        };
      });

      // Find unexpected performers
      if (gradeStats.B.rate > gradeStats.A.rate && gradeStats.B.total > 3) {
        newInsights.push({
          type: 'surprise',
          priority: 'high',
          title: 'B-Grade Leads Outperforming A-Grades',
          description: `B-grade leads are converting at ${gradeStats.B.rate.toFixed(
            1
          )}% vs A-grade at ${gradeStats.A.rate.toFixed(
            1
          )}%. Eleanor may need recalibration.`,
          action: 'Review scoring criteria for B-grade leads',
          impact: 'high',
        });
      }

      // INSIGHT 2: Geographic Performance
      const cityStats = {};
      leads.forEach((lead) => {
        const city = lead.city || 'Unknown';
        if (!cityStats[city]) {
          cityStats[city] = {
            total: 0,
            converted: 0,
            avgExcess: 0,
            totalExcess: 0,
          };
        }
        cityStats[city].total++;
        cityStats[city].totalExcess += lead.excess_funds_amount || 0;
      });

      contracts.forEach((contract) => {
        const city = contract.maxsam_leads?.city || 'Unknown';
        if (cityStats[city]) {
          cityStats[city].converted++;
        }
      });

      // Find hot cities
      const topCity = Object.entries(cityStats)
        .filter(([city, stats]) => stats.total >= 3)
        .sort((a, b) => {
          const rateA = (a[1].converted / a[1].total) * 100;
          const rateB = (b[1].converted / b[1].total) * 100;
          return rateB - rateA;
        })[0];

      if (topCity) {
        const [cityName, stats] = topCity;
        const rate = (stats.converted / stats.total) * 100;
        newInsights.push({
          type: 'geographic',
          priority: 'medium',
          title: `${cityName} is a Hot Market`,
          description: `${cityName} leads convert at ${rate.toFixed(
            1
          )}% with avg excess of $${(stats.totalExcess / stats.total).toFixed(
            0
          )}. Focus here!`,
          action: `Prioritize ${cityName} leads for calling`,
          impact: 'medium',
        });
      }

      // INSIGHT 3: Score Threshold Analysis
      const highScoreLeads = leads.filter((l) => l.eleanor_score >= 85);
      const highScoreContracts = contracts.filter(
        (c) => (c.maxsam_leads?.eleanor_score || 0) >= 85
      );
      const highScoreRate =
        highScoreLeads.length > 0
          ? (highScoreContracts.length / highScoreLeads.length) * 100
          : 0;

      const medScoreLeads = leads.filter(
        (l) => l.eleanor_score >= 70 && l.eleanor_score < 85
      );
      const medScoreContracts = contracts.filter((c) => {
        const score = c.maxsam_leads?.eleanor_score || 0;
        return score >= 70 && score < 85;
      });
      const medScoreRate =
        medScoreLeads.length > 0
          ? (medScoreContracts.length / medScoreLeads.length) * 100
          : 0;

      if (medScoreRate > highScoreRate && medScoreLeads.length > 5) {
        newInsights.push({
          type: 'scoring',
          priority: 'high',
          title: 'Score Threshold May Be Too High',
          description: `Leads scoring 70-84 convert at ${medScoreRate.toFixed(
            1
          )}% vs 85+ at ${highScoreRate.toFixed(
            1
          )}%. Consider lowering priority threshold.`,
          action: 'Review leads in 70-84 range for patterns',
          impact: 'high',
        });
      }

      // INSIGHT 4: Phone Number Impact
      const leadsWithPhone = leads.filter((l) => l.phone);
      const leadsWithoutPhone = leads.filter((l) => !l.phone);

      if (leadsWithoutPhone.length > leadsWithPhone.length * 0.3) {
        newInsights.push({
          type: 'data-quality',
          priority: 'high',
          title: 'Missing Phone Numbers Blocking Progress',
          description: `${
            leadsWithoutPhone.length
          } leads (${((leadsWithoutPhone.length / leads.length) * 100).toFixed(
            0
          )}%) have no phone numbers. These can't be contacted.`,
          action: 'Run Dallas CAD enrichment to get phone numbers',
          impact: 'critical',
        });
      }

      // INSIGHT 5: Deal Type Optimization
      const excessOnly = contracts.filter((c) => c.deal_type === 'excess_only');
      const wholesale = contracts.filter((c) => c.deal_type === 'wholesale');
      const dual = contracts.filter((c) => c.deal_type === 'dual');

      const avgExcessRevenue =
        excessOnly.length > 0
          ?
            excessOnly.reduce((sum, c) => sum + (c.total_fee || 0), 0) /
            excessOnly.length
          : 0;
      const avgDualRevenue =
        dual.length > 0
          ? dual.reduce((sum, c) => sum + (c.total_fee || 0), 0) / dual.length
          : 0;

      if (avgDualRevenue > avgExcessRevenue * 2 && dual.length > 0) {
        newInsights.push({
          type: 'revenue',
          priority: 'medium',
          title: 'DUAL Deals Generate 3x More Revenue',
          description: `DUAL deals average $${(avgDualRevenue / 1000).toFixed(
            0
          )}K vs excess-only at $${(avgExcessRevenue / 1000).toFixed(
            0
          )}K. Train Sam to identify wholesale opportunities.`,
          action: 'Update Sam AI scripts to ask about selling property',
          impact: 'high',
        });
      }

      // Default insight if none found
      if (newInsights.length === 0) {
        newInsights.push({
          type: 'status',
          priority: 'low',
          title: 'System Operating Normally',
          description:
            'Eleanor is performing as expected. No anomalies detected.',
          action: 'Continue current operations',
          impact: 'low',
        });
      }

      setInsights(newInsights);
    } catch (error) {
      console.error('Error generating insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    critical: 'border-red-500 bg-red-500/10',
    high: 'border-orange-500 bg-orange-500/10',
    medium: 'border-yellow-500 bg-yellow-500/10',
    low: 'border-green-500 bg-green-500/10',
  };

  const priorityIcons = {
    critical: '🚨',
    high: '⚠️',
    medium: '💡',
    low: '✅',
  };

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="animate-pulse text-zinc-400">Analyzing data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">
          🤖 Eleanor's Insights
        </h2>
        <button
          onClick={generateInsights}
          className="text-sm px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      <div className="space-y-3">
        {insights.map((insight, idx) => (
          <div
            key={idx}
            className={`bg-zinc-900 border-2 rounded-lg p-4 ${priorityColors[insight.priority]}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 flex-1">
                <span className="text-2xl">{priorityIcons[insight.priority]}</span>
                <div className="flex-1">
                  <h3 className="text-white font-semibold mb-1">
                    {insight.title}
                  </h3>
                  <p className="text-sm text-zinc-300 mb-2">
                    {insight.description}
                  </p>
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded">
                      {insight.action}
                    </span>
                    <span className="text-zinc-500">
                      Impact: {insight.impact}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
