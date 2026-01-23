/**
 * Message Intelligence Classifier
 *
 * Deterministic keyword/regex-based classification.
 * LLM hook stubbed behind env flag (OFF by default).
 */

import {
  MessageIntent,
  MessageSentiment,
  NextAction,
  ExtractedFields,
  ClassificationResult,
} from './types';

// ============================================================================
// ENV FLAGS
// ============================================================================

const USE_LLM_CLASSIFICATION = process.env.MESSAGE_INTEL_USE_LLM === 'true';

// ============================================================================
// CLASSIFICATION RULES (order matters - first match wins)
// ============================================================================

interface Rule {
  name: string;
  patterns: RegExp[];
  intent: MessageIntent;
  sentiment: MessageSentiment;
  confidence: number;
  next_action: NextAction;
}

const RULES: Rule[] = [
  // HOSTILE - Check first (highest priority)
  {
    name: 'hostile_legal_threat',
    patterns: [
      /\b(lawyer|attorney|sue|lawsuit|legal\s+action|court)\b/i,
      /\b(police|cops|authorities|report\s+you)\b/i,
      /\b(harass|stalker|creep|predator)\b/i,
    ],
    intent: 'HOSTILE',
    sentiment: 'NEGATIVE',
    confidence: 0.95,
    next_action: 'HANDOFF_HUMAN',
  },
  {
    name: 'hostile_profanity',
    patterns: [
      /\b(fuck|shit|damn|ass|bitch|bastard|hell)\b/i,
      /f+u+c+k/i,
      /\b(screw\s+you|go\s+to\s+hell|piss\s+off)\b/i,
    ],
    intent: 'HOSTILE',
    sentiment: 'NEGATIVE',
    confidence: 0.90,
    next_action: 'HANDOFF_HUMAN',
  },

  // NEGATIVE - Explicit refusals and opt-outs
  {
    name: 'negative_stop',
    patterns: [
      /^(stop|unsubscribe|cancel|end|quit|remove)$/i,
      /\b(stop\s+(texting|messaging|contacting)|don'?t\s+(text|contact|message))\b/i,
      /\b(opt\s*out|take\s+me\s+off|remove\s+(me|my\s+number))\b/i,
    ],
    intent: 'NEGATIVE',
    sentiment: 'NEGATIVE',
    confidence: 0.98,
    next_action: 'STOP',
  },
  {
    name: 'negative_wrong_person',
    patterns: [
      /\b(wrong\s+(person|number)|not\s+me|that'?s\s+not\s+me)\b/i,
      /\b(never\s+(owned|lived|had)|don'?t\s+own)\b/i,
      /\b(mistaken|mistake|wrong\s+info)\b/i,
    ],
    intent: 'NEGATIVE',
    sentiment: 'NEGATIVE',
    confidence: 0.85,
    next_action: 'STOP',
  },
  {
    name: 'negative_not_interested',
    patterns: [
      /\b(not\s+interested|no\s+thanks|no\s+thank\s+you)\b/i,
      /\b(don'?t\s+want|don'?t\s+need|pass)\b/i,
      /^no+\.?!?$/i,
    ],
    intent: 'NEGATIVE',
    sentiment: 'NEGATIVE',
    confidence: 0.80,
    next_action: 'STOP',
  },

  // CONFUSED - Uncertainty or skepticism
  {
    name: 'confused_scam',
    patterns: [
      /\b(scam|fraud|fake|spam|phishing)\b/i,
      /\b(is\s+this\s+(real|legit|legitimate))\b/i,
      /\b(sounds?\s+(fishy|suspicious|too\s+good))\b/i,
    ],
    intent: 'CONFUSED',
    sentiment: 'NEGATIVE',
    confidence: 0.85,
    next_action: 'SEND_EXPLANATION',
  },
  {
    name: 'confused_unclear',
    patterns: [
      /\b(confused|don'?t\s+understand|what\s+is\s+this)\b/i,
      /\b(huh|what|wha)\?+/i,
      /^\?+$/,
      /\b(explain|clarify)\b/i,
    ],
    intent: 'CONFUSED',
    sentiment: 'NEUTRAL',
    confidence: 0.75,
    next_action: 'SEND_EXPLANATION',
  },

  // QUESTION - Seeking information
  {
    name: 'question_how_much',
    patterns: [
      /\b(how\s+much|what'?s?\s+the\s+(amount|fee|cost|percentage))\b/i,
      /\b(what\s+do\s+(you|i)\s+(charge|pay|owe))\b/i,
    ],
    intent: 'QUESTION',
    sentiment: 'NEUTRAL',
    confidence: 0.90,
    next_action: 'SEND_EXPLANATION',
  },
  {
    name: 'question_how_it_works',
    patterns: [
      /\b(how\s+(does|do)\s+(this|it)\s+work)\b/i,
      /\b(what'?s?\s+the\s+process|how\s+do\s+i\s+(claim|get))\b/i,
      /\b(tell\s+me\s+more|more\s+info|information)\b/i,
    ],
    intent: 'QUESTION',
    sentiment: 'POSITIVE',
    confidence: 0.85,
    next_action: 'SEND_EXPLANATION',
  },
  {
    name: 'question_generic',
    patterns: [
      /\?$/,
      /\b(who|what|when|where|why|how)\b.*\?/i,
    ],
    intent: 'QUESTION',
    sentiment: 'NEUTRAL',
    confidence: 0.70,
    next_action: 'WAIT',
  },

  // AFFIRMATIVE - Positive engagement
  {
    name: 'affirmative_strong_yes',
    patterns: [
      /^(yes|yeah|yep|yup|sure|ok|okay|absolutely|definitely)!*$/i,
      /\b(i'?m\s+interested|sounds?\s+good|let'?s\s+do\s+(it|this))\b/i,
      /\b(sign\s+me\s+up|send\s+(it|the\s+(contract|agreement|form)))\b/i,
    ],
    intent: 'AFFIRMATIVE',
    sentiment: 'POSITIVE',
    confidence: 0.95,
    next_action: 'SEND_AGREEMENT',
  },
  {
    name: 'affirmative_identity_confirm',
    patterns: [
      /\b(that'?s?\s+me|yes\s+that'?s?\s+(me|correct|right))\b/i,
      /\b(i\s+am\s+|i'?m\s+)(the\s+owner|that\s+person)\b/i,
      /\b(correct|right|exactly)\b/i,
    ],
    intent: 'AFFIRMATIVE',
    sentiment: 'POSITIVE',
    confidence: 0.90,
    next_action: 'ASK_ADDRESS',
  },
  {
    name: 'affirmative_claim_intent',
    patterns: [
      /\b(claim|want\s+to\s+claim|ready\s+to\s+claim)\b/i,
      /\b(proceed|move\s+forward|go\s+ahead)\b/i,
      /\b(help\s+me\s+(claim|get)|i\s+want\s+(my|the)\s+(money|funds))\b/i,
    ],
    intent: 'AFFIRMATIVE',
    sentiment: 'POSITIVE',
    confidence: 0.90,
    next_action: 'ASK_IDENTITY',
  },
  {
    name: 'affirmative_soft',
    patterns: [
      /\b(maybe|perhaps|possibly|might\s+be\s+interested)\b/i,
      /\b(tell\s+me\s+more|sounds\s+interesting)\b/i,
    ],
    intent: 'AFFIRMATIVE',
    sentiment: 'POSITIVE',
    confidence: 0.65,
    next_action: 'SEND_EXPLANATION',
  },

  // OUT_OF_SCOPE - Unrelated content
  {
    name: 'out_of_scope_spam',
    patterns: [
      /\b(buy|sell|discount|deal|offer|promo|crypto|bitcoin|invest)\b/i,
      /\b(click\s+here|visit\s+our|free\s+gift)\b/i,
      /https?:\/\/\S+/i, // URLs are often spam
    ],
    intent: 'OUT_OF_SCOPE',
    sentiment: 'NEUTRAL',
    confidence: 0.80,
    next_action: 'WAIT',
  },
  {
    name: 'out_of_scope_random',
    patterns: [
      /^[a-z]{1,3}$/i, // Single letters/short gibberish
      /^[\W\d]+$/, // Only symbols/numbers
    ],
    intent: 'OUT_OF_SCOPE',
    sentiment: 'NEUTRAL',
    confidence: 0.60,
    next_action: 'WAIT',
  },
];

// ============================================================================
// FIELD EXTRACTION PATTERNS
// ============================================================================

const EXTRACTION_PATTERNS = {
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  phone: /\b(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/,
  time: /\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|AM|PM)?|\d{1,2}\s*o'?clock|morning|afternoon|evening|night)\b/i,
  address: /\b\d+\s+[\w\s]+(?:st|street|ave|avenue|rd|road|dr|drive|ln|lane|ct|court|blvd|boulevard|way|pl|place)\b/i,
  county: /\b(dallas|tarrant|collin|denton|harris|bexar|travis)\s*(?:county)?\b/i,
  case_number: /\b(?:case|cause|cv|dc)[-#:\s]*(\d{2,}[-\s]?\d+[-\s]?\d*)\b/i,
  name: /\b(?:my\s+name\s+is|i'?m|i\s+am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/i,
};

// ============================================================================
// CLASSIFIER
// ============================================================================

export function classifyMessage(text: string): ClassificationResult {
  const normalizedText = text.trim();

  // Try each rule in order
  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(normalizedText)) {
        return {
          intent: rule.intent,
          sentiment: rule.sentiment,
          confidence: rule.confidence,
          extracted_fields: extractFields(normalizedText),
          next_action: rule.next_action,
          matched_rule: rule.name,
        };
      }
    }
  }

  // Default fallback - couldn't classify
  return {
    intent: 'OUT_OF_SCOPE',
    sentiment: 'NEUTRAL',
    confidence: 0.30,
    extracted_fields: extractFields(normalizedText),
    next_action: 'WAIT',
    matched_rule: 'default_fallback',
  };
}

// ============================================================================
// FIELD EXTRACTION
// ============================================================================

function extractFields(text: string): ExtractedFields {
  const fields: ExtractedFields = {};

  // Email
  const emailMatch = text.match(EXTRACTION_PATTERNS.email);
  if (emailMatch) {
    fields.email = emailMatch[0].toLowerCase();
  }

  // Best callback time
  const timeMatch = text.match(EXTRACTION_PATTERNS.time);
  if (timeMatch) {
    fields.best_callback_time = timeMatch[0];
  }

  // County
  const countyMatch = text.match(EXTRACTION_PATTERNS.county);
  if (countyMatch) {
    fields.county = countyMatch[1].toLowerCase();
  }

  // Case number
  const caseMatch = text.match(EXTRACTION_PATTERNS.case_number);
  if (caseMatch) {
    fields.case_number = caseMatch[1];
  }

  // Property address
  const addressMatch = text.match(EXTRACTION_PATTERNS.address);
  if (addressMatch) {
    fields.property_address = addressMatch[0];
  }

  // Name extraction
  const nameMatch = text.match(EXTRACTION_PATTERNS.name);
  if (nameMatch) {
    fields.full_name = nameMatch[1];
  }

  return fields;
}

// ============================================================================
// SENTIMENT ANALYSIS (simple rule-based)
// ============================================================================

export function analyzeSentiment(text: string): MessageSentiment {
  const lowerText = text.toLowerCase();

  const positiveWords = ['yes', 'good', 'great', 'thanks', 'thank', 'interested', 'love', 'appreciate', 'perfect', 'awesome', 'excellent'];
  const negativeWords = ['no', 'stop', 'bad', 'hate', 'scam', 'fraud', 'angry', 'upset', 'terrible', 'worst', 'never'];

  let positiveCount = 0;
  let negativeCount = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveCount++;
  }
  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeCount++;
  }

  if (positiveCount > negativeCount) return 'POSITIVE';
  if (negativeCount > positiveCount) return 'NEGATIVE';
  return 'NEUTRAL';
}

// ============================================================================
// LLM CLASSIFICATION STUB (for future use)
// ============================================================================

export async function classifyWithLLM(text: string): Promise<ClassificationResult | null> {
  if (!USE_LLM_CLASSIFICATION) {
    return null;
  }

  // TODO: Implement LLM-based classification when env flag is enabled
  // This would call Gemini/OpenAI for complex/ambiguous messages
  console.log('[MessageIntel] LLM classification not implemented yet');
  return null;
}

// ============================================================================
// MAIN EXPORT
// ============================================================================

export async function classify(text: string): Promise<ClassificationResult> {
  // Try LLM first if enabled
  if (USE_LLM_CLASSIFICATION) {
    const llmResult = await classifyWithLLM(text);
    if (llmResult) {
      return llmResult;
    }
  }

  // Fall back to deterministic rules
  return classifyMessage(text);
}
