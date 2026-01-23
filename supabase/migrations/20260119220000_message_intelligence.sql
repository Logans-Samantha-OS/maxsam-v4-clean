-- ============================================================================
-- Migration: Message Intelligence System (Phase 1)
-- ============================================================================
--
-- PURPOSE: Add intent classification, confidence scoring, and readiness gates
--
-- TABLES MODIFIED:
--   - sms_messages: Add intent, sentiment, confidence, extracted_fields, next_action
--   - maxsam_leads: Add identity_confidence, claim_confidence, motivation_score,
--                   compliance_risk, ready_for_documents
--
-- TABLES CREATED:
--   - lead_events: Audit trail for all lead-related events
--
-- RULES:
--   - All changes are ADDITIVE and IDEMPOTENT
--   - Uses DO blocks with IF NOT EXISTS checks
--   - Safe to run multiple times
-- ============================================================================

-- ============================================================================
-- PART 1: Add columns to sms_messages for classification
-- ============================================================================

DO $$
BEGIN
  -- intent column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'intent'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN intent TEXT;
  END IF;

  -- sentiment column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'sentiment'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN sentiment TEXT;
  END IF;

  -- classification_confidence column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'classification_confidence'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN classification_confidence DECIMAL(3,2) DEFAULT 0;
  END IF;

  -- extracted_fields column (JSONB for flexible field extraction)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'extracted_fields'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN extracted_fields JSONB DEFAULT '{}';
  END IF;

  -- next_action column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'next_action'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN next_action TEXT;
  END IF;

  -- classified_at timestamp
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'classified_at'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN classified_at TIMESTAMPTZ;
  END IF;

  -- read_at timestamp (for unread tracking)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'sms_messages' AND column_name = 'read_at'
  ) THEN
    ALTER TABLE sms_messages ADD COLUMN read_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add check constraints for valid values
DO $$
BEGIN
  -- intent check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'sms_messages' AND constraint_name = 'sms_messages_intent_check'
  ) THEN
    ALTER TABLE sms_messages ADD CONSTRAINT sms_messages_intent_check
      CHECK (intent IS NULL OR intent IN ('AFFIRMATIVE', 'NEGATIVE', 'QUESTION', 'CONFUSED', 'HOSTILE', 'OUT_OF_SCOPE'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- sentiment check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'sms_messages' AND constraint_name = 'sms_messages_sentiment_check'
  ) THEN
    ALTER TABLE sms_messages ADD CONSTRAINT sms_messages_sentiment_check
      CHECK (sentiment IS NULL OR sentiment IN ('POSITIVE', 'NEUTRAL', 'NEGATIVE'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  -- next_action check
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'sms_messages' AND constraint_name = 'sms_messages_next_action_check'
  ) THEN
    ALTER TABLE sms_messages ADD CONSTRAINT sms_messages_next_action_check
      CHECK (next_action IS NULL OR next_action IN ('WAIT', 'ASK_IDENTITY', 'ASK_ADDRESS', 'SEND_EXPLANATION', 'SEND_AGREEMENT', 'HANDOFF_HUMAN', 'STOP'));
  END IF;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- PART 2: Add confidence columns to maxsam_leads
-- ============================================================================

DO $$
BEGIN
  -- identity_confidence (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maxsam_leads' AND column_name = 'identity_confidence'
  ) THEN
    ALTER TABLE maxsam_leads ADD COLUMN identity_confidence INTEGER DEFAULT 0
      CHECK (identity_confidence >= 0 AND identity_confidence <= 100);
  END IF;

  -- claim_confidence (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maxsam_leads' AND column_name = 'claim_confidence'
  ) THEN
    ALTER TABLE maxsam_leads ADD COLUMN claim_confidence INTEGER DEFAULT 0
      CHECK (claim_confidence >= 0 AND claim_confidence <= 100);
  END IF;

  -- motivation_score (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maxsam_leads' AND column_name = 'motivation_score'
  ) THEN
    ALTER TABLE maxsam_leads ADD COLUMN motivation_score INTEGER DEFAULT 0
      CHECK (motivation_score >= 0 AND motivation_score <= 100);
  END IF;

  -- compliance_risk (0-100)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maxsam_leads' AND column_name = 'compliance_risk'
  ) THEN
    ALTER TABLE maxsam_leads ADD COLUMN compliance_risk INTEGER DEFAULT 0
      CHECK (compliance_risk >= 0 AND compliance_risk <= 100);
  END IF;

  -- ready_for_documents flag
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maxsam_leads' AND column_name = 'ready_for_documents'
  ) THEN
    ALTER TABLE maxsam_leads ADD COLUMN ready_for_documents BOOLEAN DEFAULT false;
  END IF;

  -- do_not_contact (ensure it exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'maxsam_leads' AND column_name = 'do_not_contact'
  ) THEN
    ALTER TABLE maxsam_leads ADD COLUMN do_not_contact BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ============================================================================
