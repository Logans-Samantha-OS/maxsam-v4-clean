// app/api/leads/upload-blast/route.ts
// ONE-CLICK UPLOAD → SCORE → BLAST ENDPOINT

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const N8N_WEBHOOK = process.env.NEXT_PUBLIC_N8N_WEBHOOK_URL || 'https://skooki.app.n8n.cloud/webhook';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const autoBlast = formData.get('autoBlast') === 'true';
    const blastLimit = parseInt(formData.get('blastLimit') as string) || 50;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file content
    const fileText = await file.text();
    const fileType = file.name.endsWith('.csv') ? 'csv' : 'pdf';

    // Generate import ID
    const importId = `import-${Date.now()}`;

    // Create import job
    const { data: importJob, error: jobError } = await supabase
      .from('import_jobs')
      .insert({
        id: importId,
        file_name: file.name,
        list_type: 'excess_funds',
        status: 'processing',
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (jobError) throw jobError;

    // Send to N8N for processing
    const importResponse = await fetch(`${N8N_WEBHOOK}/import-leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        import_id: importId,
        file_name: file.name,
        file_content: fileText,
        file_type: fileType,
        list_type: 'excess_funds',
        auto_score: true,
        auto_queue: true,
      }),
    });

    if (!importResponse.ok) {
      throw new Error('N8N import failed');
    }

    // Wait 5 seconds for processing
    await new Promise(resolve => setTimeout(resolve, 5000));

    // If auto-blast enabled, trigger outreach
    if (autoBlast) {
      const blastResponse = await fetch(`${N8N_WEBHOOK}/start-outreach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          import_id: importId,
          limit: blastLimit,
          priority_filter: 'all', // or 'golden_only'
        }),
      });

      if (!blastResponse.ok) {
        console.error('Blast failed but import succeeded');
      }
    }

    // Get stats
    const { data: leads, error: leadsError } = await supabase
      .from('maxsam_leads')
      .select('id, eleanor_score, is_golden')
      .eq('import_id', importId);

    const stats = {
      total: leads?.length || 0,
      golden: leads?.filter(l => l.is_golden).length || 0,
      avgScore: leads?.length 
        ? Math.round(leads.reduce((sum, l) => sum + (l.eleanor_score || 0), 0) / leads.length)
        : 0,
    };

    return NextResponse.json({
      success: true,
      importId,
      stats,
      blastInitiated: autoBlast,
      message: autoBlast 
        ? `Imported ${stats.total} leads (${stats.golden} golden). Sam is now texting ${blastLimit} leads!`
        : `Imported ${stats.total} leads (${stats.golden} golden). Ready for manual blast.`,
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}

// GET endpoint for blast status
export async function GET(request: NextRequest) {
  const importId = request.nextUrl.searchParams.get('importId');
  
  if (!importId) {
    return NextResponse.json({ error: 'No import ID' }, { status: 400 });
  }

  const { data: job } = await supabase
    .from('import_jobs')
    .select('*')
    .eq('id', importId)
    .single();

  const { data: queue } = await supabase
    .from('maxsam_sam_call_queue')
    .select('status')
    .eq('import_id', importId);

  const stats = {
    total: queue?.length || 0,
    pending: queue?.filter(q => q.status === 'pending').length || 0,
    completed: queue?.filter(q => q.status === 'completed').length || 0,
    failed: queue?.filter(q => q.status === 'failed').length || 0,
  };

  return NextResponse.json({
    job,
    blastStats: stats,
  });
}
