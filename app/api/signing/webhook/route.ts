/**
 * POST /api/signing/webhook
 * Unified webhook endpoint for all signing providers
 *
 * Query params:
 * - provider: 'jotform_sign' | 'signwell' | 'dropbox_sign' | 'docusign'
 *
 * This endpoint:
 * 1. Identifies provider from query param or payload
 * 2. Verifies webhook signature/authenticity
 * 3. Normalizes event to canonical format
 * 4. Updates packet status and triggers downstream actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { processWebhook } from '@/lib/signing';
import { SigningProvider } from '@/lib/signing/types';

const VALID_PROVIDERS = ['jotform_sign', 'signwell', 'dropbox_sign', 'docusign'];

export async function POST(request: NextRequest) {
  try {
    // Get provider from query param
    const searchParams = request.nextUrl.searchParams;
    let provider = searchParams.get('provider') as SigningProvider | null;

    // Parse request body
    const rawPayload = await request.json();

    // Try to detect provider from payload if not specified
    if (!provider) {
      provider = detectProvider(rawPayload);
    }

    if (!provider || !VALID_PROVIDERS.includes(provider)) {
      console.error('Webhook received with unknown provider:', provider);
      return NextResponse.json(
        { success: false, error: 'Provider not specified or invalid' },
        { status: 400 }
      );
    }

    // Extract headers for signature verification
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    // Process webhook through signing module
    const result = await processWebhook(provider, rawPayload, headers);

    if (!result.success) {
      console.error(`Webhook processing failed for ${provider}:`, result.error);
      // Return 200 to prevent retries for invalid webhooks
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    console.log(`Webhook processed: provider=${provider}, event=${result.event?.eventType}, packet=${result.event?.packetId}`);

    return NextResponse.json({
      success: true,
      event_type: result.event?.eventType,
      packet_id: result.event?.packetId,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    // Return 200 to prevent infinite retries
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Internal server error',
    });
  }
}

/**
 * Attempt to detect provider from webhook payload structure
 */
function detectProvider(payload: Record<string, unknown>): SigningProvider | null {
  // JotForm Sign detection
  if (payload.formID || payload.submissionID || payload.rawRequest) {
    return SigningProvider.JOTFORM_SIGN;
  }

  // SignWell detection
  if (payload.event && typeof payload.event === 'string' && payload.event.startsWith('document')) {
    return SigningProvider.SIGNWELL;
  }
  if (payload.data && typeof payload.data === 'object' && 'document_id' in (payload.data as object)) {
    return SigningProvider.SIGNWELL;
  }

  // DocuSign detection
  if (payload.event === 'envelope-completed' || payload.envelopeId || payload.envelopeStatus) {
    return SigningProvider.DOCUSIGN;
  }

  // Dropbox Sign detection
  if (payload.event && typeof payload.event === 'object' && 'event_type' in (payload.event as object)) {
    const eventType = (payload.event as { event_type: string }).event_type;
    if (eventType.startsWith('signature_request')) {
      return SigningProvider.DROPBOX_SIGN;
    }
  }

  return null;
}

// Also support GET for webhook verification (some providers require this)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const provider = searchParams.get('provider');

  // JotForm doesn't require verification
  // SignWell may send a verification request
  // Return challenge response if present
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');

  if (challenge) {
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'ready',
    provider: provider || 'any',
    message: 'Webhook endpoint ready',
  });
}
