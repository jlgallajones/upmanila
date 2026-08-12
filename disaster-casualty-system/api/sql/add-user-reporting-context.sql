alter table public.users
  add column if not exists reporting_context varchar(40) not null default 'scene';

alter table public.users
  drop constraint if exists users_reporting_context_check;

alter table public.users
  add constraint users_reporting_context_check
  check (
    reporting_context in (
      'scene',
      'transport',
      'receiving_facility_ed',
      'hospital_ward',
      'evacuation_center',
      'command_admin'
    )
  );

comment on column public.users.reporting_context is
  'Current reporting context for role-based mobile triage visibility.';
