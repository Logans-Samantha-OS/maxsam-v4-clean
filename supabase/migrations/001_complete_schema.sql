-- ============================================
-- MAXSAM V4 - COMPLETE DATABASE SCHEMA
-- ============================================
-- Run this in Supabase SQL Editor to set up all tables
-- This is idempotent - safe to run multiple times

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

-- Ensure maxsam_leads has all required columns
DO $$
BEGIN
  -- Add columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'eleanor_score') THEN
    ALTER TABLE maxsam_leads ADD COLUMN eleanor_score INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'deal_grade') THEN
    ALTER TABLE maxsam_leads ADD COLUMN deal_grade TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'contact_priority') THEN
    ALTER TABLE maxsam_leads ADD COLUMN contact_priority TEXT DEFAULT 'cold';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'deal_type') THEN
    ALTER TABLE maxsam_leads ADD COLUMN deal_type TEXT DEFAULT 'excess_only';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'potential_revenue') THEN
    ALTER TABLE maxsam_leads ADD COLUMN potential_revenue DECIMAL(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'eleanor_reasoning') THEN
    ALTER TABLE maxsam_leads ADD COLUMN eleanor_reasoning TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'contact_attempts') THEN
    ALTER TABLE maxsam_leads ADD COLUMN contact_attempts INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'last_contact_date') THEN
    ALTER TABLE maxsam_leads ADD COLUMN last_contact_date TIMESTAMP;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'email') THEN
    ALTER TABLE maxsam_leads ADD COLUMN email TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'phone') THEN
    ALTER TABLE maxsam_leads ADD COLUMN phone TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'estimated_arv') THEN
    ALTER TABLE maxsam_leads ADD COLUMN estimated_arv DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'estimated_repair_cost') THEN
    ALTER TABLE maxsam_leads ADD COLUMN estimated_repair_cost DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'state') THEN
    ALTER TABLE maxsam_leads ADD COLUMN state TEXT DEFAULT 'TX';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'case_number') THEN
    ALTER TABLE maxsam_leads ADD COLUMN case_number TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'scored_at') THEN
    ALTER TABLE maxsam_leads ADD COLUMN scored_at TIMESTAMP;
  END IF;
END $$;

-- ============================================
-- CONTRACTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('excess_funds', 'wholesale', 'dual')),
  seller_name TEXT NOT NULL,
  seller_email TEXT,
  property_address TEXT NOT NULL,
  excess_funds_amount DECIMAL(12,2),
  wholesale_fee DECIMAL(12,2),
  total_fee DECIMAL(12,2) NOT NULL,
  owner_fee DECIMAL(12,2) NOT NULL,
  partner_fee DECIMAL(12,2) DEFAULT 0,
  owner_name TEXT DEFAULT 'Logan Toups',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'delivered', 'signed', 'rejected', 'expired')),
  docusign_envelope_id TEXT,
  docusign_document_url TEXT,
  stripe_invoice_id TEXT,
  stripe_invoice_url TEXT,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'invoiced', 'paid', 'failed', 'refunded')),
  sent_at TIMESTAMP,
  signed_at TIMESTAMP,
  paid_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- BUYERS/INVESTORS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS buyers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  max_purchase_price DECIMAL(12,2),
  preferred_areas TEXT[],
  property_types TEXT[],
  min_bedrooms INTEGER,
  max_repair_budget DECIMAL(12,2),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'vip', 'blacklisted')),
  total_purchases INTEGER DEFAULT 0,
  total_volume DECIMAL(12,2) DEFAULT 0,
  avg_days_to_close INTEGER,
  source TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ============================================
-- PROPERTY-BUYER MATCHES
-- ============================================

CREATE TABLE IF NOT EXISTS property_buyer_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES buyers(id) ON DELETE CASCADE,
  match_score INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'notified', 'interested', 'passed', 'under_contract', 'closed')),
  notified_at TIMESTAMP,
  responded_at TIMESTAMP,
  buyer_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(lead_id, buyer_id)
);

-- ============================================
-- OPT-OUTS (TCPA COMPLIANCE - CRITICAL!)
-- ============================================

CREATE TABLE IF NOT EXISTS opt_outs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  email TEXT,
  opted_out_at TIMESTAMP DEFAULT NOW(),
  source TEXT CHECK (source IN ('sms', 'voice', 'email', 'manual', 'dnc')),
  reason TEXT
);

-- Create index for fast opt-out lookups
CREATE INDEX IF NOT EXISTS idx_opt_outs_phone ON opt_outs(phone);

-- ============================================
-- STATUS HISTORY (AUDIT TRAIL)
-- ============================================

