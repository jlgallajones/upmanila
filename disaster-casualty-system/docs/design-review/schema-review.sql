-- READ ONLY: run against the intended PostgreSQL/Supabase database.
-- These queries inspect deployed state; they do not create or alter anything.
-- Review package source date: 2026-10-22. Never substitute source SQL for a live catalog export.
BEGIN TRANSACTION READ ONLY;

-- Actual fields, defaults and nullability.
SELECT table_name, ordinal_position, column_name, data_type, udt_name,
       is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;

-- PK, FK, UNIQUE and CHECK definitions, including deletion rules.
SELECT c.relname AS table_name, con.conname AS constraint_name, con.contype,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid = con.conrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, con.conname;

-- Confirm retry protection and per-incident identity rules using real indexes.
SELECT tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Actual enum values; compare original role definitions with later role migrations.
SELECT t.typname, e.enumsortorder, e.enumlabel
FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid
JOIN pg_namespace n ON t.typnamespace=n.oid
WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder;

-- RLS state and policies must be checked alongside service-role API scope enforcement.
SELECT c.relname AS table_name,c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;
SELECT schemaname,tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;

-- Realtime subscription publication membership.
SELECT pubname,schemaname,tablename FROM pg_publication_tables
WHERE schemaname='public' ORDER BY pubname,tablename;
ROLLBACK;
