import { state } from './state.js';
import { saveData } from './storage.js';

/*
 * Core Scheduler Logic
 * This file contains the main scheduling functionality separated from the UI
 */
const APP_CONFIG = {
  // === Monthly targeting (global) ===
  DEFAULT_MONTH_TOLERANCE: 4,  // Fallback if role not listed
  MONTH_TOLERANCE_BY_ROLE: {
    minijob:   4,
    student:   4,
    permanent: 2
    },
  FLOAT_PRECISION_OFFSET: 1e-6, //
  EVENING_OPTIONAL_DAYS: [2, 4], // Tue, Thu

  // Shift priority levels for hour conservation
  CRITICAL_SHIFTS: ['early', 'midday', 'closing'], // Must be filled on weekdays
  OPTIONAL_SHIFTS: ['evening'], // Can be skipped on Tue/Thu to save hours
  WEEKEND_SHIFTS_CRITICAL: true, // All weekend shifts are critical

  // Hour conservation settings
  HOUR_CONSERVATION_ENABLED: true,
  HOUR_CONSERVATION_THRESHOLD: 1.5, // Hours per remaining day threshold for conservation

  // Fairness settings
  FAIRNESS_ENABLED: true,
  STUDENT_MAX_EXTRA_DAYS_PER_WEEK: 1,
  TYPICAL_DAYS_PENALTY: 200, // Base penalty for exceeding typical workdays
  EXTRA_DAY_PENALTY: 100, // Additional penalty per extra day worked
  FAIRNESS_OVERRIDE_THRESHOLD: 0.5, // Allow override if monthly target <50% achieved
  MAX_EXTRA_DAYS_ALLOWED: 1,
  MAX_EXTRA_DAYS_HARD_CAP: 2,
  SECOND_EXTRA_DAY_SHIFT_KEY: 'evening',

  // Student weekday daytime limits (during term)
  STUDENT_WEEKDAY_DAYTIME_ENABLED: true,
  STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS: 1, // Max early/midday shifts per week during term
  STUDENT_WEEKDAY_DAYTIME_PENALTY: 300, // Heavy penalty for exceeding weekday daytime limit

  // Student strategic preferences (configurable weights)
  STUDENT_WEEKEND_BONUS: 60, // Bonus for weekend shifts
  STUDENT_EVENING_BONUS: 80, // Bonus for evening shifts
  STUDENT_WEEKDAY_DAYTIME_PENALTY_PREF: -50, // Preference penalty for weekday daytime

  // Student exception tracking
  STUDENT_MAX_EXCEPTION_WEEKS_PER_TERM: 2, // Max automatic >20h exception weeks per term
  STUDENT_EXCEPTION_REQUIRES_CRITICAL_SHIFT: true, // Only allow auto exception for critical shifts

  // Weekend saturation (prevent Sat+Sun for same staff)
  WEEKEND_SATURATION_PENALTY: 250, // Heavy penalty when staff already works the other day of the weekend

  // Academic term configuration (Hessen universities)
  ACADEMIC_TERM_CONFIG: {
    // Winter semester: October 1 - March 31 (next year)
    WINTER_START_MONTH: 10, // October
    WINTER_START_DAY: 1,
    WINTER_END_MONTH: 3, // March (next year)
    WINTER_END_DAY: 31,

    // Summer semester: April 1 - September 30
    SUMMER_START_MONTH: 4, // April
    SUMMER_START_DAY: 1,
    SUMMER_END_MONTH: 9, // September
    SUMMER_END_DAY: 30,

    // Lecture periods (stricter limits during these times)
    WINTER_LECTURE_START: { month: 10, day: 15 }, // Mid-October
    WINTER_LECTURE_END: { month: 2, day: 15 }, // Mid-February (next year)
    SUMMER_LECTURE_START: { month: 4, day: 15 }, // Mid-April
    SUMMER_LECTURE_END: { month: 7, day: 15 } // Mid-July
  },

  // Weekend distribution settings (applies to minijob and student employees only)
  WEEKEND_DISTRIBUTION_ENABLED: true,
  MIN_WEEKENDS_PER_MONTH: 1, // Minimum weekends each non-permanent employee must work
  MAX_WEEKENDS_WITHOUT_PREFERENCE: 2, // Max weekends for non-preferring non-permanent employees
  WEEKEND_PREFERENCE_BONUS: 50, // Bonus for employees who prefer weekends (all types)
  WEEKEND_FAIRNESS_PENALTY: 100, // Penalty for unfair weekend distribution (non-permanent only)

  // Permanent employee weekend preference system
  // - If weekendPreference: true, weekend shifts count as regular hours (not overtime)
  // - If weekendPreference: false/undefined, weekend shifts require overtime consent
  // - Weekend-preferring permanent employees get positive scoring for weekend shifts
  // - Monthly targets include weekend days for weekend-preferring employees

  // Alternative weekend functionality (PLACEHOLDER - currently disabled)
  // TODO: Enable when weekend-preferring employees need guaranteed rest days
  ALTERNATIVE_WEEKEND_ENABLED: false, // Set to true to activate alternative weekend functionality
  ALTERNATIVE_WEEKEND_OVERTIME_PENALTY: 100, // Penalty for scheduling on alternative weekend days
  ALTERNATIVE_WEEKEND_REQUIRES_CONSENT: true, // Whether alternative weekend work requires overtime consent

  FULL_TIME_VACATION_DAYS: 30, // Annual vacation days for a 5-day/week employee

  MINIJOB_MAX_EARNING: 556,
  // Optional per-person override in future: use (staff.hourlyWage ?? APP_CONFIG.MINIJOB_HOURLY_WAGE)
  MINIJOB_HOURLY_WAGE: 13.50,

  WERKSTUDENT_MAX_HOURS: 20,
  WERKSTUDENT_EXCEPTION_ENABLED: true,
  WERKSTUDENT_EXCEPTION_NIGHTWE_RATIO: 0.5, // >=50% WE or closing hours unlock >20h

  HOLIDAY_API_STATE: 'HE',
  UNDESIRABLE_SHIFTS: ['closing', 'weekend-early', 'weekend-late', 'evening'],
  MIN_REST_HOURS: 11,
  MAX_CONSECUTIVE_DAYS: 6,

  PERMANENT_HOURS_TOLERANCE: 4,     // weekly ±4h


  // Minijob steering (weekly ~10h)
  MINIJOB_TARGET_WEEK_HOURS: 10,
  MINIJOB_MAX_WEEK_HOURS: 15, // Hard weekly limit for legal compliance
  MINIJOB_WEEK_TOLERANCE: 1.5,
  MINIJOB_STEER_PENALTY: 6,
  MINIJOB_THIRD_SHIFT_PENALTY: 50,
  MINIJOB_TOPUP_BONUS: 35,

  // Add role-specific constraints
  ROLE_CONSTRAINTS: {
    permanent: {
      minDaysPerWeek: 4,
      maxHoursPerDay: 10,
      requiresOvertimeConsent: true
    },
    student: {
      maxDaysPerWeek: 5,
      maxHoursPerDay: 8,
      maxWeekdayDaytime: 1  // Max weekday early/midday shifts during term
    },
    minijob: {
      maxDaysPerWeek: 3,
      maxHoursPerDay: 8,
      maxWeeklyHours: 15
    }
  },

  // Add holiday handling config
  HOLIDAY_HANDLING: {
    allowDoubleShifts: false,  // Whether one person can work both holiday shifts
    requiresConsent: true,     // Whether holiday work requires explicit consent
    consentByRole: {           // Role-specific consent requirements
      permanent: true,
      student: false,
      minijob: false
    },
    bonusScore: 40            // Scoring bonus for holiday availability
  }
};

