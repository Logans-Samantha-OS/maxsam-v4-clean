import { NextRequest, NextResponse } from 'next/server';
import { runOutreachBatch, getOutreachStats } from '@/lib/sam-outreach';
import { isTwilioConfigured } from '@/lib/twilio';

/**
 * POST /api/sam/run-batch - Run Sam AI outreach batch
 */
export async function POST(request: NextRequest) {
  try {
    if (!isTwilioConfigured()) {
      return NextResponse.json({
        error: 'Twilio not configured',
        message: 'Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to enable outreach'
      }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const limit = body.limit || 20;

    const result = await runOutreachBatch(limit);

    return NextResponse.json({
      success: true,
      ...result
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/sam/run-batch - Get outreach stats
 */
export async function GET() {
  try {
    const stats = await getOutreachStats();
    const configured = isTwilioConfigured();

    return NextResponse.json({
      configured,
      stats
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
