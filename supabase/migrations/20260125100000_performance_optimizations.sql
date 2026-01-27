-- ============================================================================
-- Migration: Performance Optimizations & Data Cleanup
-- ============================================================================
-- Purpose:
--   1. Add composite indexes for common query patterns
--   2. Add indexes for expiry date prioritization
--   3. Create auto-cleanup functions for old data
--   4. Add scheduled maintenance triggers
-- ============================================================================

-- ============================================================================
-- COMPOSITE INDEXES for common query patterns
-- ============================================================================

-- SAM Campaign query: status + contact_attempts + opted_out + excess_funds + score
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_sam_campaign
ON maxsam_leads(status, contact_attempts, excess_funds_amount DESC, eleanor_score DESC)
WHERE (opted_out IS NULL OR opted_out = false)
  AND (do_not_contact IS NULL OR do_not_contact = false)
  AND (sms_opt_out IS NULL OR sms_opt_out = false);

-- Expiry date priority index for SAM outreach
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_expiry_priority
ON maxsam_leads(excess_funds_expiry_date ASC NULLS LAST, eleanor_score DESC)
WHERE excess_funds_expiry_date IS NOT NULL;

-- Classification query: excess_funds_amount + lead_class
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_classification
ON maxsam_leads(excess_funds_amount DESC, lead_class)
WHERE excess_funds_amount >= 5000;

-- Phone lookup for inbound SMS
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_phone_lookup
ON maxsam_leads(phone, phone_1, phone_2)
WHERE phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL;

-- Golden leads fast access
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_golden_priority
ON maxsam_leads(is_golden_lead, eleanor_score DESC, excess_funds_amount DESC)
WHERE is_golden_lead = true OR golden_lead = true;

-- ============================================================================
-- SMS MESSAGES INDEXES for conversation views
-- ============================================================================

-- Lead conversation history
CREATE INDEX IF NOT EXISTS idx_sms_messages_lead_conversation
ON sms_messages(lead_id, created_at DESC)
WHERE lead_id IS NOT NULL;

-- Phone number conversation (for inbound before lead match)
CREATE INDEX IF NOT EXISTS idx_sms_messages_phone_conversation
ON sms_messages(from_number, created_at DESC);

-- ============================================================================
-- AUTO-CLEANUP FUNCTIONS
-- ============================================================================

