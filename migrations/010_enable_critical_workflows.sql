-- ============================================================================
-- Migration 010: Enable Critical N8N Workflows
-- ============================================================================
--
-- This migration enables the essential workflows needed for the MaxSam pipeline:
-- 1. PDF Processor (Ingestion)
-- 2. Eleanor Lead Scorer (Processing)
-- 3. Skip Trace Enricher (Processing)
-- 4. Ralph Executor (Orchestration)
--
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql
-- ============================================================================

-- Step 1: Create workflow_controls table if not exists
CREATE TABLE IF NOT EXISTS workflow_controls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT NOT NULL UNIQUE,
  workflow_name TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  last_enabled_at TIMESTAMPTZ,
  last_disabled_at TIMESTAMPTZ,
  enabled_by TEXT,
  disabled_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE workflow_controls ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Enable all for workflow_controls" ON workflow_controls;
CREATE POLICY "Enable all for workflow_controls" ON workflow_controls FOR ALL USING (true);

-- Step 2: Insert/update critical workflows as ENABLED
-- Using UPSERT to handle existing records

-- PDF Processor (Ingestion)
INSERT INTO workflow_controls (workflow_id, workflow_name, enabled, last_enabled_at, enabled_by, notes)
VALUES ('pdf-processor', 'PDF Processor', true, NOW(), 'migration', 'Critical ingestion workflow')
ON CONFLICT (workflow_id) DO UPDATE SET
  enabled = true,
  last_enabled_at = NOW(),
  enabled_by = 'migration',
  updated_at = NOW();

-- Eleanor Lead Scorer
INSERT INTO workflow_controls (workflow_id, workflow_name, enabled, last_enabled_at, enabled_by, notes)
VALUES ('eleanor-scorer', 'Eleanor Lead Scorer', true, NOW(), 'migration', 'Critical processing workflow')
ON CONFLICT (workflow_id) DO UPDATE SET
  enabled = true,
  last_enabled_at = NOW(),
  enabled_by = 'migration',
  updated_at = NOW();

-- Skip Trace Enricher
INSERT INTO workflow_controls (workflow_id, workflow_name, enabled, last_enabled_at, enabled_by, notes)
VALUES ('skip-trace', 'Skip Trace Enricher', true, NOW(), 'migration', 'Critical phone lookup workflow')
ON CONFLICT (workflow_id) DO UPDATE SET
  enabled = true,
  last_enabled_at = NOW(),
  enabled_by = 'migration',
  updated_at = NOW();

-- Ralph Executor (Orchestration)
INSERT INTO workflow_controls (workflow_id, workflow_name, enabled, last_enabled_at, enabled_by, notes)
VALUES ('ralph-executor', 'Ralph Executor', true, NOW(), 'migration', 'Critical orchestration workflow')
ON CONFLICT (workflow_id) DO UPDATE SET
  enabled = true,
  last_enabled_at = NOW(),
  enabled_by = 'migration',
  updated_at = NOW();

-- Golden Lead Pipeline
INSERT INTO workflow_controls (workflow_id, workflow_name, enabled, last_enabled_at, enabled_by, notes)
VALUES ('golden-lead-pipeline', 'Golden Lead Execution Pipeline', true, NOW(), 'migration', 'Golden lead processing')
ON CONFLICT (workflow_id) DO UPDATE SET
  enabled = true,
  last_enabled_at = NOW(),
  enabled_by = 'migration',
  updated_at = NOW();

-- Step 3: Set system controls to enable Ralph
-- Update system_controls to enable Ralph execution
DO $$
BEGIN
  -- Enable Ralph
  INSERT INTO system_controls (control_key, control_value, updated_at)
  VALUES ('ralph_enabled', 'true', NOW())
  ON CONFLICT (control_key) DO UPDATE SET
    control_value = 'true',
    updated_at = NOW();

  -- Keep Sam disabled for now (per governance gates)
  INSERT INTO system_controls (control_key, control_value, updated_at)
  VALUES ('sam_enabled', 'false', NOW())
  ON CONFLICT (control_key) DO UPDATE SET
    control_value = 'false',
    updated_at = NOW();

EXCEPTION
  WHEN undefined_table THEN
    -- Create system_controls if it doesn't exist
    CREATE TABLE system_controls (
      control_key TEXT PRIMARY KEY,
      control_value TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO system_controls (control_key, control_value) VALUES
      ('ralph_enabled', 'true'),
      ('sam_enabled', 'false');
END $$;

-- Step 4: Verify enabled workflows
SELECT
  workflow_id,
  workflow_name,
  enabled,
  last_enabled_at
FROM workflow_controls
WHERE enabled = true
ORDER BY workflow_name;

-- Step 5: Log the migration
DO $$
BEGIN
  INSERT INTO system_config (key, value)
  VALUES ('migration_010_completed', NOW()::text)
  ON CONFLICT (key) DO UPDATE SET value = NOW()::text;
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'system_config table does not exist, skipping log';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
--
-- Check workflow status:
-- SELECT * FROM workflow_controls ORDER BY workflow_name;
--
-- Check system controls:
-- SELECT * FROM system_controls;
--
-- ============================================================================
