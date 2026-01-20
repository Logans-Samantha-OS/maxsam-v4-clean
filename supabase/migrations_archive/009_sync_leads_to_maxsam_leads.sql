-- ============================================================================
-- Migration 009: SMS Compliance & A2P 10DLC Support
-- MaxSam V4 - SMS Compliance Layer
-- Created: 2026-01-19
-- ============================================================================

-- SMS Consent Tracking (Required for A2P 10DLC)
CREATE TABLE IF NOT EXISTS sms_consent (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
    phone_number TEXT NOT NULL,
    consent_status TEXT NOT NULL DEFAULT 'pending' CHECK (consent_status IN ('pending', 'opted_in', 'opted_out', 'revoked')),
    consent_method TEXT CHECK (consent_method IN ('web_form', 'sms_keyword', 'verbal', 'written', 'imported')),
    consent_timestamp TIMESTAMPTZ,
    opt_out_timestamp TIMESTAMPTZ,
    consent_ip_address TEXT,
    consent_source TEXT, -- 'maxsam_landing', 'direct_sms', 'phone_call', etc.
    tcpa_disclosure_shown BOOLEAN DEFAULT false,
    campaign_id TEXT, -- Links to Twilio Campaign
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Message Log (Audit trail for compliance)
CREATE TABLE IF NOT EXISTS sms_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    consent_id UUID REFERENCES sms_consent(id) ON DELETE SET NULL,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    from_number TEXT NOT NULL,
    to_number TEXT NOT NULL,
    message_body TEXT NOT NULL,
    message_sid TEXT UNIQUE, -- Twilio Message SID
    status TEXT DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'undelivered', 'received')),
    error_code TEXT,
    error_message TEXT,
    segment_count INTEGER DEFAULT 1,
    media_urls JSONB, -- For MMS
    agent_name TEXT, -- 'SAM', 'ALEX', 'ELEANOR', 'SYSTEM'
    template_id TEXT,
    campaign_id TEXT,
    cost_cents INTEGER,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SMS Templates (Pre-approved messages for compliance)
CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_key TEXT UNIQUE NOT NULL, -- 'initial_outreach', 'follow_up_1', 'offer_sent', etc.
    template_name TEXT NOT NULL,
    message_body TEXT NOT NULL,
    variables JSONB DEFAULT '[]', -- ['owner_name', 'property_address', 'excess_amount']
    category TEXT CHECK (category IN ('outreach', 'follow_up', 'offer', 'closing', 'opt_out', 'system')),
    requires_consent BOOLEAN DEFAULT true,
    active BOOLEAN DEFAULT true,
    compliance_approved BOOLEAN DEFAULT false,
    compliance_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Opt-Out Keywords Tracking
