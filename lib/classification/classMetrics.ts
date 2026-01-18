/**
 * Class-Specific Metrics Tracking
 * Phase 13.3 - Economic Lead Classification
 *
 * CRITICAL: Track metrics SEPARATELY by class - NEVER BLEND.
 *
 * Track independently for A, B, C:
 * - Conversion rate
 * - Cost per recovered dollar
 * - Time to cash
 * - Negative signals
 * - Drop-off points
 */

import { createClient } from '@supabase/supabase-js';
import { LeadClass, ClassMetrics, CLASS_PRIORITY_ORDER } from './types';

// ============================================================================
// COMPUTE CLASS METRICS
// ============================================================================

export interface MetricsPeriod {
  type: 'day' | 'week' | 'month' | 'all_time';
  start: Date;
  end: Date;
}

export function getPeriod(type: MetricsPeriod['type']): MetricsPeriod {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start: Date;

  switch (type) {
    case 'day':
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start = new Date(now);
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case 'month':
      start = new Date(now);
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
    case 'all_time':
      start = new Date('2020-01-01');
      break;
  }

  return { type, start, end };
}

export async function computeClassMetrics(
  leadClass: LeadClass,
  period: MetricsPeriod,
  supabaseUrl: string,
  supabaseKey: string
): Promise<ClassMetrics> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get leads in this class for the period
  const { data: leads } = await supabase
    .from('maxsam_leads')
    .select(`
      id,
      status,
      excess_funds_amount,
      expected_value,
      contact_attempts,
      created_at,
      last_contact_date,
      classified_at
    `)
    .eq('lead_class', leadClass)
    .gte('created_at', period.start.toISOString())
    .lte('created_at', period.end.toISOString());

  const leadsArray = leads || [];

  // Count by status
  const total = leadsArray.length;
  const contacted = leadsArray.filter((l) => (l.contact_attempts || 0) > 0).length;
  const responded = leadsArray.filter((l) =>
    ['responded', 'qualified', 'contract_sent', 'contract_signed', 'closed'].includes(l.status)
  ).length;
  const qualified = leadsArray.filter((l) =>
    ['qualified', 'contract_sent', 'contract_signed', 'closed'].includes(l.status)
  ).length;
  const contracted = leadsArray.filter((l) =>
    ['contract_sent', 'contract_signed', 'closed'].includes(l.status)
  ).length;
  const closed = leadsArray.filter((l) => l.status === 'closed').length;

  // Revenue metrics
  const totalExpectedValue = leadsArray.reduce(
    (sum, l) => sum + (Number(l.expected_value) || 0),
    0
  );
  const closedLeads = leadsArray.filter((l) => l.status === 'closed');
  const totalRecovered = closedLeads.reduce(
    (sum, l) => sum + (Number(l.expected_value) || 0),
    0
  );
  const avgDealSize = closed > 0 ? totalRecovered / closed : 0;

  // Efficiency metrics
  const conversionRate = contacted > 0 ? closed / contacted : 0;
  const responseRate = contacted > 0 ? responded / contacted : 0;
  const qualificationRate = responded > 0 ? qualified / responded : 0;
  const closeRate = qualified > 0 ? closed / qualified : 0;

  // Get opt-outs for this class
  const { count: optOutCount } = await supabase
    .from('opt_outs')
    .select('*', { count: 'exact', head: true })
    .gte('opted_out_at', period.start.toISOString())
    .lte('opted_out_at', period.end.toISOString());

  const optOutRate = contacted > 0 ? (optOutCount || 0) / contacted : 0;

  // Get negative responses (from communication_logs)
  const { count: negativeCount } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sentiment', 'negative')
    .gte('created_at', period.start.toISOString())
    .lte('created_at', period.end.toISOString());

  const negativeResponseRate = contacted > 0 ? (negativeCount || 0) / contacted : 0;

  // Drop-off stages
  const dropoffStages: Record<string, number> = {
    contacted_to_responded: contacted > 0 ? 1 - responseRate : 0,
    responded_to_qualified: responded > 0 ? 1 - qualificationRate : 0,
    qualified_to_contracted: qualified > 0 ? (qualified - contracted) / qualified : 0,
    contracted_to_closed: contracted > 0 ? (contracted - closed) / contracted : 0,
  };

  return {
    class: leadClass,
    period: period.type,
    period_start: period.start.toISOString().split('T')[0],
    period_end: period.end.toISOString().split('T')[0],

    total_leads: total,
    contacted,
    responded,
    qualified,
    contracted,
    closed,

    total_expected_value: totalExpectedValue,
    total_recovered: totalRecovered,
    avg_deal_size: avgDealSize,

    conversion_rate: conversionRate,
    response_rate: responseRate,
    qualification_rate: qualificationRate,
    close_rate: closeRate,

    // Time metrics (placeholders - would need actual timestamps)
    avg_time_to_response_hours: 0,
    avg_time_to_close_days: 0,
    avg_time_to_cash_days: 0,

    // Cost metrics (placeholders - would need cost tracking)
    cost_per_lead: 0,
    cost_per_close: 0,
    cost_per_recovered_dollar: 0,

    opt_out_rate: optOutRate,
    negative_response_rate: negativeResponseRate,
    dropoff_stages: dropoffStages,
  };
}

