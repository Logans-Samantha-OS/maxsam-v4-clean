-- ============================================================================
-- Migration: SMS Template System
-- ============================================================================
-- Purpose:
--   Store SMS templates in Supabase for easy editing without code deployment.
--   Templates include all required fields and selection logic.
-- ============================================================================

-- ============================================================================
-- SMS_TEMPLATES Table (enhanced version)
-- ============================================================================

-- First, add new columns to existing sms_templates table if needed
DO $$
BEGIN
  -- Add template_key column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'template_key') THEN
    ALTER TABLE sms_templates ADD COLUMN template_key TEXT UNIQUE;
  END IF;

  -- Add template_type column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'template_type') THEN
    ALTER TABLE sms_templates ADD COLUMN template_type TEXT; -- EXCESS_FUNDS, WHOLESALE, GOLDEN, FOLLOW_UP
  END IF;

  -- Add sequence_number for follow-ups
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'sequence_number') THEN
    ALTER TABLE sms_templates ADD COLUMN sequence_number INTEGER DEFAULT 0;
  END IF;

  -- Add variables JSON (what variables the template expects)
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'variables') THEN
    ALTER TABLE sms_templates ADD COLUMN variables JSONB DEFAULT '[]';
  END IF;

  -- Add description
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'description') THEN
    ALTER TABLE sms_templates ADD COLUMN description TEXT;
  END IF;

  -- Add updated_by
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'updated_by') THEN
    ALTER TABLE sms_templates ADD COLUMN updated_by TEXT;
  END IF;

  -- Add updated_at
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sms_templates' AND column_name = 'updated_at') THEN
    ALTER TABLE sms_templates ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Index on template_key
CREATE INDEX IF NOT EXISTS idx_sms_templates_key ON sms_templates(template_key);
CREATE INDEX IF NOT EXISTS idx_sms_templates_type ON sms_templates(template_type);

-- ============================================================================
-- Insert Standard Templates
-- ============================================================================

-- Clear existing default templates (keep custom ones)
DELETE FROM sms_templates WHERE template_key IN (
  'EXCESS_FUNDS', 'WHOLESALE', 'GOLDEN',
  'FOLLOW_UP_1', 'FOLLOW_UP_2', 'FOLLOW_UP_3', 'FOLLOW_UP_4',
  'QUALIFIED', 'CONTRACT_SENT', 'CONTRACT_SIGNED'
);

-- EXCESS_FUNDS Template
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, description, is_approved, is_active) VALUES (
  'EXCESS_FUNDS',
  'Excess Funds Recovery',
  'EXCESS_FUNDS',
  'initial_outreach',
  '{first_name} - {county} County has ${excess_amount} from {property_address} (Case #{case_number}).

This expires {expiry_date} and requires specific paperwork to claim.

I handle the entire process - no upfront cost, I only get paid when you do.

Want me to recover this for you? Reply YES

Text STOP to opt-out',
  '["first_name", "county", "excess_amount", "property_address", "case_number", "expiry_date"]',
  'Primary template for leads with excess funds but no wholesale potential',
  true,
  true
);

-- WHOLESALE Template
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, description, is_approved, is_active) VALUES (
  'WHOLESALE',
  'Wholesale Property Offer',
  'WHOLESALE',
  'initial_outreach',
  '{first_name} - I work with cash buyers looking for properties like {property_address}.

Based on recent sales in {city}, they''re offering around ${offer_amount} for homes in your area. No repairs, no fees, close in 2 weeks.

Want to see what they''d offer? Reply YES

Text STOP to opt-out',
  '["first_name", "property_address", "city", "offer_amount"]',
  'Template for leads with wholesale potential but no excess funds',
  true,
  true
);

-- GOLDEN Template
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, description, is_approved, is_active) VALUES (
  'GOLDEN',
  'Golden Lead Dual Offer',
  'GOLDEN',
  'initial_outreach',
  '{first_name} - Two things about {property_address}:

1) {county} County is holding ${excess_amount} for you (Case #{case_number}, expires {expiry_date})

2) I have buyers paying ${offer_amount}+ for properties in {city}

