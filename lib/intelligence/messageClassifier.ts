export type MessageIntent =
  | 'claim_confirmation'
  | 'information_request'
  | 'skepticism'
  | 'denial'
  | 'noise';

export interface MessageClassification {
  intent: MessageIntent;
  confidence: number;
  extractedEntities: Record<string, any>;
  notes?: string;
}

export function classifyMessage(text: string): MessageClassification {
  const normalized = text.toLowerCase();

  if (/(yes|claim|mine|correct)/.test(normalized)) {
    return {
      intent: 'claim_confirmation',
      confidence: 0.85,
      extractedEntities: {},
    };
  }

  if (/(how|what|why|explain)/.test(normalized)) {
    return {
      intent: 'information_request',
      confidence: 0.70,
      extractedEntities: {},
    };
  }

  if (/(scam|prove|real)/.test(normalized)) {
    return {
      intent: 'skepticism',
      confidence: 0.75,
      extractedEntities: {},
    };
  }

  if (/(stop|no|wrong)/.test(normalized)) {
    return {
      intent: 'denial',
      confidence: 0.80,
      extractedEntities: {},
    };
  }

  return {
    intent: 'noise',
    confidence: 0.40,
    extractedEntities: {},
  };
}
