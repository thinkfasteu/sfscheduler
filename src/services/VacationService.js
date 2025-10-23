import { appState } from '../../modules/state.js';

export function createVacationService(store){
  return {
    listVacations(staffId){ return store.listVacations(staffId); },
    addVacation(staffId, period){ return store.addVacation(staffId, period); },
    removeVacation(staffId, idx){ return store.removeVacation(staffId, idx); },
    removeVacationById(id){ return store.removeVacationById ? store.removeVacationById(id) : Promise.reject(new Error('Not implemented')); },
    listIllness(staffId){ return store.listIllness(staffId); },
    addIllness(staffId, period){ return store.addIllness(staffId, period); },
    removeIllness(staffId, idx){ return store.removeIllness(staffId, idx); },
    removeIllnessById(id){ return store.removeIllnessById ? store.removeIllnessById(id) : Promise.reject(new Error('Not implemented')); },
    getLedger(year){ return store.getVacationLedgerYear(year); },
    upsertLedgerEntry(entry){
      const { staffId, year, allowance, takenManual, carryPrev, meta } = entry;
      return store.upsertVacationLedgerEntry(year, staffId, { allowance, takenManual, carryPrev, meta });
    },
    updateLedgerEntry(year, staffId, patch){ return this.upsertLedgerEntry({ staffId, year, ...patch }); },
    // Direct passthrough for existing in-memory shape until fully externalized
    raw(){ return { vacationsByStaff: appState.vacationsByStaff, illnessByStaff: appState.illnessByStaff, vacationLedger: appState.vacationLedger }; }
  };
}
