-- MaxSam V4 - Add foreclosure_borrower column to property_intelligence
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/tidcqvhxdsbnfykbvygs/sql

-- Add foreclosure_borrower column for golden lead matching
ALTER TABLE property_intelligence 
ADD COLUMN IF NOT EXISTS foreclosure_borrower TEXT;

-- Add owner_name column 
ALTER TABLE property_intelligence 
ADD COLUMN IF NOT EXISTS owner_name TEXT;

-- Add auction_date column
ALTER TABLE property_intelligence 
ADD COLUMN IF NOT EXISTS auction_date DATE;

-- Add index for faster name matching
CREATE INDEX IF NOT EXISTS idx_property_intelligence_foreclosure_borrower 
ON property_intelligence (foreclosure_borrower);

-- Verify columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'property_intelligence'
ORDER BY ordinal_position;
