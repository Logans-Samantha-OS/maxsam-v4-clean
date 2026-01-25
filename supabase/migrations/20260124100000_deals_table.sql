-- Migration: Create deals table for correct payment flow tracking
-- MaxSam does NOT invoice clients via Stripe
-- Revenue comes from: County (excess funds) or Title Company (wholesale)

-- Drop and recreate deals table with correct schema
DROP TABLE IF EXISTS deals CASCADE;

-- Create deals table
CREATE TABLE deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES maxsam_leads(id),
  contract_id UUID REFERENCES contracts(id),

  -- Deal type: excess_funds or wholesale
  deal_type TEXT NOT NULL CHECK (deal_type IN ('excess_funds', 'wholesale')),

  -- Common fields
  property_address TEXT,
  seller_name TEXT,
  seller_email TEXT,
  seller_phone TEXT,

  -- Status tracking
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending',           -- Contract signed, awaiting next steps
    'claim_filed',       -- Excess funds: claim filed with county
    'claim_approved',    -- Excess funds: county approved claim
    'claim_denied',      -- Excess funds: county denied claim
    'scheduled',         -- Wholesale: closing scheduled
    'closed',            -- Deal complete, money received
    'fell_through',      -- Deal failed
    'paid_out'           -- Owner/seller has been paid their share
  )),

  -- ============================================
  -- EXCESS FUNDS DEAL FIELDS (25% fee)
  -- Money comes from COUNTY payout
  -- ============================================
  excess_funds_amount DECIMAL(12,2),           -- Total county is holding
  claim_filed_date TIMESTAMPTZ,                -- When we filed with county
  claim_status TEXT CHECK (claim_status IN ('pending', 'approved', 'denied', 'paid') OR claim_status IS NULL),
  county_name TEXT,                            -- Which county holds the funds
  county_case_number TEXT,                     -- County's case/reference number
  county_payout_date TIMESTAMPTZ,              -- When county paid out
  county_payout_amount DECIMAL(12,2),          -- Actual amount received from county
  our_excess_fee_percentage DECIMAL(5,4) DEFAULT 0.25,  -- Our 25% cut
  our_excess_fee_amount DECIMAL(12,2),         -- Calculated fee amount
  owner_payout_amount DECIMAL(12,2),           -- Their 75%
  owner_paid_date TIMESTAMPTZ,                 -- When we sent owner their share
  owner_paid_method TEXT,                      -- Check, wire, etc.

  -- ============================================
  -- WHOLESALE DEAL FIELDS (10% assignment fee)
  -- Money comes through TITLE COMPANY at closing
  -- ============================================
  contract_price DECIMAL(12,2),                -- What we got property under contract for
  assignment_fee DECIMAL(12,2),                -- Our fee (usually 10% or flat)
  assignment_fee_percentage DECIMAL(5,4) DEFAULT 0.10,
  buyer_id UUID REFERENCES buyers(id),         -- Link to buyers table
  buyer_name TEXT,                             -- Buyer name (denormalized)
  buyer_company TEXT,
  buyer_phone TEXT,
  buyer_email TEXT,
  title_company TEXT,
  title_company_contact TEXT,
  title_company_phone TEXT,
  title_company_email TEXT,
  closing_date TIMESTAMPTZ,
  closing_status TEXT CHECK (closing_status IN ('scheduled', 'closed', 'fell_through', 'postponed') OR closing_status IS NULL),
  assignment_fee_received BOOLEAN DEFAULT false,
  assignment_fee_received_date TIMESTAMPTZ,

  -- ============================================
  -- Revenue tracking (replaces old Stripe invoice flow)
  -- ============================================
  total_revenue DECIMAL(12,2),                 -- Total money we received
  owner_split_percentage DECIMAL(5,4) DEFAULT 1.0,  -- Logan gets 100% for now
  partner_split_percentage DECIMAL(5,4) DEFAULT 0.0,
  owner_revenue DECIMAL(12,2),                 -- Logan's share
  partner_revenue DECIMAL(12,2),               -- Future partner share

  -- Notes and metadata
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_deals_lead_id ON deals(lead_id);
CREATE INDEX IF NOT EXISTS idx_deals_contract_id ON deals(contract_id);
CREATE INDEX IF NOT EXISTS idx_deals_deal_type ON deals(deal_type);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_claim_status ON deals(claim_status);
CREATE INDEX IF NOT EXISTS idx_deals_closing_status ON deals(closing_status);
CREATE INDEX IF NOT EXISTS idx_deals_buyer_id ON deals(buyer_id);

