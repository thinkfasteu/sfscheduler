-- Migration 003: Add audit_log table & bump schema version to 2
begin;
create table if not exists public.audit_log (
  id bigserial primary key,
  ts timestamptz not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_ts_idx on public.audit_log (ts DESC);
-- Bump schema version row
update public.app_meta set value = jsonb_build_object('v',2), updated_at=now() where key='schema_version';
commit;