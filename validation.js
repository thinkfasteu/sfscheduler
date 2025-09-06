import { APP_CONFIG, SHIFTS } from './modules/config.js';  // Updated path
import { appState } from './modules/state.js';  // Updated path and name
import { getWeekNumber, parseShiftTime, parseYMD } from './utils/dateUtils.js';
import { getStudentWeeklyCapSync } from './modules/academicTerms.js';

export class ScheduleValidator {
    constructor(month) {
        this.month = month;
        const [year, monthNum] = month.split('-').map(Number);
        this.year = year;
        this.monthNum = monthNum;
    }

    validateSchedule(schedule) {
        const issues = {
            workload: this.validateWorkloadLimits(schedule),
            rest: this.validateRestPeriods(schedule),
            weekends: this.validateWeekendDistribution(schedule),
            students: this.validateStudentRules(schedule),
            permanentConsent: this.validatePermanentWeekendConsent(schedule),
            alternativeWeekend: this.validateAlternativeWeekendConsent(schedule),
            minijob: this.validateMinijobEarnings(schedule),
            studentHours: this.validateStudentWeeklyHours(schedule),
            absences: this.validateAbsenceConflicts(schedule),
            typicalDays: this.validateTypicalWorkdays(schedule)
        };

        return this.consolidateIssues(schedule, issues);
    }