// ============================================================================
// STORE METRICS
// ============================================================================

export async function storeClassMetrics(
  metrics: ClassMetrics,
  supabaseUrl: string,
  supabaseKey: string
): Promise<void> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  await supabase.from('class_metrics').upsert(
    {
      class: metrics.class,
      period: metrics.period,
      period_start: metrics.period_start,
      period_end: metrics.period_end,
      total_leads: metrics.total_leads,
      contacted: metrics.contacted,
      responded: metrics.responded,
      qualified: metrics.qualified,
      contracted: metrics.contracted,
      closed: metrics.closed,
      total_expected_value: metrics.total_expected_value,
      total_recovered: metrics.total_recovered,
      avg_deal_size: metrics.avg_deal_size,
      conversion_rate: metrics.conversion_rate,
      response_rate: metrics.response_rate,
      qualification_rate: metrics.qualification_rate,
      close_rate: metrics.close_rate,
      avg_time_to_response_hours: metrics.avg_time_to_response_hours,
      avg_time_to_close_days: metrics.avg_time_to_close_days,
      avg_time_to_cash_days: metrics.avg_time_to_cash_days,
      cost_per_lead: metrics.cost_per_lead,
      cost_per_close: metrics.cost_per_close,
      cost_per_recovered_dollar: metrics.cost_per_recovered_dollar,
      opt_out_rate: metrics.opt_out_rate,
      negative_response_rate: metrics.negative_response_rate,
      dropoff_stages: metrics.dropoff_stages,
      computed_at: new Date().toISOString(),
    },
    {
      onConflict: 'class,period,period_start,period_end',
    }
  );
}

// ============================================================================
// COMPUTE ALL CLASS METRICS
// ============================================================================

export async function computeAllClassMetrics(
  periodType: MetricsPeriod['type'],
  supabaseUrl: string,
  supabaseKey: string
): Promise<ClassMetrics[]> {
  const period = getPeriod(periodType);
  const allMetrics: ClassMetrics[] = [];

  for (const cls of CLASS_PRIORITY_ORDER) {
    const metrics = await computeClassMetrics(cls, period, supabaseUrl, supabaseKey);
    allMetrics.push(metrics);
    await storeClassMetrics(metrics, supabaseUrl, supabaseKey);
  }

  return allMetrics;
}

// ============================================================================
// METRICS COMPARISON
// ============================================================================

export interface ClassComparison {
  winning_class: LeadClass | null;
  comparison: {
    class: LeadClass;
    conversion_rate: number;
    avg_deal_size: number;
    score: number; // Composite score
  }[];
  insights: string[];
}

export async function compareClasses(
  periodType: MetricsPeriod['type'],
  supabaseUrl: string,
  supabaseKey: string
): Promise<ClassComparison> {
  const metrics = await computeAllClassMetrics(periodType, supabaseUrl, supabaseKey);

  const comparison = metrics.map((m) => ({
    class: m.class,
    conversion_rate: m.conversion_rate,
    avg_deal_size: m.avg_deal_size,
    score: m.conversion_rate * 0.4 + (m.avg_deal_size / 10000) * 0.6, // Weighted score
  }));

  // Sort by score
  comparison.sort((a, b) => b.score - a.score);

  const insights: string[] = [];

  // Generate insights
  const classA = metrics.find((m) => m.class === 'A');
  const classB = metrics.find((m) => m.class === 'B');
  const classC = metrics.find((m) => m.class === 'C');

  if (classA && classB) {
    if (classB.conversion_rate > classA.conversion_rate * 1.2) {
      insights.push(
        `Class B has ${((classB.conversion_rate / classA.conversion_rate - 1) * 100).toFixed(0)}% higher conversion than Class A`
      );
    }
  }

  if (classB && classB.avg_deal_size > 10000) {
    insights.push(`Class B "big fish" averaging $${classB.avg_deal_size.toLocaleString()} per deal`);
  }

  if (classC && classC.opt_out_rate > 0.05) {
    insights.push(
      `Warning: Class C opt-out rate at ${(classC.opt_out_rate * 100).toFixed(1)}% - consider reducing volume`
    );
  }

  return {
    winning_class: comparison.length > 0 ? comparison[0].class : null,
    comparison,
    insights,
  };
}

