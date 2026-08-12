-- users.role uses the public.user_role enum in Supabase.
-- Add every role label the app may store in public.users.
-- Admin-created unit users are still limited by the backend endpoint to:
--   responder
--   documenter

alter type public.user_role add value if not exists 'super_admin';
alter type public.user_role add value if not exists 'admin';
alter type public.user_role add value if not exists 'administrator';
alter type public.user_role add value if not exists 'responder';
alter type public.user_role add value if not exists 'encoder';
alter type public.user_role add value if not exists 'documenter';
alter type public.user_role add value if not exists 'medical_personnel';
alter type public.user_role add value if not exists 'viewer';

-- Do not restrict public.users globally to only responder/documenter.
-- That rule belongs in the admin unit-user API, because this table also
-- stores super admin and admin accounts.
alter table public.users
  drop constraint if exists users_role_check;
