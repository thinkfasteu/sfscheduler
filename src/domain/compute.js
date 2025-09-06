// Pure computation helpers extracted from UI for reuse.
import { parseYMD } from '../../utils/dateUtils.js';

export function getPrevMonthKey(month){
  if (!month || typeof month !== 'string' || !month.includes('-')) return month;
  const [y,m] = month.split('-').map(Number);
  const prevM = m === 1 ? 12 : (m-1);
  const prevY = m === 1 ? (y-1) : y;
  return `${prevY}-${String(prevM).padStart(2,'0')}`;
}

export function countOverlapDaysInYear(startStr, endStr, year, weekdaysOnly){
  if (!startStr || !endStr) return 0;
  const start = parseYMD(startStr); const end = parseYMD(endStr);
  if (isNaN(start) || isNaN(end)) return 0;
  const yearStart = new Date(year,0,1); const yearEnd = new Date(year,11,31);
  const s = start > yearStart ? start : yearStart; const e = end < yearEnd ? end : yearEnd;
  if (e < s) return 0;
  let count=0; const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
  while(cur<=e){ const day = cur.getDay(); if (!weekdaysOnly || (day>=1 && day<=5)) count++; cur.setDate(cur.getDate()+1); }
  return count;
}

export function computeDefaultEntitlement(staff, year, shifts){
  if (staff?.role === 'permanent') return 30;
  const statutoryFiveDay = 20;
  let avgDays = Number(staff?.typicalWorkdays || 0);
  if (!avgDays || !Number.isFinite(avgDays) || avgDays <= 0){
    const entries = Object.values(shifts || {}).filter(s=>s.type==='weekday');
    const perDay = entries.length ? (entries.reduce((sum,s)=>sum+(Number(s.hours)||0),0)/entries.length) : 6;
    const h = Number(staff?.contractHours || 0);
    const est = h>0 && perDay>0 ? (h/perDay) : 0; avgDays = Math.min(5, Math.max(1, Math.round(est)));
  }
  avgDays = Math.min(5, Math.max(1, Number(avgDays)));
  return Math.round((statutoryFiveDay * (avgDays / 5)));
}

export function getWeekNumber(d){
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  return Math.ceil((((d - yearStart)/86400000)+1)/7);
}