-- PART 3: Create lead_events audit table
-- ============================================================================

CREATE TABLE IF NOT EXISTS lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  message_id UUID,
  event_type TEXT NOT NULL,
  payload JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Event type examples:
  -- MESSAGE_CLASSIFIED, CONFIDENCE_UPDATED, READY_FOR_DOCUMENTS_TRUE,
  -- DNC_SET, INTENT_CHANGED, HANDOFF_HUMAN
  CONSTRAINT lead_events_type_check CHECK (
    event_type IN (
      'MESSAGE_CLASSIFIED',
      'CONFIDENCE_UPDATED',
      'READY_FOR_DOCUMENTS_TRUE',
      'READY_FOR_DOCUMENTS_FALSE',
      'DNC_SET',
      'INTENT_CHANGED',
      'HANDOFF_HUMAN',
      'OUTREACH_SENT',
      'INBOUND_RECEIVED',
      'LEAD_IMPORTED',
      'LEAD_SCORED',
      'CONTRACT_SENT',
      'CONTRACT_SIGNED',
      'PAYMENT_RECEIVED',
      'STATUS_CHANGED'
    )
  )
);

-- Indexes for lead_events
CREATE INDEX IF NOT EXISTS idx_lead_events_lead_id ON lead_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_message_id ON lead_events(message_id);
CREATE INDEX IF NOT EXISTS idx_lead_events_type ON lead_events(event_type);
CREATE INDEX IF NOT EXISTS idx_lead_events_created ON lead_events(created_at DESC);

-- Index for sms_messages intent column
CREATE INDEX IF NOT EXISTS idx_sms_messages_intent ON sms_messages(intent);
CREATE INDEX IF NOT EXISTS idx_sms_messages_next_action ON sms_messages(next_action);

-- ============================================================================
-- PART 4: Row Level Security for lead_events
-- ============================================================================

ALTER TABLE lead_events ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "lead_events_service_role" ON lead_events;
CREATE POLICY "lead_events_service_role" ON lead_events FOR ALL TO service_role USING (true);

-- Anon read access (for dashboard)
DROP POLICY IF EXISTS "lead_events_anon_read" ON lead_events;
CREATE POLICY "lead_events_anon_read" ON lead_events FOR SELECT TO anon USING (true);

-- ============================================================================
-- PART 5: Helper function to calculate readiness
-- ============================================================================

