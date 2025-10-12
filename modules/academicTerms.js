import { appState } from './state.js';
import { APP_CONFIG } from './config.js';
import { toLocalISODate } from '../utils/dateUtils.js';

// Very small iCalendar parser for VEVENT DTSTART/DTEND with SUMMARY containing keywords
function parseICS(text){
  const lines = text.split(/\r?\n/);
  const events = [];
  let cur = null;
  for (const raw of lines){
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT'){ cur = {}; continue; }
    if (line === 'END:VEVENT'){ if (cur) events.push(cur); cur=null; continue; }
    if (!cur) continue;
    if (line.startsWith('DTSTART')){
      const [, val] = line.split(':');
      cur.start = parseICSTime(val);
    } else if (line.startsWith('DTEND')){
      const [, val] = line.split(':');
      cur.end = parseICSTime(val);
    } else if (line.startsWith('SUMMARY:')){
      cur.summary = line.substring('SUMMARY:'.length).trim();
    }
  }
  return events;
}

function parseICSTime(val){
  // Handles YYYYMMDD or YYYYMMDDTHHMMSSZ
  const y = Number(val.slice(0,4));
  const m = Number(val.slice(4,6));
  const d = Number(val.slice(6,8));
  return new Date(Date.UTC(y, m-1, d));
}

function dateRange(start, end){
  const out = [];
  const d0 = new Date(start.getTime());
  const d1 = new Date(end.getTime());
  // ICS DTEND is exclusive; include up to end-1 day
  d1.setUTCDate(d1.getUTCDate()-1);
  for (let d = d0; d <= d1; d = new Date(d.getTime() + 86400000)){
    out.push(toLocalISODate(new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())));
  }
  return out;
}

export async function fetchAcademicTerms(force=false){
  const cacheKey = 'terms';
  if (!force && appState.academicTermCache?.[cacheKey]) return appState.academicTermCache[cacheKey];
  const urls = (appState.academicTermSources && appState.academicTermSources.length)
    ? appState.academicTermSources
    : (APP_CONFIG?.ACADEMIC_TERM_ICS_SOURCES || []);
  const results = [];
  for (const url of urls){
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const text = await res.text();
      const ev = parseICS(text);
      results.push(...ev);
    } catch { /* ignore */ }
  }
  const terms = buildTermsFromEvents(results);
  appState.academicTermCache[cacheKey] = terms;
  appState.save?.();
  return terms;
}

// Build high-level lecture vs break periods per year using either ICS or fallback config
export function buildTermsFromEvents(events){
  const byYear = {};
  if (Array.isArray(events) && events.length){
    // Heuristic: events with SUMMARY containing lecture keywords classify periods
    const isLecture = (s='') => /vorlesung|lecture/i.test(s);
    for (const e of events){
      if (!e.start || !e.end) continue;
      const year = String(new Date(e.start).getUTCFullYear());
      byYear[year] = byYear[year] || { lectureDays: new Set(), breakDays: new Set() };
      const days = dateRange(e.start, e.end);
      const target = isLecture(e.summary) ? byYear[year].lectureDays : byYear[year].breakDays;
      days.forEach(d => target.add(d));
    }
    // Convert sets to arrays
    Object.entries(byYear).forEach(([y,obj])=>{
      byYear[y] = { lectureDays: Array.from(obj.lectureDays), breakDays: Array.from(obj.breakDays) };
    });
    return byYear;
  }
  // Fallback: synthesize common German academic calendar per config
  const cfg = APP_CONFIG?.ACADEMIC_TERM_CONFIG || {};
  const years = [new Date().getFullYear()-1, new Date().getFullYear(), new Date().getFullYear()+1];
  for (const y of years){
    const yStr = String(y);
    const lectureDays = new Set();
    const breakDays = new Set();
    // Winter term spans Oct 1 (y) to Mar 31 (y+1), lecture mid-Oct to mid-Feb
    const wStart = new Date(Date.UTC(y, (cfg.WINTER_START_MONTH||10)-1, cfg.WINTER_START_DAY||1));
    const wEnd = new Date(Date.UTC(y+1, (cfg.WINTER_END_MONTH||3)-1, (cfg.WINTER_END_DAY||31)+1)); // exclusive
    const wlStart = new Date(Date.UTC(y, (cfg.WINTER_LECTURE_START?.month||10)-1, cfg.WINTER_LECTURE_START?.day||15));
    const wlEnd = new Date(Date.UTC(y+1, (cfg.WINTER_LECTURE_END?.month||2)-1, (cfg.WINTER_LECTURE_END?.day||15)+1));
    dateRange(wStart, wEnd).forEach(d => breakDays.add(d));
    dateRange(wlStart, wlEnd).forEach(d => { breakDays.delete(d); lectureDays.add(d); });
    // Summer term spans Apr 1 (y) to Sep 30 (y), lecture mid-Apr to mid-Jul
    const sStart = new Date(Date.UTC(y, (cfg.SUMMER_START_MONTH||4)-1, cfg.SUMMER_START_DAY||1));
    const sEnd = new Date(Date.UTC(y, (cfg.SUMMER_END_MONTH||9)-1, (cfg.SUMMER_END_DAY||30)+1));
    const slStart = new Date(Date.UTC(y, (cfg.SUMMER_LECTURE_START?.month||4)-1, cfg.SUMMER_LECTURE_START?.day||15));
    const slEnd = new Date(Date.UTC(y, (cfg.SUMMER_LECTURE_END?.month||7)-1, (cfg.SUMMER_LECTURE_END?.day||15)+1));
    dateRange(sStart, sEnd).forEach(d => breakDays.add(d));
    dateRange(slStart, slEnd).forEach(d => { breakDays.delete(d); lectureDays.add(d); });
    byYear[yStr] = { lectureDays: Array.from(lectureDays), breakDays: Array.from(breakDays) };
  }
  return byYear;
}

