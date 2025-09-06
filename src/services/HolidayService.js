import { appState } from '../../modules/state.js';

export function createHolidayService(){
  return {
    list(year){ return Object.entries(appState.holidays?.[year] || {}).map(([date,name])=>({ date, name })); },
    add(year, date, name){ if (!appState.holidays[year]) appState.holidays[year]={}; appState.holidays[year][date]=name; appState.save(); return true; },
    remove(year, date){ if (!appState.holidays[year]) return false; delete appState.holidays[year][date]; appState.save(); return true; },
    ensureLoaded(year){ if (!appState.holidays[year]) appState.holidays[year]={}; return true; }
  };
}