CREATE TABLE IF NOT EXISTS sms_opt_out_keywords (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keyword TEXT UNIQUE NOT NULL, -- 'STOP', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'
    response_message TEXT NOT NULL,
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Campaign Registry (For A2P 10DLC tracking)
CREATE TABLE IF NOT EXISTS sms_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id TEXT UNIQUE NOT NULL, -- Twilio Campaign SID
    campaign_name TEXT NOT NULL,
    use_case TEXT NOT NULL, -- 'marketing', 'notifications', 'customer_care'
    brand_id TEXT, -- Twilio Brand SID
    messaging_service_sid TEXT,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
    daily_limit INTEGER,
    monthly_limit INTEGER,
    messages_sent_today INTEGER DEFAULT 0,
    messages_sent_month INTEGER DEFAULT 0,
    last_reset_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sms_consent_phone ON sms_consent(phone_number);
CREATE INDEX IF NOT EXISTS idx_sms_consent_lead ON sms_consent(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_consent_status ON sms_consent(consent_status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_lead ON sms_messages(lead_id);
CREATE INDEX IF NOT EXISTS idx_sms_messages_direction ON sms_messages(direction);
CREATE INDEX IF NOT EXISTS idx_sms_messages_status ON sms_messages(status);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sent ON sms_messages(sent_at);
CREATE INDEX IF NOT EXISTS idx_sms_messages_sid ON sms_messages(message_sid);

-- Insert default opt-out keywords (CTIA required)
INSERT INTO sms_opt_out_keywords (keyword, response_message) VALUES
    ('STOP', 'You have been unsubscribed from MaxSam Recovery Services messages. Reply START to resubscribe.'),
    ('STOPALL', 'You have been unsubscribed from MaxSam Recovery Services messages. Reply START to resubscribe.'),
    ('UNSUBSCRIBE', 'You have been unsubscribed from MaxSam Recovery Services messages. Reply START to resubscribe.'),
    ('CANCEL', 'You have been unsubscribed from MaxSam Recovery Services messages. Reply START to resubscribe.'),
    ('END', 'You have been unsubscribed from MaxSam Recovery Services messages. Reply START to resubscribe.'),
    ('QUIT', 'You have been unsubscribed from MaxSam Recovery Services messages. Reply START to resubscribe.')
ON CONFLICT (keyword) DO NOTHING;

-- Insert default SMS templates
INSERT INTO sms_templates (template_key, template_name, message_body, variables, category, compliance_approved) VALUES
    ('initial_outreach', 'Initial Contact', 
     'Hi {{owner_name}}, this is Sam from MaxSam Recovery. Dallas County may owe you {{excess_amount}} from a property at {{property_address}}. Would you like more info? Reply STOP to opt out.',
     '["owner_name", "excess_amount", "property_address"]', 'outreach', true),
    ('follow_up_1', 'First Follow Up',
     'Hi {{owner_name}}, following up about the {{excess_amount}} Dallas County may owe you. Our service is free until you get paid. Interested? Reply STOP to opt out.',
     '["owner_name", "excess_amount"]', 'follow_up', true),
    ('offer_sent', 'Offer Notification',
     'Hi {{owner_name}}, we just sent your claim documents to {{email}}. Please review and sign when ready. Questions? Just reply here. Reply STOP to opt out.',
     '["owner_name", "email"]', 'offer', true),
    ('opt_out_confirm', 'Opt Out Confirmation',
     'You have been unsubscribed from MaxSam Recovery Services. You will receive no further messages. Reply START to resubscribe.',
     '[]', 'opt_out', true),
    ('opt_in_confirm', 'Opt In Confirmation',
     'Welcome back! You are now subscribed to MaxSam Recovery Services updates. Reply STOP at any time to unsubscribe.',
     '[]', 'system', true)
ON CONFLICT (template_key) DO NOTHING;

-- Function to check consent before sending
CREATE OR REPLACE FUNCTION check_sms_consent(p_phone TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_consent_status TEXT;
BEGIN
    SELECT consent_status INTO v_consent_status
    FROM sms_consent
    WHERE phone_number = p_phone
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN COALESCE(v_consent_status = 'opted_in', false);
END;
$$ LANGUAGE plpgsql;

-- Function to process opt-out
CREATE OR REPLACE FUNCTION process_sms_opt_out(p_phone TEXT, p_method TEXT DEFAULT 'sms_keyword')
RETURNS VOID AS $$
BEGIN
    UPDATE sms_consent
    SET consent_status = 'opted_out',
        opt_out_timestamp = NOW(),
        updated_at = NOW()
    WHERE phone_number = p_phone
    AND consent_status = 'opted_in';
    
    -- Also update any leads with this phone
    UPDATE leads
    SET do_not_contact = true,
        dnc_reason = 'SMS opt-out via ' || p_method,
        updated_at = NOW()
    WHERE phone = p_phone OR phone_alt = p_phone;
END;
$$ LANGUAGE plpgsql;

-- Function to log SMS and update counts
CREATE OR REPLACE FUNCTION log_sms_message()
RETURNS TRIGGER AS $$
BEGIN
    -- Update campaign daily/monthly counts for outbound
    IF NEW.direction = 'outbound' AND NEW.campaign_id IS NOT NULL THEN
        UPDATE sms_campaigns
        SET messages_sent_today = messages_sent_today + 1,
            messages_sent_month = messages_sent_month + 1,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_log_sms_message
    AFTER INSERT ON sms_messages
    FOR EACH ROW
    EXECUTE FUNCTION log_sms_message();

-- Function to reset daily SMS counts (call via cron)
CREATE OR REPLACE FUNCTION reset_daily_sms_counts()
RETURNS VOID AS $$
BEGIN
    UPDATE sms_campaigns
    SET messages_sent_today = 0,
        last_reset_date = CURRENT_DATE,
        updated_at = NOW()
    WHERE last_reset_date < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE sms_consent ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_opt_out_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access to sms_consent" ON sms_consent FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to sms_messages" ON sms_messages FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to sms_templates" ON sms_templates FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to sms_opt_out_keywords" ON sms_opt_out_keywords FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access to sms_campaigns" ON sms_campaigns FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON sms_consent TO service_role;
GRANT ALL ON sms_messages TO service_role;
GRANT ALL ON sms_templates TO service_role;
GRANT ALL ON sms_opt_out_keywords TO service_role;
GRANT ALL ON sms_campaigns TO service_role;

COMMENT ON TABLE sms_consent IS 'Tracks SMS consent status for A2P 10DLC compliance';
COMMENT ON TABLE sms_messages IS 'Audit log of all SMS messages sent/received';
COMMENT ON TABLE sms_templates IS 'Pre-approved SMS templates for compliance';
COMMENT ON TABLE sms_opt_out_keywords IS 'CTIA-required opt-out keywords';
COMMENT ON TABLE sms_campaigns IS 'A2P 10DLC campaign tracking';