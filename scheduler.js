import { APP_CONFIG, SHIFTS } from './modules/config.js';
import { appState } from './modules/state.js';
import { parseYMD } from './utils/dateUtils.js';

// Minimal, consistent schedule container used by the UI/state
class Schedule {
    constructor(month){
        this.month = month;
        this.data = appState.scheduleData[month] || {};
        const [y, m] = month.split('-').map(Number);
        this.year = y;
        this.monthNum = m;
        this.daysInMonth = new Date(y, m, 0).getDate();
    }
    getShiftsForDate(dateStr){
        const d = parseYMD(dateStr);
        const isWeekend = [0,6].includes(d.getDay());
        const isHoliday = appState.holidays[this.year]?.[dateStr];
        const type = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'weekday';
        return Object.entries(SHIFTS)
            .filter(([,s]) => s.type === type)
            .map(([k]) => k);
    }
    setAssignment(dateStr, shiftKey, staffId){
        if (!this.data[dateStr]){
            this.data[dateStr] = { assignments: {}, holidayName: appState.holidays[this.year]?.[dateStr] || null };
        }
        this.data[dateStr].assignments[shiftKey] = staffId;
    }
}

class SchedulerError extends Error {
    constructor(type, code, message, details={}){ super(message); this.type=type; this.code=code; this.details=details; }
}

const LogLevel = { DEBUG:0, INFO:1, WARN:2, ERROR:3 };
class SchedulerLogger {
    constructor(minLevel=LogLevel.INFO){ this.minLevel=minLevel; this.logs=[]; }
    log(level, message, data={}){ if(level<this.minLevel) return; this.logs.push({timestamp:new Date(), level, message, data}); if(level>=LogLevel.WARN) console.warn(`Scheduler: ${message}`, data); }
}

// Keep only the core rules the engine currently enforces
const BUSINESS_RULES = {
    REST_PERIOD: {
        id: 'REST_PERIOD', description: '11h rest between shifts',
        // Compare the actual shift start time with the last recorded end time
        validate: (dateStr, shiftKey, staff, hours, engine) => {
            const last = engine.lastShiftEndTimes[staff.id];
            if (!last) return true;
            const [startTime] = SHIFTS[shiftKey].time.split('-');
            const start = engine.parseShiftTime(dateStr, startTime);
            const diffH = (start - last) / (3600 * 1000);
            const min = APP_CONFIG?.MIN_REST_HOURS ?? 11;
            return diffH >= min;
        }
    },
    MAX_CONSECUTIVE_DAYS: {
        id: 'MAX_CONSECUTIVE_DAYS', description: '<=6 consecutive days',
        validate: (_dateStr, _shiftKey, staff, _hours, engine) => {
            const max = APP_CONFIG?.MAX_CONSECUTIVE_DAYS ?? 6;
            return (engine.consecutiveDaysWorked[staff.id] || 0) < max;
        }
    }
};

class SchedulingEngine {
    constructor(month){
        this.month = month;
        const [y,m] = month.split('-').map(Number);
        this.year=y; this.monthNum=m;
        this.daysInMonth = new Date(y,m,0).getDate();
        this.staffHoursByWeek = {}; this.monthlyHours={}; this.lastShiftEndTimes={}; this.consecutiveDaysWorked={}; this.daysWorkedThisWeek={};
        this.logger = new SchedulerLogger();
        (appState.staffData||[]).forEach(s=>{ this.staffHoursByWeek[s.id]={}; this.monthlyHours[s.id]=0; this.consecutiveDaysWorked[s.id]=0; this.daysWorkedThisWeek[s.id]=0; });
    }

