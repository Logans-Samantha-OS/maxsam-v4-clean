-- ============================================================================
-- Migration: Zillow Matches Table for Golden Lead Hunter
-- ============================================================================

-- ============================================================================
-- TABLE: zillow_matches
-- Stores Zillow listing data cross-referenced with leads
-- ============================================================================
CREATE TABLE IF NOT EXISTS zillow_matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL,

    -- Zillow listing data
    zillow_url TEXT,
    listing_status TEXT CHECK (listing_status IN ('active', 'pending', 'sold', 'off_market', 'unknown')),
    list_price DECIMAL(12,2),
    sold_price DECIMAL(12,2),
    days_on_market INTEGER,
    property_type TEXT,
    beds INTEGER,
    baths DECIMAL(3,1),
    sqft INTEGER,
    lot_size TEXT,
    year_built INTEGER,

    -- Match metadata
    match_confidence INTEGER DEFAULT 0 CHECK (match_confidence >= 0 AND match_confidence <= 100),
    match_type TEXT CHECK (match_type IN ('exact_address', 'name_match', 'partial', 'fuzzy')),
    match_details JSONB DEFAULT '{}',

    -- Search info
    search_query TEXT,
    search_type TEXT CHECK (search_type IN ('address', 'owner_name', 'both')),

    -- Processing
    scraped_at TIMESTAMPTZ DEFAULT NOW(),
    scrape_source TEXT DEFAULT 'browserless',
    raw_html TEXT,

    -- Audit
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_zillow_matches_lead_id ON zillow_matches(lead_id);
CREATE INDEX IF NOT EXISTS idx_zillow_matches_status ON zillow_matches(listing_status);
CREATE INDEX IF NOT EXISTS idx_zillow_matches_confidence ON zillow_matches(match_confidence DESC);
CREATE INDEX IF NOT EXISTS idx_zillow_matches_scraped_at ON zillow_matches(scraped_at DESC);

-- ============================================================================
-- Add golden lead columns to maxsam_leads if not exist
-- ============================================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'golden_lead') THEN
        ALTER TABLE maxsam_leads ADD COLUMN golden_lead BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'is_golden_lead') THEN
        ALTER TABLE maxsam_leads ADD COLUMN is_golden_lead BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'golden_score') THEN
        ALTER TABLE maxsam_leads ADD COLUMN golden_score INTEGER DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'zillow_status') THEN
        ALTER TABLE maxsam_leads ADD COLUMN zillow_status TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'zillow_url') THEN
        ALTER TABLE maxsam_leads ADD COLUMN zillow_url TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'zillow_price') THEN
        ALTER TABLE maxsam_leads ADD COLUMN zillow_price DECIMAL(12,2);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'zillow_checked_at') THEN
        ALTER TABLE maxsam_leads ADD COLUMN zillow_checked_at TIMESTAMPTZ;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'maxsam_leads' AND column_name = 'combined_value') THEN
        ALTER TABLE maxsam_leads ADD COLUMN combined_value DECIMAL(12,2);
    END IF;
END $$;

-- Index for golden leads
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_golden ON maxsam_leads(golden_lead) WHERE golden_lead = true;
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_is_golden ON maxsam_leads(is_golden_lead) WHERE is_golden_lead = true;
CREATE INDEX IF NOT EXISTS idx_maxsam_leads_golden_score ON maxsam_leads(golden_score DESC);

-- ============================================================================
-- TABLE: golden_hunt_runs
-- Tracks each hunt execution for auditing
-- ============================================================================
CREATE TABLE IF NOT EXISTS golden_hunt_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),

    -- Stats
    leads_scanned INTEGER DEFAULT 0,
    zillow_matches_found INTEGER DEFAULT 0,
    golden_leads_identified INTEGER DEFAULT 0,

    -- Config
    min_excess_amount DECIMAL(12,2),
    max_leads_to_scan INTEGER,

    -- Results
    error_message TEXT,
    summary JSONB DEFAULT '{}',

    -- Trigger info
    triggered_by TEXT DEFAULT 'manual',

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RLS Policies
-- ============================================================================
ALTER TABLE zillow_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE golden_hunt_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zillow_matches_all" ON zillow_matches;
CREATE POLICY "zillow_matches_all" ON zillow_matches FOR ALL USING (true);

DROP POLICY IF EXISTS "golden_hunt_runs_all" ON golden_hunt_runs;
CREATE POLICY "golden_hunt_runs_all" ON golden_hunt_runs FOR ALL USING (true);

-- ============================================================================
-- Function to calculate golden score
-- ============================================================================
CREATE OR REPLACE FUNCTION calculate_golden_score(
    p_match_type TEXT,
    p_listing_status TEXT,
    p_match_confidence INTEGER,
    p_excess_amount DECIMAL
) RETURNS INTEGER AS $$
DECLARE
    v_score INTEGER := 0;
BEGIN
    -- Base score from match type
    IF p_match_type = 'exact_address' THEN
        v_score := 70;
    ELSIF p_match_type = 'name_match' THEN
        v_score := 50;
    ELSIF p_match_type = 'partial' THEN
        v_score := 30;
    ELSE
        v_score := 10;
    END IF;

    -- Bonus for listing status
    IF p_listing_status = 'active' THEN
        v_score := v_score + 30;
    ELSIF p_listing_status = 'pending' THEN
        v_score := v_score + 40; -- URGENT - pending sale
    ELSIF p_listing_status = 'sold' THEN
        v_score := v_score + 15;
    END IF;

    -- Confidence adjustment
    v_score := v_score * COALESCE(p_match_confidence, 50) / 100;

    -- Bonus for high excess funds
    IF COALESCE(p_excess_amount, 0) >= 10000 THEN
        v_score := v_score + 10;
    ELSIF COALESCE(p_excess_amount, 0) >= 5000 THEN
        v_score := v_score + 5;
    END IF;

    -- Cap at 100
    RETURN LEAST(v_score, 100);
END;
$$ LANGUAGE plpgsql;

SELECT 'Zillow matches migration complete' AS result;
