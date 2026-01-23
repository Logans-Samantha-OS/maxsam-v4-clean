-- ============================================================================
-- Migration 011: A2P 10DLC SMS Compliance Layer
-- ============================================================================
--
-- PURPOSE: TCPA/CTIA compliant SMS infrastructure for Sam AI outreach
--
-- Features:
--   - Consent tracking with full audit trail
--   - Message logging for compliance reporting
--   - Pre-approved templates with variable substitution
--   - Auto opt-out keyword processing
--   - Campaign rate limiting
--
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
-- ============================================================================

-- ============================================================================
-- TABLE: sms_consent - Tracks consent status per phone number
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_consent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  phone_normalized TEXT GENERATED ALWAYS AS (regexp_replace(phone, '[^0-9]', '', 'g')) STORED,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,

  -- Consent status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'opted_in', 'opted_out', 'revoked')),

  -- How consent was obtained
  consent_method TEXT CHECK (consent_method IN ('web_form', 'sms_reply', 'verbal', 'written', 'inherited', 'manual')),
  consent_source TEXT,  -- e.g., 'landing_page_v2', 'inbound_sms', 'import_batch_123'

  -- TCPA required disclosures
  tcpa_disclosure_shown BOOLEAN DEFAULT false,
  tcpa_disclosure_text TEXT,
  tcpa_disclosure_timestamp TIMESTAMPTZ,

  -- Consent timestamps
  opted_in_at TIMESTAMPTZ,
  opted_out_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,

  -- Opt-out details
  opt_out_keyword TEXT,  -- which keyword triggered opt-out
  opt_out_message_sid TEXT,  -- Twilio message that triggered opt-out

  -- Metadata
  ip_address INET,
  user_agent TEXT,
  campaign_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_phone_consent UNIQUE (phone_normalized)
);

-- ============================================================================
-- TABLE: sms_messages - Audit log of all SMS sent/received
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Direction and parties
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_number TEXT NOT NULL,
  to_number TEXT NOT NULL,

  -- Message content
  body TEXT NOT NULL,
  media_urls TEXT[],  -- MMS attachments

  -- Twilio tracking
  message_sid TEXT UNIQUE,
  account_sid TEXT,
  messaging_service_sid TEXT,

  -- Status tracking
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'undelivered', 'failed', 'received')),
  error_code TEXT,
  error_message TEXT,

  -- Agent attribution
  agent_name TEXT,  -- SAM, ALEX, SYSTEM, etc.
  template_id UUID,
  campaign_id UUID,

  -- Lead association
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,

  -- Cost tracking
  cost DECIMAL(10,4),
  segments INTEGER DEFAULT 1,

  -- Timestamps
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: sms_templates - Pre-approved message templates
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identification
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT CHECK (category IN ('initial_outreach', 'follow_up', 'response', 'confirmation', 'opt_out', 'system')),

  -- Template content with variables: {{owner_name}}, {{property_address}}, {{excess_amount}}
  body TEXT NOT NULL,

  -- Supported variables
  variables TEXT[] DEFAULT ARRAY['owner_name', 'property_address', 'excess_amount', 'company_name', 'agent_name'],

  -- Approval status
  is_approved BOOLEAN DEFAULT false,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,

  -- Usage tracking
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,

  -- A/B testing
  variant_group TEXT,
  variant_name TEXT,

  -- Status
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: sms_opt_out_keywords - CTIA required keywords with auto-responses
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_opt_out_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  keyword TEXT NOT NULL UNIQUE,
  keyword_upper TEXT GENERATED ALWAYS AS (UPPER(keyword)) STORED,

  -- Action to take
  action TEXT NOT NULL CHECK (action IN ('opt_out', 'opt_in', 'help', 'info')),

  -- Auto-response message
  auto_response TEXT NOT NULL,

  -- CTIA compliance
  is_ctia_required BOOLEAN DEFAULT false,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TABLE: sms_campaigns - Campaign registry with rate limits