CREATE OR REPLACE FUNCTION check_lead_readiness(p_lead_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_identity_conf INTEGER;
  v_claim_conf INTEGER;
  v_compliance_risk INTEGER;
  v_has_affirmative BOOLEAN;
BEGIN
  -- Get lead confidence scores
  SELECT
    COALESCE(identity_confidence, 0),
    COALESCE(claim_confidence, 0),
    COALESCE(compliance_risk, 0)
  INTO v_identity_conf, v_claim_conf, v_compliance_risk
  FROM maxsam_leads
  WHERE id = p_lead_id;

  -- Check for affirmative in last 3 inbound messages
  SELECT EXISTS (
    SELECT 1
    FROM sms_messages
    WHERE lead_id = p_lead_id
      AND direction = 'inbound'
      AND intent = 'AFFIRMATIVE'
    ORDER BY created_at DESC
    LIMIT 3
  ) INTO v_has_affirmative;

  -- Readiness gate logic
  RETURN (
    v_has_affirmative = true AND
    v_identity_conf >= 70 AND
    v_claim_conf >= 70 AND
    v_compliance_risk < 50
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 6: Function to update lead confidence deltas
-- ============================================================================

CREATE OR REPLACE FUNCTION apply_confidence_delta(
  p_lead_id UUID,
  p_intent TEXT,
  p_message_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_lead RECORD;
  v_old_values JSONB;
  v_new_values JSONB;
  v_delta_identity INTEGER := 0;
  v_delta_claim INTEGER := 0;
  v_delta_motivation INTEGER := 0;
  v_delta_compliance INTEGER := 0;
  v_set_dnc BOOLEAN := false;
  v_new_identity INTEGER;
  v_new_claim INTEGER;
  v_new_motivation INTEGER;
  v_new_compliance INTEGER;
  v_ready BOOLEAN;
BEGIN
  -- Get current lead values
  SELECT
    COALESCE(identity_confidence, 0) AS identity_confidence,
    COALESCE(claim_confidence, 0) AS claim_confidence,
    COALESCE(motivation_score, 0) AS motivation_score,
    COALESCE(compliance_risk, 0) AS compliance_risk,
    COALESCE(do_not_contact, false) AS do_not_contact
  INTO v_lead
  FROM maxsam_leads
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Lead not found');
  END IF;

  v_old_values := jsonb_build_object(
    'identity_confidence', v_lead.identity_confidence,
    'claim_confidence', v_lead.claim_confidence,
    'motivation_score', v_lead.motivation_score,
    'compliance_risk', v_lead.compliance_risk
  );

  -- Apply delta rules based on intent
  CASE p_intent
    WHEN 'AFFIRMATIVE' THEN
      v_delta_identity := 15;
      v_delta_claim := 15;
      v_delta_motivation := 8;
    WHEN 'QUESTION' THEN
      v_delta_claim := 3;
      v_delta_motivation := 2;
    WHEN 'CONFUSED' THEN
      v_delta_compliance := 10;
    WHEN 'HOSTILE' THEN
      v_delta_compliance := 35;
      v_delta_motivation := -10;
    WHEN 'NEGATIVE' THEN
      v_delta_compliance := 20;
      v_delta_identity := -15;
      v_delta_claim := -25;
      v_set_dnc := true;
    WHEN 'OUT_OF_SCOPE' THEN
      v_delta_compliance := 5;
    ELSE
      -- No delta for unknown intents
      NULL;
  END CASE;

  -- Calculate new values (clamped 0-100)
  v_new_identity := GREATEST(0, LEAST(100, v_lead.identity_confidence + v_delta_identity));
  v_new_claim := GREATEST(0, LEAST(100, v_lead.claim_confidence + v_delta_claim));
  v_new_motivation := GREATEST(0, LEAST(100, v_lead.motivation_score + v_delta_motivation));
  v_new_compliance := GREATEST(0, LEAST(100, v_lead.compliance_risk + v_delta_compliance));

  -- Check readiness
  v_ready := (
    v_new_identity >= 70 AND
    v_new_claim >= 70 AND
    v_new_compliance < 50
  );

  -- Update lead
  UPDATE maxsam_leads
  SET
    identity_confidence = v_new_identity,
    claim_confidence = v_new_claim,
    motivation_score = v_new_motivation,
    compliance_risk = v_new_compliance,
    do_not_contact = CASE WHEN v_set_dnc THEN true ELSE do_not_contact END,
    ready_for_documents = v_ready,
    updated_at = NOW()
  WHERE id = p_lead_id;

  v_new_values := jsonb_build_object(
    'identity_confidence', v_new_identity,
    'claim_confidence', v_new_claim,
    'motivation_score', v_new_motivation,
    'compliance_risk', v_new_compliance,
    'ready_for_documents', v_ready,
    'do_not_contact', v_set_dnc OR v_lead.do_not_contact
  );

  -- Log event
  INSERT INTO lead_events (lead_id, message_id, event_type, payload)
  VALUES (
    p_lead_id,
    p_message_id,
    'CONFIDENCE_UPDATED',
    jsonb_build_object(
      'intent', p_intent,
      'old', v_old_values,
      'new', v_new_values,
      'deltas', jsonb_build_object(
        'identity', v_delta_identity,
        'claim', v_delta_claim,
        'motivation', v_delta_motivation,
        'compliance', v_delta_compliance
      )
    )
  );

  -- Log DNC if set
  IF v_set_dnc THEN
    INSERT INTO lead_events (lead_id, message_id, event_type, payload)
    VALUES (p_lead_id, p_message_id, 'DNC_SET', jsonb_build_object('reason', 'NEGATIVE intent'));
  END IF;

  -- Log readiness change
  IF v_ready THEN
    INSERT INTO lead_events (lead_id, message_id, event_type, payload)
    VALUES (p_lead_id, p_message_id, 'READY_FOR_DOCUMENTS_TRUE', v_new_values);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'lead_id', p_lead_id,
    'old', v_old_values,
    'new', v_new_values,
    'ready_for_documents', v_ready
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- PART 7: Log migration completion
-- ============================================================================

DO $$
BEGIN
  INSERT INTO system_config (key, value, description)
  VALUES (
    'migration_message_intelligence_completed',
    NOW()::text,
    'Message Intelligence Phase 1 migration'
  )
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'system_config table does not exist, skipping log';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES (commented out, run manually)
-- ============================================================================
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'sms_messages' AND column_name IN ('intent', 'sentiment', 'classification_confidence', 'extracted_fields', 'next_action');
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name IN ('identity_confidence', 'claim_confidence', 'motivation_score', 'compliance_risk', 'ready_for_documents');
-- SELECT * FROM lead_events LIMIT 5;
-- SELECT check_lead_readiness('some-uuid-here');
-- ============================================================================
