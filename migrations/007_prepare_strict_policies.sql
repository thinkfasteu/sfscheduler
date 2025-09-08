-- Migration 007: Enforce strict RLS ownership (schema version 6)
-- Preconditions: Migration 006 backfill executed; verify_db_integrity script reports 0 NULL created_by.
begin;

-- 1. Enforce NOT NULL on created_by columns
alter table public.staff alter column created_by set not null;
alter table public.schedule_days alter column created_by set not null;
alter table public.availability alter column created_by set not null;
alter table public.vacation_ledger alter column created_by set not null;
alter table public.absences alter column created_by set not null;
alter table public.overtime_requests alter column created_by set not null;
alter table public.overtime_consents alter column created_by set not null;
alter table public.audit_log alter column created_by set not null;

-- 2. Drop transitional owner-or-null policies
drop policy if exists staff_owner_rw on public.staff;
drop policy if exists schedule_owner_rw on public.schedule_days;
drop policy if exists availability_owner_rw on public.availability;
drop policy if exists vacation_ledger_owner_rw on public.vacation_ledger;
drop policy if exists absences_owner_rw on public.absences;
drop policy if exists overtime_requests_owner_rw on public.overtime_requests;
drop policy if exists overtime_consents_owner_rw on public.overtime_consents;
drop policy if exists audit_log_owner_rw on public.audit_log;

-- 3. Create strict policies (row must belong to auth user)
create policy staff_owner_strict on public.staff for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy schedule_owner_strict on public.schedule_days for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy availability_owner_strict on public.availability for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy vacation_ledger_owner_strict on public.vacation_ledger for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy absences_owner_strict on public.absences for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy overtime_requests_owner_strict on public.overtime_requests for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy overtime_consents_owner_strict on public.overtime_consents for all using (created_by = auth.uid()) with check (created_by = auth.uid());
create policy audit_log_owner_strict on public.audit_log for all using (created_by = auth.uid()) with check (created_by = auth.uid());

-- 4. Preserve existing client_errors open policies (left unchanged)

-- 5. Bump schema version to 6
update public.app_meta set value = jsonb_build_object('v',6), updated_at=now() where key='schema_version';

commit;
