-- Phase 1.1: Identify duplicates by case_number
SELECT 
  case_number, 
  COUNT(*) as count, 
  array_agg(id) as duplicate_ids,
  array_agg(owner_name) as names,
  array_agg(excess_amount) as amounts,
  MAX(updated_at) as latest_update
FROM leads 
WHERE case_number IS NOT NULL
GROUP BY case_number 
HAVING COUNT(*) > 1
ORDER BY count DESC, case_number;

-- Phase 1.2: Merge duplicates - keep most complete record
-- For each duplicate group, keep the record with:
-- 1. Highest excess_amount > 0
-- 2. Valid phone number
-- 3. Most recent updated_at
-- Delete all other duplicates

-- First, create a temporary table with records to keep
CREATE TEMPORARY TABLE leads_to_keep AS
SELECT DISTINCT ON (case_number) 
  l.*
FROM leads l
WHERE l.id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY case_number 
        ORDER BY 
          CASE WHEN excess_amount > 0 THEN 1 ELSE 0 END DESC,
          CASE WHEN phone_1 IS NOT NULL OR phone_2 IS NOT NULL THEN 1 ELSE 0 END DESC,
          updated_at DESC
      ) as rn
    FROM leads
    WHERE case_number IS NOT NULL
  ) ranked
  WHERE rn = 1
);

-- Delete all duplicates not in the keep table
DELETE FROM leads 
WHERE case_number IS NOT NULL 
  AND id NOT IN (SELECT id FROM leads_to_keep);

-- Restore from temporary table
INSERT INTO leads 
SELECT * FROM leads_to_keep;

-- Drop temporary table
DROP TABLE leads_to_keep;

-- Phase 1.3: Add unique constraint
ALTER TABLE leads 
ADD CONSTRAINT unique_case_number UNIQUE (case_number);

-- Phase 1.4: Create upsert function
CREATE OR REPLACE FUNCTION upsert_lead()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = COALESCE(NEW.updated_at, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Phase 1.5: Create trigger for automatic updates
CREATE TRIGGER trigger_upsert_lead
BEFORE INSERT ON leads
FOR EACH ROW
EXECUTE FUNCTION upsert_lead();
