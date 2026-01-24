-- Multi-County Golden Lead Hunter System
-- Migration: 20260124000000
-- Purpose: Enable matching excess funds leads with distressed properties across multiple Texas counties

-- ============================================================
-- PART 1: County Sources Table
-- ============================================================
CREATE TABLE IF NOT EXISTS county_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_name TEXT NOT NULL,
  state TEXT DEFAULT 'TX',
  excess_funds_url TEXT,
  tax_sale_url TEXT,
  foreclosure_url TEXT,
  scrape_frequency TEXT DEFAULT 'weekly',
  last_scraped_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed top 10 Texas counties with excess funds URLs
INSERT INTO county_sources (county_name, excess_funds_url) VALUES
('Dallas', 'https://www.dallascounty.org/government/district-clerk/court-funds-excess-proceeds/'),
('Harris', 'https://www.cclerk.hctx.net/ExcessProceeds.aspx'),
('Tarrant', 'https://www.tarrantcounty.com/en/district-clerk/excess-proceeds.html'),
('Bexar', 'https://www.bexar.org/1626/Excess-Proceeds'),
('Travis', 'https://www.traviscountytx.gov/district-clerk/excess-proceeds'),
('Collin', 'https://www.collincountytx.gov/district_clerk/Pages/excess-proceeds.aspx'),
('Denton', 'https://www.dentoncounty.gov/1582/Excess-Proceeds'),
('Hidalgo', 'https://www.co.hidalgo.tx.us/2428/Excess-Proceeds'),
('El Paso', 'https://www.epcounty.com/distclerk/excess-proceeds.htm'),
('Fort Bend', 'https://www.fortbendcountytx.gov/government/departments/district-clerk/excess-proceeds')
ON CONFLICT DO NOTHING;

-- Add unique constraint on county_name + state
ALTER TABLE county_sources
  ADD CONSTRAINT county_sources_county_state_unique UNIQUE (county_name, state);

-- ============================================================
-- PART 2: Distressed Properties Table
-- ============================================================
CREATE TABLE IF NOT EXISTS distressed_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT, -- 'zillow', 'redfin', 'auction.com', 'foreclosure.com'
  property_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  owner_name TEXT,
  list_price NUMERIC,
  zestimate NUMERIC,
  listing_status TEXT, -- 'pre-foreclosure', 'auction', 'price-reduced', 'bank-owned'
  days_on_market INTEGER,
  listing_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  matched_lead_id UUID REFERENCES maxsam_leads(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes for matching
CREATE INDEX IF NOT EXISTS idx_distressed_owner_name ON distressed_properties(owner_name);
CREATE INDEX IF NOT EXISTS idx_distressed_address ON distressed_properties(property_address);
CREATE INDEX IF NOT EXISTS idx_distressed_matched_lead ON distressed_properties(matched_lead_id);
CREATE INDEX IF NOT EXISTS idx_distressed_source ON distressed_properties(source);
CREATE INDEX IF NOT EXISTS idx_distressed_status ON distressed_properties(listing_status);

-- ============================================================
-- PART 3: Add Super Golden Columns to maxsam_leads
-- ============================================================
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS is_super_golden BOOLEAN DEFAULT false;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS golden_match_source TEXT; -- 'zillow', 'redfin', etc.
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS distressed_property_url TEXT;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS distressed_listing_price NUMERIC;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS combined_opportunity_value NUMERIC; -- excess_funds + property equity

-- Index for super golden leads
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_super_golden ON maxsam_leads(is_super_golden) WHERE is_super_golden = true;

-- ============================================================
-- PART 4: Golden Lead Matching Function
-- ============================================================
CREATE OR REPLACE FUNCTION match_golden_leads()
RETURNS INTEGER AS $$
DECLARE
  match_count INTEGER := 0;
BEGIN
  -- Match by owner name (exact case-insensitive) or address similarity
  UPDATE maxsam_leads ml
  SET
    is_golden = true,
    is_super_golden = true,
    golden_match_source = dp.source,
    distressed_property_url = dp.listing_url,
    distressed_listing_price = dp.list_price,
    combined_opportunity_value = COALESCE(ml.excess_funds_amount, 0) + COALESCE(dp.list_price * 0.1, 0)
  FROM distressed_properties dp
  WHERE
    dp.matched_lead_id IS NULL
    AND (
      LOWER(TRIM(ml.owner_name)) = LOWER(TRIM(dp.owner_name))
      OR (
        ml.property_address IS NOT NULL
        AND dp.property_address IS NOT NULL
        AND ml.property_address ILIKE '%' || dp.property_address || '%'
      )
    )
    AND ml.state = dp.state;

  GET DIAGNOSTICS match_count = ROW_COUNT;

  -- Mark the distressed properties as matched
  UPDATE distressed_properties dp
  SET matched_lead_id = ml.id
  FROM maxsam_leads ml
  WHERE
    dp.matched_lead_id IS NULL
    AND (
      LOWER(TRIM(ml.owner_name)) = LOWER(TRIM(dp.owner_name))
      OR (
        ml.property_address IS NOT NULL
        AND dp.property_address IS NOT NULL
        AND ml.property_address ILIKE '%' || dp.property_address || '%'
      )
    )
    AND ml.state = dp.state;

  RETURN match_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Helper function to get county sources for N8N
-- ============================================================
CREATE OR REPLACE FUNCTION get_active_county_sources()
RETURNS TABLE (
  id UUID,
  county_name TEXT,
  state TEXT,
  excess_funds_url TEXT,
  last_scraped_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cs.id,
    cs.county_name,
    cs.state,
    cs.excess_funds_url,
    cs.last_scraped_at
  FROM county_sources cs
  WHERE cs.is_active = true
  ORDER BY cs.county_name;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Helper function to mark county as scraped
-- ============================================================
CREATE OR REPLACE FUNCTION mark_county_scraped(p_county_name TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE county_sources
  SET last_scraped_at = NOW()
  WHERE county_name = p_county_name;
END;
$$ LANGUAGE plpgsql;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION match_golden_leads() TO authenticated;
GRANT EXECUTE ON FUNCTION get_active_county_sources() TO authenticated;
GRANT EXECUTE ON FUNCTION mark_county_scraped(TEXT) TO authenticated;

-- Enable RLS on new tables
ALTER TABLE county_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE distressed_properties ENABLE ROW LEVEL SECURITY;

-- Create policies for county_sources (read-only for most users)
CREATE POLICY "Allow read access to county_sources" ON county_sources
  FOR SELECT USING (true);

-- Create policies for distressed_properties
CREATE POLICY "Allow read access to distressed_properties" ON distressed_properties
  FOR SELECT USING (true);

CREATE POLICY "Allow insert to distressed_properties" ON distressed_properties
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update to distressed_properties" ON distressed_properties
  FOR UPDATE USING (true);
