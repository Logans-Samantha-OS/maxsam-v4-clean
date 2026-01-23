/**
 * Message Intelligence Types
 * Phase 1: Deterministic Classification System
 */

// ============================================================================
// INTENT CLASSIFICATION
// ============================================================================

export type MessageIntent =
  | 'AFFIRMATIVE'   // yes, yep, correct, ok, claim, proceed, sign, send it, that's me
  | 'NEGATIVE'      // no, stop, wrong person, not me, don't contact, remove
  | 'QUESTION'      // contains ?, how, what, why, who, where, when
  | 'CONFUSED'      // confused, dont understand, what is this, scam, ??
  | 'HOSTILE'       // threats, profanity, lawyer, police, sue, harass
  | 'OUT_OF_SCOPE'; // spammy, unrelated, ads, random content

export type MessageSentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';

export type NextAction =
  | 'WAIT'             // Do nothing, wait for more info
  | 'ASK_IDENTITY'     // Ask to confirm identity
  | 'ASK_ADDRESS'      // Ask to confirm property address
  | 'SEND_EXPLANATION' // Send more details about the service
  | 'SEND_AGREEMENT'   // Ready to send contract
  | 'HANDOFF_HUMAN'    // Escalate to human
  | 'STOP';            // Stop all contact

// ============================================================================
// EXTRACTED FIELDS
// ============================================================================

export interface ExtractedFields {
  full_name?: string;
  property_address?: string;
  email?: string;
  best_callback_time?: string;
  county?: string;
  case_number?: string;
}

// ============================================================================
// CLASSIFICATION RESULT
// ============================================================================

export interface ClassificationResult {
  intent: MessageIntent;
  sentiment: MessageSentiment;
  confidence: number; // 0.0 to 1.0
  extracted_fields: ExtractedFields;
  next_action: NextAction;
  matched_rule?: string; // For debugging: which rule matched
}

// ============================================================================
// CONFIDENCE SCORES
// ============================================================================

export interface ConfidenceScores {
  identity_confidence: number;  // 0-100
  claim_confidence: number;     // 0-100
  motivation_score: number;     // 0-100
  compliance_risk: number;      // 0-100
}

export interface ConfidenceDelta {
  identity: number;
  claim: number;
  motivation: number;
  compliance: number;
}

// ============================================================================
// READINESS GATE
// ============================================================================

export interface ReadinessResult {
  ready: boolean;
  reasons: string[];
  scores: ConfidenceScores;
  has_affirmative_in_recent: boolean;
}

// ============================================================================
// PROCESSING RESULT
// ============================================================================

export interface ProcessingResult {
  success: boolean;
  message_id: string;
  classification: ClassificationResult;
  confidence_update: {
    old: ConfidenceScores;
    new: ConfidenceScores;
    deltas: ConfidenceDelta;
  };
  readiness: ReadinessResult;
  events_logged: string[];
  error?: string;
}

// ============================================================================
// DATABASE TYPES
// ============================================================================

export interface SmsMessage {
  id: string;
  direction: 'inbound' | 'outbound';
  from_number: string;
  to_number: string;
  body: string;
  status: string;
  lead_id: string | null;
  intent?: MessageIntent | null;
  sentiment?: MessageSentiment | null;
  classification_confidence?: number | null;
  extracted_fields?: ExtractedFields | null;
  next_action?: NextAction | null;
  classified_at?: string | null;
  created_at: string;
}

export interface Lead {
  id: string;
  owner_name: string | null;
  property_address: string | null;
  phone: string | null;
  identity_confidence: number;
  claim_confidence: number;
  motivation_score: number;
  compliance_risk: number;
  ready_for_documents: boolean;
  do_not_contact: boolean;
}

export interface LeadEvent {
  id: string;
  lead_id: string;
  message_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}
