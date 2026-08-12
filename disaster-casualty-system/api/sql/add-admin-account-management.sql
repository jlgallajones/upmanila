alter table public.users
  add column if not exists created_by uuid references public.users(id) on delete set null;

alter table public.users
  add column if not exists last_seen_at timestamptz;

create index if not exists users_created_by_idx
  on public.users(created_by);

create index if not exists users_last_seen_at_idx
  on public.users(last_seen_at);

comment on column public.users.created_by is
  'Admin/super admin user that created this account from the admin dashboard.';

comment on column public.users.last_seen_at is
  'Last successful login time used by the admin dashboard for online/offline display.';