I can help with either or both - no upfront cost.

Interested? Reply YES

Text STOP to opt-out',
  '["first_name", "property_address", "county", "excess_amount", "case_number", "expiry_date", "offer_amount", "city"]',
  'Priority template for golden leads with BOTH excess funds AND wholesale potential',
  true,
  true
);

-- FOLLOW_UP_1 Template (Day 1)
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, sequence_number, description, is_approved, is_active) VALUES (
  'FOLLOW_UP_1',
  'Follow-up Day 1',
  'FOLLOW_UP',
  'follow_up',
  '{first_name}, following up about {property_address} in {city}.

{county} County has ${excess_amount} waiting (Case #{case_number}).

I handle all paperwork at no upfront cost - I only get paid if you do.

Interested? Reply YES

-Sam',
  '["first_name", "property_address", "city", "county", "excess_amount", "case_number"]',
  1,
  'First follow-up sent 1 day after initial contact',
  true,
  true
);

-- FOLLOW_UP_2 Template (Day 3)
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, sequence_number, description, is_approved, is_active) VALUES (
  'FOLLOW_UP_2',
  'Follow-up Day 3',
  'FOLLOW_UP',
  'follow_up',
  '{first_name}, wanted to make sure you saw my messages about the ${excess_amount} from {property_address}.

This is YOUR money from the foreclosure sale and it expires {expiry_date}.

Reply YES to learn how I can recover it for you.

-Sam',
  '["first_name", "excess_amount", "property_address", "expiry_date"]',
  2,
  'Second follow-up sent 3 days after initial contact',
  true,
  true
);

-- FOLLOW_UP_3 Template (Day 7)
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, sequence_number, description, is_approved, is_active) VALUES (
  'FOLLOW_UP_3',
  'Follow-up Day 7',
  'FOLLOW_UP',
  'follow_up',
  '{first_name}, quick reminder: there''s still ${excess_amount} waiting for you from {property_address}.

I can help you recover this money. It''s a simple process.

Interested? Reply YES.

-Sam',
  '["first_name", "excess_amount", "property_address"]',
  3,
  'Third follow-up sent 7 days after initial contact',
  true,
  true
);

-- FOLLOW_UP_4 Template (Day 14 - Final)
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, sequence_number, description, is_approved, is_active) VALUES (
  'FOLLOW_UP_4',
  'Follow-up Final',
  'FOLLOW_UP',
  'follow_up',
  '{first_name}, last message about ${excess_amount} in {county} County (Case #{case_number}).

If I don''t hear back, I''ll close your file. This money will go unclaimed.

Reply YES to claim it, or STOP to opt out.

-Sam',
  '["first_name", "excess_amount", "county", "case_number"]',
  4,
  'Final follow-up sent 14 days after initial contact',
  true,
  true
);

-- QUALIFIED Template
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, description, is_approved, is_active) VALUES (
  'QUALIFIED',
  'Qualified Response',
  'RESPONSE',
  'qualified',
  'Great, {first_name}! I''ll prepare your paperwork for the ${excess_amount} recovery.

You''ll receive an agreement via text shortly. No upfront cost - we only get paid when you do.

Questions? Reply here.

-Sam',
  '["first_name", "excess_amount"]',
  'Sent when lead responds YES and becomes qualified',
  true,
  true
);

-- CONTRACT_SENT Template
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, description, is_approved, is_active) VALUES (
  'CONTRACT_SENT',
  'Contract Sent',
  'RESPONSE',
  'contract',
  '{first_name}, I just sent your agreement for the ${excess_amount} recovery from {property_address}.

Check your texts for a signing link. Sign it and we start working immediately.

Questions? Reply here.

-Sam',
  '["first_name", "excess_amount", "property_address"]',
  'Sent when contract/agreement is sent to lead',
  true,
  true
);