const SHIFTS = {
  'early':           { name: 'Früh',          time: '06:45-12:00', type: 'weekday', hours: 5.25 },
  'midday':          { name: 'Mittel',        time: '11:45-17:00', type: 'weekday', hours: 5.25 },
  'evening':         { name: 'Abend',         time: '17:00-20:30', type: 'weekday', hours: 3.5 },
  'closing':         { name: 'Spät',          time: '16:45-22:15', type: 'weekday', hours: 5.5 },
  'weekend-early':   { name: 'WE Früh',       time: '08:45-14:35', type: 'weekend', hours: 5.83 },
  'weekend-late':    { name: 'WE Spät',       time: '14:25-20:15', type: 'weekend', hours: 5.83 },
  'holiday-early':   { name: 'Feiertag Früh', time: '08:45-13:15', type: 'holiday', hours: 4.5 },
  'holiday-late':    { name: 'Feiertag Spät', time: '13:05-17:15', type: 'holiday', hours: 4.17 }
};

// Add safe date parsing helper
const parseYMD = (s) => {
    const [y, m, d] = s.split('-').map(Number);
    return new Date(y, m - 1, d);
};

/**
 * Core scheduling class that handles schedule creation and validation
 */
class Schedule {
    constructor(month) {
        this.month = month;
        this.data = state.scheduleData[month] || {};
        
        const [year, monthNum] = month.split('-').map(Number);
        this.year = year;
        this.monthNum = monthNum;
        this.daysInMonth = new Date(year, monthNum, 0).getDate();
    }

