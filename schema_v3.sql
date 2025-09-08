-- Master schema snapshot (version 3)
-- Re-generate after structural changes; keep in sync with EXPECTED_SCHEMA_VERSION in env.js

begin;

-- NOTE: Upgrading from v2: add created_by columns & backfill before enforcing strict policies.

create table if not exists public.staff (
  id bigserial primary key,
  name text not null,
  role text not null,
  contract_hours int,
  typical_workdays int,
  weekend_preference boolean,
  version bigint not null default 1,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists staff_name_role_unique on public.staff (lower(name), role);

create table if not exists public.schedule_days (
  date date primary key,
  month text not null,
  assignments jsonb not null default '{}'::jsonb,
  version bigint not null default 1,
  created_by uuid,
  updated_at timestamptz not null default now()
);

create table if not exists public.availability (
  id bigserial primary key,
  staff_id bigint not null references public.staff(id) on delete cascade,
  date date not null,
  shift_key text not null,
  status text not null,
  version bigint not null default 1,
  created_by uuid,
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
  created_by uuid,
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
  created_by uuid,
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
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists overtime_requests_month_date_idx on public.overtime_requests (month, date);

create table if not exists public.overtime_consents (
  staff_id bigint not null references public.staff(id) on delete cascade,
  date date not null,
  granted_at timestamptz not null default now(),
  created_by uuid,
  primary key (staff_id, date)
);

create table if not exists public.app_meta (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

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

create table if not exists public.audit_log (
  id bigserial primary key,
  ts timestamptz not null,
  message text not null,
  meta jsonb,
  created_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_ts_idx on public.audit_log (ts DESC);

-- Seed / bump schema version
insert into public.app_meta(key,value) values ('schema_version', jsonb_build_object('v',3))
  on conflict (key) do update set value = excluded.value, updated_at = now();

-- Enable RLS
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

-- Policies (owner-or-null transitional)
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
  if not found then create policy client_errors_select_dev on public.client_errors for select using (true); end if; -- tighten later
end $$;

commit;