-- CONTRACT_SIGNED Template
INSERT INTO sms_templates (template_key, name, template_type, category, body, variables, description, is_approved, is_active) VALUES (
  'CONTRACT_SIGNED',
  'Contract Signed',
  'RESPONSE',
  'contract',
  '{first_name}, thank you for signing! We''re processing your ${excess_amount} claim now.

I''ll keep you updated. Most claims complete within 30-60 days.

-Sam',
  '["first_name", "excess_amount"]',
  'Sent when lead signs the agreement',
  true,
  true
);

-- ============================================================================
-- Template Selection Function
-- ============================================================================

-- Function to get template by type and context
CREATE OR REPLACE FUNCTION get_sms_template(
  p_template_type TEXT,
  p_sequence_number INTEGER DEFAULT NULL
) RETURNS TABLE(
  template_key TEXT,
  body TEXT,
  variables JSONB
) AS $$
BEGIN
  IF p_sequence_number IS NOT NULL THEN
    RETURN QUERY
    SELECT st.template_key, st.body, st.variables
    FROM sms_templates st
    WHERE st.template_type = p_template_type
      AND st.sequence_number = p_sequence_number
      AND st.is_active = true
    LIMIT 1;
  ELSE
    RETURN QUERY
    SELECT st.template_key, st.body, st.variables
    FROM sms_templates st
    WHERE st.template_type = p_template_type
      AND st.is_active = true
    ORDER BY st.sequence_number NULLS FIRST
    LIMIT 1;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to select template based on lead characteristics
CREATE OR REPLACE FUNCTION select_template_for_lead(
  p_has_excess_funds BOOLEAN,
  p_has_wholesale_potential BOOLEAN,
  p_contact_attempts INTEGER DEFAULT 0
) RETURNS TEXT AS $$
DECLARE
  v_template_key TEXT;
BEGIN
  -- Initial outreach (contact_attempts = 0)
  IF p_contact_attempts = 0 THEN
    IF p_has_excess_funds AND p_has_wholesale_potential THEN
      v_template_key := 'GOLDEN';
    ELSIF p_has_excess_funds THEN
      v_template_key := 'EXCESS_FUNDS';
    ELSIF p_has_wholesale_potential THEN
      v_template_key := 'WHOLESALE';
    ELSE
      v_template_key := 'EXCESS_FUNDS'; -- Default fallback
    END IF;
  -- Follow-up sequence
  ELSIF p_contact_attempts = 1 THEN
    v_template_key := 'FOLLOW_UP_1';
  ELSIF p_contact_attempts = 2 THEN
    v_template_key := 'FOLLOW_UP_2';
  ELSIF p_contact_attempts = 3 THEN
    v_template_key := 'FOLLOW_UP_3';
  ELSIF p_contact_attempts >= 4 THEN
    v_template_key := 'FOLLOW_UP_4';
  END IF;

  RETURN v_template_key;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Template Variable Reference (for documentation)
-- ============================================================================

COMMENT ON TABLE sms_templates IS 'SMS templates for SAM outreach.

Available variables:
- {first_name}: Lead''s first name
- {property_address}: Full property address
- {city}: Property city
- {county}: County name (e.g., Dallas)
- {excess_amount}: Excess funds amount (formatted with $)
- {case_number}: County case number
- {expiry_date}: Funds expiration date
- {offer_amount}: Wholesale offer amount (calculated)

Template Types:
- EXCESS_FUNDS: Leads with excess funds, no wholesale potential
- WHOLESALE: Leads with wholesale potential, no excess funds
- GOLDEN: Leads with BOTH opportunities
- FOLLOW_UP: Follow-up sequence templates
- RESPONSE: Response templates (qualified, contract sent, etc.)

NEVER include in templates:
- How to file claims themselves
- County office contact info
- Buyer names or contact info
- Claim form details';

SELECT 'SMS template system migration complete' AS result;
