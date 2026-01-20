/**
 * Message Intelligence Processing API - Phase 1 (READ-ONLY)
 *
 * POST: Analyze a message and store intelligence data
 * GET: Retrieve message intelligence for a lead
 *
 * Phase 1 is READ-ONLY intelligence - no automation triggers.
 * This API analyzes messages and stores insights for dashboard display.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Simple intent detection (Phase 1 - basic keyword matching)
function detectIntent(content: string): { intent: string; confidence: number } {
  const lowerContent = content.toLowerCase();

  // Positive intents
  if (lowerContent.includes('yes') || lowerContent.includes('interested') || lowerContent.includes('tell me more')) {
    return { intent: 'interested', confidence: 0.8 };
  }
  if (lowerContent.includes('call me') || lowerContent.includes('call back') || lowerContent.includes('give me a call')) {
    return { intent: 'callback_request', confidence: 0.85 };
  }
  if (lowerContent.includes('how much') || lowerContent.includes('what is') || lowerContent.includes('?')) {
    return { intent: 'question', confidence: 0.7 };
  }

  // Negative intents
  if (lowerContent.includes('stop') || lowerContent.includes('unsubscribe') || lowerContent.includes('remove')) {
    return { intent: 'opt_out', confidence: 0.95 };
  }
  if (lowerContent.includes('no') || lowerContent.includes('not interested') || lowerContent.includes('don\'t contact')) {
    return { intent: 'not_interested', confidence: 0.8 };
  }
  if (lowerContent.includes('wrong number') || lowerContent.includes('wrong person')) {
    return { intent: 'wrong_contact', confidence: 0.9 };
  }

  return { intent: 'unknown', confidence: 0.3 };
}

// Simple sentiment analysis (Phase 1 - basic scoring)
function analyzeSentiment(content: string): number {
  const lowerContent = content.toLowerCase();
  let score = 0;

  // Positive words
  const positiveWords = ['yes', 'great', 'thanks', 'thank', 'please', 'interested', 'help', 'appreciate'];
  const negativeWords = ['no', 'stop', 'don\'t', 'never', 'hate', 'terrible', 'scam', 'fraud'];

  for (const word of positiveWords) {
    if (lowerContent.includes(word)) score += 0.2;
  }

  for (const word of negativeWords) {
    if (lowerContent.includes(word)) score -= 0.3;
  }

  // Clamp between -1 and 1
  return Math.max(-1, Math.min(1, score));
}

// Extract key entities (Phase 1 - basic extraction)
function extractEntities(content: string): Record<string, string | string[]> {
  const entities: Record<string, string | string[]> = {};

  // Extract phone numbers
  const phoneMatch = content.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  if (phoneMatch) {
    entities.phone_numbers = phoneMatch;
  }

  // Extract email addresses
  const emailMatch = content.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
  if (emailMatch) {
    entities.emails = emailMatch;
  }

  // Extract dollar amounts
  const amountMatch = content.match(/\$[\d,]+(?:\.\d{2})?/g);
  if (amountMatch) {
    entities.amounts = amountMatch;
  }

  // Extract dates (basic patterns)
  const dateMatch = content.match(/\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}-\d{1,2}-\d{2,4}/g);
  if (dateMatch) {
    entities.dates = dateMatch;
  }

  return entities;
}

// Generate suggested response (Phase 1 - template-based)
function generateSuggestedResponse(intent: string): string {
  const templates: Record<string, string> = {
    interested: "Great! I'd love to tell you more about how we can help you recover your excess funds. When would be a good time to chat?",
    callback_request: "Absolutely! I'll give you a call. What time works best for you?",
    question: "Great question! I'd be happy to explain. The excess funds from your property foreclosure are legally yours to claim, and we help recover them for a small fee.",
    opt_out: "[AUTO-OPT-OUT] - Lead should be marked as opted out.",
    not_interested: "No problem at all. If you change your mind, feel free to reach out anytime. Take care!",
    wrong_contact: "I apologize for the confusion. I'll remove this number from our records.",
    unknown: "Thanks for your message! Could you tell me a bit more about how I can help you?"
  };

  return templates[intent] || templates.unknown;
}

// POST: Process and analyze a message
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const body = await request.json();

    const { lead_id, message_id, direction, content } = body;

    if (!content) {
      return NextResponse.json(
        { success: false, error: 'Message content is required' },
        { status: 400 }
      );
    }

    // Analyze the message
    const { intent, confidence } = detectIntent(content);
    const sentimentScore = analyzeSentiment(content);
    const entities = extractEntities(content);
    const suggestedResponse = generateSuggestedResponse(intent);

    // Insert into message_intelligence table
    const { data, error } = await supabase
      .from('message_intelligence')
      .insert({
        lead_id: lead_id || null,
        message_id: message_id || null,
        direction: direction || 'inbound',
        raw_content: content,
        detected_intent: intent,
        sentiment_score: sentimentScore,
        key_entities: entities,
        suggested_response: suggestedResponse,
        confidence_score: confidence,
        processing_model: 'maxsam_v1_basic',
        processed_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Message intelligence insert error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      intelligence: {
        id: data.id,
        intent,
        confidence,
        sentiment_score: sentimentScore,
        key_entities: entities,
        suggested_response: suggestedResponse
      }
    });

  } catch (err) {
    console.error('Message processing error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to process message' },
      { status: 500 }
    );
  }
}

// GET: Retrieve message intelligence for a lead
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);

    const lead_id = searchParams.get('lead_id');
    const limit = parseInt(searchParams.get('limit') || '20', 10);

    let query = supabase
      .from('message_intelligence')
      .select('*')
      .order('processed_at', { ascending: false })
      .limit(limit);

    if (lead_id) {
      query = query.eq('lead_id', lead_id);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Message intelligence fetch error:', error);
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      count: data?.length || 0,
      intelligence: data || []
    });

  } catch (err) {
    console.error('Message fetch error:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch message intelligence' },
      { status: 500 }
    );
  }
}
