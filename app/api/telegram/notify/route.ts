import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage, isTelegramConfigured } from '@/lib/telegram';

/**
 * POST /api/telegram/notify - Send a Telegram notification
 */
export async function POST(request: NextRequest) {
  try {
    if (!isTelegramConfigured()) {
      return NextResponse.json({
        success: false,
        error: 'Telegram not configured'
      }, { status: 400 });
    }

    const body = await request.json();
    const { message, parse_mode } = body;

    if (!message) {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    const result = await sendTelegramMessage(message, parse_mode || 'HTML');

    return NextResponse.json(result);

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

/**
 * GET /api/telegram/notify - Check Telegram status
 */
export async function GET() {
  return NextResponse.json({
    configured: isTelegramConfigured()
  });
}
