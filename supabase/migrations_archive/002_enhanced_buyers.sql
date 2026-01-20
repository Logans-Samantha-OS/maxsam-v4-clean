-- ============================================
-- MAXSAM V4 - ENHANCED BUYERS TABLE
-- ============================================
-- Run this in Supabase SQL Editor to add buyer management fields

-- Add new columns to buyers table
DO $$
BEGIN
  -- Contact Information
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'full_name') THEN
    ALTER TABLE buyers ADD COLUMN full_name TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'secondary_phone') THEN
    ALTER TABLE buyers ADD COLUMN secondary_phone TEXT;
  END IF;

  -- Buy Box Criteria
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'preferred_zips') THEN
    ALTER TABLE buyers ADD COLUMN preferred_zips TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'min_purchase_price') THEN
    ALTER TABLE buyers ADD COLUMN min_purchase_price DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'min_arv') THEN
    ALTER TABLE buyers ADD COLUMN min_arv DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'max_arv') THEN
    ALTER TABLE buyers ADD COLUMN max_arv DECIMAL(12,2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'condition_preference') THEN
    ALTER TABLE buyers ADD COLUMN condition_preference TEXT DEFAULT 'any';
  END IF;

  -- Deal Preferences
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'deal_types') THEN
    ALTER TABLE buyers ADD COLUMN deal_types TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'closing_speed') THEN
    ALTER TABLE buyers ADD COLUMN closing_speed TEXT DEFAULT '30 days';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'funding_type') THEN
    ALTER TABLE buyers ADD COLUMN funding_type TEXT DEFAULT 'cash';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'proof_of_funds') THEN
    ALTER TABLE buyers ADD COLUMN proof_of_funds BOOLEAN DEFAULT FALSE;
  END IF;

  -- Track Record
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'deals_closed') THEN
    ALTER TABLE buyers ADD COLUMN deals_closed INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'average_deal_size') THEN
    ALTER TABLE buyers ADD COLUMN average_deal_size DECIMAL(12,2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'reliability_rating') THEN
    ALTER TABLE buyers ADD COLUMN reliability_rating INTEGER DEFAULT 3 CHECK (reliability_rating >= 1 AND reliability_rating <= 5);
  END IF;

  -- Status
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'buyers' AND column_name = 'is_active') THEN
    ALTER TABLE buyers ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;

END $$;

-- Update existing status column constraint if needed
ALTER TABLE buyers DROP CONSTRAINT IF EXISTS buyers_status_check;
ALTER TABLE buyers ADD CONSTRAINT buyers_status_check
  CHECK (status IN ('active', 'inactive', 'vip', 'blacklisted', 'pending'));

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_buyers_status ON buyers(status);
CREATE INDEX IF NOT EXISTS idx_buyers_is_active ON buyers(is_active);
CREATE INDEX IF NOT EXISTS idx_buyers_max_purchase ON buyers(max_purchase_price);
CREATE INDEX IF NOT EXISTS idx_buyers_funding_type ON buyers(funding_type);
CREATE INDEX IF NOT EXISTS idx_buyers_closing_speed ON buyers(closing_speed);
CREATE INDEX IF NOT EXISTS idx_buyers_deals_closed ON buyers(deals_closed);

-- Create view for buyer analytics
CREATE OR REPLACE VIEW buyer_analytics AS
SELECT
  COUNT(*) as total_buyers,
  COUNT(*) FILTER (WHERE is_active = true OR status = 'active') as active_buyers,
  SUM(deals_closed) as total_deals_closed,
  AVG(max_purchase_price) FILTER (WHERE max_purchase_price > 0) as avg_max_budget,
  COUNT(*) FILTER (WHERE closing_speed = '7 days') as quick_closers,
  COUNT(*) FILTER (WHERE funding_type = 'cash') as cash_buyers,
  COUNT(*) FILTER (WHERE funding_type = 'hard_money') as hard_money_buyers,
  COUNT(*) FILTER (WHERE funding_type = 'conventional') as conventional_buyers,
  COUNT(*) FILTER (WHERE funding_type = 'private_lending') as private_lending_buyers,
  COUNT(*) FILTER (WHERE proof_of_funds = true) as pof_on_file
FROM buyers;
