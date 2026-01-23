-- ============================================================================
-- Migration: Agreement Automation Engine
-- Purpose: Tables for the seamless agreement signing pipeline
-- Provider: Abstracted (JotForm Sign primary, swappable)
-- ============================================================================

-- ============================================================================
-- 1. agreement_packets: Core signing packet tracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS agreement_packets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Lead/Client reference
  lead_id UUID REFERENCES maxsam_leads(id),
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT NOT NULL,
  property_address TEXT,
  case_number TEXT,

  -- Selection: what was requested
  selection_code INTEGER NOT NULL CHECK (selection_code IN (1, 2, 3)),
  -- 1 = Excess Funds Only
  -- 2 = Wholesale/Assignment Only
  -- 3 = Both (dual deal)

  -- Financial data
  excess_funds_amount NUMERIC(12,2),
  estimated_equity NUMERIC(12,2),
  excess_fee_percent NUMERIC(5,2) DEFAULT 25.00,
  wholesale_fee_percent NUMERIC(5,2) DEFAULT 10.00,
  calculated_excess_fee NUMERIC(12,2),
  calculated_wholesale_fee NUMERIC(12,2),
  total_fee NUMERIC(12,2),

  -- Signing provider (abstracted)
  signing_provider TEXT NOT NULL DEFAULT 'jotform_sign',
  provider_document_id TEXT, -- JotForm: form submission ID
  provider_packet_id TEXT, -- JotForm: packet/envelope ID if multiple docs
  signing_link TEXT, -- The one-click mobile signing link
  signing_link_expires_at TIMESTAMPTZ,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'created' CHECK (status IN (
    'created',      -- Packet created, not yet sent
    'sent',         -- Signing link sent to client
    'viewed',       -- Client opened the link
    'partial',      -- Some documents signed (for multi-doc)
    'signed',       -- All documents signed
    'declined',     -- Client declined to sign
    'expired',      -- Link expired without signing
    'voided'        -- Manually cancelled
  )),

  -- Tracking timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  first_viewed_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  expired_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Follow-up tracking
  reminder_count INTEGER DEFAULT 0,
  last_reminder_at TIMESTAMPTZ,
  next_reminder_at TIMESTAMPTZ,
  escalated_at TIMESTAMPTZ,
  escalation_reason TEXT,

  -- Signed document storage
  signed_pdf_dropbox_url TEXT,
  signed_pdf_gdrive_url TEXT,
  signed_pdf_gdrive_file_id TEXT,

  -- Source tracking
  triggered_by TEXT NOT NULL DEFAULT 'sms', -- 'sms', 'ui', 'api', 'workflow'
  triggered_by_user TEXT,
  source_message_sid TEXT, -- Twilio message SID if SMS triggered

  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_agreement_packets_lead_id ON agreement_packets(lead_id);
CREATE INDEX IF NOT EXISTS idx_agreement_packets_status ON agreement_packets(status);
CREATE INDEX IF NOT EXISTS idx_agreement_packets_client_phone ON agreement_packets(client_phone);
CREATE INDEX IF NOT EXISTS idx_agreement_packets_provider_doc ON agreement_packets(provider_document_id);
CREATE INDEX IF NOT EXISTS idx_agreement_packets_next_reminder ON agreement_packets(next_reminder_at) WHERE status = 'sent';
CREATE INDEX IF NOT EXISTS idx_agreement_packets_created ON agreement_packets(created_at DESC);

-- ============================================================================
-- 2. agreement_documents: Individual documents within a packet
-- ============================================================================
CREATE TABLE IF NOT EXISTS agreement_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES agreement_packets(id) ON DELETE CASCADE,

  -- Document type
  document_type TEXT NOT NULL CHECK (document_type IN (
    'excess_funds_recovery',
    'wholesale_assignment'
  )),

  -- Provider tracking
  provider_document_id TEXT, -- JotForm form ID for this specific doc

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',   -- Not yet signed
    'signed',    -- Signed by client
    'declined'   -- Client declined this document
  )),

  -- Timestamps
  signed_at TIMESTAMPTZ,

  -- Signed PDF storage
  signed_pdf_url TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agreement_documents_packet ON agreement_documents(packet_id);
CREATE INDEX IF NOT EXISTS idx_agreement_documents_type ON agreement_documents(document_type);

