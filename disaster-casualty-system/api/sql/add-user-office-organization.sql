ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS office_organization varchar(255);

COMMENT ON COLUMN public.users.office_organization IS
  'Office or organization label for command/admin accounts, such as CDRRMO - City of Manila or BDRRMO - Brgy. San Isidro.';
