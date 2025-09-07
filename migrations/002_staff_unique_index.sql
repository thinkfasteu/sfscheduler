-- Migration 002: Explicitly ensure unique index for (lower(name), role) if upgrading older DB
create unique index if not exists staff_name_role_unique on public.staff (lower(name), role);
