import { appState } from '../../modules/state.js';
import { SHIFTS, APP_CONFIG } from '../../modules/config.js';
import { parseYMD } from '../../utils/dateUtils.js';

export function createReportService(store, injectedState){
  const state = injectedState || appState;
  // Performance caches (Sprint 5)
  const cache = {
    monthlyHours: new Map(),       // key: month -> { staffId: hours }
    earnings: new Map(),           // key: month -> { staffId: { hours, earnings } }
    studentWeekly: new Map(),      // key: month -> weeks structure
    overtimeCredits: new Map(),    // key: month -> creditsByStaffWeek
    contractedHours: new Map(),    // key: month -> { staffId: contractedHours }
    dirtyMonths: new Set()
  };
  function markDirty(dateStr){
    if (!dateStr) return; const month = dateStr.slice(0,7); cache.dirtyMonths.add(month);
  }
  // Hook into store assignment operations if possible (best-effort)
  try {
    const origAssign = store.assign?.bind(store);
    if (origAssign){ store.assign = (dateStr, shiftKey, staffId)=>{ markDirty(dateStr); return origAssign(dateStr, shiftKey, staffId); }; }
    const origUnassign = store.unassign?.bind(store);
    if (origUnassign){ store.unassign = (dateStr, shiftKey)=>{ markDirty(dateStr); return origUnassign(dateStr, shiftKey); }; }
    const origSetMonth = store.setMonthSchedule?.bind(store);
    if (origSetMonth){ store.setMonthSchedule = (month, data)=>{ 
      cache.dirtyMonths.add(month); 
      return origSetMonth(month, data); 
    }; }
    const origClearMonth = store.clearMonthSchedule?.bind(store);
    if (origClearMonth){ store.clearMonthSchedule = (month)=>{ 
      cache.dirtyMonths.add(month); 
      return origClearMonth(month); 
    }; }
  } catch{}

  function sumMonthlyHours(month){
    if (!cache.dirtyMonths.has(month) && cache.monthlyHours.has(month)) return cache.monthlyHours.get(month);
    const data = state.scheduleData?.[month] || {};
    const perStaff = {};
    Object.values(data).forEach(day => {
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const h = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
  const key = typeof sid === 'string' ? (sid.match(/^\d+$/)? Number(sid): sid) : sid;
  perStaff[key] = (perStaff[key]||0)+h;
      });
    });
    cache.monthlyHours.set(month, perStaff);
    cache.earnings.delete(month); // dependent cache invalidated
    cache.studentWeekly.delete(month);
    cache.overtimeCredits.delete(month);
    cache.dirtyMonths.delete(month);
    return perStaff;
  }
  function computeEarnings(month){
    if (cache.earnings.has(month) && !cache.dirtyMonths.has(month)) return cache.earnings.get(month);
    const wages = Number(APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5);
    const hours = sumMonthlyHours(month);
    const out = {};
    (state.staffData||[]).forEach(s => {
      const h = hours[s.id]||0;
      const earn = s.role==='permanent' ? h * wages * (35/20) : h * wages; // placeholder logic
      out[s.id] = { hours: h, earnings: earn };
    });
    cache.earnings.set(month, out);
    return out;
  }
  function recomputeOvertimeCredits(month){
    if (!cache.dirtyMonths.has(month) && cache.overtimeCredits.has(month)) return cache.overtimeCredits.get(month);
    const data = appState.scheduleData?.[month] || {};
    const creditsByStaffWeek = {};
    Object.entries(data).forEach(([dateStr, day]) => {
      const d = parseYMD(dateStr);
      const week = getWeekNumber(d);
      const isWE = [0,6].includes(d.getDay());
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const staff = (appState.staffData||[]).find(x=>x.id==sid);
        if (!staff || staff.role!=='permanent') return;
        const hours = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
        if (!isWE && !(APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED && staff.weekendPreference)) return;
        const year = String(d.getFullYear());
        const consent = !!appState.permanentOvertimeConsent?.[sid]?.[year]?.[dateStr];
        if (isWE && !staff.weekendPreference && consent){
          if (!creditsByStaffWeek[sid]) creditsByStaffWeek[sid] = {}; creditsByStaffWeek[sid][week] = (creditsByStaffWeek[sid][week]||0)+hours; return;
        }
        if (!isWE && APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED && APP_CONFIG?.ALTERNATIVE_WEEKEND_REQUIRES_CONSENT && staff.weekendPreference){
          const altDays = Array.isArray(staff.alternativeWeekendDays) ? staff.alternativeWeekendDays : [];
          if (altDays.includes(d.getDay()) && consent){
            if (!creditsByStaffWeek[sid]) creditsByStaffWeek[sid] = {}; creditsByStaffWeek[sid][week] = (creditsByStaffWeek[sid][week]||0)+hours;
          }
        }
      });
    });
    // Only save if data actually changed to prevent recursive loops
    const currentCredits = appState.overtimeCredits?.[month];
    const creditsChanged = JSON.stringify(currentCredits) !== JSON.stringify(creditsByStaffWeek);
    if (!appState.overtimeCredits) appState.overtimeCredits = {}; 
    appState.overtimeCredits[month] = creditsByStaffWeek; 
    if (creditsChanged) appState.save?.();
  cache.overtimeCredits.set(month, creditsByStaffWeek);
  return creditsByStaffWeek;
  }
  function getWeekNumber(d){
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function studentWeekly(month){
  if (cache.studentWeekly.has(month) && !cache.dirtyMonths.has(month)) return cache.studentWeekly.get(month);
    const data = appState.scheduleData?.[month] || {};
    const weeks = {};
    Object.entries(data).forEach(([dateStr, day]) => {
      const d = parseYMD(dateStr); const week = getWeekNumber(d);
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const staff = (appState.staffData||[]).find(x=>x.id==sid);
        if (!staff || staff.role!=='student') return;
        if (!weeks[sid]) weeks[sid] = {}; if (!weeks[sid][week]) weeks[sid][week] = { hours:0, nightWeekend:0, total:0 };
        const h = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
        weeks[sid][week].hours += h; weeks[sid][week].total += h;
        const isWE = ['weekend-early','weekend-late'].includes(shiftKey);
        const isNight = (shiftKey==='closing');
        if (isWE || isNight) weeks[sid][week].nightWeekend += h;
      });
    });
    cache.studentWeekly.set(month, weeks);
    return weeks;
  }
  function getOvertimeCredits(month){
    // Always recompute to reflect latest schedule state; could be optimized with dirty flags later.
    return recomputeOvertimeCredits(month);
  }

  function countVacationDaysInMonth(staffId, month){
    const vacations = state.vacationsByStaff?.[staffId] || [];
    const [year, monthNum] = month.split('-').map(Number);
    let total = 0;
    for (const period of vacations) {
      const start = parseYMD(period.start);
      const end = parseYMD(period.end);
      if (isNaN(start) || isNaN(end)) continue;
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0); // Last day of month
      const overlapStart = start > monthStart ? start : monthStart;
      const overlapEnd = end < monthEnd ? end : monthEnd;
      if (overlapEnd >= overlapStart) {
        const cur = new Date(overlapStart);
        while (cur <= overlapEnd) {
          const day = cur.getDay();
          // Count weekdays (Monday-Friday) as vacation days
          if (day >= 1 && day <= 5) total++;
          cur.setDate(cur.getDate() + 1);
        }
      }
    }
    return total;
  }

  function computeContractedHours(month){
    if (cache.contractedHours.has(month) && !cache.dirtyMonths.has(month)) return cache.contractedHours.get(month);
    const out = {};
    const baselineWorkdays = Number(APP_CONFIG?.WORKDAYS_PER_WEEK || 5) || 5;
    (state.staffData||[]).forEach(s => {
      const weeklyContractHours = Number(s.contractHours || 0);
      if (weeklyContractHours <= 0) {
        out[s.id] = 0;
        return;
      }
      const [year, monthNum] = month.split('-').map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      const monthEnd = new Date(year, monthNum, 0);
      let workingWeekdays = 0;
      const cursor = new Date(monthStart);
      while (cursor <= monthEnd) {
        const day = cursor.getDay();
        if (day >= 1 && day <= 5) workingWeekdays++;
        cursor.setDate(cursor.getDate() + 1);
      }
      const vacationWeekdays = countVacationDaysInMonth(s.id, month);
      const effectiveWeekdays = Math.max(0, workingWeekdays - vacationWeekdays);
      const expectedHours = (baselineWorkdays > 0)
        ? weeklyContractHours * (effectiveWeekdays / baselineWorkdays)
        : 0;
      out[s.id] = expectedHours;
    });
    cache.contractedHours.set(month, out);
    return out;
  }

  return { sumMonthlyHours, computeEarnings, recomputeOvertimeCredits, getWeekNumber, studentWeekly, getOvertimeCredits, computeContractedHours, _cache:cache };
}
