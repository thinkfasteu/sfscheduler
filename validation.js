import { APP_CONFIG, SHIFTS } from './modules/config.js';  // Updated path
import { appState } from './modules/state.js';  // Updated path and name
import { getWeekNumber, parseShiftTime } from './utils/dateUtils.js';

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
            students: this.validateStudentRules(schedule)
        };

        return this.consolidateIssues(schedule, issues);
    }

    validateWorkloadLimits(schedule) {
        const issues = [];
        const weeklyHours = {};
        const monthlyHours = {};

        // Calculate actual hours
        Object.entries(schedule).forEach(([dateStr, day]) => {
            const weekNum = getWeekNumber(new Date(dateStr));
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
                    severity: 'error',
                    staffId: staff.id,
                    message: `Month total: ${monthlyHoursTotal}h (target: ${monthlyTarget}±${tolerance})`
                });
            }
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
            const date = new Date(dateStr);
            const isWeekend = [0, 6].includes(date.getDay());
            if (!isWeekend) return;

            Object.values(day.assignments || {}).forEach(staffId => {
                weekendCounts[staffId] = (weekendCounts[staffId] || 0) + 1;
            });
        });

        appState.staffData.forEach(staff => {
            if (staff.role === 'permanent') return;

            const count = weekendCounts[staff.id] || 0;
            if (!staff.weekendPreference && count > APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE) {
                issues.push({
                    type: 'weekend',
                    severity: 'warning',
                    staffId: staff.id,
                    message: `Exceeds max weekends (${count}/${APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE})`
                });
            }
        });

        return issues;
    }

    validateStudentRules(schedule) {
        const issues = [];
        const weekdayDaytime = {};

        Object.entries(schedule).forEach(([dateStr, day]) => {
            const date = new Date(dateStr);
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
        return staff.weeklyHours || 0;
    }

    getMonthlyTarget(staff) {
        const weeklyTarget = this.getWeeklyTarget(staff);
        const weekCount = Math.ceil(this.getDaysInMonth() / 7);
        return weeklyTarget * weekCount;
    }

    getDaysInMonth() {
        return new Date(this.year, this.monthNum, 0).getDate();
    }
}
