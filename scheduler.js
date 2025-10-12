import { APP_CONFIG, SHIFTS } from './modules/config.js';
import { appState } from './modules/state.js';
// Safe window proxy for non-browser test runs
const WIN = (typeof window !== 'undefined') ? window : { holidayService: null };
import { parseYMD } from './utils/dateUtils.js';
import { getStudentWeeklyCapSync } from './modules/academicTerms.js';

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
        // Christmas Day (December 25) and New Year's Day (January 1) are non-business days
        if (dateStr.endsWith('-12-25') || dateStr.endsWith('-01-01')) {
            return []; // No shifts available on Christmas or New Year
        }
        
        const d = parseYMD(dateStr);
        const isWeekend = [0,6].includes(d.getDay());
        // Use TS singleton as primary source, fallback to appState for compatibility
        const isHoliday = WIN.holidayService
            ? WIN.holidayService.isHoliday(dateStr)
            : !!(appState.holidays?.[String(this.year)]?.[dateStr]);
        const type = isHoliday ? 'holiday' : isWeekend ? 'weekend' : 'weekday';
        
        // DEBUG: Log holiday detection for October 3rd
        if (dateStr === '2025-10-03') {
            console.log('[DEBUG] getShiftsForDate for 2025-10-03:', {
                dateStr,
                isWeekend,
                isHoliday,
                type,
                holidayService: !!WIN.holidayService,
                appStateHoliday: appState.holidays?.[String(this.year)]?.[dateStr]
            });
        }
        
        const shifts = Object.entries(SHIFTS)
            .filter(([,s]) => s.type === type)
            .map(([k]) => k);
            
        // DEBUG: Log shifts for October 3rd
        if (dateStr === '2025-10-03') {
            console.log('[DEBUG] Shifts for 2025-10-03:', shifts);
        }
        
        return shifts;
    }
    setAssignment(dateStr, shiftKey, staffId){
        if (!this.data[dateStr]){
            // Use TS singleton as primary source for holiday name
            const holidayName = WIN.holidayService
                ? WIN.holidayService.getHolidayName(dateStr)
                : (appState.holidays?.[String(this.year)]?.[dateStr] || null);
            this.data[dateStr] = { assignments: {}, holidayName };
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
            // If the "last" end time lies in the future relative to this start (can happen when
            // seeding from later-in-month assignments), ignore it for rest-period checks.
            if (diffH < 0) return true;
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
    },
    MINIJOB_EARNINGS_CAP: {
        id: 'MINIJOB_EARNINGS_CAP', description: 'Minijob monthly earnings cap',
        validate: (_dateStr, shiftKey, staff, _hours, engine) => {
            if (staff.role !== 'minijob') return true;
            const wage = APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5;
            const cap = APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556;
            const projected = (engine.monthlyHours[staff.id] || 0) * wage + (SHIFTS[shiftKey].hours * wage);
            return projected <= cap + 1e-6;
        }
    },
    PERMANENT_WEEKEND_CONSENT: {
        id: 'PERMANENT_WEEKEND_CONSENT', description: 'Permanent weekend requires consent when not pref',
        validate: (dateStr, _shiftKey, staff, _hours, engine) => {
            if (!APP_CONFIG?.PERMANENT_WEEKEND_CONSENT_ENABLED) return true;
            if (staff.role !== 'permanent') return true;
            if (!engine.isWeekend(dateStr)) return true;
            // If staff has weekendPreference, allow as regular
            if (staff.weekendPreference) return true;
            // Check consent record in state
            const year = String(parseYMD(dateStr).getFullYear());
            const consent = appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
            return !!consent; // must have explicit consent
        }
    },
    ALTERNATIVE_WEEKEND_CONSENT: {
        id: 'ALTERNATIVE_WEEKEND_CONSENT', description: 'Alt-weekend requires consent',
        validate: (dateStr, _shiftKey, staff, _hours, engine) => {
            if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED) return true;
            if (staff.role !== 'permanent') return true;
            if (!staff.weekendPreference) return true;
            if (!engine.isAlternativeWeekendDay(dateStr, staff)) return true;
            if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_REQUIRES_CONSENT) return true;
            const year = String(parseYMD(dateStr).getFullYear());
            const consent = appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
            return !!consent;
        }
    },
    NON_BUSINESS_DAYS: {
        id: 'NON_BUSINESS_DAYS', description: 'No scheduling on Christmas and New Year',
        validate: (dateStr, _shiftKey, _staff, _hours, _engine) => {
            // Christmas Day (December 25) and New Year's Day (January 1) are non-business days
            // No shifts should be scheduled on these days regardless of holiday shift availability
            if (dateStr.endsWith('-12-25')) {
                return false; // Christmas Day - no scheduling
            }
            if (dateStr.endsWith('-01-01')) {
                return false; // New Year's Day - no scheduling  
            }
            return true;
        }
    },
    PERMANENT_HOLIDAY_RESTRICTION: {
        id: 'PERMANENT_HOLIDAY_RESTRICTION', description: 'Permanent employees do not work holiday shifts',
        validate: (dateStr, shiftKey, staff, _hours, engine) => {
            if (staff.role !== 'permanent') return true;
            // Check if this date is a holiday
            const d = parseYMD(dateStr);
            const isWeekend = [0,6].includes(d.getDay());
            const isHoliday = WIN.holidayService
                ? WIN.holidayService.isHoliday(dateStr)
                : !!(appState.holidays?.[String(d.getFullYear())]?.[dateStr]);
            
            const shouldBlock = isHoliday && !isWeekend;
            
            // DEBUG: Log validation for October 3rd
            if (dateStr === '2025-10-03') {
                console.log('[DEBUG] PERMANENT_HOLIDAY_RESTRICTION for 2025-10-03:', {
                    dateStr,
                    shiftKey,
                    staffRole: staff.role,
                    staffName: staff.name,
                    isWeekend,
                    isHoliday,
                    shouldBlock,
                    result: !shouldBlock
                });
            }
            
            return !shouldBlock; // Allow if weekend, block if holiday
        }
    },
    NON_PERMANENT_WEEKEND_MAX: {
        id: 'NON_PERMANENT_WEEKEND_MAX', description: 'Non-permanent weekend max without preference',
        validate: (dateStr, _shiftKey, staff, _hours, engine) => {
            if (!APP_CONFIG?.WEEKEND_DISTRIBUTION_ENABLED) return true;
            if (staff.role === 'permanent') return true;
            if (!engine.isWeekend(dateStr)) return true;
            const weekendOnly = typeof engine.isWeekendOnlyAvailability === 'function' ? engine.isWeekendOnlyAvailability(staff) : false;
            const maxWithoutPref = APP_CONFIG?.MAX_WEEKENDS_WITHOUT_PREFERENCE ?? 2;
            const prior = engine.weekendAssignmentsCount[staff.id] || 0;
            if (!staff.weekendPreference && !weekendOnly && prior >= maxWithoutPref) return false;
            return true;
        }
    },
    STUDENT_WEEKDAY_DAYTIME_CAP: {
        id: 'STUDENT_WEEKDAY_DAYTIME_CAP', description: 'Student weekday daytime per-week cap',
        validate: (dateStr, shiftKey, staff, _hours, engine) => {
            if (!APP_CONFIG?.STUDENT_WEEKDAY_DAYTIME_ENABLED) return true;
            if (staff.role !== 'student') return true;
            if (engine.isWeekend(dateStr)) return true;
            const isDaytime = (shiftKey === 'early' || shiftKey === 'midday');
            if (!isDaytime) return true;
            const weekNum = engine.getWeekNumber(parseYMD(dateStr));
            const prior = engine.studentDaytimePerWeek[staff.id]?.[weekNum] || 0;
            const cap = APP_CONFIG?.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS ?? 1;
            // Engine will avoid exceeding cap during auto-generation by returning false
            // Manual override: validator will surface warning but not block
            return (prior + 1) <= cap;
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
    this.overtimeByWeek = {};
        // Fairness trackers
        this.weekendAssignmentsCount = {}; // per-staff count of weekend shift assignments in the month
        this.studentDaytimePerWeek = {};   // per-staff per-week count of weekday daytime (early/midday)
        this.logger = new SchedulerLogger();
        // Carryover-in hours (signed): positive means shortfall to make up; negative means surplus from last month
        this.carryoverIn = {};
        this.nextMonthKey = this.computeNextMonthKey();
        (appState.staffData||[]).forEach(s=>{ 
            this.staffHoursByWeek[s.id]={}; 
            this.monthlyHours[s.id]=0; 
            this.consecutiveDaysWorked[s.id]=0; 
            this.daysWorkedThisWeek[s.id]=0; 
            this.weekendAssignmentsCount[s.id]=0;
            this.studentDaytimePerWeek[s.id] = {};
            this.overtimeByWeek[s.id] = {};
            const co = appState.carryoverByStaffAndMonth?.[s.id]?.[this.month];
            this.carryoverIn[s.id] = Number.isFinite(co) ? Number(co) : 0;
        });
    // Seed trackers from existing schedule (if any)
    this.seedTrackersFromExistingSchedule();
    // Precompute absence (vacation/sick) hours and days for this month
    this.absenceHoursByWeek = {};   // hours deducted from weekly target per week
    this.absenceDaysByWeek = {};    // days counted as worked per week
    this.absenceHoursByMonth = {};  // hours deducted from monthly target
    this.computeAbsenceMaps();
    // Snapshot student exception & fairness flags
    this.studentExceptionAllowed = !!appState.studentExceptionMonths?.[month];
    this.studentFairnessMode = !!appState.studentFairnessMode;
    // TODO (Vacation/Neutral Absence Revisit): Currently ONLY entries in vacations / illness reduce weekly & monthly targets
    // and count toward typical workday calculations. Ad-hoc 'off' availability (availabilityData['staff:ID'][date]=='off')
    // blocks assignment but DOES NOT reduce targets, causing later-week catch-up pressure (overpacking) for minijob/student exam weeks.
    // Future options (see design note in discussion):
    //  A) Treat off-days (or >=N consecutive) as neutral absences reducing targets.
    //  B) Introduce explicit neutralAbsences collection separate from legal vacation.
    //  C) Dynamically scale weekly target by (availableWorkingDays / typicalWorkdays).
    // Deferred: needs business sign-off due to “everyone has 30 days” policy.
    }

    // Calendar-aware monthly target hours: scale weekly hours by (weekdayCount / 5)
    computeMonthlyTargetHours(staff){
        const weekly = Number(staff?.weeklyHours ?? staff?.contractHours ?? 0) || 0;
        if (!weekly) return 0;
        // Count Mon-Fri days in this month
        let weekdayCount = 0;
        for (let d=1; d<=this.daysInMonth; d++){
            const dt = new Date(this.year, this.monthNum-1, d);
            const dow = dt.getDay();
            if (dow!==0 && dow!==6) weekdayCount++;
        }
        return weekly * (weekdayCount / 5);
    }

    // Get effective weekly hour limits using practical limits where available
    getEffectiveWeeklyLimits(staff){
        const contractHours = Number(staff?.weeklyHours ?? staff?.contractHours ?? 0) || 0;
        
        // For Minijob and Student, prefer practical limits over contract hours
        if (staff.role === 'minijob' || staff.role === 'student') {
            const practicalMin = staff.weeklyHoursMinPractical;
            const practicalMax = staff.weeklyHoursMaxPractical;
            
            const hasPracticalLimits = Number.isFinite(practicalMin) || Number.isFinite(practicalMax);
            const min = Number.isFinite(practicalMin) ? practicalMin : 0;
            const max = Number.isFinite(practicalMax) ? practicalMax : contractHours;
            
            // Target is average of min/max when both practical limits exist, otherwise use max
            let target;
            if (Number.isFinite(practicalMin) && Number.isFinite(practicalMax)) {
                target = Math.round((practicalMin + practicalMax) / 2);
            } else {
                target = max;
            }
            
            return {
                min,
                max,
                target,
                hasPracticalLimits
            };
        }
        
        // For permanent staff, use contract hours
        return {
            min: 0,
            max: contractHours,
            target: contractHours,
            hasPracticalLimits: false
        };
    }

    // Dynamic critical determination: All shifts are critical EXCEPT 'evening' on configured optional days (Tue/Thu by default)
    isShiftCritical(dateStr, shiftKey){
        if (shiftKey !== 'evening') return true;
        const dow = parseYMD(dateStr).getDay(); // 0=Sun..6=Sat
        const optionalDays = APP_CONFIG?.EVENING_OPTIONAL_DAYS || [];
        return !optionalDays.includes(dow); // non-critical only if day is listed
    }

    toLocalISODate(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
    getWeekNumber(d){ d=new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate()+4-(d.getUTCDay()||7)); const y0=new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d-y0)/86400000)+1)/7); }
    isWeekend(dateStr){ const d=parseYMD(dateStr); return [0,6].includes(d.getDay()); }
    isNightWeekendShift(shiftKey){ return shiftKey==='closing' || shiftKey.startsWith('weekend-'); }
    parseShiftTime(dateStr, timeStr){ const [H,M]=timeStr.split(':').map(Number); const [y,m,d]=dateStr.split('-').map(Number); return new Date(y,m-1,d,H,M); }

    isAlternativeWeekendDay(dateStr, staff){
        if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED) return false;
        if (!staff?.alternativeWeekendDays || staff.alternativeWeekendDays.length!==2) return false;
        const d = parseYMD(dateStr).getDay();
        // JS: 0=Sun..6=Sat; assume alt days stored as 1..5 for Mon..Fri
        return staff.alternativeWeekendDays.includes(d);
    }

    getAverageWeekdayShiftHours(){
        const entries = Object.values(SHIFTS||{}).filter(s=>s.type==='weekday');
        if (!entries.length) return 6;
        const avg = entries.reduce((a,b)=>a+(Number(b.hours)||0),0)/entries.length;
        return avg || 6;
    }

    getHoursPerWorkingDay(staff){
        const weekly = Number(staff?.weeklyHours ?? staff?.contractHours ?? 0) || 0;
        const days = Number(staff?.typicalWorkdays || 0) || 0;
        if (weekly > 0 && days > 0) return weekly / days;
        return this.getAverageWeekdayShiftHours();
    }

    computeAbsenceMaps(){
        const hpdByStaff = {};
        (appState.staffData||[]).forEach(s=>{ hpdByStaff[s.id] = this.getHoursPerWorkingDay(s); });
        // Iterate each day of this month
        for (let day=1; day<=this.daysInMonth; day++){
            const dt = new Date(this.year, this.monthNum-1, day);
            const dateStr = this.toLocalISODate(dt);
            const weekNum = this.getWeekNumber(dt);
            (appState.staffData||[]).forEach(s=>{
                const sid = s.id;
                const hpd = hpdByStaff[sid] || 0;
                const vac = (appState.vacationsByStaff?.[sid]||[]).some(p=>{
                    if (!p?.start || !p?.end) return false; const t=dt.getTime(); const sD=parseYMD(p.start).getTime(); const eD=parseYMD(p.end).getTime(); return t>=sD && t<=eD; });
                const ill = (appState.illnessByStaff?.[sid]||[]).some(p=>{
                    if (!p?.start || !p?.end) return false; const t=dt.getTime(); const sD=parseYMD(p.start).getTime(); const eD=parseYMD(p.end).getTime(); return t>=sD && t<=eD; });
                if (!(vac || ill)) return;
                if (!this.absenceHoursByWeek[sid]) this.absenceHoursByWeek[sid] = {};
                if (!this.absenceDaysByWeek[sid]) this.absenceDaysByWeek[sid] = {};
                this.absenceHoursByWeek[sid][weekNum] = (this.absenceHoursByWeek[sid][weekNum]||0) + hpd;
                this.absenceDaysByWeek[sid][weekNum] = (this.absenceDaysByWeek[sid][weekNum]||0) + 1;
                this.absenceHoursByMonth[sid] = (this.absenceHoursByMonth[sid]||0) + hpd;
            });
        }
    }

    isStaffAvailable(staff, dateStr, shiftKey){
    const vac = appState.vacationsByStaff?.[staff.id]||[];
    if (vac.length){ const t=parseYMD(dateStr).getTime(); for(const p of vac){ if(!p?.start||!p?.end) continue; const s=parseYMD(p.start).getTime(); const e=parseYMD(p.end).getTime(); if (t>=s && t<=e) return false; } }
    // Illness periods block assignment exactly like vacations
    const ill = appState.illnessByStaff?.[staff.id]||[];
    if (ill.length){ const t=parseYMD(dateStr).getTime(); for(const p of ill){ if(!p?.start||!p?.end) continue; const s=parseYMD(p.start).getTime(); const e=parseYMD(p.end).getTime(); if (t>=s && t<=e) return false; } }
        
        // Robust availability lookup: handle both namespaced and legacy key formats
        const availBucket =
            appState.availabilityData?.[`staff:${staff.id}`] ??
            appState.availabilityData?.[staff.id] ?? null;
        if (availBucket?.[dateStr] === 'off') return false;
        const a = availBucket?.[dateStr]?.[shiftKey];
        
        // For non-permanent staff: only explicit 'yes' or 'prefer' counts as available; undefined / legacy 'no' treated not available.
        if (staff.role !== 'permanent'){
            return a === 'yes' || a === 'prefer';
        }
        // Permanents: available unless explicitly opted out (no/off)
        if (a==='no' || a==='off') return false;
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
            const isWE = this.isWeekend(dateStr);
            if (isWE && staff.weekendPreference) score += (APP_CONFIG?.WEEKEND_PREFERENCE_BONUS ?? 50);
            // Fairness: strong guard against exceeding personal weekend cap (soft before hard rules)
            if (isWE && staff.role !== 'permanent'){
                const priorWE = this.weekendAssignmentsCount[staff.id] || 0;
                const maxWE = APP_CONFIG?.MAX_WEEKENDS_WITHOUT_PREFERENCE ?? 2;
                if (!staff.weekendPreference && priorWE >= maxWE){
                    // Large penalty to push others forward; not absolute block to allow fallback if no one else
                    score -= (APP_CONFIG?.WEEKEND_SATURATION_PENALTY ?? 250) * 2;
                }
            }
            // Permanent preferred weekday shift bonus
            if (!isWE && staff.role==='permanent'){
                const pref = staff.permanentPreferredShift || 'none';
                if (pref !== 'none' && (shiftKey === pref)){
                    score += (APP_CONFIG?.PERMANENT_PREFERRED_SHIFT_BONUS ?? 60);
                }
            }
            // Strongly discourage selecting permanents for weekends without explicit consent
            if (isWE && staff.role==='permanent' && !staff.weekendPreference){
                const year = String(parseYMD(dateStr).getFullYear());
                const hasConsent = !!appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
                if (!hasConsent) score -= 1000;
            }
            // Heavy penalty for automatic assignment of permanents to weekday evening/closing (rare exception)
            if (!isWE && staff.role==='permanent' && (shiftKey==='evening' || shiftKey==='closing')){
                const volKey = `${staff.id}::${dateStr}::${shiftKey}`;
                const legacyKey = `${staff.id}::${dateStr}`;
                const volunteered = !!(appState.voluntaryEveningAvailability?.[volKey] || appState.voluntaryEveningAvailability?.[legacyKey]);
                if (volunteered){
                    // Remove penalty and add small volunteer bonus
                    score += (APP_CONFIG?.PERMANENT_EVENING_VOLUNTEER_BONUS ?? 60);
                } else {
                    score -= (APP_CONFIG?.PERMANENT_WEEKDAY_EVENING_PENALTY ?? 400);
                }
            }
            const weeklyTargetBase = staff.weeklyHours ?? staff.contractHours ?? 0;
            const weeklyLimits = this.getEffectiveWeeklyLimits(staff);
            const absHWeek = this.absenceHoursByWeek?.[staff.id]?.[weekNum] || 0;
            
            // Use practical limits for target calculation
            const weeklyTarget = Math.max(0, weeklyLimits.target - absHWeek);
            
            // Scoring based on practical limits
            if (weeklyLimits.hasPracticalLimits) {
                // For staff with practical limits, prefer staying within the band
                if (weekH + hours >= weeklyLimits.min && weekH + hours <= weeklyLimits.max) {
                    score += 60; // Bonus for staying in practical range
                } else if (weekH + hours < weeklyLimits.min) {
                    score -= (weeklyLimits.min - (weekH + hours)) * 15; // Penalty for under-utilization
                } else {
                    score -= ((weekH + hours) - weeklyLimits.max) * 20; // Stronger penalty for exceeding practical max
                }
            } else {
                // Traditional scoring for permanent staff
                if (weekH + hours <= weeklyTarget) score += 50; 
                else score -= (weekH + hours - weeklyTarget) * 10;
            }
            // Calendar-aware monthly target (before absence adjustment). Use base weekly hours not reduced weeklyTarget
            const monthlyTarget = this.computeMonthlyTargetHours(staff);
            const carryIn = this.carryoverIn[staff.id] || 0;
            const absHMonth = this.absenceHoursByMonth?.[staff.id] || 0;
            const monthlyTargetEffective = Math.max(0, monthlyTarget - absHMonth) + Math.max(0, carryIn);
            if (monthlyTargetEffective>0 && monthH < 0.8*monthlyTargetEffective) score += 30;

            // Typical workdays adherence (do not exceed typical days by much)
            const typicalDays = Number(staff.typicalWorkdays || 0);
            const workedDaysThisWeek = (this.daysWorkedThisWeek[staff.id] || 0) + (this.absenceDaysByWeek?.[staff.id]?.[weekNum] || 0);
            if (typicalDays > 0){
                // Small bonus to reach typical days
                if (workedDaysThisWeek < typicalDays) score += 20;
                // Penalties for exceeding typical days
                const over = workedDaysThisWeek + 1 - typicalDays; // +1 if we assign today
                if (over >= 1){
                    // Allow some temporary extra days when there is positive carry-in (shortfall from last month)
                    const allowedExtra = Math.min(
                        (APP_CONFIG?.MAX_EXTRA_DAYS_HARD_CAP ?? 2),
                        Math.max(0, Math.ceil((Math.max(0, carryIn)) / this.getAverageWeekdayShiftHours()))
                    );
                    const excessOver = Math.max(0, over - allowedExtra);
                    if (excessOver >= 1){
                        score -= (APP_CONFIG?.TYPICAL_DAYS_PENALTY ?? 200);
                        const hardCap = (APP_CONFIG?.MAX_EXTRA_DAYS_HARD_CAP ?? 2) + allowedExtra;
                        const maxExtra = (APP_CONFIG?.MAX_EXTRA_DAYS_ALLOWED ?? 1) + allowedExtra;
                        if (over > maxExtra) score -= (APP_CONFIG?.EXTRA_DAY_PENALTY ?? 100) * (over - maxExtra);
                        if (over > hardCap) score -= 1000; // effectively block
                    }
                }
            }

            // Weekend fairness distribution (scoring only)
            if (APP_CONFIG?.WEEKEND_DISTRIBUTION_ENABLED && isWE && staff.role !== 'permanent') {
                const priorWE = this.weekendAssignmentsCount[staff.id] || 0;
                const fairnessPenalty = APP_CONFIG?.WEEKEND_FAIRNESS_PENALTY ?? 100;
                const saturationPenalty = APP_CONFIG?.WEEKEND_SATURATION_PENALTY ?? 250;
                const maxWithoutPref = APP_CONFIG?.MAX_WEEKENDS_WITHOUT_PREFERENCE ?? 2;
                const minWe = APP_CONFIG?.MIN_WEEKENDS_PER_MONTH ?? 1;
                const weekendOnly = this.isWeekendOnlyAvailability?.(staff) || false;
                if (!staff.weekendPreference && !weekendOnly) {
                    // Penalize proportionally to prior weekend load; hard penalty once max exceeded
                    score -= fairnessPenalty * priorWE;
                    if (priorWE >= maxWithoutPref) score -= saturationPenalty;
                }
                // Encourage those with few weekends to balance distribution and meet min
                if (priorWE < minWe) score += Math.max(0, Math.floor(fairnessPenalty / 2));
            }

            // Student-focused scoring
        if (staff.role === 'student') {
                // Nudge against exceeding dynamic weekly cap (lecture vs break)
                const weekCap = getStudentWeeklyCapSync(dateStr);
                if (weekH + hours > weekCap){
            // If exception month is enabled, soften penalty
            score -= this.studentExceptionAllowed ? 50 : 150;
                }
                // Bonus for evenings (weekday) to keep daytime free
                if (shiftKey === 'evening' || shiftKey === 'closing') {
                    score += (APP_CONFIG?.STUDENT_EVENING_BONUS ?? 80);
                }
                // Bonus on weekends to reduce weekday daytime load
                if (isWE) {
                    score += (APP_CONFIG?.STUDENT_WEEKEND_BONUS ?? 60);
                }
                // Penalty when exceeding weekday daytime cap per week (early/midday on weekdays)
                if (APP_CONFIG?.STUDENT_WEEKDAY_DAYTIME_ENABLED && !isWE) {
                    const isDaytime = (shiftKey === 'early' || shiftKey === 'midday');
                    if (isDaytime) {
                        const prior = this.studentDaytimePerWeek[staff.id]?.[weekNum] || 0;
                        const cap = APP_CONFIG?.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS ?? 1;
                        if (prior + 1 > cap) {
                            let pen = APP_CONFIG?.STUDENT_WEEKDAY_DAYTIME_PENALTY ?? 300;
                            if (avail === 'prefer') pen = Math.max(0, pen + (APP_CONFIG?.STUDENT_WEEKDAY_DAYTIME_PENALTY_PREF ?? 0));
                if (this.studentFairnessMode) pen = Math.max(0, pen - 100); // respect desired workdays slightly more
                            score -= pen;
                        }
                    }
                }
            }
            // Alternative weekend penalty for permanent staff on their rest days
            if (staff.role === 'permanent' && staff.weekendPreference && this.isAlternativeWeekendDay(dateStr, staff)){
                score -= (APP_CONFIG?.ALTERNATIVE_WEEKEND_PENALTY ?? 120);
            }
            // Evening / closing student ratio targeting & closing shift fatigue fairness
            const isEveningType = (shiftKey === 'evening' || shiftKey === 'closing');
            if (!isWE && isEveningType && APP_CONFIG?.STUDENT_EVENING_PRIORITY_ENABLED){
                // Approx achieved ratio so far this month
                if (!this._eveningClosingStatsComputed){
                    const stats = { total:0, student:0, closingByStaff:{}, lastClosingDate:{} };
                    const monthData = appState.scheduleData?.[this.month] || {};
                    Object.entries(monthData).forEach(([dStr, day])=>{
                        Object.entries(day?.assignments||{}).forEach(([sh, sid])=>{
                            if (sh==='evening' || sh==='closing'){
                                stats.total++;
                                const stf = (appState.staffData||[]).find(s=>s.id==sid);
                                if (stf?.role==='student') stats.student++;
                                if (sh==='closing'){
                                    stats.closingByStaff[sid] = (stats.closingByStaff[sid]||0)+1;
                                    stats.lastClosingDate[sid] = dStr;
                                }
                            }
                        });
                    });
                    this._eveningClosingStats = stats; this._eveningClosingStatsComputed = true;
                }
                const stats = this._eveningClosingStats;
                const target = APP_CONFIG?.EVENING_CLOSING_STUDENT_TARGET_RATIO ?? 0.5;
                const achieved = stats.total>0 ? (stats.student / stats.total) : 0;
                const needsStudent = achieved < target;
                if (needsStudent && staff.role==='student'){
                    score += (APP_CONFIG?.EVENING_CLOSING_STUDENT_BONUS ?? 40);
                } else if (needsStudent && staff.role!=='student'){
                    score -= (APP_CONFIG?.EVENING_CLOSING_NON_STUDENT_PENALTY ?? 120);
                }
                if (shiftKey==='closing'){
                    const personalCap = APP_CONFIG?.CLOSING_SHIFT_PERSONAL_CAP ?? 3;
                    const priorClosing = stats.closingByStaff[staff.id] || 0;
                    if (priorClosing >= personalCap){
                        score -= (APP_CONFIG?.CLOSING_SHIFT_EXCESS_PENALTY ?? 200) * (priorClosing - personalCap + 1);
                    }
                    // Consecutive closing deterrent (yesterday closing?)
                    const lastDate = stats.lastClosingDate[staff.id];
                    if (lastDate){
                        // Simple check: if last closing date is the immediately previous calendar day
                        if (lastDate){
                            const prev = parseYMD(lastDate);
                            const cur = parseYMD(dateStr);
                            const diffDays = (cur - prev)/(1000*3600*24);
                            if (diffDays === 1 && staff.role!=='student'){
                                score -= (APP_CONFIG?.CLOSING_SHIFT_CONSECUTIVE_PENALTY ?? 150);
                            }
                        }
                    }
                }
            }
            cands.push({ staff, score });
        });
        return cands.sort((a,b)=> b.score - a.score);
    }

    assignShift(schedule, dateStr, shiftKey, staff, weekNum){
        this.validateBusinessRules(dateStr, shiftKey, staff, SHIFTS[shiftKey].hours);
        const hours = SHIFTS[shiftKey].hours;
        schedule.setAssignment(dateStr, shiftKey, staff.id);
        this.monthlyHours[staff.id] = (this.monthlyHours[staff.id]||0) + hours;
        const isWE = this.isWeekend(dateStr);
        const isPermanent = staff.role === 'permanent';
        if (isWE && isPermanent && !staff.weekendPreference) {
            // Consent is required by rule; if assignment succeeded, count as overtime
            this.overtimeByWeek[staff.id][weekNum] = (this.overtimeByWeek[staff.id][weekNum]||0) + hours;
        } else {
            this.staffHoursByWeek[staff.id][weekNum] = (this.staffHoursByWeek[staff.id][weekNum]||0) + hours;
        }
        if (this.isNightWeekendShift(shiftKey)){
            if (!this.staffNWHoursByWeek) this.staffNWHoursByWeek = {};
            if (!this.staffNWHoursByWeek[staff.id]) this.staffNWHoursByWeek[staff.id] = {};
            this.staffNWHoursByWeek[staff.id][weekNum] = (this.staffNWHoursByWeek[staff.id][weekNum]||0) + hours;
        }
        const [_s,e] = SHIFTS[shiftKey].time.split('-');
        this.lastShiftEndTimes[staff.id] = this.parseShiftTime(dateStr, e);
        // Update fairness trackers
        if (this.isWeekend(dateStr)) {
            this.weekendAssignmentsCount[staff.id] = (this.weekendAssignmentsCount[staff.id] || 0) + 1;
        } else {
            // Weekday daytime (early/midday) tracking for students
            if (staff.role === 'student' && (shiftKey === 'early' || shiftKey === 'midday')) {
                this.studentDaytimePerWeek[staff.id][weekNum] = (this.studentDaytimePerWeek[staff.id][weekNum] || 0) + 1;
            }
        }
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

    seedTrackersFromExistingSchedule(cutoffDate = null){
        const monthData = appState.scheduleData?.[this.month] || {};
        const dates = Object.keys(monthData).sort();
        
        // Filter dates to only include those before the cutoff (for rest-period bug fix)
        const filteredDates = cutoffDate ? 
            dates.filter(dateStr => dateStr < cutoffDate) : 
            dates;
            
        const workedToday = {};
        filteredDates.forEach(dateStr => {
            const day = monthData[dateStr];
            const weekNum = this.getWeekNumber(parseYMD(dateStr));
            const assigns = day?.assignments || {};
            Object.entries(assigns).forEach(([shiftKey, staffId]) => {
                const hours = SHIFTS[shiftKey]?.hours || 0;
                this.monthlyHours[staffId] = (this.monthlyHours[staffId] || 0) + hours;
                const staff = (appState.staffData||[]).find(s=>s.id==staffId);
                const isWE = this.isWeekend(dateStr);
                let countedWeekly = false;
                if (isWE && staff?.role==='permanent' && !staff?.weekendPreference){
                    const year = String(parseYMD(dateStr).getFullYear());
                    const consent = appState.permanentOvertimeConsent?.[staffId]?.[year]?.[dateStr];
                    if (consent){
                        this.overtimeByWeek[staffId][weekNum] = (this.overtimeByWeek[staffId][weekNum]||0) + hours;
                        countedWeekly = true; // counted as overtime bucket
                    }
                }
                if (!countedWeekly){
                    this.staffHoursByWeek[staffId][weekNum] = (this.staffHoursByWeek[staffId][weekNum] || 0) + hours;
                }
                if (this.isWeekend(dateStr)) {
                    this.weekendAssignmentsCount[staffId] = (this.weekendAssignmentsCount[staffId] || 0) + 1;
                } else if (staff?.role === 'student' && (shiftKey==='early'||shiftKey==='midday')) {
                    this.studentDaytimePerWeek[staffId][weekNum] = (this.studentDaytimePerWeek[staffId][weekNum]||0)+1;
                }
                const [_st, end] = SHIFTS[shiftKey]?.time?.split('-') || [];
                if (end){
                    const endDt = this.parseShiftTime(dateStr, end);
                    const prev = this.lastShiftEndTimes[staffId];
                    if (!prev || prev < endDt) this.lastShiftEndTimes[staffId] = endDt;
                }
                if (!workedToday[dateStr]) workedToday[dateStr] = new Set();
                workedToday[dateStr].add(staffId);
            });
        });
        // Reconstruct consecutive-day streaks up to last scheduled day
        let streak = {};
        filteredDates.forEach(dateStr => {
            const set = workedToday[dateStr] || new Set();
            (appState.staffData||[]).forEach(s=>{
                if (set.has(s.id)) streak[s.id] = (streak[s.id]||0)+1; else streak[s.id]=0;
                this.consecutiveDaysWorked[s.id] = streak[s.id];
            });
        });
    }

    generateSchedule(){
        const schedule = new Schedule(this.month);
        let currentWeek=-1;
    // Log generation start
    try{ if (!Array.isArray(appState.auditLog)) appState.auditLog = []; appState.auditLog.push({ timestamp: Date.now(), message: `Dienstplan für ${this.month} erstellt.` }); appState.save?.(); }catch{}
        // Precompute weekend-only availability check per staff for this month
        this.isWeekendOnlyAvailability = (staff) => {
            // Require explicit availability info to conclude weekend-only
            let hasWeekendAvail = false;
            let hasWeekdayAvail = false;
            for (let day=1; day<=schedule.daysInMonth; day++){
                const dt = new Date(this.year, this.monthNum-1, day);
                const ds = this.toLocalISODate(dt);
                const perShift = appState.availabilityData?.[staff.id]?.[ds];
                if (!perShift) continue;
                const anyYes = Object.values(perShift).some(v => v==='yes' || v==='prefer');
                if (!anyYes) continue;
                const isWE = this.isWeekend(ds);
                if (isWE) hasWeekendAvail = true; else hasWeekdayAvail = true;
            }
            return hasWeekendAvail && !hasWeekdayAvail;
        };
        for (let day=1; day<=schedule.daysInMonth; day++){
            const date = new Date(this.year, this.monthNum-1, day);
            const dateStr = this.toLocalISODate(date);
            const weekNum = this.getWeekNumber(date);
            
            // CRITICAL FIX: Re-seed trackers to only include shifts from days before this candidate date
            // This ensures lastShiftEndTimes only contains end times from previous days for rest-period calculations
            this.lastShiftEndTimes = {}; // Reset
            this.seedTrackersFromExistingSchedule(dateStr);
            
            if (weekNum !== currentWeek){ currentWeek = weekNum; (appState.staffData||[]).forEach(s=>{ this.daysWorkedThisWeek[s.id]=0; }); }
            
            // Clear existing assignments for this date to ensure only valid shifts for the current day type are assigned
            if (schedule.data[dateStr]?.assignments) {
                // DEBUG: Log clearing for October 3rd
                if (dateStr === '2025-10-03') {
                    console.log('[DEBUG] Clearing existing assignments for 2025-10-03:', schedule.data[dateStr].assignments);
                }
                schedule.data[dateStr].assignments = {};
            }
            
            // Order shifts: dynamic critical (all except Tue/Thu evening) first
            const allShifts = schedule.getShiftsForDate(dateStr);
            const shifts = allShifts.slice().sort((a,b)=>{
                const ac = this.isShiftCritical(dateStr, a) ? 0 : 1;
                const bc = this.isShiftCritical(dateStr, b) ? 0 : 1;
                return ac - bc;
            });
            
            // DEBUG: Log shifts being processed for October 3rd
            if (dateStr === '2025-10-03') {
                console.log('[DEBUG] Processing shifts for 2025-10-03:', shifts);
            }
            const scheduledToday = new Set();
            for (const sh of shifts){
                const cands = this.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
                if (cands.length===0) {
                    // Nothing available that passes hard rules; skip instead of forcing
                    this.logger.log(LogLevel.INFO, 'No candidates (skipped)', { date: dateStr, shift: sh });
                    try{
                        appState.auditLog.push({ timestamp: Date.now(), message: `Unbesetzbare Schicht: ${dateStr} (${sh}) - Keine Kandidaten gefunden.` });
                    }catch{}
                    continue;
                }
                // Optional Tue/Thu evening shifts can be skipped if no good candidate
                const d = parseYMD(dateStr).getDay(); // 0=Sun..6=Sat; Tue=2, Thu=4
                const isOptionalEvening = (sh==='evening' && (APP_CONFIG?.EVENING_OPTIONAL_DAYS||[]).includes(d));
                const minScore = Number(APP_CONFIG?.OPTIONAL_SHIFT_MIN_SCORE ?? 0);
                let assigned = false;
                for (const cand of cands){
                    if (isOptionalEvening && cand.score < minScore){
                        // skip assigning this optional shift if best score below threshold
                        this.logger.log(LogLevel.INFO, 'Optional evening skipped due to low score', { date: dateStr, shift: sh, bestScore: cands[0]?.score||0 });
                        try{ appState.auditLog.push({ timestamp: Date.now(), message: `Optionale Abendschicht übersprungen (keine Kandidaten): ${dateStr}` }); }catch{}
                        break;
                    }
                    try {
                        this.assignShift(schedule, dateStr, sh, cand.staff, weekNum);
                        scheduledToday.add(cand.staff.id);
                        assigned = true;
                        break;
                    } catch (e){
                        if (e instanceof SchedulerError) {
                            // Try next candidate on business rule violation
                            continue;
                        } else {
                            throw e;
                        }
                    }
                }
                // if not assigned, leave shift empty
                if (!assigned) {
                    this.logger.log(LogLevel.WARN, 'No suitable candidate found', { date: dateStr, shift: sh });
                    try{
                        appState.auditLog.push({ timestamp: Date.now(), message: `Unbesetzbare Schicht: ${dateStr} (${sh}) - Keine Kandidaten gefunden.` });
                    }catch{}
                }
            }
            this.updateConsecutiveDays(scheduledToday);
        }
        // Compute and store carryover-out for next month per staff
        (appState.staffData||[]).forEach(s=>{
            const monthlyTarget = this.computeMonthlyTargetHours(s);
            const achieved = this.monthlyHours[s.id] || 0;
            const carryIn = this.carryoverIn[s.id] || 0;
            const absHMonth = this.absenceHoursByMonth?.[s.id] || 0;
            const targetAdj = Math.max(0, monthlyTarget - absHMonth);
            const carryOut = (targetAdj - achieved) + carryIn; // signed
            if (!appState.carryoverByStaffAndMonth) appState.carryoverByStaffAndMonth = {};
            if (!appState.carryoverByStaffAndMonth[s.id]) appState.carryoverByStaffAndMonth[s.id] = {};
            appState.carryoverByStaffAndMonth[s.id][this.nextMonthKey] = Math.round(carryOut * 100) / 100;
        });
        appState.save();
        return schedule;
    }
}

// Helpers on prototype
SchedulingEngine.prototype.computeNextMonthKey = function(){
    const y = this.year; const m = this.monthNum;
    const nm = m === 12 ? 1 : m+1; const ny = m === 12 ? y+1 : y;
    return `${ny}-${String(nm).padStart(2,'0')}`;
}

export { Schedule, SchedulingEngine, SchedulerError, BUSINESS_RULES, LogLevel, SchedulerLogger };