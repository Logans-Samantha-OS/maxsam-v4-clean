/**
 * Golden Lead Hunter Cron API
 * Runs daily at 6am to scan unprocessed leads
 * Sends summary to morning report
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const N8N_WEBHOOK_BASE = 'https://skooki.app.n8n.cloud/webhook';

export async function POST(request: NextRequest) {
  const supabase = createClient();

  try {
    const body = await request.json().catch(() => ({}));
    const { triggered_by = 'cron', send_summary = true } = body;

    // Check if hunt is already running
    const { data: runningHunt } = await supabase
      .from('golden_hunt_runs')
      .select('id')
      .eq('status', 'running')
      .maybeSingle();

    if (runningHunt) {
      return NextResponse.json({
        success: false,
        message: 'A hunt is already running',
        hunt_id: runningHunt.id,
      });
    }

    // Get unprocessed leads count
    const { count: unprocessedCount } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact', head: true })
      .or('zillow_checked_at.is.null,golden_lead.is.null')
      .gte('excess_funds_amount', 2000);

    if (!unprocessedCount || unprocessedCount === 0) {
      // No leads to process, just send current golden leads summary
      if (send_summary) {
        await sendMorningSummary(supabase);
      }

      return NextResponse.json({
        success: true,
        message: 'No new leads to scan',
        summary_sent: send_summary,
      });
    }

    // Trigger the hunt via internal call
    const huntResponse = await fetch(new URL('/api/golden-leads/hunt', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        min_excess_amount: 2000,
        max_leads: 100, // Process up to 100 leads per cron run
      }),
    });

    const huntResult = await huntResponse.json();

    // Send morning summary
    if (send_summary) {
      await sendMorningSummary(supabase, huntResult);
    }

    // Try to trigger N8N workflow if it exists
    try {
      await fetch(`${N8N_WEBHOOK_BASE}/golden-hunt-complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hunt_id: huntResult.hunt_id,
          golden_found: huntResult.golden_found,
          scanned: huntResult.scanned,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      console.log('N8N webhook not available');
    }

    return NextResponse.json({
      success: true,
      hunt_result: huntResult,
      summary_sent: send_summary,
    });
  } catch (error) {
    console.error('Golden leads cron error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: message, success: false },
      { status: 500 }
    );
  }
}

async function sendMorningSummary(
  supabase: ReturnType<typeof createClient>,
  huntResult?: { golden_found?: number; scanned?: number; golden_leads?: Array<{ owner_name: string; golden_score: number; listing_status: string }> }
) {
  try {
    // Get golden leads stats
    const { data: goldenLeads, count: goldenCount } = await supabase
      .from('maxsam_leads')
      .select('id, owner_name, property_address, excess_funds_amount, zillow_status, golden_score, combined_value', { count: 'exact' })
      .eq('golden_lead', true)
      .order('golden_score', { ascending: false })
      .limit(10);

    // Get total potential value
    const { data: valueData } = await supabase
      .from('maxsam_leads')
      .select('combined_value, excess_funds_amount')
      .eq('golden_lead', true);

    const totalCombinedValue = valueData?.reduce((sum, l) => sum + (l.combined_value || 0), 0) || 0;
    const totalExcessFunds = valueData?.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0) || 0;

    // Build summary message
    const summaryLines = [
      `🏆 **Golden Lead Hunter Report**`,
      `📅 ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`,
      ``,
    ];

    if (huntResult) {
      summaryLines.push(`**Today's Hunt:**`);
      summaryLines.push(`• Leads Scanned: ${huntResult.scanned || 0}`);
      summaryLines.push(`• New Golden Leads: ${huntResult.golden_found || 0}`);
      summaryLines.push(``);
    }

    summaryLines.push(`**Golden Lead Portfolio:**`);
    summaryLines.push(`• Total Golden Leads: ${goldenCount || 0}`);
    summaryLines.push(`• Total Excess Funds: $${totalExcessFunds.toLocaleString()}`);
    summaryLines.push(`• Potential Revenue: $${totalCombinedValue.toLocaleString()}`);
    summaryLines.push(``);

    if (goldenLeads && goldenLeads.length > 0) {
      summaryLines.push(`**Top Golden Leads:**`);
      goldenLeads.slice(0, 5).forEach((lead, i) => {
        const status = lead.zillow_status === 'active' ? '🟢 Active' :
          lead.zillow_status === 'pending' ? '🟡 Pending' :
            lead.zillow_status === 'sold' ? '🔴 Sold' : '⚪ Unknown';
        summaryLines.push(`${i + 1}. ${lead.owner_name} - $${(lead.excess_funds_amount || 0).toLocaleString()} - ${status} (Score: ${lead.golden_score})`);
      });
    }

    const summaryText = summaryLines.join('\n');

    // Try to send to Telegram
    try {
      await fetch(`${N8N_WEBHOOK_BASE}/telegram-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: summaryText,
          type: 'morning_golden_report',
        }),
      });
    } catch {
      console.log('Telegram notification not sent');
    }

    // Log to activity feed
    await supabase.from('activity_feed').insert({
      activity_type: 'golden_summary',
      description: `Morning Golden Report: ${goldenCount} leads, $${totalCombinedValue.toLocaleString()} potential`,
      metadata: {
        golden_count: goldenCount,
        total_value: totalCombinedValue,
        total_excess: totalExcessFunds,
        top_leads: goldenLeads?.slice(0, 5),
      },
    });

    return summaryText;
  } catch (error) {
    console.error('Failed to send morning summary:', error);
    throw error;
  }
}

// GET endpoint to manually check summary
export async function GET() {
  const supabase = createClient();

  try {
    // Get golden leads overview
    const { data: goldenLeads, count } = await supabase
      .from('maxsam_leads')
      .select('*', { count: 'exact' })
      .eq('golden_lead', true)
      .order('golden_score', { ascending: false });

    // Get status breakdown
    const statusBreakdown = {
      active: goldenLeads?.filter(l => l.zillow_status === 'active').length || 0,
      pending: goldenLeads?.filter(l => l.zillow_status === 'pending').length || 0,
      sold: goldenLeads?.filter(l => l.zillow_status === 'sold').length || 0,
      unknown: goldenLeads?.filter(l => !l.zillow_status || l.zillow_status === 'unknown').length || 0,
    };

    // Get recent hunts
    const { data: recentHunts } = await supabase
      .from('golden_hunt_runs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5);

    // Get value totals
    const totalExcess = goldenLeads?.reduce((sum, l) => sum + (l.excess_funds_amount || 0), 0) || 0;
    const totalCombined = goldenLeads?.reduce((sum, l) => sum + (l.combined_value || 0), 0) || 0;

    return NextResponse.json({
      success: true,
      summary: {
        total_golden: count || 0,
        status_breakdown: statusBreakdown,
        total_excess_funds: totalExcess,
        total_potential_revenue: totalCombined,
      },
      top_leads: goldenLeads?.slice(0, 10) || [],
      recent_hunts: recentHunts || [],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message, success: false }, { status: 500 });
  }
}
