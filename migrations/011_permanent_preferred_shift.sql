-- Migration 011: Add permanent_preferred_shift column to staff table
-- Adds support for permanent employees to specify preferred shift types (early/midday)

begin;

-- Add the permanent_preferred_shift column
alter table public.staff
add column if not exists permanent_preferred_shift text;

-- Add a check constraint to ensure valid values
alter table public.staff
add constraint permanent_preferred_shift_check
check (permanent_preferred_shift in ('none', 'early', 'midday') or permanent_preferred_shift is null);

-- Set default value for existing records
update public.staff
set permanent_preferred_shift = 'none'
where permanent_preferred_shift is null and role = 'permanent';

commit;