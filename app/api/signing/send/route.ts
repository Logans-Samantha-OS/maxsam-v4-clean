/**
 * POST /api/signing/send
 * Send signing link to client via SMS and/or email
 *
 * Request body:
 * - packet_id: UUID (required)
 * - delivery_method: 'sms' | 'email' | 'both' (optional, default: 'both')
 *
 * Response:
 * - success: boolean
 * - signing_link: string
 * - sms_sent: boolean
 * - email_sent: boolean
 * - error: string (if failed)
 */

import { NextRequest, NextResponse } from 'next/server';
import { sendPacket } from '@/lib/signing';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { packet_id, delivery_method } = body;

    // Validate required fields
    if (!packet_id) {
      return NextResponse.json(
        { success: false, error: 'packet_id is required' },
        { status: 400 }
      );
    }

    // Validate delivery method
    const validMethods = ['sms', 'email', 'both'];
    const method = delivery_method || 'both';

    if (!validMethods.includes(method)) {
      return NextResponse.json(
        { success: false, error: 'delivery_method must be sms, email, or both' },
        { status: 400 }
      );
    }

    // Send packet
    const result = await sendPacket(packet_id, method as 'sms' | 'email' | 'both');

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      packet_id,
      signing_link: result.signingLink,
      sms_sent: result.smsSent,
      email_sent: result.emailSent,
    });

  } catch (error) {
    console.error('Signing send error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
