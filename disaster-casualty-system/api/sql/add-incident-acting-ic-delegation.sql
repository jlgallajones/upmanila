-- Incident-specific temporary Acting IC delegation.
-- The incident.created_by value remains the permanent unit owner.

create table if not exists public.incident_ic_backups (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  priority integer not null default 1 check (priority > 0),
  designated_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (incident_id, user_id)
);

create table if not exists public.incident_ic_delegations (
  id uuid primary key default gen_random_uuid(),
  incident_id uuid not null references public.incidents(id) on delete cascade,
  primary_ic_user_id uuid not null references public.users(id) on delete restrict,
  acting_ic_user_id uuid not null references public.users(id) on delete restrict,
  delegated_by uuid not null references public.users(id) on delete restrict,
  reason text,
  delegated_at timestamptz not null default now(),
  resumed_at timestamptz,
  resumed_by uuid references public.users(id) on delete set null,
  resume_reason text,
  created_at timestamptz not null default now(),
  check (primary_ic_user_id <> acting_ic_user_id)
);

create unique index if not exists incident_ic_one_active_delegation
  on public.incident_ic_delegations (incident_id)
  where resumed_at is null;

create index if not exists incident_ic_backups_incident_idx
  on public.incident_ic_backups (incident_id, priority);

create index if not exists incident_ic_delegations_incident_idx
  on public.incident_ic_delegations (incident_id, delegated_at desc);

alter table public.incident_ic_backups enable row level security;
alter table public.incident_ic_delegations enable row level security;

comment on table public.incident_ic_backups is
  'Incident-specific backup users who may be selected as Acting IC.';
comment on table public.incident_ic_delegations is
  'Audited, reversible Acting IC sessions. incidents.created_by remains permanent ownership.';
