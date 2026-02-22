create table if not exists public.agreements (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lead_id uuid not null,
  agreement_type text not null default 'excess_funds' check (agreement_type in ('excess_funds','property','both')),
  status text not null default 'draft' check (status in ('draft','sent','viewed','signed','cancelled','expired')),
  external_envelope_id text,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists idx_agreements_lead_id on public.agreements(lead_id);
create index if not exists idx_agreements_status on public.agreements(status);
create index if not exists idx_agreements_created_at on public.agreements(created_at desc);
