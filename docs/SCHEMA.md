# Database Schema (Version 1)

This document tracks the persisted database contract used by the Scheduler app. Keep `schema.sql` and `EXPECTED_SCHEMA_VERSION` (in `src/config/env.js`) aligned.

## Entities

### staff
Core employee records. Uniqueness enforced on `(lower(name), role)` to avoid duplicate logical staff.

Fields: id, name, role, contract_hours, typical_workdays, weekend_preference, version, timestamps.

### schedule_days
One row per calendar date with JSON assignments map.

### availability
Row per (staff, date, shift_key) capturing availability or special sentinels (`__day_off__`, `vol:evening`, `vol:closing`).

### vacation_ledger
Yearly allowance & manual adjustments.

### absences
Unified vacation / illness storage (`type`).

### overtime_requests / overtime_consents
Tracking weekend overtime request workflow & consent.

### app_meta
Holds `schema_version` ( JSON: `{ "v": 1 }`).

### client_errors
Batched client runtime errors (ingested via REST).

## Versioning
- Bump: edit `EXPECTED_SCHEMA_VERSION` & apply new migration file under `migrations/`.
- Run migrations (psql): `psql $URL -f migrations/001_base.sql` then subsequent numbered migrations.
- Update version: `psql $URL -v new_version=2 -f tools/bump_schema_version.sql`.

## Adding a Column
1. Create migration `0NN_add_column_x.sql` with `alter table`.
2. Update `schema.sql` reflection.
3. Adjust adapter / services if needed.
4. Increment schema version.

## RLS & Security
Currently permissive dev policies (allow all). Production hardening sprint will replace with role-based policies referencing `auth.uid()` and `created_by` columns (future).

## Tests & Expectations
- Duplicate create attempt for same name+role returns existing row (client guard + DB constraint).
- Client error logger inserts into `client_errors` (non-blocking if fails).

Keep this file updated with any structural changes.
