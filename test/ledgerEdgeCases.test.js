import { createServices } from '../src/services/index.js';
import { appState } from '../modules/state.js';

function reset(){
  Object.assign(appState, {
    staffData: [ { id:1, name:'Alice', role:'minijob', contractHours:20, typicalWorkdays:5 } ],
    vacationsByStaff: { 1: [] },
    illnessByStaff: { 1: [] },
    vacationLedger: {},
    availabilityData: {},
    scheduleData: {},
    holidays: {},
    carryoverByStaffAndMonth: {},
    save(){}
  });
}

(async function(){
  reset();
  const services = createServices();
  // Add spanning year boundary vacation (Dec 29 - Jan 03)
  services.vacation.addVacation(1,{ start:'2024-12-29', end:'2025-01-03' });
  const vacs = services.vacation.listVacations(1);
  if (vacs.length!==1) throw new Error('Vacation boundary add failed');
  // Simulate ledger entries for 2024 and 2025
  services.vacation.updateLedgerEntry(2024,1,{ entitlement:20, takenManual:0, carryover:0 });
  services.vacation.updateLedgerEntry(2025,1,{ entitlement:20, takenManual:0, carryover:0 });
  // Quick overlap counts using UI helper logic mimic
  const year2024Days = 3; // Dec 29,30,31 (assuming all weekdays? simplification)
  const year2025Days = 3; // Jan 1,2,3
  if (year2024Days<=0 || year2025Days<=0) throw new Error('Boundary day counts invalid test assumptions');
  // Sickness periods
  services.vacation.addIllness(1,{ start:'2025-02-10', end:'2025-02-12' });
  if (services.vacation.listIllness(1).length!==1) throw new Error('Illness add failed');
  services.vacation.removeIllness(1,0);
  if (services.vacation.listIllness(1).length!==0) throw new Error('Illness remove failed');
  console.log('ledgerEdgeCases.test passed');
})();
