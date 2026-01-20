/**
 * Message Classification API
 *
 * POST /api/messages/classify
 *
 * Classifies a message text and returns intent, sentiment, confidence,
 * extracted fields, and recommended next action.
 *
 * Request body:
 * {
 *   text: string,       // Required: the message text to classify
 *   phone?: string,     // Optional: sender phone for context
 *   lead_id?: string    // Optional: lead ID for context
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   classification: {
 *     intent: 'AFFIRMATIVE' | 'NEGATIVE' | 'QUESTION' | 'CONFUSED' | 'HOSTILE' | 'OUT_OF_SCOPE',
 *     sentiment: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE',
 *     confidence: number,     // 0.0 to 1.0
 *     extracted_fields: {
 *       full_name?: string,
 *       property_address?: string,
 *       email?: string,
 *       best_callback_time?: string,
 *       county?: string,
 *       case_number?: string
 *     },
 *     next_action: 'WAIT' | 'ASK_IDENTITY' | 'ASK_ADDRESS' | 'SEND_EXPLANATION' | 'SEND_AGREEMENT' | 'HANDOFF_HUMAN' | 'STOP',
 *     matched_rule?: string
 *   }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { classify } from '@/lib/message-intelligence';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, phone, lead_id } = body;

    // Validate required fields
    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "text" field' },
        { status: 400 }
      );
    }

    // Trim and validate text length
    const trimmedText = text.trim();
    if (trimmedText.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Text cannot be empty' },
        { status: 400 }
      );
    }

    if (trimmedText.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Text exceeds maximum length (5000 chars)' },
        { status: 400 }
      );
    }

    // Classify the message
    const classification = await classify(trimmedText);

    // Return response
    return NextResponse.json({
      success: true,
      classification,
      metadata: {
        text_length: trimmedText.length,
        phone: phone || null,
        lead_id: lead_id || null,
        classified_at: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('[MessageClassify] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Classification failed',
      },
      { status: 500 }
    );
  }
}

// GET method for testing/health check
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Message Classification API',
    version: '1.0.0',
    supported_intents: [
      'AFFIRMATIVE',
      'NEGATIVE',
      'QUESTION',
      'CONFUSED',
      'HOSTILE',
      'OUT_OF_SCOPE',
    ],
    supported_actions: [
      'WAIT',
      'ASK_IDENTITY',
      'ASK_ADDRESS',
      'SEND_EXPLANATION',
      'SEND_AGREEMENT',
      'HANDOFF_HUMAN',
      'STOP',
    ],
  });
}
