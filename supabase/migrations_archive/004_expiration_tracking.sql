-- ============================================
-- MAXSAM V4 - EXPIRATION TRACKING & CRITICAL LEADS
-- ============================================
-- Migration 004: Expiration-First Scoring System
-- The Golden Filter - Expiration is King

-- ===========================================
-- ADD EXPIRATION TRACKING COLUMNS
-- ===========================================

ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS first_seen_date DATE DEFAULT CURRENT_DATE;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS expiration_date DATE;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS days_until_expiration INTEGER;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS expiration_urgency TEXT DEFAULT 'normal';
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS is_distressed BOOLEAN DEFAULT FALSE;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS is_cross_referenced BOOLEAN DEFAULT FALSE;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS distressed_source TEXT;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS cross_reference_boost INTEGER DEFAULT 0;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS priority_override TEXT;
ALTER TABLE maxsam_leads ADD COLUMN IF NOT EXISTS last_expiration_check TIMESTAMP WITH TIME ZONE;

-- ===========================================
-- ADD CONSTRAINT FOR EXPIRATION URGENCY
-- ===========================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_expiration_urgency'
  ) THEN
    ALTER TABLE maxsam_leads ADD CONSTRAINT valid_expiration_urgency
    CHECK (expiration_urgency IN ('critical', 'urgent', 'warning', 'normal', 'safe'));
  END IF;
END $$;

-- ===========================================
-- CREATE DISTRESSED LISTS TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS distressed_lists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'foreclosure', 'bankruptcy', 'tax_lien', 'divorce', 'probate', 'code_violation'
  file_name TEXT,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  record_count INTEGER DEFAULT 0,
  last_cross_referenced TIMESTAMP WITH TIME ZONE,
  is_active BOOLEAN DEFAULT TRUE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- CREATE DISTRESSED LIST ENTRIES TABLE
-- ===========================================

CREATE TABLE IF NOT EXISTS distressed_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID REFERENCES distressed_lists(id) ON DELETE CASCADE,
  property_address TEXT NOT NULL,
  owner_name TEXT,
  city TEXT,
  state TEXT DEFAULT 'TX',
  zip_code TEXT,
  distress_type TEXT NOT NULL,
  distress_date DATE,
  amount_owed DECIMAL(12,2),
  case_number TEXT,
  status TEXT DEFAULT 'active',
  matched_lead_id UUID REFERENCES maxsam_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ===========================================
-- CREATE CRITICAL LEADS VIEW
-- ===========================================

CREATE OR REPLACE VIEW critical_leads AS
SELECT
  *,
  CASE
    WHEN days_until_expiration <= 7 THEN 'CRITICAL'
    WHEN days_until_expiration <= 14 THEN 'ULTRA DIAMOND'
    WHEN days_until_expiration <= 30 AND is_cross_referenced THEN 'DIAMOND'
    WHEN days_until_expiration <= 30 THEN 'EMERALD'
    WHEN days_until_expiration <= 60 THEN 'SAPPHIRE'
    WHEN days_until_expiration <= 90 THEN 'AMBER'
    ELSE 'RUBY'
  END AS priority_tier,
  CASE
    WHEN days_until_expiration <= 7 THEN 1
    WHEN days_until_expiration <= 14 THEN 2
    WHEN days_until_expiration <= 30 AND is_cross_referenced THEN 3
    WHEN days_until_expiration <= 30 THEN 4
    WHEN days_until_expiration <= 60 THEN 5
    WHEN days_until_expiration <= 90 THEN 6
    ELSE 7
  END AS priority_rank
FROM maxsam_leads
WHERE status NOT IN ('closed', 'dead', 'archived')
ORDER BY priority_rank ASC, potential_revenue DESC;

-- ===========================================
-- CREATE EXPIRING SOON VIEW (Next 30 Days)
-- ===========================================

CREATE OR REPLACE VIEW expiring_soon AS
SELECT
  *,
  CASE
    WHEN days_until_expiration <= 3 THEN 'IMMEDIATE'
    WHEN days_until_expiration <= 7 THEN 'CRITICAL'
    WHEN days_until_expiration <= 14 THEN 'URGENT'
    WHEN days_until_expiration <= 21 THEN 'WARNING'
    ELSE 'APPROACHING'
  END AS urgency_label,
  CASE
    WHEN days_until_expiration <= 3 THEN '#ff0000'
    WHEN days_until_expiration <= 7 THEN '#ff4444'
    WHEN days_until_expiration <= 14 THEN '#ffaa00'
    WHEN days_until_expiration <= 21 THEN '#ffdd00'
    ELSE '#00ff88'
  END AS urgency_color
FROM maxsam_leads
WHERE days_until_expiration <= 30
  AND days_until_expiration > 0
  AND status NOT IN ('closed', 'dead', 'archived')
ORDER BY days_until_expiration ASC;

-- ===========================================
-- CREATE CROSS-REFERENCED LEADS VIEW
-- ===========================================

CREATE OR REPLACE VIEW cross_referenced_leads AS
SELECT
  ml.*,
  de.distress_type,
  de.distress_date,
  de.amount_owed as distress_amount,
  dl.name as distressed_list_name,
  dl.source_type
FROM maxsam_leads ml
INNER JOIN distressed_entries de ON ml.id = de.matched_lead_id
INNER JOIN distressed_lists dl ON de.list_id = dl.id
WHERE ml.is_cross_referenced = TRUE
ORDER BY ml.days_until_expiration ASC, ml.potential_revenue DESC;

-- ===========================================
-- FUNCTION: Update Days Until Expiration
-- ===========================================

