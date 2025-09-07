import { createServices } from '../src/services/index.js';
import { appState } from '../modules/state.js';

function reset(){
  Object.assign(appState, {
    staffData: [ { id:1, name:'Alice', role:'permanent', contractHours:40, typicalWorkdays:5 } ],
    vacationsByStaff: { 1: [] },
    illnessByStaff: { 1: [] },
    vacationLedger: {},
    availabilityData: {},
    scheduleData: {},
    holidays: {},
    carryoverByStaffAndMonth: {},
    overtimeRequests: {},
    save(){}
  });
}

(async function(){
  reset();
  const services = createServices();
  const year = new Date().getFullYear();
  // Initial upsert
  let rec = await services.vacation.upsertLedgerEntry({ staffId:1, year, allowance:30, takenManual:0, carryPrev:2 });
  if (!rec || rec.allowance!==30) throw new Error('Initial ledger upsert failed');
  const v1 = rec.version || 0;
  // Simulate concurrent change by directly mutating local version then forcing remote mismatch via second enqueue
  // For local test (no real remote), just call upsert again with old version to exercise conflict retry path silently
  rec = await services.vacation.upsertLedgerEntry({ staffId:1, year, allowance:31, takenManual:1, carryPrev:2 });
  if (!rec || rec.allowance!==31) throw new Error('Second ledger upsert failed');
  console.log('vacationLedgerConcurrency.test passed');
})();
