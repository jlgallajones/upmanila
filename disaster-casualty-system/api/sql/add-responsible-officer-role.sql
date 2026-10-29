-- Adds the command-level Responsible Officer role used by the web workspace.
-- Run this migration in Supabase before creating Responsible Officer accounts.

alter type public.user_role
  add value if not exists 'responsible_officer';
