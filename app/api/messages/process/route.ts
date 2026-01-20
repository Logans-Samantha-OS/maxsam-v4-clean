/**
 * Message Processing API
 *
 * POST /api/messages/process
 *
 * Processes a message by:
 * 1. Loading the message and its lead
 * 2. Classifying the message
 * 3. Updating message with classification data
 * 4. Updating lead confidence scores
 * 5. Checking readiness gate
 * 6. Logging events
 *
 * Request body:
 * {
 *   message_id: string  // Required: ID of the message to process
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message_id: string,
 *   classification: ClassificationResult,
 *   confidence_update: {
 *     old: ConfidenceScores,
 *     new: ConfidenceScores,
 *     deltas: ConfidenceDelta
 *   },
 *   readiness: ReadinessResult,
 *   events_logged: string[]
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  classify,
  applyDelta,
  checkReadiness,
  shouldSetDoNotContact,
  requiresHandoff,
  ConfidenceScores,
  MessageIntent,
} from '@/lib/message-intelligence';

export async function POST(request: NextRequest) {
  const supabase = createClient();
  const eventsLogged: string[] = [];

  try {
    const body = await request.json();
    const { message_id } = body;

    // Validate required fields
    if (!message_id || typeof message_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid "message_id" field' },
        { status: 400 }
      );
    }

    // 1. Load the message
    const { data: message, error: messageError } = await supabase
      .from('sms_messages')
      .select('*')
      .eq('id', message_id)
      .single();

    if (messageError || !message) {
      return NextResponse.json(
        { success: false, error: `Message not found: ${messageError?.message || 'Unknown'}` },
        { status: 404 }
      );
    }

    // Skip if already classified
    if (message.intent) {
      return NextResponse.json({
        success: true,
        message_id,
        already_classified: true,
        classification: {
          intent: message.intent,
          sentiment: message.sentiment,
          confidence: message.classification_confidence,
          extracted_fields: message.extracted_fields || {},
          next_action: message.next_action,
        },
      });
    }

    // 2. Classify the message
    const classification = await classify(message.body);

    // 3. Update message with classification
    const { error: updateMessageError } = await supabase
      .from('sms_messages')
      .update({
        intent: classification.intent,
        sentiment: classification.sentiment,
        classification_confidence: classification.confidence,
        extracted_fields: classification.extracted_fields,
        next_action: classification.next_action,
        classified_at: new Date().toISOString(),
      })
      .eq('id', message_id);

    if (updateMessageError) {
      console.error('[MessageProcess] Failed to update message:', updateMessageError);
    }

    // Log classification event
    if (message.lead_id) {
      await supabase.from('lead_events').insert({
        lead_id: message.lead_id,
        message_id: message_id,
        event_type: 'MESSAGE_CLASSIFIED',
        payload: {
          intent: classification.intent,
          sentiment: classification.sentiment,
          confidence: classification.confidence,
          next_action: classification.next_action,
          matched_rule: classification.matched_rule,
        },
      });
      eventsLogged.push('MESSAGE_CLASSIFIED');
    }

    // If no lead_id, return early
    if (!message.lead_id) {
      return NextResponse.json({
        success: true,
        message_id,
        classification,
        no_lead: true,
        events_logged: eventsLogged,
      });
    }

    // 4. Load the lead
    const { data: lead, error: leadError } = await supabase
      .from('maxsam_leads')
      .select('id, identity_confidence, claim_confidence, motivation_score, compliance_risk, do_not_contact, ready_for_documents')
      .eq('id', message.lead_id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({
        success: true,
        message_id,
        classification,
        lead_error: leadError?.message || 'Lead not found',
        events_logged: eventsLogged,
      });
    }

    // 5. Calculate confidence deltas
    const oldScores: ConfidenceScores = {
      identity_confidence: lead.identity_confidence || 0,
      claim_confidence: lead.claim_confidence || 0,
      motivation_score: lead.motivation_score || 0,
      compliance_risk: lead.compliance_risk || 0,
    };

    const { newScores, deltas } = applyDelta(oldScores, classification.intent as MessageIntent);

    // 6. Get recent intents for readiness check
    const { data: recentMessages } = await supabase
      .from('sms_messages')
      .select('intent')
      .eq('lead_id', message.lead_id)
      .eq('direction', 'inbound')
      .not('intent', 'is', null)
      .order('created_at', { ascending: false })
      .limit(3);

    const recentIntents = (recentMessages || [])
      .map(m => m.intent)
      .filter(Boolean) as MessageIntent[];

    // Add current intent if not already in the list
    if (!recentIntents.includes(classification.intent as MessageIntent)) {
      recentIntents.unshift(classification.intent as MessageIntent);
    }

    // 7. Check readiness
    const readiness = checkReadiness(newScores, recentIntents);

    // 8. Determine if we should set DNC or handoff
    const setDNC = shouldSetDoNotContact(classification.intent as MessageIntent);
    const needsHandoff = requiresHandoff(classification.intent as MessageIntent);

    // 9. Update lead
    const { error: updateLeadError } = await supabase
      .from('maxsam_leads')
      .update({
        identity_confidence: newScores.identity_confidence,
        claim_confidence: newScores.claim_confidence,
        motivation_score: newScores.motivation_score,
        compliance_risk: newScores.compliance_risk,
        ready_for_documents: readiness.ready,
        do_not_contact: setDNC ? true : lead.do_not_contact,
        updated_at: new Date().toISOString(),
      })
      .eq('id', message.lead_id);

    if (updateLeadError) {
      console.error('[MessageProcess] Failed to update lead:', updateLeadError);
    }

    // Log confidence update event
    await supabase.from('lead_events').insert({
      lead_id: message.lead_id,
      message_id: message_id,
      event_type: 'CONFIDENCE_UPDATED',
      payload: {
        intent: classification.intent,
        old: oldScores,
        new: newScores,
        deltas,
      },
    });
    eventsLogged.push('CONFIDENCE_UPDATED');

    // Log DNC event if set
    if (setDNC && !lead.do_not_contact) {
      await supabase.from('lead_events').insert({
        lead_id: message.lead_id,
        message_id: message_id,
        event_type: 'DNC_SET',
        payload: { reason: 'NEGATIVE intent', intent: classification.intent },
      });
      eventsLogged.push('DNC_SET');
    }

    // Log handoff event if needed
    if (needsHandoff) {
      await supabase.from('lead_events').insert({
        lead_id: message.lead_id,
        message_id: message_id,
        event_type: 'HANDOFF_HUMAN',
        payload: { reason: 'HOSTILE intent', intent: classification.intent },
      });
      eventsLogged.push('HANDOFF_HUMAN');
    }

    // Log readiness change
    if (readiness.ready && !lead.ready_for_documents) {
      await supabase.from('lead_events').insert({
        lead_id: message.lead_id,
        message_id: message_id,
        event_type: 'READY_FOR_DOCUMENTS_TRUE',
        payload: { scores: newScores, reasons: readiness.reasons },
      });
      eventsLogged.push('READY_FOR_DOCUMENTS_TRUE');
    }

    // 10. Return result
    return NextResponse.json({
      success: true,
      message_id,
      lead_id: message.lead_id,
      classification,
      confidence_update: {
        old: oldScores,
        new: newScores,
        deltas,
      },
      readiness,
      flags: {
        do_not_contact: setDNC || lead.do_not_contact,
        needs_handoff: needsHandoff,
      },
      events_logged: eventsLogged,
    });
  } catch (error) {
    console.error('[MessageProcess] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Processing failed',
        events_logged: eventsLogged,
      },
      { status: 500 }
    );
  }
}

// GET method for info
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Message Processing API',
    version: '1.0.0',
    description: 'Processes messages: classifies, updates scores, checks readiness',
    usage: 'POST { message_id: "uuid" }',
  });
}
