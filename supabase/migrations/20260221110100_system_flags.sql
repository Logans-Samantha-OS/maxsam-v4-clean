create table if not exists public.system_flags (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  flag_key text not null unique,
  status text not null default 'active' check (status in ('active','disabled')),
  pause_all boolean not null default false,
  flag_value jsonb not null default '{}'::jsonb,
  notes text
);

insert into public.system_flags (flag_key, status, pause_all, flag_value)
values ('global', 'active', false, '{}'::jsonb)
on conflict (flag_key) do nothing;

create index if not exists idx_system_flags_status on public.system_flags(status);
create index if not exists idx_system_flags_pause_all on public.system_flags(pause_all);