// ============================================================================
// METRICS DASHBOARD
// ============================================================================

export interface MetricsDashboard {
  period: MetricsPeriod['type'];
  generated_at: string;
  classes: ClassMetrics[];
  totals: {
    total_leads: number;
    total_contacted: number;
    total_closed: number;
    total_recovered: number;
    overall_conversion_rate: number;
  };
  recommendations: string[];
}

export async function generateMetricsDashboard(
  periodType: MetricsPeriod['type'],
  supabaseUrl: string,
  supabaseKey: string
): Promise<MetricsDashboard> {
  const metrics = await computeAllClassMetrics(periodType, supabaseUrl, supabaseKey);

  // Compute totals (but don't blend rates!)
  const totals = {
    total_leads: metrics.reduce((sum, m) => sum + m.total_leads, 0),
    total_contacted: metrics.reduce((sum, m) => sum + m.contacted, 0),
    total_closed: metrics.reduce((sum, m) => sum + m.closed, 0),
    total_recovered: metrics.reduce((sum, m) => sum + m.total_recovered, 0),
    overall_conversion_rate: 0,
  };
  totals.overall_conversion_rate =
    totals.total_contacted > 0 ? totals.total_closed / totals.total_contacted : 0;

  // Generate recommendations
  const recommendations: string[] = [];

  const classA = metrics.find((m) => m.class === 'A');
  const classB = metrics.find((m) => m.class === 'B');
  const classC = metrics.find((m) => m.class === 'C');

  if (classA && classA.total_leads > 0 && classA.contacted === 0) {
    recommendations.push('URGENT: Class A leads not being contacted - prioritize immediately');
  }

  if (classB && classB.total_leads > 10 && classA?.contacted === 0) {
    recommendations.push('Class B has leads but Class A should be worked first');
  }

  if (classC && classC.opt_out_rate > 0.08) {
    recommendations.push('Class C opt-out rate exceeding threshold - consider pausing');
  }

  if (totals.total_recovered > 0 && classB) {
    const classBContribution = classB.total_recovered / totals.total_recovered;
    if (classBContribution > 0.5) {
      recommendations.push(
        `Class B "big fish" driving ${(classBContribution * 100).toFixed(0)}% of revenue - maintain focus`
      );
    }
  }

  return {
    period: periodType,
    generated_at: new Date().toISOString(),
    classes: metrics,
    totals,
    recommendations,
  };
}

// ============================================================================
// FORMAT METRICS FOR DISPLAY
// ============================================================================

export function formatMetricsAsText(metrics: ClassMetrics): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push(`           CLASS ${metrics.class} METRICS - ${metrics.period.toUpperCase()}`);
  lines.push('═══════════════════════════════════════════════════════════════');
  lines.push('');
  lines.push('VOLUME:');
  lines.push(`  Total Leads:     ${metrics.total_leads}`);
  lines.push(`  Contacted:       ${metrics.contacted}`);
  lines.push(`  Responded:       ${metrics.responded}`);
  lines.push(`  Qualified:       ${metrics.qualified}`);
  lines.push(`  Contracted:      ${metrics.contracted}`);
  lines.push(`  Closed:          ${metrics.closed}`);
  lines.push('');
  lines.push('REVENUE:');
  lines.push(`  Expected Value:  $${metrics.total_expected_value.toLocaleString()}`);
  lines.push(`  Recovered:       $${metrics.total_recovered.toLocaleString()}`);
  lines.push(`  Avg Deal Size:   $${metrics.avg_deal_size.toLocaleString()}`);
  lines.push('');
  lines.push('EFFICIENCY:');
  lines.push(`  Conversion Rate: ${(metrics.conversion_rate * 100).toFixed(1)}%`);
  lines.push(`  Response Rate:   ${(metrics.response_rate * 100).toFixed(1)}%`);
  lines.push(`  Close Rate:      ${(metrics.close_rate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('SIGNALS:');
  lines.push(`  Opt-Out Rate:    ${(metrics.opt_out_rate * 100).toFixed(1)}%`);
  lines.push(`  Negative Rate:   ${(metrics.negative_response_rate * 100).toFixed(1)}%`);
  lines.push('');
  lines.push('DROP-OFF POINTS:');
  for (const [stage, rate] of Object.entries(metrics.dropoff_stages)) {
    lines.push(`  ${stage}: ${((rate as number) * 100).toFixed(1)}%`);
  }
  lines.push('═══════════════════════════════════════════════════════════════');

  return lines.join('\n');
}
