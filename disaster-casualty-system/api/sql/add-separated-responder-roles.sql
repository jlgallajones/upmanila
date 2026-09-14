-- Adds separated responder account roles while preserving legacy responder accounts.
-- Run this in Supabase before creating Field Responder or SAR Responder accounts.

alter type public.user_role add value if not exists 'field_responder';
alter type public.user_role add value if not exists 'sa_responder';

-- Existing users.role = 'responder' records are intentionally kept unchanged.
-- Admins can edit legacy responder accounts into field_responder or sa_responder
-- from Account Management after deciding the correct assignment.
