alter table public.casualty_triage_assessments
  drop constraint if exists casualty_triage_assessments_system_check;

alter table public.casualty_triage_assessments
  add constraint casualty_triage_assessments_system_check
  check (
    triage_system in (
      'urgent_non_urgent',
      'nato',
      'stieve',
      'start',
      'mstart',
      'jumpstart',
      'sieve',
      'sort',
      'sieve_sort',
      'smart',
      'rts',
      'care_flight',
      'mass',
      'salt',
      'ptt',
      'mitt',
      'homebush',
      'mptt',
      'stm',
      'ed_triage',
      'other'
    )
  );
