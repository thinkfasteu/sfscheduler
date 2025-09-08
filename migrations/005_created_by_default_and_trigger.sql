-- Migration 005: created_by auto population via trigger; lays groundwork for future NOT NULL enforcement (schema version 4)
begin;

-- Function to set created_by on insert when null, using authenticated user id.
create or replace function public.set_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    begin
      new.created_by := auth.uid();
    exception when others then
      -- In case auth.uid() not available (service role contexts), leave null.
      null;
    end;
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Attach trigger to all tables with created_by (excluding app_meta & client_errors which don't need ownership semantics)
do $$
declare r record; begin
  for r in select unnest(array['staff','schedule_days','availability','vacation_ledger','absences','overtime_requests','overtime_consents','audit_log']) as t loop
    execute format('drop trigger if exists set_created_by_%I on public.%I', r.t, r.t);
    execute format('create trigger set_created_by_%I before insert on public.%I for each row execute function public.set_created_by()', r.t, r.t);
  end loop;
end $$;

-- Optional backfill: set created_by where still null and a candidate user id is known (skipped here due to lacking mapping). Left for ops script.

-- Bump schema version to 4
update public.app_meta set value = jsonb_build_object('v',4), updated_at=now() where key='schema_version';

commit;