CREATE TABLE IF NOT EXISTS status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  contract_id UUID REFERENCES contracts(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT NOT NULL,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for lead history lookups
CREATE INDEX IF NOT EXISTS idx_status_history_lead_id ON status_history(lead_id);
CREATE INDEX IF NOT EXISTS idx_status_history_created_at ON status_history(created_at DESC);

-- ============================================
-- SYSTEM CONFIGURATION
-- ============================================

CREATE TABLE IF NOT EXISTS system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT UNIQUE NOT NULL,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP DEFAULT NOW(),
  updated_by TEXT
);

-- Insert default configuration values
INSERT INTO system_config (key, value, description) VALUES
  ('dallas_county_pdf_url', '', 'URL to Dallas County excess funds PDF'),
  ('legal_entity_name', 'Logan Toups', 'Legal name for contracts'),
  ('business_address', 'Richardson, TX', 'Business address for contracts'),
  ('signer_title', 'Real Estate Investor', 'Title for contract signatures'),
  ('excess_funds_fee_percent', '25', 'Fee percentage for excess funds recovery'),
  ('wholesale_fee_percent', '10', 'Fee percentage for wholesale deals'),
  ('owner_split_percent', '100', 'Owner share of fees (Logan)'),
  ('partner_split_percent', '0', 'Partner share of fees'),
  ('partner_name', '', 'Partner name if configured'),
  ('partner_email', '', 'Partner email if configured'),
  ('daily_import_time', '05:30', 'Time for daily PDF import (24h format)'),
  ('scoring_time', '06:00', 'Time for daily Eleanor scoring (24h format)'),
  ('morning_brief_time', '06:15', 'Time for morning brief notification (24h format)'),
  ('outreach_enabled', 'false', 'Whether automated outreach is enabled'),
  ('max_daily_sms', '100', 'Maximum SMS to send per day'),
  ('max_contact_attempts', '5', 'Maximum outreach attempts per lead')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- REVENUE TRACKING
-- ============================================

CREATE TABLE IF NOT EXISTS revenue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID REFERENCES contracts(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  fee_type TEXT NOT NULL CHECK (fee_type IN ('excess_funds', 'wholesale', 'dual')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'invoiced', 'paid', 'failed', 'refunded')),
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  owner_amount DECIMAL(12,2),
  partner_amount DECIMAL(12,2) DEFAULT 0,
  paid_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for revenue reporting
CREATE INDEX IF NOT EXISTS idx_revenue_status ON revenue(status);
CREATE INDEX IF NOT EXISTS idx_revenue_paid_at ON revenue(paid_at);
CREATE INDEX IF NOT EXISTS idx_revenue_created_at ON revenue(created_at);

-- ============================================
-- COMMUNICATION LOGS
-- ============================================

