import { appState } from '../../modules/state.js';

export function createVacationService(store){
  return {
    listVacations(staffId){ return store.listVacations(staffId); },
    addVacation(staffId, period){ return store.addVacation(staffId, period); },
    removeVacation(staffId, idx){ return store.removeVacation(staffId, idx); },
    listIllness(staffId){ return store.listIllness(staffId); },
    addIllness(staffId, period){ return store.addIllness(staffId, period); },
    removeIllness(staffId, idx){ return store.removeIllness(staffId, idx); },
    getLedger(year){ if (!appState.vacationLedger) appState.vacationLedger = {}; if (!appState.vacationLedger[year]) appState.vacationLedger[year]={}; return appState.vacationLedger[year]; },
    updateLedgerEntry(year, staffId, patch){ const led = this.getLedger(year); const cur = led[staffId] || {}; led[staffId] = { ...cur, ...patch }; appState.save?.(); return led[staffId]; },
    // Direct passthrough for existing in-memory shape until fully externalized
    raw(){ return { vacationsByStaff: appState.vacationsByStaff, illnessByStaff: appState.illnessByStaff, vacationLedger: appState.vacationLedger }; }
  };
}
