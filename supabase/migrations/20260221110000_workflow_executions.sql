create table if not exists public.workflow_executions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  status text not null default 'received' check (status in ('received','running','success','failure')),
  workflow_name text not null,
  webhook_path text,
  instruction_id text,
  lead_id uuid null,
  artifacts jsonb not null default '{}'::jsonb,
  error_text text
);

create index if not exists idx_workflow_executions_status on public.workflow_executions(status);
create index if not exists idx_workflow_executions_workflow_name on public.workflow_executions(workflow_name);
create index if not exists idx_workflow_executions_lead_id on public.workflow_executions(lead_id);
create index if not exists idx_workflow_executions_created_at on public.workflow_executions(created_at desc);
