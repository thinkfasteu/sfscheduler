-- Master schema snapshot (version 2)
-- Re-generate after structural changes; keep in sync with EXPECTED_SCHEMA_VERSION in env.js

begin;

create table if not exists public.staff (
  id bigserial primary key,
  name text not null,
  role text not null,
  contract_hours int,
  typical_workdays int,
  weekend_preference boolean,
  permanent_preferred_shift text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Enforce uniqueness (case-insensitive) per role
create unique index if not exists staff_name_role_unique on public.staff (lower(name), role);

create table if not exists public.schedule_days (
  date date primary key,
  month text not null,
  assignments jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.availability (
  id bigserial primary key,
  staff_id bigint not null references public.staff(id) on delete cascade,
  date date not null,
  shift_key text not null,
  status text not null,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists availability_unique on public.availability (staff_id, date, shift_key);

create table if not exists public.vacation_ledger (
  id bigserial primary key,
  staff_id bigint not null references public.staff(id) on delete cascade,
  year int not null,
  allowance int not null default 0,
  taken_manual int not null default 0,
  carry_prev int not null default 0,
  meta jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  updated_at timestamptz not null default now(),
  unique(staff_id, year)
);

create table if not exists public.absences (
  id bigserial primary key,
  staff_id bigint not null references public.staff(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type text not null check (type in ('vacation','illness')),
  version bigint not null default 1,
  created_at timestamptz not null default now()
);
create index if not exists absences_staff_type_idx on public.absences (staff_id, type);

create table if not exists public.overtime_requests (
  id bigserial primary key,
  month text not null,
  date date not null,
  staff_id bigint not null references public.staff(id) on delete cascade,
  shift_key text not null,
  status text not null default 'requested',
  reason text,
  last_error text,
  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists overtime_requests_month_date_idx on public.overtime_requests (month, date);

create table if not exists public.overtime_consents (
  staff_id bigint not null references public.staff(id) on delete cascade,
  date date not null,
  granted_at timestamptz not null default now(),
  primary key (staff_id, date)
);

create table if not exists public.app_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- Seed schema version (idempotent)
insert into public.app_meta(key,value) values ('schema_version', jsonb_build_object('v',2))
  on conflict (key) do update set value = excluded.value, updated_at = now();

create table if not exists public.client_errors (
  id bigserial primary key,
  ts timestamptz not null,
  event_type text not null,
  message text not null,
  source text,
  line int,
  stack text,
  created_at timestamptz not null default now()
);
create index if not exists client_errors_ts_idx on public.client_errors (ts DESC);

-- Audit log (persisted application events)
create table if not exists public.audit_log (
  id bigserial primary key,
  ts timestamptz not null,
  message text not null,
  meta jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_ts_idx on public.audit_log (ts DESC);

-- Dev RLS (permissive) — tighten in later access-model sprint
alter table public.staff enable row level security;
alter table public.schedule_days enable row level security;
alter table public.availability enable row level security;
alter table public.vacation_ledger enable row level security;
alter table public.absences enable row level security;
alter table public.overtime_requests enable row level security;
alter table public.overtime_consents enable row level security;
alter table public.app_meta enable row level security;
alter table public.client_errors enable row level security;
alter table public.audit_log enable row level security;

do $$ begin
  perform 1 from pg_policies where policyname='dev_all_staff';
  if not found then create policy dev_all_staff on public.staff for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_schedule_days';
  if not found then create policy dev_all_schedule_days on public.schedule_days for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_availability';
  if not found then create policy dev_all_availability on public.availability for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_vacation_ledger';
  if not found then create policy dev_all_vacation_ledger on public.vacation_ledger for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_absences';
  if not found then create policy dev_all_absences on public.absences for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_overtime_requests';
  if not found then create policy dev_all_overtime_requests on public.overtime_requests for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_overtime_consents';
  if not found then create policy dev_all_overtime_consents on public.overtime_consents for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_app_meta';
  if not found then create policy dev_all_app_meta on public.app_meta for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_client_errors';
  if not found then create policy dev_all_client_errors on public.client_errors for all using (true) with check (true); end if;
  perform 1 from pg_policies where policyname='dev_all_audit_log';
  if not found then create policy dev_all_audit_log on public.audit_log for all using (true) with check (true); end if;
end $$;

commit;