-- ============================================================================
-- 3. agreement_events: Complete audit trail
-- ============================================================================
CREATE TABLE IF NOT EXISTS agreement_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  packet_id UUID NOT NULL REFERENCES agreement_packets(id) ON DELETE CASCADE,
  document_id UUID REFERENCES agreement_documents(id),

  -- Event type
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created',
    'sent',
    'link_clicked',
    'document_viewed',
    'field_completed',
    'signed',
    'declined',
    'expired',
    'voided',
    'reminder_sent',
    'escalated',
    'pdf_downloaded',
    'pdf_uploaded_dropbox',
    'pdf_uploaded_gdrive',
    'error'
  )),

  -- Event details
  event_data JSONB DEFAULT '{}'::jsonb,

  -- Source of event
  source TEXT NOT NULL DEFAULT 'system', -- 'webhook', 'api', 'system', 'user'
  source_ip TEXT,
  user_agent TEXT,

  -- Error tracking
  error_message TEXT,
  error_code TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agreement_events_packet ON agreement_events(packet_id);
CREATE INDEX IF NOT EXISTS idx_agreement_events_type ON agreement_events(event_type);
CREATE INDEX IF NOT EXISTS idx_agreement_events_created ON agreement_events(created_at DESC);

-- ============================================================================
-- 4. agreement_templates: Master agreement PDF references
-- ============================================================================
CREATE TABLE IF NOT EXISTS agreement_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identification
  template_type TEXT NOT NULL UNIQUE CHECK (template_type IN (
    'excess_funds_recovery',
    'wholesale_assignment'
  )),

  -- Display info
  display_name TEXT NOT NULL,
  description TEXT,

  -- Source files
  dropbox_path TEXT NOT NULL, -- /MAXSAM V4/Templates/
  gdrive_path TEXT,
  gdrive_file_id TEXT,

  -- JotForm configuration
  jotform_form_id TEXT, -- The JotForm Sign form template ID

  -- Version control
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default templates
INSERT INTO agreement_templates (template_type, display_name, description, dropbox_path) VALUES
  ('excess_funds_recovery', 'Excess Funds Recovery Agreement', '25% fee for recovering foreclosure excess funds', '/MAXSAM V4/Templates/Excess_Funds_Recovery_Agreement.pdf'),
  ('wholesale_assignment', 'Real Estate Wholesale/Assignment Agreement', '10% fee for wholesale property assignment', '/MAXSAM V4/Templates/Wholesale_Assignment_Agreement.pdf')
ON CONFLICT (template_type) DO NOTHING;

-- ============================================================================
-- 5. Helper functions
-- ============================================================================