    isAlternativeWeekendDay(dateStr, staff){
        if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED) return false;
        if (!staff?.alternativeWeekendDays || staff.alternativeWeekendDays.length!==2) return false;
    const d = parseYMD(dateStr).getDay();
        return staff.alternativeWeekendDays.includes(d);
    }

    validatePermanentWeekendConsent(schedule){
        const issues = [];
        if (!APP_CONFIG?.PERMANENT_WEEKEND_CONSENT_ENABLED) return issues;
        Object.entries(schedule).forEach(([dateStr, day]) => {
            const dow = parseYMD(dateStr).getDay();
            const isWeekend = dow===0 || dow===6;
            if (!isWeekend) return;
            Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                const staff = appState.staffData.find(s=>s.id===staffId);
                if (!staff || staff.role !== 'permanent') return;
                if (staff.weekendPreference) return; // preference allows without consent
                const year = String(parseYMD(dateStr).getFullYear());
                const consent = appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
        if (!consent){
                    issues.push({
                        type: 'permanentConsent',
            severity: 'warning',
                        staffId: staff.id,
                        dateStr,
                        shiftKey,
                        message: 'Wochenendarbeit erfordert Zustimmung'
                    });
                }
            });
        });
        return issues;
    }

    validateAlternativeWeekendConsent(schedule){
        const issues = [];
        if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED) return issues;
        Object.entries(schedule).forEach(([dateStr, day]) => {
            Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                const staff = appState.staffData.find(s=>s.id===staffId);
                if (!staff || staff.role !== 'permanent') return;
                if (!staff.weekendPreference) return; // alt weekend applies to weekend-preferring permanents
                if (!this.isAlternativeWeekendDay(dateStr, staff)) return;
                if (!APP_CONFIG?.ALTERNATIVE_WEEKEND_REQUIRES_CONSENT) return;
                const year = String(parseYMD(dateStr).getFullYear());
                const consent = appState.permanentOvertimeConsent?.[staff.id]?.[year]?.[dateStr];
        if (!consent){
                    issues.push({
                        type: 'alternativeWeekend',
            severity: 'warning',
                        staffId: staff.id,
                        dateStr,
                        shiftKey,
                        message: 'Alternative Wochenendtage erfordern Zustimmung'
                    });
                }
            });
        });
        return issues;
    }

    validateWorkloadLimits(schedule) {
        const issues = [];
        const weeklyHours = {};
        const monthlyHours = {};

        // Calculate actual hours
        Object.entries(schedule).forEach(([dateStr, day]) => {
            const weekNum = getWeekNumber(parseYMD(dateStr));
            Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                const hours = SHIFTS[shiftKey].hours;
                
                // Track weekly hours
                weeklyHours[weekNum] = weeklyHours[weekNum] || {};
                weeklyHours[weekNum][staffId] = (weeklyHours[weekNum][staffId] || 0) + hours;
                
                // Track monthly hours
                monthlyHours[staffId] = (monthlyHours[staffId] || 0) + hours;
            });
        });

        // Check limits
        appState.staffData.forEach(staff => {
            // Weekly checks
            Object.entries(weeklyHours).forEach(([weekNum, staffHours]) => {
                const hours = staffHours[staff.id] || 0;
                const weeklyTarget = this.getWeeklyTarget(staff);
                const tolerance = APP_CONFIG.WEEK_TOLERANCE_BY_ROLE[staff.role] || 
                                APP_CONFIG.DEFAULT_WEEK_TOLERANCE;

                if (Math.abs(hours - weeklyTarget) > tolerance) {
                    issues.push({
                        type: 'workload',
                        severity: 'warning',
                        staffId: staff.id,
                        message: `Week ${weekNum}: ${hours}h (target: ${weeklyTarget}±${tolerance})`
                    });
                }
            });

            // Monthly checks
            const monthlyHoursTotal = monthlyHours[staff.id] || 0;
            const monthlyTarget = this.getMonthlyTarget(staff);
            const tolerance = APP_CONFIG.MONTH_TOLERANCE_BY_ROLE[staff.role] || 
                            APP_CONFIG.DEFAULT_MONTH_TOLERANCE;

        if (Math.abs(monthlyHoursTotal - monthlyTarget) > tolerance) {
                issues.push({
                    type: 'workload',
            severity: 'warning',
                    staffId: staff.id,
                    message: `Month total: ${monthlyHoursTotal}h (target: ${monthlyTarget}±${tolerance})`
                });
            }
        });

        return issues;
    }

    // Return both issues and consolidated schedule so callers can distinguish overridable vs hard errors
    validateScheduleWithIssues(schedule){
        const issues = {
            workload: this.validateWorkloadLimits(schedule),
            rest: this.validateRestPeriods(schedule),
            weekends: this.validateWeekendDistribution(schedule),
            students: this.validateStudentRules(schedule),
            permanentConsent: this.validatePermanentWeekendConsent(schedule),
            alternativeWeekend: this.validateAlternativeWeekendConsent(schedule),
            minijob: this.validateMinijobEarnings(schedule),
            studentHours: this.validateStudentWeeklyHours(schedule),
            absences: this.validateAbsenceConflicts(schedule),
            typicalDays: this.validateTypicalWorkdays(schedule)
        };
        const consolidated = this.consolidateIssues(schedule, issues);
        return { issues, schedule: consolidated };
    }

    validateMinijobEarnings(schedule){
        const issues = [];
        const monthlyHours = {};
        Object.entries(schedule).forEach(([dateStr, day]) => {
            Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                const hours = SHIFTS[shiftKey]?.hours || 0;
                monthlyHours[staffId] = (monthlyHours[staffId] || 0) + hours;
            });
        });
        const cap = APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556;
        const wage = APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5;
        (appState.staffData||[]).forEach(staff => {
            if (staff.role !== 'minijob') return;
            const projected = (monthlyHours[staff.id] || 0) * wage;
            if (projected > cap + (APP_CONFIG?.FLOAT_PRECISION_OFFSET||0)){
                issues.push({
                    type: 'minijob',
                    severity: 'warning',
                    staffId: staff.id,
                    message: `Minijob earnings risk: €${projected.toFixed(2)} > cap €${cap}`
                });
            }
        });
        return issues;
    }

    validateStudentWeeklyHours(schedule){
        const issues = [];
        const weeklyHoursByStaff = {};
        const sampleDateByWeek = {};
        Object.entries(schedule).forEach(([dateStr, day]) => {
            const weekNum = getWeekNumber(parseYMD(dateStr));
            if (!sampleDateByWeek[weekNum]) sampleDateByWeek[weekNum] = dateStr;
            Object.entries(day.assignments||{}).forEach(([shiftKey, staffId]) => {
                const hours = SHIFTS[shiftKey]?.hours || 0;
                weeklyHoursByStaff[staffId] = weeklyHoursByStaff[staffId] || {};
                weeklyHoursByStaff[staffId][weekNum] = (weeklyHoursByStaff[staffId][weekNum] || 0) + hours;
            });
        });
        (appState.staffData||[]).forEach(staff => {
            if (staff.role !== 'student') return;
            Object.entries(weeklyHoursByStaff[staff.id]||{}).forEach(([week, h]) => {
                const sampleDate = sampleDateByWeek[week];
                const maxWeekly = sampleDate ? getStudentWeeklyCapSync(sampleDate) : (APP_CONFIG?.STUDENT_MAX_WEEKLY_HOURS_LECTURE ?? 20);
                if (h > maxWeekly + (APP_CONFIG?.FLOAT_PRECISION_OFFSET||0)){
                    issues.push({ type:'student', severity:'warning', staffId:staff.id, message:`Student weekly hours ${h}h exceed ${maxWeekly}h (KW${week})` });
                }
            });
        });
        return issues;
    }

    validateRestPeriods(schedule) {
        const issues = [];
        const lastEndTime = {};

        Object.entries(schedule)
            .sort(([a], [b]) => a.localeCompare(b))
            .forEach(([dateStr, day]) => {
                Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                    const shift = SHIFTS[shiftKey];
                    const [startTime] = shift.time.split('-');
                    const start = parseShiftTime(dateStr, startTime);

                    if (lastEndTime[staffId]) {
                        const rest = (start - lastEndTime[staffId]) / (1000 * 60 * 60);
                        if (rest < APP_CONFIG.MIN_REST_HOURS) {
                            issues.push({
                                type: 'rest',
                                severity: 'error',
                                staffId,
                                dateStr,
                                shiftKey,
                                message: `Insufficient rest period (${rest.toFixed(1)}h)`
                            });
                        }
                    }

                    const [_, endTime] = shift.time.split('-');
                    lastEndTime[staffId] = parseShiftTime(dateStr, endTime);
                });
            });

        return issues;
    }

    validateWeekendDistribution(schedule) {
        const issues = [];
        const weekendCounts = {};

        Object.entries(schedule).forEach(([dateStr, day]) => {
            const date = parseYMD(dateStr);
            const isWeekend = [0, 6].includes(date.getDay());
            if (!isWeekend) return;

            Object.values(day.assignments || {}).forEach(staffId => {
                weekendCounts[staffId] = (weekendCounts[staffId] || 0) + 1;
            });
        });

        appState.staffData.forEach(staff => {
            if (staff.role === 'permanent') return;

            const count = weekendCounts[staff.id] || 0;
            const minWe = APP_CONFIG.MIN_WEEKENDS_PER_MONTH ?? 1;
            const maxWe = APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE ?? 2;
            const weekendOnly = this.isWeekendOnlyAvailability(staff, schedule);

            if (count < minWe) {
                issues.push({
                    type: 'weekend',
                    severity: 'warning',
                    staffId: staff.id,
                    message: `Too few weekend shifts (${count}/${minWe})`
                });
            }

            if (!staff.weekendPreference && !weekendOnly && count > maxWe) {
                issues.push({
                    type: 'weekend',
                    severity: 'warning',
                    staffId: staff.id,
                    message: `Exceeds max weekends (${count}/${maxWe})`
                });
            }
        });

        return issues;
    }

    // Check assignments don't fall on vacation or illness dates
    validateAbsenceConflicts(schedule){
        const issues = [];
        const inPeriods = (dateStr, periods=[]) => {
            if (!Array.isArray(periods) || periods.length===0) return false;
            const t = parseYMD(dateStr).getTime();
            for (const p of periods){
                if (!p?.start || !p?.end) continue;
                const s = parseYMD(p.start).getTime();
                const e = parseYMD(p.end).getTime();
                if (t>=s && t<=e) return true;
            }
            return false;
        };
        Object.entries(schedule).forEach(([dateStr, day])=>{
            Object.entries(day.assignments || {}).forEach(([shiftKey, staffId])=>{
                const vac = appState.vacationsByStaff?.[staffId] || [];
                const ill = appState.illnessByStaff?.[staffId] || [];
                if (inPeriods(dateStr, vac)){
                    issues.push({ type:'absence', severity:'error', staffId, dateStr, shiftKey, message:'Assignment on vacation day' });
                }
                if (inPeriods(dateStr, ill)){
                    issues.push({ type:'absence', severity:'error', staffId, dateStr, shiftKey, message:'Assignment on sick day' });
                }
            });
        });
        return issues;
    }

    // Typical workdays weekly deviation checks
    validateTypicalWorkdays(schedule){
        const issues = [];
        const daysPerWeek = {};
        Object.entries(schedule).forEach(([dateStr, day])=>{
            const weekNum = getWeekNumber(parseYMD(dateStr));
            const seen = new Set();
            Object.values(day.assignments || {}).forEach(staffId => { seen.add(staffId); });
            seen.forEach(staffId => {
                daysPerWeek[weekNum] = daysPerWeek[weekNum] || {};
                daysPerWeek[weekNum][staffId] = (daysPerWeek[weekNum][staffId] || 0) + 1;
            });
        });
        const maxExtra = APP_CONFIG.MAX_EXTRA_DAYS_ALLOWED ?? 1;
        const hardCap = APP_CONFIG.MAX_EXTRA_DAYS_HARD_CAP ?? 2;
        (appState.staffData||[]).forEach(staff=>{
            const typical = Number(staff.typicalWorkdays || 0);
            if (!typical) return;
            Object.entries(daysPerWeek).forEach(([weekNum, map])=>{
                const days = map[staff.id] || 0;
                if (days > typical + hardCap){
                    issues.push({ type:'typicalDays', severity:'error', staffId:staff.id, message:`Week ${weekNum}: ${days} days assigned (typical ${typical}+${hardCap})` });
                } else if (days > typical + maxExtra){
                    issues.push({ type:'typicalDays', severity:'warning', staffId:staff.id, message:`Week ${weekNum}: ${days} days exceeds typical (${typical}+${maxExtra})` });
                } else if (typical - days > 1){
                    issues.push({ type:'typicalDays', severity:'warning', staffId:staff.id, message:`Week ${weekNum}: only ${days} days (typical ${typical})` });
                }
            });
        });
        return issues;
    }

    validateStudentRules(schedule) {
        const issues = [];
    const weekdayDaytime = {};
    const weekdayEvenings = {};
    const weekendShifts = {};

        Object.entries(schedule).forEach(([dateStr, day]) => {
            const date = parseYMD(dateStr);
            const isWeekday = ![0, 6].includes(date.getDay());
            const weekNum = getWeekNumber(date);

            if (isWeekday) {
                Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                    const staff = appState.staffData.find(s => s.id === staffId);
                    if (staff?.role !== 'student') return;

                    if (shiftKey === 'early' || shiftKey === 'midday') {
                        weekdayDaytime[staffId] = weekdayDaytime[staffId] || {};
                        weekdayDaytime[staffId][weekNum] = (weekdayDaytime[staffId][weekNum] || 0) + 1;

                        if (weekdayDaytime[staffId][weekNum] > APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS) {
                            issues.push({
                                type: 'student',
                                severity: 'warning',
                                staffId,
                                weekNum,
                                message: `Too many daytime shifts in week ${weekNum}`
                            });
                        }
                    }
                    if (shiftKey === 'evening' || shiftKey === 'closing') {
                        weekdayEvenings[staffId] = weekdayEvenings[staffId] || {};
                        weekdayEvenings[staffId][weekNum] = (weekdayEvenings[staffId][weekNum] || 0) + 1;
                    }
                });
            }
            // Weekend distribution for students
            else {
                Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                    const staff = appState.staffData.find(s => s.id === staffId);
                    if (staff?.role !== 'student') return;
                    weekendShifts[staffId] = (weekendShifts[staffId] || 0) + 1;
                });
            }
        });

        // Ratio guidance: encourage more evenings/weekends relative to weekday daytime for students
        const monthDays = this.getDaysInMonth();
        const weeksApprox = Math.ceil(monthDays / 7);
        (appState.staffData||[]).forEach(staff => {
            if (staff.role !== 'student') return;
            const totalDaytime = Object.values(weekdayDaytime[staff.id]||{}).reduce((a,b)=>a+b,0);
            const totalEvening = Object.values(weekdayEvenings[staff.id]||{}).reduce((a,b)=>a+b,0);
            const totalWeekend = weekendShifts[staff.id] || 0;
            // Warn if daytime significantly exceeds (evening + weekend)
            if (totalDaytime > (totalEvening + totalWeekend)) {
                issues.push({
                    type: 'student',
                    severity: 'warning',
                    staffId: staff.id,
                    message: `Student ratio: daytime (${totalDaytime}) exceeds evenings+weekends (${totalEvening + totalWeekend})`
                });
            }
        });

        return issues;
    }

    consolidateIssues(schedule, issues) {
        const result = { ...schedule };

        Object.entries(result).forEach(([dateStr, day]) => {
            day.blockers = {};
            day.warnings = {};

            Object.entries(day.assignments || {}).forEach(([shiftKey, staffId]) => {
                const staffIssues = Object.values(issues)
                    .flat()
                    .filter(i => i.staffId === staffId && 
                                (!i.dateStr || i.dateStr === dateStr) &&
                                (!i.shiftKey || i.shiftKey === shiftKey));

                if (staffIssues.some(i => i.severity === 'error')) {
                    day.blockers[shiftKey] = staffIssues
                        .filter(i => i.severity === 'error')
                        .map(i => i.message)
                        .join('; ');
                }

                if (staffIssues.some(i => i.severity === 'warning')) {
                    day.warnings[shiftKey] = staffIssues
                        .filter(i => i.severity === 'warning')
                        .map(i => i.message)
                        .join('; ');
                }
            });
        });

        return result;
    }

    getWeeklyTarget(staff) {
        return (staff.weeklyHours ?? staff.contractHours ?? 0);
    }

    getMonthlyTarget(staff) {
        const weeklyTarget = this.getWeeklyTarget(staff);
        if (!weeklyTarget) return 0;
        const daysInMonth = this.getDaysInMonth();
        let weekdayCount = 0;
        for (let d=1; d<=daysInMonth; d++){
            const dt = new Date(this.year, this.monthNum-1, d);
            const dow = dt.getDay(); // 0 Sun .. 6 Sat
            if (dow!==0 && dow!==6) weekdayCount++;
        }
        // Scale weekly hours by proportion of weekdays relative to a standard 5-day week
        return weeklyTarget * (weekdayCount / 5);
    }

    getDaysInMonth() {
        return new Date(this.year, this.monthNum, 0).getDate();
    }
}

// Helper: Determine if staff has weekend-only availability for the month
// Uses appState.availabilityData, counting days with any 'yes' or 'prefer' per-shift.
ScheduleValidator.prototype.isWeekendOnlyAvailability = function(staff, schedule){
    const [year, monthNum] = this.month.split('-').map(Number);
    const daysInMonth = new Date(year, monthNum, 0).getDate();
    let hasWeekendAvail = false;
    let hasWeekdayAvail = false;
    for (let day=1; day<=daysInMonth; day++){
        const ds = `${year}-${String(monthNum).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        const perShift = appState.availabilityData?.[staff.id]?.[ds];
        if (!perShift) continue;
        const anyYes = Object.values(perShift).some(v => v==='yes' || v==='prefer');
        if (!anyYes) continue;
        const dow = parseYMD(ds).getDay();
        const isWE = dow===0 || dow===6;
        if (isWE) hasWeekendAvail = true; else hasWeekdayAvail = true;
    }
    return hasWeekendAvail && !hasWeekdayAvail;
};