-- Function to delete old SMS messages (older than 90 days, non-essential)
CREATE OR REPLACE FUNCTION cleanup_old_sms_messages(days_to_keep INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sms_messages
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND status IN ('delivered', 'failed', 'undelivered')
    AND lead_id IS NOT NULL;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup
  INSERT INTO system_config (key, value)
  VALUES ('last_sms_cleanup', jsonb_build_object(
    'timestamp', NOW(),
    'deleted_count', deleted_count,
    'days_kept', days_to_keep
  )::TEXT)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to archive old agent activities (older than 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_agent_activities(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete old agent messages that have been processed
  DELETE FROM agent_messages
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND status IN ('processed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;

  -- Log the cleanup
  INSERT INTO system_config (key, value)
  VALUES ('last_agent_cleanup', jsonb_build_object(
    'timestamp', NOW(),
    'deleted_count', deleted_count,
    'days_kept', days_to_keep
  )::TEXT)
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup old workflow executions (older than 60 days)
CREATE OR REPLACE FUNCTION cleanup_old_workflow_executions(days_to_keep INTEGER DEFAULT 60)
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM workflow_executions
  WHERE created_at < NOW() - (days_to_keep || ' days')::INTERVAL
    AND status IN ('completed', 'failed');

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- LEAD DEDUPLICATION FUNCTION
-- ============================================================================

-- Function to find duplicate leads by case number or address
CREATE OR REPLACE FUNCTION find_duplicate_leads()
RETURNS TABLE(
  duplicate_group INTEGER,
  lead_id UUID,
  case_number TEXT,
  property_address TEXT,
  owner_name TEXT,
  created_at TIMESTAMPTZ,
  is_primary BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  WITH duplicates AS (
    SELECT
      ROW_NUMBER() OVER (PARTITION BY COALESCE(ml.case_number, ml.property_address) ORDER BY ml.eleanor_score DESC NULLS LAST, ml.created_at) as rn,
      DENSE_RANK() OVER (ORDER BY COALESCE(ml.case_number, ml.property_address)) as dup_group,
      ml.id,
      ml.case_number,
      ml.property_address,
      ml.owner_name,
      ml.created_at
    FROM maxsam_leads ml
    WHERE ml.case_number IS NOT NULL OR ml.property_address IS NOT NULL
  )
  SELECT
    d.dup_group::INTEGER as duplicate_group,
    d.id as lead_id,
    d.case_number,
    d.property_address,
    d.owner_name,
    d.created_at,
    (d.rn = 1) as is_primary
  FROM duplicates d
  WHERE d.dup_group IN (
    SELECT dup_group FROM duplicates GROUP BY dup_group HAVING COUNT(*) > 1
  )
  ORDER BY d.dup_group, d.rn;
END;
$$ LANGUAGE plpgsql;

-- Function to merge duplicate leads (keeps primary, deletes others)
CREATE OR REPLACE FUNCTION merge_duplicate_leads(keep_id UUID, merge_ids UUID[])
RETURNS JSONB AS $$
DECLARE
  merged_count INTEGER := 0;
  merge_id UUID;
BEGIN
  -- Update references to point to the kept lead
  FOREACH merge_id IN ARRAY merge_ids
  LOOP
    -- Update SMS messages
    UPDATE sms_messages SET lead_id = keep_id WHERE lead_id = merge_id;

    -- Update deals
    UPDATE deals SET lead_id = keep_id WHERE lead_id = merge_id;

    -- Update contracts
    UPDATE contracts SET lead_id = keep_id WHERE lead_id = merge_id;

    -- Update agreement packets
    UPDATE agreement_packets SET lead_id = keep_id WHERE lead_id = merge_id;

    -- Delete the duplicate lead
    DELETE FROM maxsam_leads WHERE id = merge_id;

    merged_count := merged_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'kept_lead_id', keep_id,
    'merged_count', merged_count
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- EXPIRY ALERT VIEW for leads expiring soon
-- ============================================================================

CREATE OR REPLACE VIEW leads_expiring_soon AS
SELECT
  id,
  owner_name,
  property_address,
  excess_funds_amount,
  excess_funds_expiry_date,
  days_until_expiration,
  eleanor_score,
  lead_class,
  status,
  contact_attempts,
  CASE
    WHEN days_until_expiration <= 7 THEN 'CRITICAL'
    WHEN days_until_expiration <= 14 THEN 'URGENT'
    WHEN days_until_expiration <= 30 THEN 'WARNING'
    ELSE 'NORMAL'
  END as urgency_level
FROM maxsam_leads
WHERE excess_funds_expiry_date IS NOT NULL
  AND excess_funds_expiry_date > NOW()
  AND status NOT IN ('closed', 'lost', 'opted_out')
ORDER BY excess_funds_expiry_date ASC;

-- ============================================================================
-- FOLLOW-UP SEQUENCE TRACKING
-- ============================================================================

-- Add columns for follow-up tracking if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'follow_up_stage') THEN
    ALTER TABLE maxsam_leads ADD COLUMN follow_up_stage INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'next_follow_up_date') THEN
    ALTER TABLE maxsam_leads ADD COLUMN next_follow_up_date TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'last_response_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_response_at TIMESTAMPTZ;
  END IF;
END $$;

-- Index for follow-up queries
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_follow_up
ON maxsam_leads(next_follow_up_date, follow_up_stage)
WHERE next_follow_up_date IS NOT NULL;

-- Function to calculate next follow-up date based on stage
CREATE OR REPLACE FUNCTION calculate_next_follow_up(
  current_stage INTEGER,
  last_contact TIMESTAMPTZ
) RETURNS TIMESTAMPTZ AS $$
BEGIN
  -- Follow-up schedule: Day 1, 3, 7, 14
  RETURN CASE current_stage
    WHEN 0 THEN last_contact + INTERVAL '1 day'    -- First follow-up after 1 day
    WHEN 1 THEN last_contact + INTERVAL '2 days'   -- Second follow-up after 2 more days (day 3)
    WHEN 2 THEN last_contact + INTERVAL '4 days'   -- Third follow-up after 4 more days (day 7)
    WHEN 3 THEN last_contact + INTERVAL '7 days'   -- Fourth follow-up after 7 more days (day 14)
    ELSE NULL                                       -- No more follow-ups after stage 4
  END;
END;
$$ LANGUAGE plpgsql;

-- Trigger to set next follow-up after contact
CREATE OR REPLACE FUNCTION update_follow_up_schedule()
RETURNS TRIGGER AS $$
BEGIN
  -- If contact was just made, schedule next follow-up
  IF NEW.last_contacted_at IS DISTINCT FROM OLD.last_contacted_at
     AND NEW.last_contacted_at IS NOT NULL
     AND NEW.follow_up_stage < 4 THEN
    NEW.next_follow_up_date := calculate_next_follow_up(
      NEW.follow_up_stage,
      NEW.last_contacted_at
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_follow_up ON maxsam_leads;
CREATE TRIGGER trg_update_follow_up
  BEFORE UPDATE ON maxsam_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_follow_up_schedule();

-- ============================================================================
-- GOLDEN LEAD FAST-TRACK VIEW
-- ============================================================================

CREATE OR REPLACE VIEW golden_leads_for_calling AS
SELECT
  id,
  owner_name,
  property_address,
  phone,
  phone_1,
  phone_2,
  excess_funds_amount,
  eleanor_score,
  golden_score,
  days_until_expiration,
  status,
  contact_attempts,
  last_contacted_at
FROM maxsam_leads
WHERE (is_golden_lead = true OR golden_lead = true OR is_super_golden = true)
  AND (phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL)
  AND status NOT IN ('closed', 'lost', 'opted_out')
  AND (opted_out IS NULL OR opted_out = false)
  AND (do_not_contact IS NULL OR do_not_contact = false)
ORDER BY
  is_super_golden DESC NULLS LAST,
  golden_score DESC NULLS LAST,
  excess_funds_amount DESC;

-- ============================================================================
-- COLD LEADS FOR RE-ENGAGEMENT (30+ days no contact)
-- ============================================================================

CREATE OR REPLACE VIEW cold_leads_for_reengagement AS
SELECT
  id,
  owner_name,
  property_address,
  phone,
  phone_1,
  phone_2,
  excess_funds_amount,
  eleanor_score,
  lead_class,
  status,
  contact_attempts,
  last_contacted_at,
  (NOW() - last_contacted_at)::TEXT as days_since_contact
FROM maxsam_leads
WHERE last_contacted_at < NOW() - INTERVAL '30 days'
  AND status IN ('contacted', 'new', 'scored')
  AND excess_funds_amount >= 10000
  AND (phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL)
  AND (opted_out IS NULL OR opted_out = false)
  AND (do_not_contact IS NULL OR do_not_contact = false)
  AND contact_attempts < 5
ORDER BY excess_funds_amount DESC, eleanor_score DESC
LIMIT 50;

SELECT 'Performance optimization migration complete' AS result;
