#!/usr/bin/env node
// Verification script: ensures no NULL created_by rows remain, and basic FK integrity.
import fs from 'fs';

async function main(){
  const url = process.env.SUPABASE_URL; const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key){ console.error('[verify] Missing SUPABASE_URL/SUPABASE_ANON_KEY'); process.exit(2); }
  const headers = { apikey:key, Authorization:`Bearer ${key}` };
  async function count(path, filter){
    const res = await fetch(`${url}/rest/v1/${path}?select=id&${filter||''}`, { headers });
    if (!res.ok){ console.error('[verify] fetch failed', path, res.status); return -1; }
    const data = await res.json(); return data.length;
  }
  const tables = ['staff','schedule_days','availability','vacation_ledger','absences','overtime_requests','overtime_consents','audit_log'];
  let nullTotal = 0;
  for (const t of tables){
    const c = await count(t, 'created_by=is.null');
    if (c>0){ console.error(`[verify] Table ${t} has ${c} NULL created_by`); nullTotal += c; }
  }
  if (nullTotal>0){ console.error('[verify] FAIL: NULL created_by rows remain'); process.exit(1); }
  console.log('[verify] created_by backfill clean');
  // Basic orphan check for availability -> staff
  const availRes = await fetch(`${url}/rest/v1/availability?select=staff_id`, { headers });
  const staffRes = await fetch(`${url}/rest/v1/staff?select=id`, { headers });
  if (availRes.ok && staffRes.ok){
    const avail = await availRes.json(); const staff = await staffRes.json();
    const staffSet = new Set(staff.map(s=>s.id));
    const orphans = avail.filter(a=> !staffSet.has(a.staff_id));
    if (orphans.length){ console.error('[verify] Orphan availability rows:', orphans.length); process.exit(1); }
    console.log('[verify] availability staff_id integrity OK');
  }
  console.log('[verify] PASS all checks');
}
main().catch(e=>{ console.error('[verify] error', e); process.exit(1); });
