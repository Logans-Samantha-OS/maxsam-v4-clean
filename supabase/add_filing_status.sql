-- Add filing status columns to agreement_packets
ALTER TABLE agreement_packets
  ADD COLUMN IF NOT EXISTS filing_status TEXT DEFAULT 'not_filed',
  ADD COLUMN IF NOT EXISTS filing_notes TEXT,
  ADD COLUMN IF NOT EXISTS filed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS county_name TEXT DEFAULT 'Dallas County';

-- filing_status values: not_filed, filed, processing, approved, paid, rejected
