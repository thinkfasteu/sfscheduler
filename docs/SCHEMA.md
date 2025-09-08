# Database Schema (Version 6)

This document tracks the persisted database contract used by the Scheduler app. Keep `schema.sql` and `EXPECTED_SCHEMA_VERSION` (in `src/config/env.js`) aligned.

## Entities

### staff
Core employee records. Uniqueness enforced on `(lower(name), role)` to avoid duplicate logical staff.

Fields: id, name, role, contract_hours, typical_workdays, weekend_preference, version, created_by, timestamps.

### schedule_days
One row per calendar date with JSON assignments map. `created_by` transitional (NULL for legacy rows) used for RLS.

### availability
Row per (staff, date, shift_key) capturing availability or special sentinels (`__day_off__`, `vol:evening`, `vol:closing`). Includes `created_by` for ownership.

### vacation_ledger
Yearly allowance & manual adjustments (`created_by`).

### absences
Unified vacation / illness storage (`type`) with `created_by`.

### overtime_requests / overtime_consents
Tracking weekend overtime request workflow & consent (`created_by` on both tables).

### app_meta
Holds `schema_version` ( JSON: `{ "v": 1 }`).

### client_errors
Batched client runtime errors (ingested via REST).

### audit_log
Persistent application audit trail (message + optional JSON meta). `created_by` for ownership; legacy NULL rows readable until cleanup migration.

Client runtime errors & audit events are batched via the environment guards and new error hook (`onError`) allowing future remote forwarding.

## Versioning
- Bump: create migration in `migrations/` (next sequential number), update `EXPECTED_SCHEMA_VERSION`.
- Apply migrations sequentially (e.g. via CI/CD migration runner or manual `psql -f`).
- Current version: 6 (strict RLS: NOT NULL `created_by` + strict ownership policies). Prior: v5 backfilled NULL `created_by` and recorded system owner; v4 introduced auto trigger.

## Adding a Column
1. Create migration `0NN_add_column_x.sql` with `alter table`.
2. Update `schema.sql` reflection.
3. Adjust adapter / services if needed.
4. Increment schema version.

## RLS & Security
Version 3 introduced transitional owner-or-null policies. Version 4 added automatic population of `created_by` via trigger (`set_created_by_*`). Version 5 backfilled any legacy NULL `created_by` with a single generated system owner UUID (stored in `app_meta.system_owner`). Version 6 enforces strict ownership:
1. All `created_by` columns are `NOT NULL`.
2. Transitional `*_owner_rw` policies removed; replaced with `*_owner_strict` requiring `created_by = auth.uid()` for all operations.
3. `client_errors` retains permissive insert/select policies for observability (reassess for production hardening if exposure broadens).

All application inserts now rely on the trigger; no manual `created_by` injection required. Any service-role backfills performed post-v5 should explicitly set `created_by` to the stored system owner for consistency.

## Tests & Expectations
- Duplicate create attempt for same name+role returns existing row (client guard + DB constraint).
- Client error logger inserts into `client_errors` (non-blocking if fails).

Keep this file updated with any structural changes.

## Nice-to-haves (Roadmap Extract)
The following feature has been added to the Nice-to-Haves list (not part of the strict schema contract):

- Scheduling Checklist Overlay: ephemeral UI driven by runtime events (no schema impact). Shows validation / fairness / overtime / save / reindex steps with real statuses and surfaced flags (overtime excess, vacation conflicts, consent warnings). Implemented via `services.events` without persisting data.
