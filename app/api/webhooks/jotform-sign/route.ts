/**
 * JotForm Sign Webhook Handler
 * POST /api/webhooks/jotform-sign
 *
 * Receives webhook events from JotForm Sign when:
 * - Document is viewed
 * - Document is signed
 * - Document is declined
 * - Document expires
 */

import { NextRequest, NextResponse } from 'next/server';
import { processJotFormWebhook } from '@/lib/jotform-sign';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    // JotForm can send different content types
    const contentType = request.headers.get('content-type') || '';
    let payload: Record<string, unknown>;

    if (contentType.includes('application/json')) {
      payload = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = Object.fromEntries(formData.entries());

      // JotForm often sends rawRequest as a JSON string
      if (typeof payload.rawRequest === 'string') {
        try {
          payload.parsedRequest = JSON.parse(payload.rawRequest as string);
        } catch {
          // Ignore parse errors
        }
      }
    } else {
      // Try JSON anyway
      try {
        payload = await request.json();
      } catch {
        const text = await request.text();
        payload = { raw: text };
      }
    }

    console.log('JotForm Sign webhook received:', JSON.stringify(payload).slice(0, 500));

    // Process the webhook
    const result = await processJotFormWebhook(payload);

    if (!result.success && result.action !== 'ignored') {
      console.error('JotForm webhook processing failed:', result.error);
    }

    // Log webhook event (fire and forget, don't block response)
    const supabase = createClient();
    void (async () => {
      try {
        await supabase.from('agreement_events').insert({
          packet_id: null, // Will be linked by processJotFormWebhook if found
          event_type: result.action === 'error' ? 'error' : 'link_clicked',
          source: 'webhook',
          event_data: {
            provider: 'jotform_sign',
            action: result.action,
            error: result.error,
            raw_payload_preview: JSON.stringify(payload).slice(0, 1000),
          },
          error_message: result.error,
        });
      } catch {
        // Don't fail webhook on logging error
      }
    })();

    // Always return 200 to acknowledge receipt
    return NextResponse.json({
      success: true,
      action: result.action,
    });

  } catch (error) {
    console.error('JotForm webhook error:', error);

    // Still return 200 to prevent retries for bad payloads
    return NextResponse.json({
      success: false,
      error: 'Webhook processing error',
    });
  }
}

// Also support GET for webhook verification (some providers use this)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // JotForm verification challenge
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');

  if (challenge) {
    return new NextResponse(challenge, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'ok',
    provider: 'jotform_sign',
    message: 'JotForm Sign webhook endpoint ready',
  });
}
