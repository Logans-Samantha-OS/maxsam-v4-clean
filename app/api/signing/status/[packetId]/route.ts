/**
 * GET /api/signing/status/[packetId]
 * Get current status of an agreement packet
 *
 * Response:
 * - success: boolean
 * - packetId: string
 * - status: AgreementPacketStatus
 * - documents: array of document statuses
 * - signingLink: string (if available)
 * - signedAt: ISO date (if signed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPacketStatus } from '@/lib/signing';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ packetId: string }> }
) {
  try {
    const { packetId } = await params;

    if (!packetId) {
      return NextResponse.json(
        { success: false, error: 'packetId is required' },
        { status: 400 }
      );
    }

    const result = await getPacketStatus(packetId);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      packetId: result.packetId,
      status: result.status,
      documents: result.documents,
      signingLink: result.signingLink,
      signedAt: result.signedAt?.toISOString(),
    });

  } catch (error) {
    console.error('Status check error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
