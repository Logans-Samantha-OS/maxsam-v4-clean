create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  title text not null,
  description text,
  status text not null default 'queued' check (status in ('queued','running','blocked','completed','failed','cancelled')),
  priority text not null default 'normal' check (priority in ('low','normal','high','critical')),
  lead_id uuid null,
  skill_key text,
  assigned_agent text,
  artifacts jsonb not null default '{}'::jsonb
);

create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_priority on public.tasks(priority);
create index if not exists idx_tasks_lead_id on public.tasks(lead_id);
create index if not exists idx_tasks_updated_at on public.tasks(updated_at desc);
