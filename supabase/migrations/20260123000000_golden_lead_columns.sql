-- ============================================================================
-- Migration: Add Golden Lead classification and tracking columns
-- Date: 2026-01-23
-- Purpose: Support autonomous operations for MaxSam V4
-- ============================================================================

-- ============================================================================
-- PATCH: maxsam_leads - Add Golden Lead classification columns
-- ============================================================================
DO $$
BEGIN
  -- Lead classification
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'lead_class') THEN
    ALTER TABLE maxsam_leads ADD COLUMN lead_class TEXT DEFAULT 'B';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'is_golden') THEN
    ALTER TABLE maxsam_leads ADD COLUMN is_golden BOOLEAN DEFAULT FALSE;
  END IF;

  -- Distressed property tracking (for Golden Leads)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'distressed_property_url') THEN
    ALTER TABLE maxsam_leads ADD COLUMN distressed_property_url TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'distressed_property_source') THEN
    ALTER TABLE maxsam_leads ADD COLUMN distressed_property_source TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'distressed_property_price') THEN
    ALTER TABLE maxsam_leads ADD COLUMN distressed_property_price NUMERIC;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'marketplace_checked_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN marketplace_checked_at TIMESTAMPTZ;
  END IF;

  -- Skip trace tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'skip_trace_attempted') THEN
    ALTER TABLE maxsam_leads ADD COLUMN skip_trace_attempted BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'skip_trace_success') THEN
    ALTER TABLE maxsam_leads ADD COLUMN skip_trace_success BOOLEAN DEFAULT FALSE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'phones_found') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phones_found TEXT[];
  END IF;

  -- Agreement tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'agreement_type') THEN
    ALTER TABLE maxsam_leads ADD COLUMN agreement_type TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'agreement_signed_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN agreement_signed_at TIMESTAMPTZ;
  END IF;

  -- Contact tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'last_contact_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_contact_at TIMESTAMPTZ;
  END IF;

  -- Ensure status column exists
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'status') THEN
    ALTER TABLE maxsam_leads ADD COLUMN status TEXT;
  END IF;

  -- Ensure phone column exists (primary phone)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'phone') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone TEXT;
  END IF;
END $$;

-- ============================================================================
-- Create indexes for faster queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_phone ON maxsam_leads(phone);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_status ON maxsam_leads(status);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_is_golden ON maxsam_leads(is_golden);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_eleanor_score_desc ON maxsam_leads(eleanor_score DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_excess_amount_desc ON maxsam_leads(excess_funds_amount DESC);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_last_contact ON maxsam_leads(last_contact_at);
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_lead_class ON maxsam_leads(lead_class);

-- ============================================================================
-- Ensure sms_messages table exists with proper columns
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id),
  message TEXT,
  direction TEXT CHECK (direction IN ('inbound', 'outbound')),
  to_number TEXT,
  from_number TEXT,
  status TEXT,
  intent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_messages_lead_id ON sms_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created_at ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to_number ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from_number ON sms_messages(from_number);

-- ============================================================================
-- Create function to get message threads for dashboard
-- ============================================================================
CREATE OR REPLACE FUNCTION get_message_threads()
RETURNS TABLE (
  lead_id UUID,
  owner_name TEXT,
  phone TEXT,
  property_address TEXT,
  excess_funds_amount NUMERIC,
  eleanor_score INTEGER,
  is_golden BOOLEAN,
  status TEXT,
  message_count BIGINT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  last_direction TEXT
) AS $$
BEGIN
  RETURN QUERY
  WITH latest_messages AS (
    SELECT DISTINCT ON (sm.lead_id)
      sm.lead_id,
      sm.message as last_message,
      sm.created_at as last_message_at,
      sm.direction as last_direction
    FROM sms_messages sm
    WHERE sm.lead_id IS NOT NULL
    ORDER BY sm.lead_id, sm.created_at DESC
  ),
  message_counts AS (
    SELECT
      sm.lead_id,
      COUNT(*) as message_count
    FROM sms_messages sm
    WHERE sm.lead_id IS NOT NULL
    GROUP BY sm.lead_id
  )
  SELECT
    ml.id as lead_id,
    ml.owner_name,
    COALESCE(ml.phone, ml.phone_1, ml.phone_2) as phone,
    ml.property_address,
    ml.excess_funds_amount,
    ml.eleanor_score,
    COALESCE(ml.is_golden, false) as is_golden,
    ml.status,
    COALESCE(mc.message_count, 0) as message_count,
    lm.last_message,
    lm.last_message_at,
    lm.last_direction
  FROM latest_messages lm
  JOIN maxsam_leads ml ON ml.id = lm.lead_id
  LEFT JOIN message_counts mc ON mc.lead_id = lm.lead_id
  ORDER BY lm.last_message_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Create view for SAM outreach queue (prioritized by Golden status and score)
-- ============================================================================
CREATE OR REPLACE VIEW sam_outreach_queue AS
SELECT
  id,
  owner_name,
  COALESCE(phone, phone_1, phone_2) as phone,
  property_address,
  city,
  county,
  state,
  excess_funds_amount,
  excess_funds_case_number,
  eleanor_score,
  COALESCE(is_golden, false) as is_golden,
  lead_class,
  status,
  last_contact_at,
  contact_attempts
FROM maxsam_leads
WHERE (phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL)
  AND (status IS NULL OR status NOT IN ('opted_out', 'signed', 'agreement_sent'))
  AND (last_contact_at IS NULL OR last_contact_at < NOW() - INTERVAL '7 days')
  AND COALESCE(do_not_contact, false) = false
ORDER BY
  COALESCE(is_golden, false) DESC,
  COALESCE(eleanor_score, 0) DESC,
  COALESCE(excess_funds_amount, 0) DESC
LIMIT 100;

-- ============================================================================
-- Update Golden Lead classification based on excess funds amount
-- (Leads with >= $75K excess funds are candidates for Golden status)
-- ============================================================================
UPDATE maxsam_leads
SET
  lead_class = CASE
    WHEN excess_funds_amount >= 75000 THEN 'golden_candidate'
    ELSE 'B'
  END,
  is_golden = CASE
    WHEN distressed_property_url IS NOT NULL AND excess_funds_amount >= 75000 THEN true
    ELSE false
  END
WHERE lead_class IS NULL OR lead_class = 'B';

SELECT 'Migration complete - Golden Lead columns added' AS result;
