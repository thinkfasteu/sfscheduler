// Smoke test: overtime parity basic lifecycle using LocalStorageAdapter (no Supabase dependency)
import { LocalStorageAdapter } from '../src/storage/LocalStorageAdapter.js';

(async function(){
  const results = [];
  function assert(name, cond, info){ results.push({ name, pass: !!cond, info }); }
  const store = new LocalStorageAdapter();
  // Seed state shape expected
  global.appState = { staffData:[], scheduleData:{}, availabilityData:{}, vacationsByStaff:{}, illnessByStaff:{}, vacationLedger:{}, overtimeRequests:{}, save:()=>{} };
  // Staff needed for overtime
  const staff = store.createStaff({ name:'Tester', role:'minijob', contractHours:10, typicalWorkdays:3 });
  const rec = store.createOvertimeRequest('2025-09','2025-09-15',{ staffId: staff.id, shiftKey:'early' });
  assert('create-overtime-id', !!rec.id, rec);
  const byMonth = store.listOvertimeByMonth('2025-09');
  assert('list-by-month', byMonth.length===1 && byMonth[0].id===rec.id, byMonth);
  const byDate = store.listOvertimeByDate('2025-09','2025-09-15');
  assert('list-by-date', byDate.length===1 && byDate[0].id===rec.id, byDate);
  store.updateOvertimeRequest('2025-09','2025-09-15', r=> r.id===rec.id, { status:'review' });
  const afterUpdate = store.listOvertimeByDate('2025-09','2025-09-15')[0];
  assert('update-status', afterUpdate.status==='review', afterUpdate);
  store.transitionOvertimeRequest(rec.id,'consented');
  const afterTransition = store.listOvertimeByDate('2025-09','2025-09-15')[0];
  assert('transition-status', afterTransition.status==='consented', afterTransition);
  store.setOvertimeConsent(staff.id,'2025-09-15',true);
  assert('consent-set', store.hasOvertimeConsent(staff.id,'2025-09-15')===true);
  const failed = results.filter(r=>!r.pass);
  if (failed.length){ console.error('[smoke.overtimeParity.test] FAIL', failed); process.exitCode=1; } else { console.log('[smoke.overtimeParity.test] PASS', results); }
})();