    // Get all possible shifts for a specific date
    getShiftsForDate(dateStr) {
        const date = parseYMD(dateStr);
        const isWeekend = [0, 6].includes(date.getDay());
        const isHoliday = state.holidays[this.year]?.[dateStr];

        if (isHoliday) {
            return Object.entries(SHIFTS)
                .filter(([_, shift]) => shift.type === 'holiday')
                .map(([key]) => key);
        }

        if (isWeekend) {
            return Object.entries(SHIFTS)
                .filter(([_, shift]) => shift.type === 'weekend')
                .map(([key]) => key);
        }

        return Object.entries(SHIFTS)
            .filter(([_, shift]) => shift.type === 'weekday')
            .map(([key]) => key);
    }

    // Add or update a shift assignment
    setAssignment(dateStr, shiftKey, staffId) {
        if (!this.data[dateStr]) {
            this.data[dateStr] = {
                assignments: {},
                holidayName: state.holidays[this.year]?.[dateStr] || null
            };
        }
        this.data[dateStr].assignments[shiftKey] = staffId;
    }

    // Get the current assignment for a shift
    getAssignment(dateStr, shiftKey) {
        return this.data[dateStr]?.assignments?.[shiftKey] || null;
    }

    // Save the schedule to global state
    save() {
        state.scheduleData[this.month] = this.data;
        saveData(); // This will be implemented later
    }
}

/**
 * Handles the core scheduling algorithm and logic
 * This separates the scheduling rules from the data management
 */
class SchedulingEngine {
    constructor(month) {
        this.month = month;
        const [year, monthNum] = month.split('-').map(Number);
        this.year = year;
        this.monthNum = monthNum;
        this.daysInMonth = new Date(year, monthNum, 0).getDate();
        
        // Initialize tracking objects
        this.staffShiftCounts = {};
        this.staffHoursByWeek = {};
        this.monthlyHours = {};
        this.staffNWHoursByWeek = {};
        this.consecutiveDaysWorked = {};
        this.lastShiftEndTimes = {};
        this.daysWorkedThisWeek = {};
        
        // Add weekend tracking
        this.staffWeekendDates = {};
        state.staffData.forEach(s => {
            this.staffWeekendDates[s.id] = new Set();
            if (!state.weekendAssignments[this.month]) {
                state.weekendAssignments[this.month] = {};
            }
            state.weekendAssignments[this.month][s.id] = 0; // Store counts, not Sets
        });

        // Initialize staff tracking using state
        state.staffData.forEach(s => {
            this.staffShiftCounts[s.id] = { total: 0 };
            this.staffHoursByWeek[s.id] = {};
            this.monthlyHours[s.id] = 0;
            this.staffNWHoursByWeek[s.id] = {};
            this.consecutiveDaysWorked[s.id] = 0;
            this.daysWorkedThisWeek[s.id] = 0;
        });

        // Initialize weekend tracking for new month
        if (!state.weekendAssignments[this.month]) {
            state.weekendAssignments[this.month] = {};
        }

        // Add target caching
        this.targetCache = new Map();

        // Add logger
        this.logger = new SchedulerLogger();
        
        // Add error tracking
        this.errors = [];
    }

    // Helper method to check if a shift is critical
    isShiftCritical(date, shiftKey) {
        const dateStr = this.toLocalISODate(date);
        const isHoliday = state.holidays[this.year]?.[dateStr];

        if (isHoliday) {
            return APP_CONFIG.NON_WEEKDAY_SHIFTS_CRITICAL;
        }
        if (APP_CONFIG.CRITICAL_SHIFTS.includes(shiftKey)) {
            return true;
        }
        if (this.isOptionalEvening(date, shiftKey)) {
            return false;
        }
        return true;
    }

    // Helper to check if evening shift can be skipped
    isOptionalEvening(dateObj, shiftKey) {
        return shiftKey === 'evening' && APP_CONFIG.EVENING_OPTIONAL_DAYS.includes(dateObj.getDay());
    }

    // Add weekend tracking methods
    isWeekendShift(shiftKey) {
        return shiftKey.startsWith('weekend-');
    }

    isWeekend(dateStr) {
        const date = parseYMD(dateStr);
        return [0, 6].includes(date.getDay());
    }

    getWeekendKey(dateStr) {
        const date = parseYMD(dateStr);
        const weekNum = this.getWeekNumber(date);
        return `${this.month}-W${weekNum}`;
    }

    trackWeekendAssignment(staff, dateStr) {
        // Track the weekend key for saturation checks
        const weekendKey = this.getWeekendKey(dateStr);
        if (!this.staffWeekendDates[staff.id]) {
            this.staffWeekendDates[staff.id] = new Set();
        }
        this.staffWeekendDates[staff.id].add(weekendKey);

        // Update the count in state (not a Set)
        if (!state.weekendAssignments[this.month]) {
            state.weekendAssignments[this.month] = {};
        }
        if (!state.weekendAssignments[this.month][staff.id]) {
            state.weekendAssignments[this.month][staff.id] = 0;
        }
        
        // Only increment if this is a new weekend
        if (!this.staffWeekendDates[staff.id].has(weekendKey)) {
            state.weekendAssignments[this.month][staff.id]++;
        }
    }

