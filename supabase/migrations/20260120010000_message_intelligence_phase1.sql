-- PHASE 1: MESSAGE INTELLIGENCE (READ-ONLY)

create table if not exists message_intelligence (
  id uuid primary key default gen_random_uuid(),

  message_id uuid not null references messages(id) on delete cascade,
  lead_id uuid references leads(id),

  intent text not null,
  confidence numeric(5,2) not null,

  extracted_entities jsonb not null default '{}'::jsonb,

  classification_notes text,

  created_at timestamptz default now()
);

create index if not exists idx_message_intelligence_message
  on message_intelligence(message_id);

create index if not exists idx_message_intelligence_lead
  on message_intelligence(lead_id);

comment on table message_intelligence is
'Phase 1 read-only message classification and entity extraction layer';
