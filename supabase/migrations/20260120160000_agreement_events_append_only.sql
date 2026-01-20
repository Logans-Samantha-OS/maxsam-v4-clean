-- ============================================================================
-- Migration: Agreement Events - Append-Only Enforcement
-- Purpose: Ensure agreement_events table is truly append-only for audit compliance
-- ============================================================================

-- 1. Add missing event types to support provider-agnostic webhooks
ALTER TABLE agreement_events
DROP CONSTRAINT IF EXISTS agreement_events_event_type_check;

ALTER TABLE agreement_events
ADD CONSTRAINT agreement_events_event_type_check CHECK (event_type IN (
  -- Lifecycle events
  'created',
  'ready_to_send',
  'sent',
  'viewed',
  'link_clicked',
  'document_viewed',
  'field_completed',
  'partially_signed',
  'signed',
  'declined',
  'expired',
  'voided',
  'failed',
  -- Status change
  'status_changed',
  -- Follow-up events
  'reminder_sent',
  'escalated',
  -- Document events
  'pdf_downloaded',
  'pdf_uploaded_dropbox',
  'pdf_uploaded_gdrive',
  -- Webhook events
  'webhook_received',
  'webhook_verified',
  'webhook_failed',
  -- Error events
  'error',
  -- Provider-specific events (for debugging)
  'provider_event'
));

-- 2. Add ready_to_send status to agreement_packets
ALTER TABLE agreement_packets
DROP CONSTRAINT IF EXISTS agreement_packets_status_check;

ALTER TABLE agreement_packets
ADD CONSTRAINT agreement_packets_status_check CHECK (status IN (
  'created',
  'ready_to_send',
  'sent',
  'viewed',
  'partial',
  'partially_signed',
  'signed',
  'declined',
  'expired',
  'voided',
  'failed'
));

-- 3. Create trigger to enforce append-only on agreement_events
CREATE OR REPLACE FUNCTION prevent_event_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'agreement_events table is append-only. Updates are not allowed.';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'agreement_events table is append-only. Deletes are not allowed.';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_append_only_events ON agreement_events;
CREATE TRIGGER enforce_append_only_events
BEFORE UPDATE OR DELETE ON agreement_events
FOR EACH ROW
EXECUTE FUNCTION prevent_event_modification();

-- 4. Add provider_ref column for linking events to provider-specific IDs
ALTER TABLE agreement_events
ADD COLUMN IF NOT EXISTS provider_ref TEXT;

-- 5. Add webhook_id to track which webhook triggered this event
ALTER TABLE agreement_events
ADD COLUMN IF NOT EXISTS webhook_id TEXT;

-- 6. Add idempotency_key for deduplication
ALTER TABLE agreement_events
ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agreement_events_idempotency
ON agreement_events(idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 7. Add provider_packet_id index for faster webhook lookups
CREATE INDEX IF NOT EXISTS idx_agreement_packets_provider_packet
ON agreement_packets(provider_packet_id)
WHERE provider_packet_id IS NOT NULL;

-- 8. Function: Log event with idempotency check
CREATE OR REPLACE FUNCTION log_agreement_event(
  p_packet_id UUID,
  p_event_type TEXT,
  p_source TEXT DEFAULT 'system',
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_document_id UUID DEFAULT NULL,
  p_provider_ref TEXT DEFAULT NULL,
  p_webhook_id TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_event_id UUID;
  v_existing_id UUID;
BEGIN
  -- Check for idempotent event
  IF p_idempotency_key IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM agreement_events
    WHERE idempotency_key = p_idempotency_key;

    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id; -- Return existing event ID
    END IF;
  END IF;

  -- Insert new event
  INSERT INTO agreement_events (
    packet_id,
    document_id,
    event_type,
    source,
    event_data,
    idempotency_key,
    provider_ref,
    webhook_id
  ) VALUES (
    p_packet_id,
    p_document_id,
    p_event_type,
    p_source,
    p_event_data,
    p_idempotency_key,
    p_provider_ref,
    p_webhook_id
  ) RETURNING id INTO v_event_id;

  RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- 9. View: Latest status per packet (derived from events)
CREATE OR REPLACE VIEW agreement_packet_current_status AS
SELECT DISTINCT ON (packet_id)
  packet_id,
  event_type as last_event,
  event_data,
  created_at as event_time
FROM agreement_events
ORDER BY packet_id, created_at DESC;

-- 10. Function: Get complete event history for a packet
CREATE OR REPLACE FUNCTION get_packet_event_history(p_packet_id UUID)
RETURNS TABLE (
  event_id UUID,
  event_type TEXT,
  event_data JSONB,
  source TEXT,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.event_type,
    e.event_data,
    e.source,
    e.created_at
  FROM agreement_events e
  WHERE e.packet_id = p_packet_id
  ORDER BY e.created_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 11. Update status function to use new event logging
CREATE OR REPLACE FUNCTION update_agreement_status(
  p_packet_id UUID,
  p_new_status TEXT,
  p_event_type TEXT DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'system',
  p_idempotency_key TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_old_status TEXT;
  v_lead_id UUID;
BEGIN
  SELECT status, lead_id INTO v_old_status, v_lead_id
  FROM agreement_packets WHERE id = p_packet_id;

  IF v_old_status IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Don't update if already in terminal state (unless voiding)
  IF v_old_status IN ('signed', 'declined', 'expired', 'voided', 'failed')
     AND p_new_status NOT IN ('voided') THEN
    -- Log attempted transition
    PERFORM log_agreement_event(
      p_packet_id,
      'status_changed',
      p_source,
      jsonb_build_object(
        'attempted_status', p_new_status,
        'current_status', v_old_status,
        'blocked', true,
        'reason', 'Packet already in terminal state'
      ),
      p_idempotency_key
    );
    RETURN FALSE;
  END IF;

  -- Update packet
  UPDATE agreement_packets
  SET
    status = p_new_status,
    updated_at = NOW(),
    sent_at = CASE WHEN p_new_status = 'sent' THEN COALESCE(sent_at, NOW()) ELSE sent_at END,
    first_viewed_at = CASE WHEN p_new_status = 'viewed' AND first_viewed_at IS NULL THEN NOW() ELSE first_viewed_at END,
    signed_at = CASE WHEN p_new_status = 'signed' THEN COALESCE(signed_at, NOW()) ELSE signed_at END,
    expired_at = CASE WHEN p_new_status = 'expired' THEN COALESCE(expired_at, NOW()) ELSE expired_at END
  WHERE id = p_packet_id;

  -- Log event
  PERFORM log_agreement_event(
    p_packet_id,
    COALESCE(p_event_type, 'status_changed'),
    p_source,
    p_event_data || jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status),
    p_idempotency_key
  );

  -- Update lead status if signed
  IF p_new_status = 'signed' AND v_lead_id IS NOT NULL THEN
    UPDATE maxsam_leads SET status = 'contract_signed' WHERE id = v_lead_id;

    INSERT INTO status_history (lead_id, old_status, new_status, changed_by, reason)
    VALUES (v_lead_id, 'agreement_pending', 'contract_signed', 'agreement_automation', 'Client signed agreement')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

SELECT 'Append-only agreement_events constraints applied successfully' AS result;
