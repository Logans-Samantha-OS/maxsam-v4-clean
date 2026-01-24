/**
 * N8N Pipeline Webhook
 *
 * Endpoint for N8N to trigger the full lead ingestion pipeline
 * Can receive:
 * - PDF URL to download and process
 * - Pre-parsed leads array
 * - File data as base64
 */

import { NextRequest, NextResponse } from 'next/server';

// Verify webhook secret for security
function verifyWebhookSecret(request: NextRequest): boolean {
  const secret = request.headers.get('x-webhook-secret');
  const expectedSecret = process.env.N8N_WEBHOOK_SECRET;

  // If no secret configured, allow all requests (dev mode)
  if (!expectedSecret) return true;

  return secret === expectedSecret;
}

export async function POST(request: NextRequest) {
  // Verify webhook authenticity
  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    // Forward to the main pipeline endpoint
    const pipelineUrl = new URL('/api/pipeline/ingest', request.url);

    const response = await fetch(pipelineUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...body,
        source: body.source || 'n8n_webhook',
      }),
    });

    const result = await response.json();

    // Return N8N-friendly response
    return NextResponse.json({
      success: result.success,
      message: result.success
        ? `Processed ${result.inserted} leads, ${result.goldenLeads} golden`
        : result.error || 'Pipeline failed',
      data: result,
    });
  } catch (error) {
    console.error('Webhook error:', error);
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * GET - Health check for N8N
 */
export async function GET() {
  return NextResponse.json({
    status: 'ready',
    endpoint: '/api/webhook/pipeline',
    methods: ['POST'],
    accepts: {
      url: 'PDF URL to download and process',
      leads: 'Pre-parsed array of lead objects',
      data: 'Base64 encoded PDF content',
    },
    headers: {
      'x-webhook-secret': 'Optional webhook secret for authentication',
    },
  });
}
