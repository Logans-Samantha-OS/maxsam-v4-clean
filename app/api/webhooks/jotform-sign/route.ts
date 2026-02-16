/**
 * DEPRECATED: JotForm Sign webhook endpoint.
 * Self-hosted e-signature system handles signing events directly.
 * This endpoint remains to acknowledge any stale webhook deliveries.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Received stale JotForm Sign webhook, ignoring');
  return NextResponse.json({ received: true, status: 'deprecated' });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  // Respond to verification challenges so JotForm stops retrying
  const challenge = searchParams.get('challenge') || searchParams.get('hub.challenge');
  if (challenge) {
    return new NextResponse(challenge, {
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return NextResponse.json({
    status: 'deprecated',
    message: 'JotForm Sign integration has been removed. Using self-hosted e-signature system.',
  });
}
