import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';

/**
 * NotebookLM Sync Webhook
 *
 * POST /api/webhook/notebook-sync
 *
 * Webhook endpoint for N8N to trigger nightly notebook syncs.
 * Validates webhook secret and forwards to the notebook-sync API.
 *
 * Headers:
 * - x-webhook-secret: string (required) - Webhook authentication secret
 *
 * Request Body:
 * - counties: string[] (optional) - List of counties to sync
 * - query_type: 'excess_funds' | 'foreclosures' | 'tax_sales' (default: 'excess_funds')
 * - execution_id: string (optional) - N8N execution ID for tracking
 *
 * Response:
 * - Same as /api/alex/notebook-sync
 */

interface WebhookRequest {
  counties?: string[];
  query_type?: 'excess_funds' | 'foreclosures' | 'tax_sales';
  execution_id?: string;
}

// Get webhook secret from environment
const WEBHOOK_SECRET = process.env.NOTEBOOK_SYNC_WEBHOOK_SECRET || process.env.WEBHOOK_SECRET || 'dev-secret';

export async function POST(request: NextRequest) {
  try {
    // Validate webhook secret
    const headersList = await headers();
    const providedSecret = headersList.get('x-webhook-secret') ||
                          headersList.get('authorization')?.replace('Bearer ', '');

    if (!providedSecret || providedSecret !== WEBHOOK_SECRET) {
      console.warn('[Webhook] Unauthorized notebook-sync attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body: WebhookRequest = await request.json();

    console.log('[Webhook] Notebook sync triggered');
    console.log(`[Webhook] Counties: ${body.counties?.join(', ') || 'all'}`);
    console.log(`[Webhook] Query type: ${body.query_type || 'excess_funds'}`);
    console.log(`[Webhook] Execution ID: ${body.execution_id || 'N/A'}`);

    // Call the notebook-sync API internally
    const syncUrl = new URL('/api/alex/notebook-sync', request.url);

    const syncResponse = await fetch(syncUrl.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        counties: body.counties,
        query_type: body.query_type || 'excess_funds',
        sync_type: 'webhook',
        triggered_by: 'n8n',
        auto_import: true,
      }),
    });

    if (!syncResponse.ok) {
      const errorData = await syncResponse.json();
      return NextResponse.json(
        { error: errorData.error || 'Sync failed' },
        { status: syncResponse.status }
      );
    }

    const syncResult = await syncResponse.json();

    // Add webhook metadata
    return NextResponse.json({
      webhook_triggered: true,
      execution_id: body.execution_id || null,
      ...syncResult,
    });
  } catch (error) {
    console.error('Webhook notebook-sync error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhook/notebook-sync
 *
 * Returns webhook documentation and health check
 */
export async function GET() {
  return NextResponse.json({
    status: 'active',
    endpoint: '/api/webhook/notebook-sync',
    method: 'POST',
    authentication: {
      header: 'x-webhook-secret',
      description: 'Webhook secret for authentication',
    },
    body: {
      counties: 'string[] (optional) - List of counties to sync, defaults to all supported',
      query_type: 'string (optional) - excess_funds, foreclosures, tax_sales (default: excess_funds)',
      execution_id: 'string (optional) - N8N execution ID for tracking',
    },
    n8n_integration: {
      workflow_name: 'ALEX Nightly NotebookLM Sync',
      schedule: 'Daily at 11:00 PM CT',
      description: 'Syncs leads from NotebookLM knowledge base to MaxSam database',
    },
    example_curl: `curl -X POST \\
  ${process.env.NEXT_PUBLIC_APP_URL || 'https://maxsam-v4-clean.vercel.app'}/api/webhook/notebook-sync \\
  -H "Content-Type: application/json" \\
  -H "x-webhook-secret: YOUR_SECRET" \\
  -d '{"counties": ["Dallas", "Tarrant"], "query_type": "excess_funds"}'`,
  });
}
