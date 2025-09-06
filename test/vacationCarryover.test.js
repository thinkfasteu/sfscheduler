import { createServices } from '../src/services/index.js';
import { appState } from '../modules/state.js';

function resetState(){
  Object.assign(appState, {
    staffData: [ { id:1, name:'Alice', role:'minijob', contractHours:20, typicalWorkdays:5 } ],
    vacationsByStaff: { 1: [] },
    illnessByStaff: { 1: [] },
    vacationLedger: {},
    availabilityData: {},
    scheduleData: {},
    holidays: {},
    carryoverByStaffAndMonth: {},
    save(){},
  });
}

(async function run(){
  resetState();
  const services = createServices();
  // Add vacations
  services.vacation.addVacation(1, { start:'2025-06-10', end:'2025-06-14' }); // 5 days
  services.vacation.addVacation(1, { start:'2025-07-01', end:'2025-07-02' }); // 2 days
  const list = services.vacation.listVacations(1);
  if (list.length !== 2) throw new Error('Vacation add failed');
  services.vacation.removeVacation(1, 1);
  if (services.vacation.listVacations(1).length !== 1) throw new Error('Vacation remove failed');

  // Ledger update
  const year = 2025;
  services.vacation.updateLedgerEntry(year, 1, { entitlement: 20, takenManual: 3, carryover: 5 });
  const ledger = services.vacation.getLedger(year);
  if (!ledger[1] || ledger[1].entitlement !== 20) throw new Error('Ledger update failed');

  // Carryover service set/get
  services.carryover.set(1, '2025-06', 2.5);
  const c = services.carryover.get(1, '2025-06');
  if (c !== 2.5) throw new Error('Carryover set/get failed');

  console.log('vacationCarryover.test passed');
})();
