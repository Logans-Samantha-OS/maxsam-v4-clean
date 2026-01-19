import { NextResponse } from 'next/server';
import { enforceGates, createBlockedResponse } from '@/lib/governance/middleware';

/**
 * POST /api/cron/import-leads - Import leads from Dallas County PDF
 *
 * This endpoint is called by Vercel Cron at 5:30 AM daily
 * Or can be triggered manually via the dashboard
 *
 * The actual PDF scraping is handled by n8n workflow
 * This endpoint triggers the n8n webhook
 */
export async function POST() {
  // GATE ENFORCEMENT - INTAKE PIPELINE
  const blocked = await enforceGates({ gate: 'gate_intake' });
  if (blocked) {
    return NextResponse.json(createBlockedResponse(blocked), { status: 503 });
  }

  try {
    // Check for n8n webhook URL
    const n8nWebhookUrl = process.env.N8N_IMPORT_WEBHOOK_URL;

    if (!n8nWebhookUrl) {
      return NextResponse.json({
        success: false,
        message: 'N8N webhook not configured. Set N8N_IMPORT_WEBHOOK_URL or use n8n workflow directly.'
      }, { status: 400 });
    }

    // Trigger n8n workflow
    const response = await fetch(n8nWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        trigger: 'cron',
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error(`N8N webhook failed: ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Import triggered via n8n webhook'
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/cron/import-leads - Check import status
 */
export async function GET() {
  return NextResponse.json({
    configured: !!process.env.N8N_IMPORT_WEBHOOK_URL,
    message: 'Use POST to trigger import'
  });
}
