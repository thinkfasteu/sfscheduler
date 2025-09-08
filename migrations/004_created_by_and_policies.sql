-- Migration 004: Add created_by columns & transitional owner policies (schema version 3)
begin;
alter table public.staff add column if not exists created_by uuid;
alter table public.schedule_days add column if not exists created_by uuid;
alter table public.availability add column if not exists created_by uuid;
alter table public.vacation_ledger add column if not exists created_by uuid;
alter table public.absences add column if not exists created_by uuid;
alter table public.overtime_requests add column if not exists created_by uuid;
alter table public.overtime_consents add column if not exists created_by uuid;
alter table public.audit_log add column if not exists created_by uuid;

-- Enable RLS if not already
alter table public.staff enable row level security;
alter table public.schedule_days enable row level security;
alter table public.availability enable row level security;
alter table public.vacation_ledger enable row level security;
alter table public.absences enable row level security;
alter table public.overtime_requests enable row level security;
alter table public.overtime_consents enable row level security;
alter table public.audit_log enable row level security;
alter table public.client_errors enable row level security;

do $$ begin
  perform 1 from pg_policies where policyname='staff_owner_rw';
  if not found then create policy staff_owner_rw on public.staff for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='schedule_owner_rw';
  if not found then create policy schedule_owner_rw on public.schedule_days for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='availability_owner_rw';
  if not found then create policy availability_owner_rw on public.availability for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='vacation_ledger_owner_rw';
  if not found then create policy vacation_ledger_owner_rw on public.vacation_ledger for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='absences_owner_rw';
  if not found then create policy absences_owner_rw on public.absences for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='overtime_requests_owner_rw';
  if not found then create policy overtime_requests_owner_rw on public.overtime_requests for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='overtime_consents_owner_rw';
  if not found then create policy overtime_consents_owner_rw on public.overtime_consents for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='audit_log_owner_rw';
  if not found then create policy audit_log_owner_rw on public.audit_log for all using (created_by is null or created_by = auth.uid()) with check (created_by is null or created_by = auth.uid()); end if;
  perform 1 from pg_policies where policyname='client_errors_insert';
  if not found then create policy client_errors_insert on public.client_errors for insert with check (true); end if;
  perform 1 from pg_policies where policyname='client_errors_select_dev';
  if not found then create policy client_errors_select_dev on public.client_errors for select using (true); end if;
end $$;

update public.app_meta set value = jsonb_build_object('v',3), updated_at=now() where key='schema_version';
commit;