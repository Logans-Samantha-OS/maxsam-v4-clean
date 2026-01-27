-- ============================================================================
-- Migration: Outreach Approval Queue
-- ============================================================================
-- Purpose:
--   Create a pre-outreach approval system where SAM messages can be
--   reviewed before being sent. This allows Logan to approve/reject
--   messages and customize them as needed.
-- ============================================================================

-- ============================================================================
-- OUTREACH QUEUE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS outreach_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES maxsam_leads(id) ON DELETE CASCADE,

  -- Message details
  phone TEXT NOT NULL,
  message_preview TEXT NOT NULL,
  template_key TEXT NOT NULL,

  -- Lead context (denormalized for quick review)
  owner_name TEXT,
  property_address TEXT,
  excess_funds_amount NUMERIC,
  eleanor_score INTEGER,
  lead_class TEXT,
  contact_attempts INTEGER DEFAULT 0,

  -- Approval workflow
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, rejected, sent, expired
  priority TEXT DEFAULT 'normal', -- urgent, high, normal, low

  -- Customization
  customized_message TEXT, -- If Logan edits the message

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT DEFAULT 'sam_campaign',
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  review_notes TEXT,
  sent_at TIMESTAMPTZ,
  message_sid TEXT, -- Twilio SID once sent

  -- Auto-expiry (messages older than 24h are stale)
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_outreach_queue_status ON outreach_queue(status);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_lead ON outreach_queue(lead_id);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_priority ON outreach_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_outreach_queue_expires ON outreach_queue(expires_at) WHERE status = 'pending';

-- ============================================================================
-- APPROVAL MODE SETTING
-- ============================================================================

INSERT INTO system_config (key, value)
VALUES ('outreach_approval_required', 'false')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to queue a message for approval
CREATE OR REPLACE FUNCTION queue_outreach_message(
  p_lead_id UUID,
  p_phone TEXT,
  p_message TEXT,
  p_template_key TEXT,
  p_priority TEXT DEFAULT 'normal'
) RETURNS UUID AS $$
DECLARE
  v_id UUID;
  v_lead RECORD;
BEGIN
  -- Get lead details
  SELECT owner_name, property_address, excess_funds_amount, eleanor_score, lead_class, contact_attempts
  INTO v_lead
  FROM maxsam_leads
  WHERE id = p_lead_id;

  -- Insert into queue
  INSERT INTO outreach_queue (
    lead_id, phone, message_preview, template_key, priority,
    owner_name, property_address, excess_funds_amount, eleanor_score, lead_class, contact_attempts
  ) VALUES (
    p_lead_id, p_phone, p_message, p_template_key, p_priority,
    v_lead.owner_name, v_lead.property_address, v_lead.excess_funds_amount,
    v_lead.eleanor_score, v_lead.lead_class, v_lead.contact_attempts
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to approve and send a queued message
CREATE OR REPLACE FUNCTION approve_outreach_message(
  p_queue_id UUID,
  p_reviewer TEXT,
  p_notes TEXT DEFAULT NULL,
  p_custom_message TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_result JSONB;
BEGIN
  UPDATE outreach_queue
  SET
    status = 'approved',
    reviewed_at = NOW(),
    reviewed_by = p_reviewer,
    review_notes = p_notes,
    customized_message = COALESCE(p_custom_message, customized_message)
  WHERE id = p_queue_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message not found or already processed');
  END IF;

  RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$ LANGUAGE plpgsql;

-- Function to reject a queued message
CREATE OR REPLACE FUNCTION reject_outreach_message(
  p_queue_id UUID,
  p_reviewer TEXT,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
BEGIN
  UPDATE outreach_queue
  SET
    status = 'rejected',
    reviewed_at = NOW(),
    reviewed_by = p_reviewer,
    review_notes = p_notes
  WHERE id = p_queue_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Message not found or already processed');
  END IF;

  RETURN jsonb_build_object('success', true, 'queue_id', p_queue_id);
END;
$$ LANGUAGE plpgsql;

-- Function to expire stale messages
CREATE OR REPLACE FUNCTION expire_stale_outreach_messages()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE outreach_queue
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get queue statistics
CREATE OR REPLACE FUNCTION get_outreach_queue_stats()
RETURNS JSONB AS $$
DECLARE
  v_pending INTEGER;
  v_approved INTEGER;
  v_sent_today INTEGER;
  v_rejected_today INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_pending FROM outreach_queue WHERE status = 'pending';
  SELECT COUNT(*) INTO v_approved FROM outreach_queue WHERE status = 'approved';
  SELECT COUNT(*) INTO v_sent_today FROM outreach_queue WHERE status = 'sent' AND sent_at >= CURRENT_DATE;
  SELECT COUNT(*) INTO v_rejected_today FROM outreach_queue WHERE status = 'rejected' AND reviewed_at >= CURRENT_DATE;

  RETURN jsonb_build_object(
    'pending', v_pending,
    'approved', v_approved,
    'sent_today', v_sent_today,
    'rejected_today', v_rejected_today
  );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEW for dashboard
-- ============================================================================

CREATE OR REPLACE VIEW outreach_queue_dashboard AS
SELECT
  oq.*,
  CASE
    WHEN oq.expires_at < NOW() + INTERVAL '1 hour' THEN 'expiring_soon'
    WHEN oq.priority = 'urgent' THEN 'urgent'
    WHEN oq.priority = 'high' THEN 'high'
    ELSE 'normal'
  END as urgency_display,
  ml.golden_lead,
  ml.is_golden_lead,
  ml.days_until_expiration
FROM outreach_queue oq
LEFT JOIN maxsam_leads ml ON oq.lead_id = ml.id
WHERE oq.status = 'pending'
ORDER BY
  CASE oq.priority
    WHEN 'urgent' THEN 1
    WHEN 'high' THEN 2
    WHEN 'normal' THEN 3
    WHEN 'low' THEN 4
  END,
  oq.created_at;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE outreach_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outreach_queue_all" ON outreach_queue;
CREATE POLICY "outreach_queue_all" ON outreach_queue FOR ALL USING (true);

SELECT 'Outreach approval queue migration complete' AS result;
