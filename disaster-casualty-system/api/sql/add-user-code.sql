alter table public.users
  add column if not exists user_code varchar(32);

alter table public.users
  drop constraint if exists users_user_code_letters_only;

alter table public.users
  add constraint users_user_code_letters_only
  check (user_code is null or user_code ~ '^[A-Za-z]+$');

create unique index if not exists users_created_by_user_code_unique
  on public.users (created_by, user_code)
  where user_code is not null;

comment on column public.users.user_code is
  'Manual letters-only code assigned by the creating admin; unique within the admin unit.';
