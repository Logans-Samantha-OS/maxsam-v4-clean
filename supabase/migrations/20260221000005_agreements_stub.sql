-- Migration: agreements (stub)
-- Normalized agreement tracking — full implementation deferred to agreement-system skill

CREATE TABLE IF NOT EXISTS agreements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id         uuid NOT NULL,
  type            text NOT NULL DEFAULT 'excess_funds'
                    CHECK (type IN ('excess_funds', 'wholesale', 'other')),
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'sent', 'viewed', 'signed', 'countersigned', 'voided', 'expired')),
  packet_id       text,                                  -- links to agreement_packets if applicable
  docusign_envelope_id text,
  purchase_price  numeric,
  fee_percent     numeric DEFAULT 25,
  metadata        jsonb DEFAULT '{}'::jsonb,
  sent_at         timestamptz,
  signed_at       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agreements_lead ON agreements (lead_id);
CREATE INDEX idx_agreements_status ON agreements (status);
CREATE INDEX idx_agreements_type ON agreements (type);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_agreements_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_agreements_updated_at
  BEFORE UPDATE ON agreements
  FOR EACH ROW EXECUTE FUNCTION update_agreements_updated_at();
