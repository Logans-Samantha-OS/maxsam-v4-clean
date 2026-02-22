create table if not exists public.skills_registry (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  skill_key text not null unique,
  name text not null,
  version text not null default '0.1.0',
  status text not null default 'draft' check (status in ('draft','active','deprecated','archived')),
  source_path text,
  owner text,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists idx_skills_registry_status on public.skills_registry(status);
create index if not exists idx_skills_registry_updated_at on public.skills_registry(updated_at desc);