CREATE OR REPLACE FUNCTION update_days_until_expiration()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expiration_date IS NOT NULL THEN
    NEW.days_until_expiration := NEW.expiration_date - CURRENT_DATE;
    NEW.expiration_urgency := CASE
      WHEN NEW.days_until_expiration <= 7 THEN 'critical'
      WHEN NEW.days_until_expiration <= 14 THEN 'urgent'
      WHEN NEW.days_until_expiration <= 30 THEN 'warning'
      WHEN NEW.days_until_expiration <= 60 THEN 'normal'
      ELSE 'safe'
    END;
  END IF;
  NEW.last_expiration_check := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGER: Auto-Update Expiration Days
-- ===========================================

DROP TRIGGER IF EXISTS trigger_update_expiration ON maxsam_leads;
CREATE TRIGGER trigger_update_expiration
  BEFORE INSERT OR UPDATE OF expiration_date ON maxsam_leads
  FOR EACH ROW
  EXECUTE FUNCTION update_days_until_expiration();

-- ===========================================
-- FUNCTION: Cross-Reference New Lead
-- ===========================================

CREATE OR REPLACE FUNCTION cross_reference_lead(lead_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  lead_record RECORD;
  match_found BOOLEAN := FALSE;
BEGIN
  SELECT property_address, owner_name, zip_code INTO lead_record
  FROM maxsam_leads WHERE id = lead_id;

  -- Check for matches in distressed entries
  IF EXISTS (
    SELECT 1 FROM distressed_entries de
    WHERE (
      LOWER(de.property_address) = LOWER(lead_record.property_address)
      OR (de.owner_name IS NOT NULL AND LOWER(de.owner_name) = LOWER(lead_record.owner_name))
    )
    AND de.matched_lead_id IS NULL
  ) THEN
    -- Update the distressed entry with the match
    UPDATE distressed_entries
    SET matched_lead_id = lead_id
    WHERE (
      LOWER(property_address) = LOWER(lead_record.property_address)
      OR (owner_name IS NOT NULL AND LOWER(owner_name) = LOWER(lead_record.owner_name))
    )
    AND matched_lead_id IS NULL;

    -- Mark the lead as cross-referenced
    UPDATE maxsam_leads
    SET
      is_cross_referenced = TRUE,
      is_distressed = TRUE,
      cross_reference_boost = 30
    WHERE id = lead_id;

    match_found := TRUE;
  END IF;

  RETURN match_found;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- FUNCTION: Batch Cross-Reference All Leads
-- ===========================================

CREATE OR REPLACE FUNCTION cross_reference_all_leads()
RETURNS TABLE(matched_count INTEGER, total_leads INTEGER) AS $$
DECLARE
  matched INTEGER := 0;
  total INTEGER := 0;
  lead_rec RECORD;
BEGIN
  FOR lead_rec IN SELECT id FROM maxsam_leads WHERE is_cross_referenced = FALSE
  LOOP
    total := total + 1;
    IF cross_reference_lead(lead_rec.id) THEN
      matched := matched + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT matched, total;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- CREATE INDEXES FOR PERFORMANCE
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_leads_expiration ON maxsam_leads(days_until_expiration);
CREATE INDEX IF NOT EXISTS idx_leads_expiration_date ON maxsam_leads(expiration_date);
CREATE INDEX IF NOT EXISTS idx_leads_cross_ref ON maxsam_leads(is_cross_referenced);
CREATE INDEX IF NOT EXISTS idx_leads_distressed ON maxsam_leads(is_distressed);
CREATE INDEX IF NOT EXISTS idx_leads_urgency ON maxsam_leads(expiration_urgency);
CREATE INDEX IF NOT EXISTS idx_distressed_address ON distressed_entries(LOWER(property_address));
CREATE INDEX IF NOT EXISTS idx_distressed_owner ON distressed_entries(LOWER(owner_name));

-- ===========================================
-- UPDATE EXISTING LEADS WITH DEFAULT EXPIRATION
-- ===========================================

-- Set default expiration to 90 days from sale_date or created_at
UPDATE maxsam_leads
SET
  first_seen_date = COALESCE(sale_date::date, created_at::date, CURRENT_DATE),
  expiration_date = COALESCE(sale_date::date, created_at::date, CURRENT_DATE) + INTERVAL '90 days',
  days_until_expiration = (COALESCE(sale_date::date, created_at::date, CURRENT_DATE) + INTERVAL '90 days')::date - CURRENT_DATE
WHERE expiration_date IS NULL;

-- ===========================================
-- REFRESH EXPIRATION FUNCTION (Run Daily)
-- ===========================================

CREATE OR REPLACE FUNCTION refresh_all_expirations()
RETURNS INTEGER AS $$
DECLARE
  updated_count INTEGER;
BEGIN
  UPDATE maxsam_leads
  SET
    days_until_expiration = expiration_date - CURRENT_DATE,
    expiration_urgency = CASE
      WHEN expiration_date - CURRENT_DATE <= 7 THEN 'critical'
      WHEN expiration_date - CURRENT_DATE <= 14 THEN 'urgent'
      WHEN expiration_date - CURRENT_DATE <= 30 THEN 'warning'
      WHEN expiration_date - CURRENT_DATE <= 60 THEN 'normal'
      ELSE 'safe'
    END,
    last_expiration_check = NOW()
  WHERE expiration_date IS NOT NULL;

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VERIFICATION
-- ===========================================

DO $$
DECLARE
  col_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO col_count
  FROM information_schema.columns
  WHERE table_name = 'maxsam_leads'
    AND column_name IN ('expiration_date', 'days_until_expiration', 'is_cross_referenced');

  RAISE NOTICE 'Expiration tracking migration complete. % new columns added.', col_count;
END $$;