    toLocalISODate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    getWeekNumber(d){ d=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7)); const y0=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-y0)/86400000)+1)/7); }
    isWeekend(dateStr){ const d=parseYMD(dateStr); return [0,6].includes(d.getDay()); }
    isNightWeekendShift(shiftKey){ return shiftKey==='closing' || shiftKey.startsWith('weekend-'); }
    parseShiftTime(dateStr, timeStr){ const [H,M]=timeStr.split(':').map(Number); const [y,m,d]=dateStr.split('-').map(Number); return new Date(y,m-1,d,H,M); }

    isStaffAvailable(staff, dateStr, shiftKey){
        const vac = appState.vacationsByStaff?.[staff.id]||[];
        if (vac.length){ const t=parseYMD(dateStr).getTime(); for(const p of vac){ if(!p?.start||!p?.end) continue; const s=parseYMD(p.start).getTime(); const e=parseYMD(p.end).getTime(); if (t>=s && t<=e) return false; } }
        if (appState.availabilityData?.[`staff:${staff.id}`]?.[dateStr] === 'off') return false;
        const a = appState.availabilityData?.[staff.id]?.[dateStr]?.[shiftKey]; if (a==='no' || a==='off') return false;
        return true;
    }

    validateBusinessRules(dateStr, shiftKey, staff, hours){
        for (const rule of Object.values(BUSINESS_RULES)){
            if (!rule.validate(dateStr, shiftKey, staff, hours, this)){
                throw new SchedulerError('constraint', rule.id, `Business rule violation: ${rule.description}`, { staffId: staff.id, date: dateStr, shiftKey });
            }
        }
    }

    findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum){
        const hours = SHIFTS[shiftKey].hours;
        const cands=[];
        (appState.staffData||[]).forEach(staff=>{
            if (scheduledToday.has(staff.id)) return;
            if (!this.isStaffAvailable(staff, dateStr, shiftKey)) return;
            const weekH = this.staffHoursByWeek[staff.id][weekNum]||0; const monthH = this.monthlyHours[staff.id]||0;
            let score=0;
            const avail = appState.availabilityData?.[staff.id]?.[dateStr]?.[shiftKey];
            if (avail==='prefer') score += 100; else if (avail==='yes') score += 10;
            if (this.isWeekend(dateStr) && staff.weekendPreference) score += (APP_CONFIG?.WEEKEND_PREFERENCE_BONUS ?? 50);
            const weeklyTarget = staff.weeklyHours ?? staff.contractHours ?? 0;
            if (weekH + hours <= weeklyTarget) score += 50; else score -= (weekH + hours - weeklyTarget)*10;
            const monthlyTarget = weeklyTarget*4; if (monthlyTarget>0 && monthH < 0.8*monthlyTarget) score += 30;
            cands.push({ staff, score });
        });
        return cands.sort((a,b)=> b.score - a.score);
    }

    assignShift(schedule, dateStr, shiftKey, staff, weekNum){
        this.validateBusinessRules(dateStr, shiftKey, staff, SHIFTS[shiftKey].hours);
        const hours = SHIFTS[shiftKey].hours;
        schedule.setAssignment(dateStr, shiftKey, staff.id);
        this.monthlyHours[staff.id] = (this.monthlyHours[staff.id]||0) + hours;
        this.staffHoursByWeek[staff.id][weekNum] = (this.staffHoursByWeek[staff.id][weekNum]||0) + hours;
        if (this.isNightWeekendShift(shiftKey)){
            if (!this.staffNWHoursByWeek) this.staffNWHoursByWeek = {};
            if (!this.staffNWHoursByWeek[staff.id]) this.staffNWHoursByWeek[staff.id] = {};
            this.staffNWHoursByWeek[staff.id][weekNum] = (this.staffNWHoursByWeek[staff.id][weekNum]||0) + hours;
        }
        const [_s,e] = SHIFTS[shiftKey].time.split('-');
        this.lastShiftEndTimes[staff.id] = this.parseShiftTime(dateStr, e);
    }

    updateConsecutiveDays(scheduledToday){
        (appState.staffData||[]).forEach(s=>{
            if (scheduledToday.has(s.id)){
                this.consecutiveDaysWorked[s.id] = (this.consecutiveDaysWorked[s.id]||0)+1;
                this.daysWorkedThisWeek[s.id] = (this.daysWorkedThisWeek[s.id]||0)+1;
            } else {
                this.consecutiveDaysWorked[s.id] = 0;
            }
        });
    }

    generateSchedule(){
        const schedule = new Schedule(this.month);
        let currentWeek=-1;
        for (let day=1; day<=schedule.daysInMonth; day++){
            const date = new Date(this.year, this.monthNum-1, day);
            const dateStr = this.toLocalISODate(date);
            const weekNum = this.getWeekNumber(date);
            if (weekNum !== currentWeek){ currentWeek = weekNum; (appState.staffData||[]).forEach(s=>{ this.daysWorkedThisWeek[s.id]=0; }); }
            const shifts = schedule.getShiftsForDate(dateStr);
            const scheduledToday = new Set();
            for (const sh of shifts){
                const cands = this.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
                if (cands.length===0) continue;
                const chosen = cands[0];
                this.assignShift(schedule, dateStr, sh, chosen.staff, weekNum);
                scheduledToday.add(chosen.staff.id);
            }
            this.updateConsecutiveDays(scheduledToday);
        }
        return schedule;
    }
}

export { Schedule, SchedulingEngine, SchedulerError, BUSINESS_RULES, LogLevel, SchedulerLogger };