    // Core scheduling method
    generateSchedule() {
        const schedule = new Schedule(this.month);
        let currentWeek = -1;

        for (let day = 1; day <= this.daysInMonth; day++) {
            const date = new Date(this.year, this.monthNum - 1, day); // This is safe as we control year/month/day
            const dateStr = this.toLocalISODate(date);
            const weekNum = this.getWeekNumber(date);
            
            // Reset weekly counters if new week
            if (weekNum !== currentWeek) {
                currentWeek = weekNum;
                Object.keys(this.daysWorkedThisWeek).forEach(staffId => {
                    this.daysWorkedThisWeek[staffId] = 0;
                });
            }

            // Get possible shifts for this day
            const shiftsForDay = schedule.getShiftsForDate(dateStr);
            const scheduledToday = new Set();

            // Process each shift
            for (const shiftKey of shiftsForDay) {
                const candidates = this.findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum);
                
                // Skip optional shifts if no suitable candidates
                if (candidates.length === 0 && !this.isShiftCritical(date, shiftKey)) {
                    continue;
                }

                if (candidates.length > 0) {
                    const chosen = this.selectBestCandidate(candidates);
                    this.assignShift(schedule, dateStr, shiftKey, chosen.staff, weekNum);
                    scheduledToday.add(chosen.staff.id);
                }
            }

            // Update consecutive days tracking
            this.updateConsecutiveDays(scheduledToday);
        }