-- Enable RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

-- Create permissive policy (adjust for production)
DROP POLICY IF EXISTS "Enable all" ON deals;
CREATE POLICY "Enable all" ON deals FOR ALL USING (true);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS deals_updated_at ON deals;
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW
  EXECUTE FUNCTION update_deals_updated_at();

-- ============================================
-- Update contracts table to remove Stripe invoice fields
-- and add deal tracking
-- ============================================

-- Add deal_id to contracts if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'deal_id'
  ) THEN
    ALTER TABLE contracts ADD COLUMN deal_id UUID REFERENCES deals(id);
  END IF;
END $$;

-- Mark Stripe invoice columns as deprecated (if they exist)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'stripe_invoice_id'
  ) THEN
    COMMENT ON COLUMN contracts.stripe_invoice_id IS 'DEPRECATED: MaxSam does not invoice clients. Revenue comes from county/title company.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'stripe_invoice_url'
  ) THEN
    COMMENT ON COLUMN contracts.stripe_invoice_url IS 'DEPRECATED: MaxSam does not invoice clients. Revenue comes from county/title company.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contracts' AND column_name = 'payment_status'
  ) THEN
    COMMENT ON COLUMN contracts.payment_status IS 'DEPRECATED: Use deals.status instead for payment tracking.';
  END IF;
END $$;

-- ============================================
-- Update revenue table to link to deals (if revenue table exists)
-- ============================================

DO $$
BEGIN
  -- Only run if revenue table exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'revenue') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'revenue' AND column_name = 'deal_id'
    ) THEN
      ALTER TABLE revenue ADD COLUMN deal_id UUID REFERENCES deals(id);
    END IF;

    -- Add source column to track where money came from
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'revenue' AND column_name = 'source'
    ) THEN
      ALTER TABLE revenue ADD COLUMN source TEXT CHECK (source IN ('county_payout', 'title_company', 'direct') OR source IS NULL);
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'revenue' AND column_name = 'stripe_invoice_id'
    ) THEN
      COMMENT ON COLUMN revenue.stripe_invoice_id IS 'DEPRECATED: MaxSam does not invoice clients.';
    END IF;
  END IF;
END $$;

-- ============================================
-- Create view for deal summary
-- ============================================

CREATE OR REPLACE VIEW deal_summary AS
SELECT
  d.id,
  d.deal_type,
  d.status,
  d.property_address,
  d.seller_name,
  CASE
    WHEN d.deal_type = 'excess_funds' THEN d.excess_funds_amount
    WHEN d.deal_type = 'wholesale' THEN d.contract_price
  END as deal_value,
  CASE
    WHEN d.deal_type = 'excess_funds' THEN d.our_excess_fee_amount
    WHEN d.deal_type = 'wholesale' THEN d.assignment_fee
  END as our_fee,
  CASE
    WHEN d.deal_type = 'excess_funds' THEN d.claim_status
    WHEN d.deal_type = 'wholesale' THEN d.closing_status
  END as sub_status,
  d.total_revenue,
  d.owner_revenue,
  d.created_at,
  d.updated_at,
  l.eleanor_score,
  l.case_number
FROM deals d
LEFT JOIN maxsam_leads l ON d.lead_id = l.id;
