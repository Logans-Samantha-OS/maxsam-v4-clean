import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendTelegramMessage } from '@/lib/telegram';

/**
 * ALEX Notebook Sync Cron Job
 * Runs at 12:00 AM CT (06:00 UTC) Monday-Saturday
 * Queries NotebookLM for new leads from county notebooks
 */

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const authHeader = request.headers.get('authorization');
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    await sendTelegramMessage('🌙 <b>ALEX starting notebook sync...</b>\n\nQuerying county notebooks for new leads.');

    const supabase = getSupabase();
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    // Get configured counties from system_config
    const { data: configData } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'active_counties')
      .single();

    const counties = configData?.value?.counties || ['Dallas'];
    let totalImported = 0;
    const countyResults: { county: string; imported: number; error?: string }[] = [];

    for (const county of counties) {
      try {
        // Call the notebook sync endpoint for each county
        const response = await fetch(`${baseUrl}/api/alex/notebook-sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ county })
        });

        const data = await response.json();

        if (response.ok && data.imported) {
          totalImported += data.imported;
          countyResults.push({ county, imported: data.imported });
        } else {
          countyResults.push({ county, imported: 0, error: data.error || 'Unknown error' });
        }
      } catch (err) {
        countyResults.push({
          county,
          imported: 0,
          error: err instanceof Error ? err.message : 'Failed to sync'
        });
      }
    }

    // Log to notebook_extractions table
    await supabase.from('notebook_extractions').insert({
      extraction_type: 'cron_sync',
      counties_processed: counties,
      leads_imported: totalImported,
      results: countyResults,
      created_at: new Date().toISOString()
    });

    const duration = Math.round((Date.now() - startTime) / 1000);
    const resultsList = countyResults
      .map(r => `• ${r.county}: ${r.imported} leads${r.error ? ` (${r.error})` : ''}`)
      .join('\n');

    await sendTelegramMessage(`✅ <b>ALEX: Notebook sync complete</b>

<b>Imported:</b> ${totalImported} new leads
<b>Duration:</b> ${duration}s

<b>By County:</b>
${resultsList}

Next: Skip trace at 2 AM CT`);

    return NextResponse.json({
      success: true,
      totalImported,
      countyResults,
      duration
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Notebook sync failed';
    await sendTelegramMessage(`❌ <b>ALEX Notebook Sync FAILED</b>\n\nError: ${message}`);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