        return schedule;
    }

    // === Date Utilities ===
    toLocalISODate(date) {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    // === Candidate Finding and Scoring ===
    findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum) {
        const candidates = [];
        const shiftHours = SHIFTS[shiftKey].hours;

        state.staffData.forEach(staff => {
            if (scheduledToday.has(staff.id)) return;
            
            const score = this.calculateStaffScore(staff, dateStr, shiftKey, weekNum, shiftHours);
            if (score.ok) {
                candidates.push({ staff, score: score.value });
            }
        });

        return candidates.sort((a, b) => b.score - a.score);
    }

    calculateStaffScore(staff, dateStr, shiftKey, weekNum, shiftHours) {
        // Check basic availability and constraints
        if (!this.isStaffAvailable(staff, dateStr, shiftKey)) {
            return { ok: false };
        }

        const currentWeekHours = this.staffHoursByWeek[staff.id][weekNum] || 0;
        const currentMonthHours = this.monthlyHours[staff.id];
        
        // Calculate score based on various factors
        let score = this.getBaseScore(staff, dateStr, shiftKey);
        
        // Apply workload balancing
        score += this.getWorkloadScore(staff, currentWeekHours, currentMonthHours, shiftHours);
        
        // Apply fairness rules
        score += this.getFairnessScore(staff, dateStr, weekNum);

        return { ok: true, value: score };
    }

    // === Scoring Methods ===
    getBaseScore(staff, dateStr, shiftKey) {
        let score = 0;
        const availability = state.availabilityData[staff.id]?.[dateStr]?.[shiftKey];
        
        // Preference bonus
        if (availability === 'prefer') {
            score += 100;
        }

        // Role-specific bonuses
        if (staff.role === 'student') {
            score += this.getStudentRoleBonus(shiftKey, dateStr);
        }

        // Weekend preference bonus
        if (this.isWeekendShift(shiftKey) && staff.weekendPreference) {
            score += APP_CONFIG.WEEKEND_PREFERENCE_BONUS;
        }

        return score;
    }

    getWorkloadScore(staff, weekHours, monthHours, shiftHours) {
        let score = 0;
        
        // Weekly hours balance
        const weeklyTarget = this.getWeeklyTarget(staff);
        if (weekHours + shiftHours <= weeklyTarget) {
            score += 50; // Bonus for staying within target
        } else {
            score -= (weekHours + shiftHours - weeklyTarget) * 10;
        }

        // Monthly balance
        const monthlyTarget = this.getMonthlyTarget(staff);
        const monthlyProgress = monthHours / monthlyTarget;
        if (monthlyProgress < 0.8) {
            score += 30; // Priority for under-scheduled staff
        }

        // Minijob earning limits
        if (staff.role === 'minijob') {
            score += this.getMinijobWorkloadScore(monthHours, shiftHours);
        }

        return score;
    }

    // Merged getFairnessScore combining both weekend and standard fairness rules
    getFairnessScore(staff, dateStr, weekNum) {
        let score = 0;
        const isWeekend = this.isWeekend(dateStr);

        if (isWeekend && APP_CONFIG.WEEKEND_DISTRIBUTION_ENABLED) {
            // Weekend saturation check
            const weekendKey = this.getWeekendKey(dateStr);
            const hasOtherDayThisWeekend = this.staffWeekendDates?.[staff.id]?.has(weekendKey);
            
            if (hasOtherDayThisWeekend) {
                score -= APP_CONFIG.WEEKEND_SATURATION_PENALTY;
            }

            // Add weekend balance scoring
            score += this.getWeekendBalanceScore(staff, dateStr);
            score += this.getWeekendFairnessScore(staff, this.month);
        }

        // Extra days penalty
        if (this.daysWorkedThisWeek[staff.id] >= staff.typicalDays) {
            score -= APP_CONFIG.TYPICAL_DAYS_PENALTY;
            score -= (this.daysWorkedThisWeek[staff.id] - staff.typicalDays) * APP_CONFIG.EXTRA_DAY_PENALTY;
        }

        // Student weekday daytime limits
        if (staff.role === 'student' && APP_CONFIG.STUDENT_WEEKDAY_DAYTIME_ENABLED) {
            score += this.getStudentDaytimeScore(staff, dateStr, weekNum);
        }

        return score;
    }

    // === Scoring Helper Methods ===
    getStudentRoleBonus(shiftKey, dateStr) {
        let bonus = 0;
        // Use parseYMD instead of direct Date constructor
        const date = parseYMD(dateStr);
        const isWeekend = [0, 6].includes(date.getDay());

        if (isWeekend) {
            bonus += APP_CONFIG.STUDENT_WEEKEND_BONUS;
        }
        if (shiftKey === 'evening' || shiftKey === 'closing') {
            bonus += APP_CONFIG.STUDENT_EVENING_BONUS;
        }
        if (!isWeekend && (shiftKey === 'early' || shiftKey === 'midday')) {
            bonus += APP_CONFIG.STUDENT_WEEKDAY_DAYTIME_PENALTY_PREF;
        }

        return bonus;
    }

    getMinijobWorkloadScore(currentHours, additionalHours) {
        const projectedEarnings = (currentHours + additionalHours) * APP_CONFIG.MINIJOB_HOURLY_WAGE;
        
        if (projectedEarnings > APP_CONFIG.MINIJOB_MAX_EARNING) {
            return -1000; // Strong penalty for exceeding earning limit
        }

        // Bonus for optimal utilization
        const utilizationRatio = projectedEarnings / APP_CONFIG.MINIJOB_MAX_EARNING;
        if (utilizationRatio > 0.8 && utilizationRatio < 0.95) {
            return APP_CONFIG.MINIJOB_TOPUP_BONUS;
        }

        return 0;
    }

    getWeekendFairnessScore(staff, month) {
        const currentCount = state.weekendAssignments[month]?.[staff.id] || 0;
        
        if (currentCount < APP_CONFIG.MIN_WEEKENDS_PER_MONTH) {
            return 50; // Bonus for staff under minimum
        }
        if (!staff.weekendPreference && currentCount >= APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE) {
            return -APP_CONFIG.WEEKEND_FAIRNESS_PENALTY;
        }
        
        return 0;
    }

    getStudentDaytimeScore(staff, dateStr, weekNum) {
        const currentDaytimeShifts = state.studentWeekdayDaytimeShifts[this.month]?.[staff.id]?.[weekNum] || 0;
        
        if (currentDaytimeShifts >= APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS) {
            return -APP_CONFIG.STUDENT_WEEKDAY_DAYTIME_PENALTY;
        }
        
        return 0;
    }

    // === Assignment and Tracking ===
    assignShift(schedule, dateStr, shiftKey, staff, weekNum) {
        try {
            // Validate business rules before assignment
            this.validateBusinessRules(dateStr, staff, SHIFTS[shiftKey].hours);
            
            const hours = SHIFTS[shiftKey].hours;
            schedule.setAssignment(dateStr, shiftKey, staff.id);
            
            // Update tracking
            this.staffShiftCounts[staff.id].total++;
            this.monthlyHours[staff.id] = (this.monthlyHours[staff.id] || 0) + hours;
            
            if (!this.staffHoursByWeek[staff.id][weekNum]) {
                this.staffHoursByWeek[staff.id][weekNum] = 0;
            }
            this.staffHoursByWeek[staff.id][weekNum] += hours;

            // Fix syntax error in if condition
            if (this.isNightWeekendShift(shiftKey)) {
                if (!this.staffNWHoursByWeek[staff.id][weekNum]) {
                    this.staffNWHoursByWeek[staff.id][weekNum] = 0;
                }
                this.staffNWHoursByWeek[staff.id][weekNum] += hours;
            }

            // Track weekend assignments if applicable
            if (this.isWeekend(dateStr)) {
                this.trackWeekendAssignment(staff, dateStr);
            }

            // Track student daytime shifts during term
            if (staff.role === 'student' && 
                this.isInAcademicTerm(dateStr) && 
                !this.isWeekend(dateStr) &&
                (shiftKey === 'early' || shiftKey === 'midday')) {
                
                if (!state.studentWeekdayDaytimeShifts[this.month]) {
                    state.studentWeekdayDaytimeShifts[this.month] = {};
                }
                if (!state.studentWeekdayDaytimeShifts[this.month][staff.id]) {
                    state.studentWeekdayDaytimeShifts[this.month][staff.id] = {};
                }
                if (!state.studentWeekdayDaytimeShifts[this.month][staff.id][weekNum]) {
                    state.studentWeekdayDaytimeShifts[this.month][staff.id][weekNum] = 0;
                }
                
                state.studentWeekdayDaytimeShifts[this.month][staff.id][weekNum]++;
            }

            // Update last shift end time
            const [startTime, endTime] = SHIFTS[shiftKey].time.split('-');
            this.lastShiftEndTimes[staff.id] = this.parseShiftTime(dateStr, endTime);

            this.logger.log(LogLevel.INFO, 'Shift assigned', {
                date: dateStr,
                shift: shiftKey,
                staff: staff.id
            });
        } catch (e) {
            if (e instanceof SchedulerError) {
                this.errors.push(e);
                this.logger.log(LogLevel.ERROR, e.message, e.details);
            }
            throw e;
        }
    }

    updateConsecutiveDays(scheduledToday) {
        state.staffData.forEach(staff => {
            if (scheduledToday.has(staff.id)) {
                this.consecutiveDaysWorked[staff.id] = (this.consecutiveDaysWorked[staff.id] || 0) + 1;
                this.daysWorkedThisWeek[staff.id] = (this.daysWorkedThisWeek[staff.id] || 0) + 1;
            } else {
                this.consecutiveDaysWorked[staff.id] = 0;
            }
        });
    }

    // === Validation Methods ===
    isStaffAvailable(staff, dateStr, shiftKey) {
        const availability = state.availabilityData[staff.id]?.[dateStr]?.[shiftKey];
        return availability === 'yes' || availability === 'prefer';
    }

    isNightWeekendShift(shiftKey) {
        return shiftKey === 'closing' || shiftKey.startsWith('weekend-');
    }

    parseShiftTime(dateStr, timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const [year, month, day] = dateStr.split('-').map(Number);
        return new Date(year, month - 1, day, hours, minutes);
    }

    // Add missing term check method
    isInAcademicTerm(dateStr) {
        if (!state.academicTermCache[dateStr]) {
            const date = parseYMD(dateStr);
            // Calculate and cache term info
            state.academicTermCache[dateStr] = this.calculateTermInfo(date);
        }
        return state.academicTermCache[dateStr].isInTerm;
    }

    calculateTermInfo(date) {
        const config = APP_CONFIG.ACADEMIC_TERM_CONFIG;
        const month = date.getMonth() + 1;
        const day = date.getDate();

        // Handle academic year spanning logic
        const isWinterTerm = (month >= config.WINTER_START_MONTH) || 
                            (month <= config.WINTER_END_MONTH);

        const termName = isWinterTerm ? 
            `winter-${date.getFullYear()}-${date.getFullYear() + 1}` :
            `summer-${date.getFullYear()}`;

        // Check if date falls within term periods
        const isInTerm = isWinterTerm ?
            this.isDateInRange(month, day, 
                config.WINTER_START_MONTH, config.WINTER_START_DAY,
                config.WINTER_END_MONTH, config.WINTER_END_DAY) :
            this.isDateInRange(month, day,
                config.SUMMER_START_MONTH, config.SUMMER_START_DAY, 
                config.SUMMER_END_MONTH, config.SUMMER_END_DAY);

        // Check if in lecture period
        const isInLecturePeriod = isWinterTerm ?
            this.isDateInRange(month, day,
                config.WINTER_LECTURE_START.month, config.WINTER_LECTURE_START.day,
                config.WINTER_LECTURE_END.month, config.WINTER_LECTURE_END.day) :
            this.isDateInRange(month, day,
                config.SUMMER_LECTURE_START.month, config.SUMMER_LECTURE_START.day,
                config.SUMMER_LECTURE_END.month, config.SUMMER_LECTURE_END.day);

        return { termName, isInTerm, isInLecturePeriod };
    }

    isDateInRange(month, day, startMonth, startDay, endMonth, endDay) {
        if (startMonth <= endMonth) {
            return (month > startMonth || (month === startMonth && day >= startDay)) &&
                   (month < endMonth || (month === endMonth && day <= endDay));
        } else {
            // Handle ranges that span year boundary
            return (month >= startMonth && day >= startDay) ||
                   (month <= endMonth && day <= endDay);
        }
    }

    // Unified target calculation system
    getWeeklyTarget(staff) {
        const cacheKey = `${staff.id}-weekly`;
        if (!this.targetCache.has(cacheKey)) {
            const baseHours = staff.weeklyHours || 0;
            const carryover = state.carryoverByStaffAndMonth[this.month]?.[staff.id] || 0;
            this.targetCache.set(cacheKey, baseHours + carryover);
        }
        return this.targetCache.get(cacheKey);
    }

    getMonthlyTarget(staff) {
        const cacheKey = `${staff.id}-monthly`;
        if (!this.targetCache.has(cacheKey)) {
            const weeklyTarget = this.getWeeklyTarget(staff);
            const workDays = this.getWorkDaysInMonth();
            const typicalDays = staff.typicalDays || 5;
            
            // Use consistent formula across all calculations
            const target = Math.round((weeklyTarget * workDays) / typicalDays);
            this.targetCache.set(cacheKey, target);
        }
        return this.targetCache.get(cacheKey);
    }

    // Remove old calculateMonthlyTarget in favor of unified system
    
    validateWorkloadLimits() {
        const issues = [];
        state.staffData.forEach(staff => {
            // Check weekly limits with proper tolerance
            Object.entries(this.staffHoursByWeek[staff.id]).forEach(([weekNum, hours]) => {
                const weeklyTarget = this.getWeeklyTarget(staff);
                const tolerance = APP_CONFIG.WEEK_TOLERANCE_BY_ROLE[staff.role] || 
                                APP_CONFIG.DEFAULT_WEEK_TOLERANCE;

                if (Math.abs(hours - weeklyTarget) > tolerance) {
                    issues.push({
                        type: 'weekly_hours',
                        staffId: staff.id,
                        weekNum,
                        hours,
                        target: weeklyTarget,
                        tolerance
                    });
                }
            });

            // Monthly target check using same calculation as scoring
            const monthlyHours = this.monthlyHours[staff.id] || 0;
            const monthlyTarget = this.getMonthlyTarget(staff);
            const tolerance = APP_CONFIG.MONTH_TOLERANCE_BY_ROLE[staff.role] || 
                            APP_CONFIG.DEFAULT_MONTH_TOLERANCE;
            
            if (Math.abs(monthlyHours - monthlyTarget) > tolerance) {
                issues.push({
                    type: 'monthly_hours',
                    staffId: staff.id,
                    hours: monthlyHours,
                    target: monthlyTarget,
                    tolerance
                });
            }

            // ...rest of existing validation code...
        });
        return issues;
    }

    // Add missing selectBestCandidate implementation
    selectBestCandidate(candidates) {
        if (candidates.length === 0) return null;
        
        return candidates.reduce((best, current) => {
            // Primary sort: score
            if (Math.abs(current.score - best.score) > APP_CONFIG.FLOAT_PRECISION_OFFSET) {
                return current.score > best.score ? current : best;
            }
            
            // Tiebreaker 1: Monthly hours (prefer less loaded staff)
            const bestHours = this.monthlyHours[best.staff.id] || 0;
            const currentHours = this.monthlyHours[current.staff.id] || 0;
            if (bestHours !== currentHours) {
                return currentHours < bestHours ? current : best;
            }
            
            // Tiebreaker 2: Staff ID (stable sort)
            return current.staff.id.localeCompare(best.staff.id) < 0 ? current : best;
        });
    }

    // Add missing getWorkDaysInMonth implementation
    getWorkDaysInMonth() {
        let workDays = 0;
        for (let day = 1; day <= this.daysInMonth; day++) {
            const date = new Date(this.year, this.monthNum - 1, day);
            const dateStr = this.toLocalISODate(date);
            if (!this.isWeekend(dateStr) && !state.holidays[this.year]?.[dateStr]) {
                workDays++;
            }
        }
        return workDays;
    }

    // Add error handling to existing methods
    assignShift(schedule, dateStr, shiftKey, staff, weekNum) {
        try {
            // Validate business rules before assignment
            this.validateBusinessRules(dateStr, staff, SHIFTS[shiftKey].hours);
            
            const hours = SHIFTS[shiftKey].hours;
            schedule.setAssignment(dateStr, shiftKey, staff.id);
            
            // Update tracking
            this.staffShiftCounts[staff.id].total++;
            this.monthlyHours[staff.id] = (this.monthlyHours[staff.id] || 0) + hours;
            
            if (!this.staffHoursByWeek[staff.id][weekNum]) {
                this.staffHoursByWeek[staff.id][weekNum] = 0;
            }
            this.staffHoursByWeek[staff.id][weekNum] += hours;

            // Fix syntax error in if condition
            if (this.isNightWeekendShift(shiftKey)) {
                if (!this.staffNWHoursByWeek[staff.id][weekNum]) {
                    this.staffNWHoursByWeek[staff.id][weekNum] = 0;
                }
                this.staffNWHoursByWeek[staff.id][weekNum] += hours;
            }

            // Track weekend assignments if applicable
            if (this.isWeekend(dateStr)) {
                this.trackWeekendAssignment(staff, dateStr);
            }

            // Track student daytime shifts during term
            if (staff.role === 'student' && 
                this.isInAcademicTerm(dateStr) && 
                !this.isWeekend(dateStr) &&
                (shiftKey === 'early' || shiftKey === 'midday')) {
                
                if (!state.studentWeekdayDaytimeShifts[this.month]) {
                    state.studentWeekdayDaytimeShifts[this.month] = {};
                }
                if (!state.studentWeekdayDaytimeShifts[this.month][staff.id]) {
                    state.studentWeekdayDaytimeShifts[this.month][staff.id] = {};
                }
                if (!state.studentWeekdayDaytimeShifts[this.month][staff.id][weekNum]) {
                    state.studentWeekdayDaytimeShifts[this.month][staff.id][weekNum] = 0;
                }
                
                state.studentWeekdayDaytimeShifts[this.month][staff.id][weekNum]++;
            }

            // Update last shift end time
            const [startTime, endTime] = SHIFTS[shiftKey].time.split('-');
            this.lastShiftEndTimes[staff.id] = this.parseShiftTime(dateStr, endTime);

            this.logger.log(LogLevel.INFO, 'Shift assigned', {
                date: dateStr,
                shift: shiftKey,
                staff: staff.id
            });
        } catch (e) {
            if (e instanceof SchedulerError) {
                this.errors.push(e);
                this.logger.log(LogLevel.ERROR, e.message, e.details);
            }
            throw e;
        }
    }

    // Add business rule validation
    validateBusinessRules(dateStr, staff, hours) {
        const date = parseYMD(dateStr);
        
        Object.values(BUSINESS_RULES).forEach(rule => {
            if (!rule.validate(date, staff, this)) {
                throw new SchedulerError(
                    'constraint',
                    rule.id,
                    `Business rule violation: ${rule.description}`,
                    { staffId: staff.id, date: dateStr }
                );
            }
        });
    }

    // === Error Handling and Logging ===
}

