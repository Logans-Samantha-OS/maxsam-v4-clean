-- County Filing Templates
-- Stores required documents, procedures, and links per county

CREATE TABLE IF NOT EXISTS county_filing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  county_name TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'TX',

  -- Filing procedure
  filing_method TEXT NOT NULL DEFAULT 'in_person',  -- in_person, mail, online, email
  filing_address TEXT,
  filing_phone TEXT,
  filing_email TEXT,
  filing_url TEXT,

  -- Required documents checklist (JSON array of strings)
  required_documents JSONB NOT NULL DEFAULT '[]',

  -- Fee info
  filing_fee NUMERIC(10, 2) DEFAULT 0,
  fee_notes TEXT,

  -- Processing
  estimated_processing_days INTEGER,
  processing_notes TEXT,

  -- Additional info
  notes TEXT,
  contact_name TEXT,
  department_name TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(county_name, state)
);

-- Seed Dallas County
INSERT INTO county_filing_templates (
  county_name,
  state,
  filing_method,
  filing_address,
  filing_phone,
  filing_email,
  filing_url,
  department_name,
  required_documents,
  filing_fee,
  fee_notes,
  estimated_processing_days,
  processing_notes,
  notes
) VALUES (
  'Dallas County',
  'TX',
  'mail',
  'Dallas County Tax Office, 500 Elm Street, Suite 3300, Dallas, TX 75202',
  '(214) 653-7811',
  NULL,
  'https://www.dallascounty.org/departments/tax/',
  'Dallas County Tax Office - Excess Funds',
  '[
    "Signed Assignment Agreement (original)",
    "Notarized Affidavit of Identity",
    "Copy of government-issued photo ID (front and back)",
    "Proof of ownership at time of sale (deed or tax records)",
    "Copy of the tax sale order / judgment",
    "W-9 form for payee",
    "Power of Attorney (if filing on behalf of owner)",
    "Certified copy of Letters Testamentary (if deceased owner)",
    "Cover letter with case number and property address"
  ]'::JSONB,
  0.00,
  'No filing fee for excess funds claims',
  90,
  'County typically processes within 60-90 days. May request additional documentation.',
  'Mail original signed documents. Keep copies of everything. Include a self-addressed stamped envelope for return correspondence. Reference the cause number on all documents.'
) ON CONFLICT (county_name, state) DO UPDATE SET
  filing_method = EXCLUDED.filing_method,
  filing_address = EXCLUDED.filing_address,
  filing_phone = EXCLUDED.filing_phone,
  filing_url = EXCLUDED.filing_url,
  department_name = EXCLUDED.department_name,
  required_documents = EXCLUDED.required_documents,
  filing_fee = EXCLUDED.filing_fee,
  fee_notes = EXCLUDED.fee_notes,
  estimated_processing_days = EXCLUDED.estimated_processing_days,
  processing_notes = EXCLUDED.processing_notes,
  notes = EXCLUDED.notes,
  updated_at = now();
