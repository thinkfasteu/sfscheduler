import { appState } from '../../modules/state.js';

// Provides CRUD + auto calculation for monthly carryover values per staff.
// Shape: appState.carryoverByStaffAndMonth[staffId][monthKey] = number
export function createCarryoverService(store){
  function ensureRoot(){ if (!appState.carryoverByStaffAndMonth) appState.carryoverByStaffAndMonth = {}; }
  function listForStaff(staffId){ ensureRoot(); return appState.carryoverByStaffAndMonth[staffId] || {}; }
  function get(staffId, month){ ensureRoot(); return Number(appState.carryoverByStaffAndMonth?.[staffId]?.[month] || 0); }
  function set(staffId, month, value){ ensureRoot(); if (!appState.carryoverByStaffAndMonth[staffId]) appState.carryoverByStaffAndMonth[staffId] = {}; appState.carryoverByStaffAndMonth[staffId][month] = Number(value)||0; appState.save?.(); return true; }
  function remove(staffId, month){ ensureRoot(); if (appState.carryoverByStaffAndMonth?.[staffId]){ delete appState.carryoverByStaffAndMonth[staffId][month]; appState.save?.(); } return true; }
  // Auto calculation replicates previous computeAutoCarryover logic (requires staff + month; monthly target estimated from contract hours)
  function auto(staff, month, helpers){
    try {
      if (!staff) return 0;
      const prev = helpers?.getPrevMonthKey ? helpers.getPrevMonthKey(month) : month; // fallback
      const weeklyTarget = Number(staff?.weeklyHours ?? staff?.contractHours ?? 0);
      if (!weeklyTarget) return 0;
      const [py, pm] = prev.split('-').map(Number);
      const daysInPrev = new Date(py, pm, 0).getDate();
      let weekdayCountPrev = 0;
      for (let d=1; d<=daysInPrev; d++){
        const dt = new Date(py, pm-1, d);
        const dow = dt.getDay(); if (dow!==0 && dow!==6) weekdayCountPrev++;
      }
      const monthlyTarget = weeklyTarget * (weekdayCountPrev / 5);
      const achievedPrev = helpers?.sumStaffHoursForMonth ? helpers.sumStaffHoursForMonth(staff.id, prev) : 0;
      const carryInPrev = get(staff.id, prev);
      const out = (monthlyTarget - achievedPrev) + carryInPrev;
      return Math.round(out * 100) / 100;
    } catch { return 0; }
  }
  return { listForStaff, get, set, remove, auto };
}