/**
 * @typedef {Object} SchedulingError
 * @property {string} type - Error category (validation|assignment|constraint)
 * @property {string} code - Specific error code
 * @property {string} message - Human readable message
 * @property {Object} [details] - Additional context
 */

/**
 * @typedef {Object} BusinessRule
 * @property {string} id - Rule identifier
 * @property {string} description - Rule description
 * @property {function} validate - Validation function
 */

class SchedulerError extends Error {
    constructor(type, code, message, details = {}) {
        super(message);
        this.type = type;
        this.code = code;
        this.details = details;
    }
}

// Add core business rules documentation and validation
const BUSINESS_RULES = {
    REST_PERIOD: {
        id: 'REST_PERIOD',
        description: 'Staff must have 11 hours between shifts',
        validate: (date, staff, engine) => {
            const lastEnd = engine.lastShiftEndTimes[staff.id];
            if (!lastEnd) return true;
            const hours = (date - lastEnd) / (60 * 60 * 1000);
            return hours >= APP_CONFIG.MIN_REST_HOURS;
        }
    },
    MAX_CONSECUTIVE_DAYS: {
        id: 'MAX_CONSECUTIVE_DAYS',
        description: 'Staff cannot work more than 6 consecutive days',
        validate: (staff, engine) => {
            return engine.consecutiveDaysWorked[staff.id] < APP_CONFIG.MAX_CONSECUTIVE_DAYS;
        }
    },
    STUDENT_TERM_LIMITS: {
        id: 'STUDENT_TERM_LIMITS',
        description: 'Students have restricted hours during term time',
        validate: (staff, hours, engine) => {
            if (staff.role !== 'student') return true;
            return !engine.isStudentHourLimitExceeded(staff, engine.currentWeek, hours);
        }
    }
};

const LogLevel = {
    DEBUG: 0,
    INFO: 1,
    WARN: 2,
    ERROR: 3
};

class SchedulerLogger {
    constructor(minLevel = LogLevel.INFO) {
        this.minLevel = minLevel;
        this.logs = [];
    }

    log(level, message, data = {}) {
        if (level < this.minLevel) return;
        
        const entry = {
            timestamp: new Date(),
            level,
            message,
            data
        };
        
        this.logs.push(entry);
        if (level >= LogLevel.WARN) {
            console.warn(`Scheduler: ${message}`, data);
        }
    }

    clear() {
        this.logs = [];
    }

    export() {
        return [...this.logs];
    }
}

// Clean up exports to remove state/saveData (now properly imported)
export {
    APP_CONFIG,
    SHIFTS,
    Schedule,
    SchedulingEngine,
    setupSchedulerFlush,
    SchedulerError,
    BUSINESS_RULES,
    LogLevel,
    SchedulerLogger
};