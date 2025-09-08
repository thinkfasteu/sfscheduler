-- Migration 006: Backfill NULL created_by with a single system owner UUID (prep for NOT NULL + strict RLS)
-- Bumps schema version to 5.
begin;

-- Ensure pgcrypto for gen_random_uuid (Supabase normally has it, but guard)
create extension if not exists pgcrypto;

do $$
declare sys_owner uuid := gen_random_uuid();
begin
  -- Update all core tables where created_by is NULL
  update public.staff set created_by = sys_owner where created_by is null;
  update public.schedule_days set created_by = sys_owner where created_by is null;
  update public.availability set created_by = sys_owner where created_by is null;
  update public.vacation_ledger set created_by = sys_owner where created_by is null;
  update public.absences set created_by = sys_owner where created_by is null;
  update public.overtime_requests set created_by = sys_owner where created_by is null;
  update public.overtime_consents set created_by = sys_owner where created_by is null;
  update public.audit_log set created_by = sys_owner where created_by is null;

  -- Record the system owner for audit / future attribution
  insert into public.app_meta(key,value) values ('system_owner', jsonb_build_object('uuid', sys_owner, 'ts', now()))
    on conflict (key) do update set value = excluded.value, updated_at = now();
end $$;

-- Bump schema version to 5
update public.app_meta set value = jsonb_build_object('v',5), updated_at=now() where key='schema_version';

commit;