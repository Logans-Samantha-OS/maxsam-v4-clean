/**
 * DEPRECATED: BoldSign webhook endpoint.
 * Self-hosted e-signature system handles signing events directly.
 * This endpoint remains to acknowledge any stale webhook deliveries.
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  console.log('Received stale BoldSign webhook, ignoring');
  return NextResponse.json({ received: true, status: 'deprecated' });
}

export async function GET() {
  return NextResponse.json({
    status: 'deprecated',
    message: 'BoldSign integration has been removed. Using self-hosted e-signature system.',
  });
}
