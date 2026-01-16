-- ============================================================
-- 006_golden_lead_execution_pipeline.sql
-- Governed Golden Lead declaration + execution substrate
-- SAFE TO RUN ONCE. DO NOT MODIFY AFTER DEPLOYMENT.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- ENUMS
-- ------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE deal_type_enum AS ENUM (
    'excess_only',
    'wholesale',
    'dual'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE golden_lead_status_enum AS ENUM (
    'declared',
    'queued',
    'contacted',
    'closed',
    'revoked'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ------------------------------------------------------------
-- SYSTEM CONTROLS (ALIGNED TO EXISTING SCHEMA)
-- ------------------------------------------------------------
-- Assumes system_controls already exists with:
-- control_key TEXT PRIMARY KEY
-- control_value JSONB NOT NULL

INSERT INTO system_controls (control_key, control_value)
VALUES
  (
    'sam_execution',
    jsonb_build_object(
      'sam_enabled', false,
      'sam_hours_start', '09:00',
      'sam_hours_end', '18:00',
      'sam_daily_rate_limit', 20
    )
  )
ON CONFLICT (control_key) DO NOTHING;

-- ------------------------------------------------------------
-- GOLDEN LEAD CANDIDATES (PRE-DECLARATION)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS golden_lead_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  full_name TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT NOT NULL,

  excess_funds_amount NUMERIC,
  foreclosure_date DATE,

  priority_score INTEGER NOT NULL CHECK (priority_score BETWEEN 0 AND 100),

  deal_type deal_type_enum NOT NULL,

  evaluated_by TEXT NOT NULL,
  evaluation_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- GOLDEN LEADS (DECLARED TRUTH — PROTECTED)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS golden_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  candidate_id UUID NOT NULL
    REFERENCES golden_lead_candidates(id)
    ON DELETE RESTRICT,

  full_name TEXT NOT NULL,
  county TEXT NOT NULL,
  state TEXT NOT NULL,

  deal_type deal_type_enum NOT NULL,
  status golden_lead_status_enum NOT NULL DEFAULT 'declared',

  declared_by TEXT NOT NULL,
  declaration_reason TEXT NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE INSERT ON golden_leads FROM PUBLIC;

-- ------------------------------------------------------------
-- GOLDEN LEAD EVENTS (FOR N8N POLLING)
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS golden_lead_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  golden_lead_id UUID NOT NULL
    REFERENCES golden_leads(id)
    ON DELETE CASCADE,

  event_type TEXT NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT FALSE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- TIME WINDOW GUARD (JSONB-BASED)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_within_sam_hours()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
  cfg JSONB;
  now_time TIME := localtime;
BEGIN
  SELECT control_value
  INTO cfg
  FROM system_controls
  WHERE control_key = 'sam_execution';

  IF cfg IS NULL THEN
    RETURN FALSE;
  END IF;

  IF (cfg->>'sam_enabled')::BOOLEAN IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  IF now_time < (cfg->>'sam_hours_start')::TIME
     OR now_time > (cfg->>'sam_hours_end')::TIME THEN
    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- ------------------------------------------------------------
-- GOLDEN LEAD DECLARATION FUNCTION (SOLE ENTRY POINT)
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION declare_golden_lead(
  p_candidate_id UUID,
  p_declared_by TEXT,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  c RECORD;
  new_lead_id UUID;
BEGIN
  SELECT * INTO c
  FROM golden_lead_candidates
  WHERE id = p_candidate_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Candidate does not exist';
  END IF;

  IF c.priority_score < 70 THEN
    RAISE EXCEPTION 'Priority score below threshold';
  END IF;

  IF c.excess_funds_amount IS NULL
     AND c.foreclosure_date IS NULL THEN
    RAISE EXCEPTION 'No qualifying distress signal';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM golden_leads
    WHERE candidate_id = p_candidate_id
  ) THEN
    RAISE EXCEPTION 'Candidate already declared';
  END IF;

  INSERT INTO golden_leads (
    candidate_id,
    full_name,
    county,
    state,
    deal_type,
    declared_by,
    declaration_reason
  )
  VALUES (
    c.id,
    c.full_name,
    c.county,
    c.state,
    c.deal_type,
    p_declared_by,
    p_reason
  )
  RETURNING id INTO new_lead_id;

  INSERT INTO golden_lead_events (
    golden_lead_id,
    event_type
  )
  VALUES (
    new_lead_id,
    'declared'
  );

  RETURN new_lead_id;
END;
$$;

COMMIT;
