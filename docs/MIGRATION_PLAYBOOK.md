# Migration Playbook (v3 -> v5 -> v6)

## Current State
- Live schema version: 5
- All `created_by` populated (migration 006 backfill) + auto trigger (migration 005).
- Policies still allow `created_by IS NULL` (transitional) pending strict enforcement.

## Pre-Flight Checklist for v6
1. Run `node tools/verify_db_integrity.mjs` with production credentials (expect PASS & zero NULL rows).
2. Confirm no long-running writes (maintenance window or low traffic period).
3. Backup database (logical dump + point-in-time snapshot if available).
4. Review application deployment plan (clients should tolerate brief mismatch; banner shows if version differs).

## Migration Steps (v6 Tightening)
1. Create migration `007_strict_policies.sql` from draft `migrations/007_prepare_strict_policies.sql` (uncomment & finalize):
   - `ALTER COLUMN created_by SET NOT NULL` on: staff, schedule_days, availability, vacation_ledger, absences, overtime_requests, overtime_consents, audit_log.
   - Drop old policies (`*_owner_rw`).
   - Create new policies requiring exact ownership (no NULL allowance).
   - Update `schema_version` to 6.
2. Bump `EXPECTED_SCHEMA_VERSION` in `src/config/env.js` to 6.
3. Deploy migration.
4. Deploy application build referencing new expected schema version.
5. Monitor logs (errors accessing tables should be zero). Run integrity verify again post-migration.

## Rollback Plan
If unexpected access errors or ownership issues arise:
1. Revert to previous application build (expected schema 5).
2. Restore backup or (if data unchanged) apply rollback SQL:
   - Revert new strict policies (drop) and recreate transitional owner-or-null policies.
   - ALTER TABLE ... ALTER COLUMN created_by DROP NOT NULL (each table).
   - Set `schema_version` back to 5 in `app_meta`.
3. Investigate root cause (missing created_by population path, service role writes without auth).

## Verification Queries (Manual psql)
```sql
-- Check for lingering NULL
select 'staff' as tbl, count(*) from public.staff where created_by is null
union all select 'schedule_days', count(*) from public.schedule_days where created_by is null
union all select 'availability', count(*) from public.availability where created_by is null
union all select 'vacation_ledger', count(*) from public.vacation_ledger where created_by is null
union all select 'absences', count(*) from public.absences where created_by is null
union all select 'overtime_requests', count(*) from public.overtime_requests where created_by is null
union all select 'overtime_consents', count(*) from public.overtime_consents where created_by is null
union all select 'audit_log', count(*) from public.audit_log where created_by is null;
```

## Operational Notes
- `system_owner` (in `app_meta`) identifies backfilled legacy rows. After v6, consider removing or repurposing.
- Any service-role automation must set `created_by` explicitly (e.g. to system_owner) or execute under an authenticated context.
- Future multi-tenant extension would introduce `organization_id` + composite policy layer; design when required.

## Future Hardening Ideas
- Periodic job to assert no new NULL `created_by` rows (should be impossible post-v6).
- Audit differential export for compliance.
