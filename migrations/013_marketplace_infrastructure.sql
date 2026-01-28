-- ============================================================================
-- MaxSam V4 - Marketplace Infrastructure
-- Created: 2026-01-27
-- Purpose: Lead Bank, Marketplace, Buyers Network, Auto-Routing, Mass Tort
-- ============================================================================

-- ============================================================================
-- TABLE 1: lead_bank (parking lot for leads not ready for outreach)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_bank (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (reason IN ('no_response', 'too_small', 'wrong_location', 'low_score', 'duplicate', 'expired', 'other')),
  original_score INTEGER,
  amount DECIMAL(12,2),
  notes TEXT,
  parked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reactivated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE 2: marketplace_inventory (leads listed for sale)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  lead_type TEXT NOT NULL CHECK (lead_type IN ('distressed_seller', 'excess_funds', 'mass_tort', 'skip_trace', 'unclaimed_property', 'death_benefit', 'wholesale')),
  asking_price DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'pending', 'sold', 'expired', 'withdrawn')),
  source_vertical TEXT,
  quality_score INTEGER,
  description TEXT,
  listed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sold_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE 3: lead_sales (transaction history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS lead_sales (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  inventory_id UUID REFERENCES marketplace_inventory(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES maxsam_buyers(id) ON DELETE SET NULL,
  lead_type TEXT NOT NULL,
  sale_price DECIMAL(10,2) NOT NULL,
  sale_method TEXT DEFAULT 'direct' CHECK (sale_method IN ('direct', 'auction', 'auto_route', 'blast', 'subscription')),
  commission_rate DECIMAL(5,2) DEFAULT 0,
  commission_amount DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  sold_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE 4: auto_routing_rules (automatic buyer matching)
-- ============================================================================
CREATE TABLE IF NOT EXISTS auto_routing_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  lead_type TEXT NOT NULL,
  conditions JSONB NOT NULL DEFAULT '{}',
  buyer_id UUID REFERENCES maxsam_buyers(id) ON DELETE CASCADE,
  price DECIMAL(10,2) NOT NULL,
  priority INTEGER DEFAULT 0,
  leads_routed INTEGER DEFAULT 0,
  last_routed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE 5: mass_tort_campaigns
-- ============================================================================
CREATE TABLE IF NOT EXISTS mass_tort_campaigns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tort_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  qualification_criteria JSONB NOT NULL DEFAULT '{}',
  price_per_lead DECIMAL(10,2),
  target_leads INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  leads_qualified INTEGER DEFAULT 0,
  leads_sold INTEGER DEFAULT 0,
  revenue DECIMAL(12,2) DEFAULT 0,
  sms_template TEXT,
  email_template TEXT,
  screening_questions JSONB DEFAULT '[]',
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- TABLE 6: mass_tort_leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS mass_tort_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID REFERENCES mass_tort_campaigns(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES maxsam_leads(id) ON DELETE CASCADE,
  tort_type TEXT NOT NULL,
  qualification_status TEXT DEFAULT 'pending' CHECK (qualification_status IN ('pending', 'screening', 'qualified', 'disqualified', 'sold', 'expired')),
  screening_answers JSONB DEFAULT '{}',
  injury_details TEXT,
  diagnosis_date DATE,
  treatment_history TEXT,
  qualified_at TIMESTAMP WITH TIME ZONE,
  sold_at TIMESTAMP WITH TIME ZONE,
  sale_price DECIMAL(10,2),
  buyer_id UUID REFERENCES maxsam_buyers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ADD COLUMNS TO maxsam_buyers (extend existing table)
-- ============================================================================
DO $$ 
BEGIN
  -- Add lead marketplace columns if they don't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'buyer_type') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN buyer_type TEXT CHECK (buyer_type IN ('wholesaler', 'investor', 'law_firm', 'recovery_company', 'heir_locator', 'collection_agency', 'pi', 'other'));
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'lead_types') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN lead_types TEXT[] DEFAULT '{}';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'max_price_per_lead') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN max_price_per_lead DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'monthly_budget') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN monthly_budget DECIMAL(10,2);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'monthly_spent') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN monthly_spent DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'lifetime_spend') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN lifetime_spend DECIMAL(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_buyers' AND column_name = 'leads_purchased') THEN
    ALTER TABLE maxsam_buyers ADD COLUMN leads_purchased INTEGER DEFAULT 0;
  END IF;
END $$;

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE lead_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE marketplace_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_tort_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE mass_tort_leads ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- CREATE POLICIES (Allow all for now - tighten for production)
-- ============================================================================
DROP POLICY IF EXISTS "Allow all lead_bank" ON lead_bank;
CREATE POLICY "Allow all lead_bank" ON lead_bank FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all marketplace_inventory" ON marketplace_inventory;
CREATE POLICY "Allow all marketplace_inventory" ON marketplace_inventory FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all lead_sales" ON lead_sales;
CREATE POLICY "Allow all lead_sales" ON lead_sales FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all auto_routing_rules" ON auto_routing_rules;
CREATE POLICY "Allow all auto_routing_rules" ON auto_routing_rules FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all mass_tort_campaigns" ON mass_tort_campaigns;
CREATE POLICY "Allow all mass_tort_campaigns" ON mass_tort_campaigns FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow all mass_tort_leads" ON mass_tort_leads;
CREATE POLICY "Allow all mass_tort_leads" ON mass_tort_leads FOR ALL USING (true);

-- ============================================================================
-- CREATE INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lead_bank_reason ON lead_bank(reason);
CREATE INDEX IF NOT EXISTS idx_lead_bank_lead_id ON lead_bank(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_bank_parked_at ON lead_bank(parked_at);

CREATE INDEX IF NOT EXISTS idx_marketplace_status ON marketplace_inventory(status);
CREATE INDEX IF NOT EXISTS idx_marketplace_type ON marketplace_inventory(lead_type);
CREATE INDEX IF NOT EXISTS idx_marketplace_lead_id ON marketplace_inventory(lead_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_expires_at ON marketplace_inventory(expires_at);

CREATE INDEX IF NOT EXISTS idx_sales_buyer ON lead_sales(buyer_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON lead_sales(sold_at);
CREATE INDEX IF NOT EXISTS idx_sales_lead_type ON lead_sales(lead_type);

CREATE INDEX IF NOT EXISTS idx_routing_buyer ON auto_routing_rules(buyer_id);
CREATE INDEX IF NOT EXISTS idx_routing_lead_type ON auto_routing_rules(lead_type);
CREATE INDEX IF NOT EXISTS idx_routing_active ON auto_routing_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_tort_campaign_status ON mass_tort_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_tort_campaign_type ON mass_tort_campaigns(tort_type);

CREATE INDEX IF NOT EXISTS idx_tort_leads_status ON mass_tort_leads(qualification_status);
CREATE INDEX IF NOT EXISTS idx_tort_leads_campaign ON mass_tort_leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_tort_leads_lead_id ON mass_tort_leads(lead_id);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to increment buyer stats when a sale is made
CREATE OR REPLACE FUNCTION increment_buyer_stats(p_buyer_id UUID, p_amount DECIMAL)
RETURNS void AS $$
BEGIN
  UPDATE maxsam_buyers
  SET 
    lifetime_spend = COALESCE(lifetime_spend, 0) + p_amount,
    monthly_spent = COALESCE(monthly_spent, 0) + p_amount,
    leads_purchased = COALESCE(leads_purchased, 0) + 1,
    updated_at = NOW()
  WHERE id = p_buyer_id;
END;
$$ LANGUAGE plpgsql;

-- Function to reset monthly spend (run on 1st of each month)
CREATE OR REPLACE FUNCTION reset_monthly_buyer_spend()
RETURNS void AS $$
BEGIN
  UPDATE maxsam_buyers SET monthly_spent = 0;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old marketplace listings
CREATE OR REPLACE FUNCTION expire_marketplace_listings()
RETURNS INTEGER AS $$
DECLARE
  expired_count INTEGER;
BEGIN
  UPDATE marketplace_inventory 
  SET status = 'expired'
  WHERE status = 'available' 
    AND expires_at < NOW();
  
  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
BEGIN
  RAISE NOTICE 'Migration 013 complete: Marketplace infrastructure created';
  RAISE NOTICE 'Tables created: lead_bank, marketplace_inventory, lead_sales, auto_routing_rules, mass_tort_campaigns, mass_tort_leads';
  RAISE NOTICE 'Extended: maxsam_buyers with marketplace columns';
END $$;