CREATE TABLE IF NOT EXISTS communication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('sms', 'voice', 'email', 'note')),
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  from_number TEXT,
  to_number TEXT,
  content TEXT,
  template_used TEXT,
  twilio_sid TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'received')),
  sentiment TEXT CHECK (sentiment IN ('positive', 'negative', 'neutral', 'unknown')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create index for lead communication lookups
CREATE INDEX IF NOT EXISTS idx_communication_logs_lead_id ON communication_logs(lead_id);
CREATE INDEX IF NOT EXISTS idx_communication_logs_created_at ON communication_logs(created_at DESC);

-- ============================================
-- VIEWS FOR DASHBOARD
-- ============================================

-- Golden Opportunities View (Dual deals with high scores)
CREATE OR REPLACE VIEW maxsam_golden_opportunities AS
SELECT
  id,
  property_address,
  city,
  owner_name,
  phone,
  email,
  excess_funds_amount,
  estimated_arv,
  eleanor_score,
  deal_grade,
  deal_type,
  potential_revenue,
  status,
  created_at
FROM maxsam_leads
WHERE deal_type = 'dual'
  AND eleanor_score >= 70
  AND status NOT IN ('closed', 'dead')
ORDER BY eleanor_score DESC, potential_revenue DESC
LIMIT 50;

-- Sam Call Queue View (Leads ready for outreach)
CREATE OR REPLACE VIEW maxsam_sam_call_queue AS
SELECT
  id,
  property_address,
  city,
  owner_name,
  phone,
  phone_1,
  phone_2,
  excess_funds_amount,
  eleanor_score,
  deal_grade,
  contact_priority,
  contact_attempts,
  last_contact_date,
  status,
  created_at
FROM maxsam_leads
WHERE phone IS NOT NULL OR phone_1 IS NOT NULL OR phone_2 IS NOT NULL
  AND contact_attempts < 5
  AND status IN ('new', 'scored', 'contacted')
  AND contact_priority IN ('hot', 'warm')
ORDER BY
  CASE contact_priority
    WHEN 'hot' THEN 1
    WHEN 'warm' THEN 2
    ELSE 3
  END,
  eleanor_score DESC
LIMIT 50;

-- Dashboard Metrics View
CREATE OR REPLACE VIEW maxsam_dashboard_metrics AS
SELECT
  COUNT(*) as total_leads,
  COUNT(*) FILTER (WHERE status = 'new') as new_leads,
  COUNT(*) FILTER (WHERE status = 'scored') as scored_leads,
  COUNT(*) FILTER (WHERE status = 'contacted') as contacted_leads,
  COUNT(*) FILTER (WHERE status = 'qualified') as qualified_leads,
  COUNT(*) FILTER (WHERE status = 'contract_sent') as contract_sent_leads,
  COUNT(*) FILTER (WHERE status = 'contract_signed') as contract_signed_leads,
  COUNT(*) FILTER (WHERE status = 'closed') as closed_leads,
  COUNT(*) FILTER (WHERE status = 'dead') as dead_leads,
  COALESCE(SUM(excess_funds_amount), 0) as total_pipeline_value,
  COALESCE(SUM(potential_revenue), 0) as total_potential_revenue,
  COALESCE(SUM(potential_revenue) FILTER (WHERE status = 'closed'), 0) as closed_revenue,
  COALESCE(AVG(eleanor_score), 0) as avg_eleanor_score,
  COUNT(*) FILTER (WHERE contact_priority = 'hot') as hot_leads,
  COUNT(*) FILTER (WHERE contact_priority = 'warm') as warm_leads,
  COUNT(*) FILTER (WHERE deal_type = 'dual') as dual_opportunities,
  COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as leads_today,
  NOW() as last_updated
FROM maxsam_leads;

-- Expiring Funds View (Time-sensitive leads)
CREATE OR REPLACE VIEW maxsam_expiring_funds AS
SELECT
  id,
  property_address,
  owner_name,
  phone,
  excess_funds_amount,
  eleanor_score,
  status,
  created_at
FROM maxsam_leads
WHERE excess_funds_amount > 5000
  AND status NOT IN ('closed', 'dead')
ORDER BY excess_funds_amount DESC
LIMIT 50;

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
DO $$
BEGIN
  -- Contracts table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_contracts_updated_at') THEN
    CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON contracts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;

  -- Buyers table trigger
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_buyers_updated_at') THEN
    CREATE TRIGGER update_buyers_updated_at BEFORE UPDATE ON buyers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Function to log status changes automatically
CREATE OR REPLACE FUNCTION log_lead_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO status_history (lead_id, old_status, new_status, changed_by, reason)
    VALUES (NEW.id, OLD.status, NEW.status, 'system', 'Automatic status change');
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply status logging trigger to maxsam_leads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_lead_status_changes') THEN
    CREATE TRIGGER log_lead_status_changes AFTER UPDATE ON maxsam_leads
    FOR EACH ROW EXECUTE FUNCTION log_lead_status_change();
  END IF;
END $$;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on sensitive tables
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue ENABLE ROW LEVEL SECURITY;
ALTER TABLE opt_outs ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users (adjust as needed)
DROP POLICY IF EXISTS "Allow authenticated access to contracts" ON contracts;
CREATE POLICY "Allow authenticated access to contracts" ON contracts
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to revenue" ON revenue;
CREATE POLICY "Allow authenticated access to revenue" ON revenue
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated access to opt_outs" ON opt_outs;
CREATE POLICY "Allow authenticated access to opt_outs" ON opt_outs
  FOR ALL TO authenticated USING (true);

-- ============================================
-- GRANTS
-- ============================================

-- Grant access to service role for API operations
GRANT ALL ON contracts TO service_role;
GRANT ALL ON buyers TO service_role;
GRANT ALL ON property_buyer_matches TO service_role;
GRANT ALL ON opt_outs TO service_role;
GRANT ALL ON status_history TO service_role;
GRANT ALL ON system_config TO service_role;
GRANT ALL ON revenue TO service_role;
GRANT ALL ON communication_logs TO service_role;

-- Grant read access to views for anon users (dashboard)
GRANT SELECT ON maxsam_golden_opportunities TO anon;
GRANT SELECT ON maxsam_sam_call_queue TO anon;
GRANT SELECT ON maxsam_dashboard_metrics TO anon;
GRANT SELECT ON maxsam_expiring_funds TO anon;

-- ============================================
-- DONE!
-- ============================================
-- Schema is now complete. Run this in Supabase SQL Editor.
