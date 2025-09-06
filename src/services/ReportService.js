import { appState } from '../../modules/state.js';
import { SHIFTS, APP_CONFIG } from '../../modules/config.js';
import { parseYMD } from '../../utils/dateUtils.js';

export function createReportService(store){
  function sumMonthlyHours(month){
    const data = appState.scheduleData?.[month] || {};
    const perStaff = {};
    Object.values(data).forEach(day => {
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const h = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
        perStaff[sid] = (perStaff[sid]||0)+h;
      });
    });
    return perStaff;
  }
  function computeEarnings(month){
    const wages = Number(APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5);
    const hours = sumMonthlyHours(month);
    const out = {};
    (appState.staffData||[]).forEach(s => {
      const h = hours[s.id]||0;
      const earn = s.role==='permanent' ? h * wages * (35/20) : h * wages; // placeholder logic
      out[s.id] = { hours: h, earnings: earn };
    });
    return out;
  }
  function recomputeOvertimeCredits(month){
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
    if (!appState.overtimeCredits) appState.overtimeCredits = {}; appState.overtimeCredits[month] = creditsByStaffWeek; appState.save?.();
    return creditsByStaffWeek;
  }
  function getWeekNumber(d){
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }
  function studentWeekly(month){
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
    return weeks;
  }
  function getOvertimeCredits(month){
    // Always recompute to reflect latest schedule state; could be optimized with dirty flags later.
    return recomputeOvertimeCredits(month);
  }
  return { sumMonthlyHours, computeEarnings, recomputeOvertimeCredits, getWeekNumber, studentWeekly, getOvertimeCredits };
}