-- ============================================================================
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Campaign identification
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  campaign_type TEXT CHECK (campaign_type IN ('initial_outreach', 'follow_up', 'blast', 'drip', 'transactional')),

  -- Rate limiting
  daily_limit INTEGER DEFAULT 1000,
  monthly_limit INTEGER DEFAULT 20000,
  messages_per_minute INTEGER DEFAULT 60,

  -- Counters (reset by cron)
  messages_sent_today INTEGER DEFAULT 0,
  messages_sent_this_month INTEGER DEFAULT 0,
  messages_sent_total INTEGER DEFAULT 0,

  -- Last reset timestamps
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  monthly_reset_at TIMESTAMPTZ DEFAULT NOW(),

  -- 10DLC registration
  a2p_campaign_id TEXT,  -- TCR campaign ID
  a2p_brand_id TEXT,
  a2p_status TEXT CHECK (a2p_status IN ('pending', 'approved', 'rejected', 'suspended')),

  -- Status
  is_active BOOLEAN DEFAULT true,
  paused_at TIMESTAMPTZ,
  paused_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- FUNCTION: check_sms_consent - Returns true if phone is opted in
-- ============================================================================
CREATE OR REPLACE FUNCTION check_sms_consent(p_phone TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  v_normalized TEXT;
  v_status TEXT;
BEGIN
  -- Normalize phone number
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Check consent status
  SELECT status INTO v_status
  FROM sms_consent
  WHERE phone_normalized = v_normalized;

  -- Return true only if explicitly opted in
  RETURN v_status = 'opted_in';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: process_sms_opt_out - Marks consent as opted_out and updates lead
-- ============================================================================
CREATE OR REPLACE FUNCTION process_sms_opt_out(
  p_phone TEXT,
  p_keyword TEXT DEFAULT NULL,
  p_message_sid TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_normalized TEXT;
  v_consent_id UUID;
  v_lead_id UUID;
  v_result JSONB;
BEGIN
  -- Normalize phone number
  v_normalized := regexp_replace(p_phone, '[^0-9]', '', 'g');

  -- Update or insert consent record
  INSERT INTO sms_consent (phone, status, opted_out_at, opt_out_keyword, opt_out_message_sid)
  VALUES (p_phone, 'opted_out', NOW(), p_keyword, p_message_sid)
  ON CONFLICT (phone_normalized) DO UPDATE SET
    status = 'opted_out',
    opted_out_at = NOW(),
    opt_out_keyword = COALESCE(p_keyword, sms_consent.opt_out_keyword),
    opt_out_message_sid = COALESCE(p_message_sid, sms_consent.opt_out_message_sid),
    updated_at = NOW()
  RETURNING id, lead_id INTO v_consent_id, v_lead_id;

  -- Update lead do_not_contact flag
  UPDATE maxsam_leads
  SET
    do_not_contact = true,
    opted_out = true,
    updated_at = NOW()
  WHERE phone = p_phone
     OR phone_1 = p_phone
     OR phone_2 = p_phone
     OR primary_phone = p_phone;

  -- Also add to opt_outs table if it exists
  BEGIN
    INSERT INTO opt_outs (phone, reason, source, created_at)
    VALUES (p_phone, 'SMS opt-out keyword: ' || COALESCE(p_keyword, 'STOP'), 'sms_auto', NOW())
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN undefined_table THEN
    -- opt_outs table doesn't exist, skip
  END;

  v_result := jsonb_build_object(
    'success', true,
    'consent_id', v_consent_id,
    'lead_id', v_lead_id,
    'phone', p_phone,
    'keyword', p_keyword,
    'opted_out_at', NOW()
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: render_sms_template - Substitutes variables in template
-- ============================================================================
CREATE OR REPLACE FUNCTION render_sms_template(
  p_template_id UUID,
  p_lead_id UUID
)
RETURNS TEXT AS $$
DECLARE
  v_template TEXT;
  v_lead RECORD;
BEGIN
  -- Get template
  SELECT body INTO v_template FROM sms_templates WHERE id = p_template_id;
  IF v_template IS NULL THEN
    RETURN NULL;
  END IF;

  -- Get lead data
  SELECT * INTO v_lead FROM maxsam_leads WHERE id = p_lead_id;

  -- Substitute variables
  v_template := replace(v_template, '{{owner_name}}', COALESCE(v_lead.owner_name, 'there'));
  v_template := replace(v_template, '{{property_address}}', COALESCE(v_lead.property_address, 'your property'));
  v_template := replace(v_template, '{{excess_amount}}', COALESCE(TO_CHAR(v_lead.excess_funds_amount, 'FM$999,999'), 'funds'));
  v_template := replace(v_template, '{{company_name}}', 'MaxSam Recovery');
  v_template := replace(v_template, '{{agent_name}}', 'Sam');

  -- Update template usage
  UPDATE sms_templates SET use_count = use_count + 1, last_used_at = NOW() WHERE id = p_template_id;

  RETURN v_template;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Auto-increment campaign message counts
-- ============================================================================
CREATE OR REPLACE FUNCTION increment_campaign_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.campaign_id IS NOT NULL AND NEW.direction = 'outbound' THEN
    UPDATE sms_campaigns
    SET
      messages_sent_today = messages_sent_today + 1,
      messages_sent_this_month = messages_sent_this_month + 1,
      messages_sent_total = messages_sent_total + 1,
      updated_at = NOW()
    WHERE id = NEW.campaign_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_campaign_counts ON sms_messages;
CREATE TRIGGER trg_increment_campaign_counts
  AFTER INSERT ON sms_messages
  FOR EACH ROW
  EXECUTE FUNCTION increment_campaign_counts();

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sms_consent_phone ON sms_consent(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_sms_consent_status ON sms_consent(status);
CREATE INDEX IF NOT EXISTS idx_sms_consent_lead ON sms_consent(lead_id);

CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_to ON sms_messages(to_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_from ON sms_messages(from_number);
CREATE INDEX IF NOT EXISTS idx_sms_messages_lead ON sms_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_created ON sms_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sid ON sms_messages(message_sid);
CREATE INDEX IF NOT EXISTS idx_sms_messages_campaign ON sms_messages(campaign_id);

CREATE INDEX IF NOT EXISTS idx_sms_templates_category ON sms_templates(category);
CREATE INDEX IF NOT EXISTS idx_sms_templates_active ON sms_templates(is_active);

CREATE INDEX IF NOT EXISTS idx_sms_keywords_upper ON sms_opt_out_keywords(keyword_upper);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE sms_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_out_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Service role policies (full access)
DROP POLICY IF EXISTS "sms_consent_service_role" ON sms_consent;
CREATE POLICY "sms_consent_service_role" ON sms_consent FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "sms_messages_service_role" ON sms_messages;
CREATE POLICY "sms_messages_service_role" ON sms_messages FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "sms_templates_service_role" ON sms_templates;
CREATE POLICY "sms_templates_service_role" ON sms_templates FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "sms_keywords_service_role" ON sms_opt_out_keywords;
CREATE POLICY "sms_keywords_service_role" ON sms_opt_out_keywords FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "sms_campaigns_service_role" ON sms_campaigns;
CREATE POLICY "sms_campaigns_service_role" ON sms_campaigns FOR ALL TO service_role USING (true);

-- Anon read access for templates and keywords (public facing)
DROP POLICY IF EXISTS "sms_templates_anon_read" ON sms_templates;
CREATE POLICY "sms_templates_anon_read" ON sms_templates FOR SELECT TO anon USING (is_active = true);

DROP POLICY IF EXISTS "sms_keywords_anon_read" ON sms_opt_out_keywords;
CREATE POLICY "sms_keywords_anon_read" ON sms_opt_out_keywords FOR SELECT TO anon USING (is_active = true);

-- ============================================================================
-- SEED DATA: CTIA Required Opt-Out Keywords
-- ============================================================================
INSERT INTO sms_opt_out_keywords (keyword, action, auto_response, is_ctia_required) VALUES
  ('STOP', 'opt_out', 'You have been unsubscribed from MaxSam Recovery messages. You will not receive any more texts. Reply START to re-subscribe.', true),
  ('UNSUBSCRIBE', 'opt_out', 'You have been unsubscribed from MaxSam Recovery messages. You will not receive any more texts. Reply START to re-subscribe.', true),
  ('CANCEL', 'opt_out', 'You have been unsubscribed from MaxSam Recovery messages. You will not receive any more texts. Reply START to re-subscribe.', true),
  ('END', 'opt_out', 'You have been unsubscribed from MaxSam Recovery messages. You will not receive any more texts. Reply START to re-subscribe.', true),
  ('QUIT', 'opt_out', 'You have been unsubscribed from MaxSam Recovery messages. You will not receive any more texts. Reply START to re-subscribe.', true),
  ('START', 'opt_in', 'You have been re-subscribed to MaxSam Recovery messages. Reply STOP to unsubscribe. Msg&data rates may apply.', true),
  ('YES', 'opt_in', 'Thank you for confirming! You will receive updates about unclaimed funds. Reply STOP to unsubscribe. Msg&data rates may apply.', false),
  ('HELP', 'help', 'MaxSam Recovery helps property owners claim excess funds from foreclosure sales. Reply STOP to unsubscribe or call (214) 555-1234 for assistance.', true),
  ('INFO', 'info', 'MaxSam Recovery: We help recover unclaimed foreclosure funds. Visit maxsamrecovery.com or reply STOP to unsubscribe.', false)
ON CONFLICT (keyword) DO NOTHING;

-- ============================================================================
-- SEED DATA: Initial SMS Templates for MaxSam
-- ============================================================================
INSERT INTO sms_templates (name, category, body, is_approved, approved_by, approved_at) VALUES
  (
    'initial_outreach_v1',
    'initial_outreach',
    'Hi {{owner_name}}, this is Sam from MaxSam Recovery. We found {{excess_amount}} in unclaimed funds from the sale of {{property_address}}. This money belongs to you! Would you like help claiming it? Reply YES for info or STOP to opt out.',
    true,
    'logan',
    NOW()
  ),
  (
    'initial_outreach_v2',
    'initial_outreach',
    '{{owner_name}}, did you know there''s {{excess_amount}} waiting for you from the {{property_address}} foreclosure? I can help you claim it - no upfront costs. Reply YES to learn more or STOP to unsubscribe.',
    true,
    'logan',
    NOW()
  ),
  (
    'follow_up_day2',
    'follow_up',
    'Hi {{owner_name}}, following up about the {{excess_amount}} in excess funds from {{property_address}}. Happy to answer any questions! Reply YES or call us. STOP to opt out.',
    true,
    'logan',
    NOW()
  ),
  (
    'follow_up_day5',
    'follow_up',
    '{{owner_name}}, just a reminder - {{excess_amount}} is still available from your property sale. The claim deadline may be approaching. Let me help you before it''s too late. Reply YES or STOP.',
    true,
    'logan',
    NOW()
  ),
  (
    'interested_response',
    'response',
    'Great! I''ll send over the details about claiming your {{excess_amount}}. What''s the best email to reach you? Or I can call you - what time works best?',
    true,
    'logan',
    NOW()
  ),
  (
    'contract_sent',
    'confirmation',
    '{{owner_name}}, I just sent the authorization form to your email. Once signed, we''ll start the claim process for your {{excess_amount}}. Any questions? Reply here or call (214) 555-1234.',
    true,
    'logan',
    NOW()
  )
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- SEED DATA: Default Campaign
-- ============================================================================
INSERT INTO sms_campaigns (name, description, campaign_type, daily_limit, monthly_limit) VALUES
  ('maxsam_outreach', 'Primary outreach campaign for excess funds leads', 'initial_outreach', 500, 10000),
  ('maxsam_followup', 'Follow-up campaign for non-responsive leads', 'follow_up', 300, 6000),
  ('maxsam_transactional', 'Contract and payment confirmations', 'transactional', 100, 2000)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- LOG MIGRATION
-- ============================================================================
DO $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES ('migration_011_completed', NOW()::text)
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'system_config table does not exist, skipping log';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- SELECT * FROM sms_opt_out_keywords;
-- SELECT * FROM sms_templates WHERE is_approved = true;
-- SELECT * FROM sms_campaigns;
-- SELECT check_sms_consent('+12145551234');
-- ============================================================================
