## Supabase RLS Hardening Checklist (Planned)

| Area | Table | Policy Concept | Status |
|------|-------|----------------|--------|
| Staff | staff | Owner-or-null transitional; tighten later | PARTIAL |
| Schedule | schedule_days | Owner-or-null transitional | PARTIAL |
| Availability | availability | Owner-or-null transitional | PARTIAL |
| Absences | absences | Owner-or-null transitional | PARTIAL |
| Overtime | overtime_requests / overtime_consents | Owner-or-null transitional | PARTIAL |
| Ledger | vacation_ledger | Owner-or-null transitional | PARTIAL |
| Errors | client_errors | Insert only; no public select (admin secure view) | TODO |
| Audit | audit_log | Owner-or-null transitional | PARTIAL |

### Required Columns for RLS
- `created_by uuid` referencing auth.uid()
- `updated_at timestamptz default now()`

### Baseline Policies Pattern
```
create policy "allow_own" on staff for select using (auth.uid() = created_by);
create policy "allow_admin" on staff for all using (auth.role() = 'service_role');
```

### Migration Steps
1. Add required columns via migration.
2. Populate legacy rows with a system user id.
3. Enable RLS.
4. Add policies.
5. Smoke test with restricted key.

### Testing
Use service key for migrations; anon key for UI. Verify denies.