-- Function: Create a new agreement packet
CREATE OR REPLACE FUNCTION create_agreement_packet(
  p_lead_id UUID,
  p_selection_code INTEGER,
  p_triggered_by TEXT DEFAULT 'sms',
  p_source_message_sid TEXT DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_lead RECORD;
  v_packet_id UUID;
  v_excess_fee NUMERIC(12,2);
  v_wholesale_fee NUMERIC(12,2);
  v_total_fee NUMERIC(12,2);
BEGIN
  -- Fetch lead data
  SELECT * INTO v_lead FROM maxsam_leads WHERE id = p_lead_id;

  IF v_lead IS NULL THEN
    RAISE EXCEPTION 'Lead not found: %', p_lead_id;
  END IF;

  -- Calculate fees based on selection
  v_excess_fee := 0;
  v_wholesale_fee := 0;

  IF p_selection_code IN (1, 3) THEN
    v_excess_fee := COALESCE(v_lead.excess_funds_amount, 0) * 0.25;
  END IF;

  IF p_selection_code IN (2, 3) THEN
    -- Estimate equity if not available
    v_wholesale_fee := COALESCE(v_lead.estimated_equity, v_lead.excess_funds_amount * 0.5, 0) * 0.10;
  END IF;

  v_total_fee := v_excess_fee + v_wholesale_fee;

  -- Create packet
  INSERT INTO agreement_packets (
    lead_id,
    client_name,
    client_email,
    client_phone,
    property_address,
    case_number,
    selection_code,
    excess_funds_amount,
    estimated_equity,
    calculated_excess_fee,
    calculated_wholesale_fee,
    total_fee,
    triggered_by,
    source_message_sid,
    next_reminder_at
  ) VALUES (
    p_lead_id,
    v_lead.owner_name,
    v_lead.email,
    COALESCE(v_lead.phone, v_lead.phone_1, v_lead.phone_2),
    v_lead.property_address,
    v_lead.case_number,
    p_selection_code,
    v_lead.excess_funds_amount,
    v_lead.estimated_equity,
    v_excess_fee,
    v_wholesale_fee,
    v_total_fee,
    p_triggered_by,
    p_source_message_sid,
    NOW() + INTERVAL '2 hours' -- First reminder at +2h
  ) RETURNING id INTO v_packet_id;

  -- Create document records based on selection
  IF p_selection_code IN (1, 3) THEN
    INSERT INTO agreement_documents (packet_id, document_type)
    VALUES (v_packet_id, 'excess_funds_recovery');
  END IF;

  IF p_selection_code IN (2, 3) THEN
    INSERT INTO agreement_documents (packet_id, document_type)
    VALUES (v_packet_id, 'wholesale_assignment');
  END IF;

  -- Log creation event
  INSERT INTO agreement_events (packet_id, event_type, source, event_data)
  VALUES (v_packet_id, 'created', p_triggered_by, jsonb_build_object(
    'selection_code', p_selection_code,
    'total_fee', v_total_fee,
    'lead_id', p_lead_id
  ));

  -- Update lead status
  UPDATE maxsam_leads SET status = 'agreement_pending' WHERE id = p_lead_id;

  RETURN v_packet_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Update packet status with event logging
CREATE OR REPLACE FUNCTION update_agreement_status(
  p_packet_id UUID,
  p_new_status TEXT,
  p_event_type TEXT DEFAULT NULL,
  p_event_data JSONB DEFAULT '{}'::jsonb,
  p_source TEXT DEFAULT 'system'
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

  -- Update packet
  UPDATE agreement_packets
  SET
    status = p_new_status,
    updated_at = NOW(),
    sent_at = CASE WHEN p_new_status = 'sent' THEN NOW() ELSE sent_at END,
    first_viewed_at = CASE WHEN p_new_status = 'viewed' AND first_viewed_at IS NULL THEN NOW() ELSE first_viewed_at END,
    signed_at = CASE WHEN p_new_status = 'signed' THEN NOW() ELSE signed_at END,
    expired_at = CASE WHEN p_new_status = 'expired' THEN NOW() ELSE expired_at END
  WHERE id = p_packet_id;

  -- Log event
  INSERT INTO agreement_events (packet_id, event_type, source, event_data)
  VALUES (
    p_packet_id,
    COALESCE(p_event_type, p_new_status),
    p_source,
    p_event_data || jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status)
  );

  -- Update lead status if signed
  IF p_new_status = 'signed' AND v_lead_id IS NOT NULL THEN
    UPDATE maxsam_leads SET status = 'contract_signed' WHERE id = v_lead_id;

    INSERT INTO status_history (lead_id, old_status, new_status, changed_by, reason)
    VALUES (v_lead_id, 'agreement_pending', 'contract_signed', 'agreement_automation', 'Client signed agreement via JotForm Sign');
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Get packets needing reminders
CREATE OR REPLACE FUNCTION get_packets_for_reminder()
RETURNS SETOF agreement_packets AS $$
BEGIN
  RETURN QUERY
  SELECT * FROM agreement_packets
  WHERE status = 'sent'
    AND next_reminder_at <= NOW()
    AND reminder_count < 3  -- Max 3 reminders
    AND escalated_at IS NULL
  ORDER BY next_reminder_at ASC
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- Function: Record reminder sent
CREATE OR REPLACE FUNCTION record_reminder_sent(p_packet_id UUID) RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_next_interval INTERVAL;
BEGIN
  SELECT reminder_count INTO v_count FROM agreement_packets WHERE id = p_packet_id;

  -- Calculate next reminder interval
  v_next_interval := CASE v_count
    WHEN 0 THEN INTERVAL '22 hours'  -- +2h → +24h
    WHEN 1 THEN INTERVAL '48 hours'  -- +24h → +72h
    ELSE NULL -- No more reminders after 3
  END;

  UPDATE agreement_packets
  SET
    reminder_count = reminder_count + 1,
    last_reminder_at = NOW(),
    next_reminder_at = CASE WHEN v_next_interval IS NOT NULL THEN NOW() + v_next_interval ELSE NULL END,
    escalated_at = CASE WHEN v_count >= 2 THEN NOW() ELSE NULL END,
    escalation_reason = CASE WHEN v_count >= 2 THEN 'Max reminders reached without signing' ELSE NULL END
  WHERE id = p_packet_id;

  INSERT INTO agreement_events (packet_id, event_type, source, event_data)
  VALUES (p_packet_id, 'reminder_sent', 'system', jsonb_build_object('reminder_number', v_count + 1));

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 6. Enable RLS
-- ============================================================================
ALTER TABLE agreement_packets ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agreement_packets_all" ON agreement_packets;
CREATE POLICY "agreement_packets_all" ON agreement_packets FOR ALL USING (true);

DROP POLICY IF EXISTS "agreement_documents_all" ON agreement_documents;
CREATE POLICY "agreement_documents_all" ON agreement_documents FOR ALL USING (true);

DROP POLICY IF EXISTS "agreement_events_all" ON agreement_events;
CREATE POLICY "agreement_events_all" ON agreement_events FOR ALL USING (true);

DROP POLICY IF EXISTS "agreement_templates_all" ON agreement_templates;
CREATE POLICY "agreement_templates_all" ON agreement_templates FOR ALL USING (true);

SELECT 'Agreement Automation schema created successfully' AS result;