export async function isLectureWeek(dateStr){
  // Determine whether the week of dateStr (Mon-Sun) falls into lecture-dominant days
  const terms = await fetchAcademicTerms();
  const d = new Date(dateStr);
  const year = String(d.getFullYear());
  const data = terms?.[year];
  if (!data){
    // If month suggests typical lecture time based on config, guess
    const m = d.getMonth()+1;
    const cfg = APP_CONFIG?.ACADEMIC_TERM_CONFIG || {};
    const inSummerLecture = (m>= (cfg.SUMMER_LECTURE_START?.month||4) && m <= (cfg.SUMMER_LECTURE_END?.month||7));
    const inWinterLecture = (m>= (cfg.WINTER_LECTURE_START?.month||10) || m <= (cfg.WINTER_LECTURE_END?.month||2));
    return inSummerLecture || inWinterLecture;
  }
  // Count lecture vs break days in that calendar week
  const start = new Date(d);
  const dow = start.getDay();
  const monday = new Date(start.getFullYear(), start.getMonth(), start.getDate() - ((dow+6)%7));
  let lecture=0, brk=0;
  for (let i=0;i<7;i++){
    const ds = `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,'0')}-${String(monday.getDate()+i).padStart(2,'0')}`;
    if (data.lectureDays.includes(ds)) lecture++;
    else if (data.breakDays.includes(ds)) brk++;
  }
  return lecture >= brk; // tie -> lecture
}

export async function getStudentWeeklyCap(dateStr){
  const lecture = await isLectureWeek(dateStr);
  return lecture ? (APP_CONFIG?.STUDENT_MAX_WEEKLY_HOURS_LECTURE ?? 20)
                 : (APP_CONFIG?.STUDENT_MAX_WEEKLY_HOURS_BREAK ?? 40);
}

export function isLectureWeekSync(dateStr){
  const d = new Date(dateStr);
  const year = String(d.getFullYear());
  const data = appState.academicTermCache?.terms;
  if (data && data[year]){
    // Count lecture vs break days in the calendar week
    const dow = d.getDay();
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((dow+6)%7));
    let lecture=0, brk=0;
    for (let i=0;i<7;i++){
      const dt = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+i);
      const ds = `${dt.getFullYear()}-${String(dt.getMonth()+1).padStart(2,'0')}-${String(dt.getDate()).padStart(2,'0')}`;
      if (data[year].lectureDays.includes(ds)) lecture++;
      else if (data[year].breakDays.includes(ds)) brk++;
    }
    return lecture >= brk;
  }
  // Fallback heuristic using config if no cache yet
  const m = d.getMonth()+1;
  const cfg = APP_CONFIG?.ACADEMIC_TERM_CONFIG || {};
  const inSummerLecture = (m>= (cfg.SUMMER_LECTURE_START?.month||4) && m <= (cfg.SUMMER_LECTURE_END?.month||7));
  const inWinterLecture = (m>= (cfg.WINTER_LECTURE_START?.month||10) || m <= (cfg.WINTER_LECTURE_END?.month||2));
  return inSummerLecture || inWinterLecture;
}

export function getStudentWeeklyCapSync(dateStr){
  const lecture = isLectureWeekSync(dateStr);
  return lecture ? (APP_CONFIG?.STUDENT_MAX_WEEKLY_HOURS_LECTURE ?? 20)
                 : (APP_CONFIG?.STUDENT_MAX_WEEKLY_HOURS_BREAK ?? 40);
}
