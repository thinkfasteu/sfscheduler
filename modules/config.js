export const APP_CONFIG = {
    // Dynamic critical shifts: scheduler now treats ALL shifts as critical except 'evening' on EVENING_OPTIONAL_DAYS
    // (CRITICAL_SHIFTS deprecated)
    EVENING_OPTIONAL_DAYS: [2, 4],
    NON_WEEKDAY_SHIFTS_CRITICAL: true,
    OPTIONAL_SHIFT_MIN_SCORE: 0,
    // Bonus for permanent staff when assigned to their preferred weekday shift
    PERMANENT_PREFERRED_SHIFT_BONUS: 60,
    // Defaults for tolerances and precision used across engine/validator
    DEFAULT_WEEK_TOLERANCE: 4,
    DEFAULT_MONTH_TOLERANCE: 4,
    WEEK_TOLERANCE_BY_ROLE: { minijob: 4, student: 4, permanent: 2 },
    MONTH_TOLERANCE_BY_ROLE: { minijob: 4, student: 4, permanent: 2 },
    FLOAT_PRECISION_OFFSET: 1e-6,

    // Weekend distribution and student constraints referenced in engine/validator
    WEEKEND_DISTRIBUTION_ENABLED: true,
    MIN_WEEKENDS_PER_MONTH: 1,
    MAX_WEEKENDS_WITHOUT_PREFERENCE: 2,
    WEEKEND_PREFERENCE_BONUS: 50,
    WEEKEND_FAIRNESS_PENALTY: 100,
    WEEKEND_SATURATION_PENALTY: 250,

    STUDENT_WEEKDAY_DAYTIME_ENABLED: true,
    STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS: 1,
    STUDENT_WEEKDAY_DAYTIME_PENALTY: 300,
    STUDENT_WEEKEND_BONUS: 60,
    STUDENT_EVENING_BONUS: 80,
    STUDENT_WEEKDAY_DAYTIME_PENALTY_PREF: -50,
    // Dynamic weekly caps for students (lecture vs. break); validator will pick based on academic terms
    STUDENT_MAX_WEEKLY_HOURS_LECTURE: 20,
    STUDENT_MAX_WEEKLY_HOURS_BREAK: 40,

    // Fairness weights
    TYPICAL_DAYS_PENALTY: 200,
    EXTRA_DAY_PENALTY: 100,
    FAIRNESS_OVERRIDE_THRESHOLD: 0.5,
    MAX_EXTRA_DAYS_ALLOWED: 1,
    MAX_EXTRA_DAYS_HARD_CAP: 2,
    SECOND_EXTRA_DAY_SHIFT_KEY: 'evening',

    // Rest and workload constraints
    MIN_REST_HOURS: 11,
    MAX_CONSECUTIVE_DAYS: 6,

    // Minijob earnings
    MINIJOB_MAX_EARNING: 556,
    MINIJOB_HOURLY_WAGE: 13.00,

    // Holiday API settings
    HOLIDAY_API_STATE: 'HE', // Hessen by default (used with Nager API counties: DE-HE)

    // Permanent weekend consent and alternative weekend days (feature flags)
    PERMANENT_WEEKEND_CONSENT_ENABLED: true, // require consent for permanent staff weekend work if not weekendPreference
    ALTERNATIVE_WEEKEND_ENABLED: false,       // enable alternative weekday rest days for weekend-preferring permanent staff
    ALTERNATIVE_WEEKEND_REQUIRES_CONSENT: true,
    ALTERNATIVE_WEEKEND_PENALTY: 120,
    // Penalize permanent staff auto-assigned to weekday evening shifts (rare exceptions)
    PERMANENT_WEEKDAY_EVENING_PENALTY: 400,
    // Bonus applied when a permanent explicitly volunteers for a weekday evening/closing shift (removes penalty above)
    PERMANENT_EVENING_VOLUNTEER_BONUS: 60,

    // Academic term configuration used in scheduler
    ACADEMIC_TERM_CONFIG: {
        WINTER_START_MONTH: 10,
        WINTER_START_DAY: 1,
        WINTER_END_MONTH: 3,
        WINTER_END_DAY: 31,
        SUMMER_START_MONTH: 4,
        SUMMER_START_DAY: 1,
        SUMMER_END_MONTH: 9,
        SUMMER_END_DAY: 30,
        WINTER_LECTURE_START: { month: 10, day: 15 },
        WINTER_LECTURE_END: { month: 2, day: 15 },
        SUMMER_LECTURE_START: { month: 4, day: 15 },
        SUMMER_LECTURE_END: { month: 7, day: 15 }
    },
    // Optional ICS sources (array of URLs). If empty, fallback config above is used. Users can paste one via UI.
    ACADEMIC_TERM_ICS_SOURCES: []
,
    // --- Fairness extensions (emphasis on satisfaction over raw coverage) ---
    // Target proportion (0-1) of evening + closing shifts to be staffed by students (Werkstudenten)
    EVENING_CLOSING_STUDENT_TARGET_RATIO: 0.5,
    // Bonus / penalty weights to steer distribution toward target ratio
    EVENING_CLOSING_STUDENT_BONUS: 40,
    EVENING_CLOSING_NON_STUDENT_PENALTY: 120,
    // Personal soft cap for non-student closing shifts before large penalty
    CLOSING_SHIFT_PERSONAL_CAP: 3,
    CLOSING_SHIFT_EXCESS_PENALTY: 200,
    // Penalty for assigning a non-student to consecutive closing shifts (fatigue / satisfaction)
    CLOSING_SHIFT_CONSECUTIVE_PENALTY: 150,
    // Whether fairness penalties can escalate to near-blocking scores
    FAIRNESS_STRICT_MODE: true,
    // Enable priority logic that biases evening/closing shifts toward students until ratio reached
    STUDENT_EVENING_PRIORITY_ENABLED: true
    // (Former recovery pass configuration removed)
};

export const SHIFTS = {
    // Weekday shifts
    early: { name: 'Früh', time: '06:45-12:00', type: 'weekday', hours: 5.25 },
    midday: { name: 'Mittel', time: '11:45-17:00', type: 'weekday', hours: 5.25 },
    evening: { name: 'Abend', time: '17:00-20:30', type: 'weekday', hours: 3.5 },
    closing: { name: 'Spät', time: '16:45-22:15', type: 'weekday', hours: 5.5 },

    // Weekend shifts
    'weekend-early': { name: 'WE Früh', time: '08:45-14:35', type: 'weekend', hours: 5.83 },
    'weekend-late': { name: 'WE Spät', time: '14:25-20:15', type: 'weekend', hours: 5.83 },

    // Holiday shifts
    'holiday-early': { name: 'Feiertag Früh', time: '08:45-13:15', type: 'holiday', hours: 4.5 },
    'holiday-late': { name: 'Feiertag Spät', time: '13:05-17:15', type: 'holiday', hours: 4.17 }
};

// Helper function to determine if a shift is critical for coverage purposes
export function isCriticalShift(shift, dateStr) {
    // All shifts are critical except evening shifts on EVENING_OPTIONAL_DAYS (Tuesday, Thursday)
    if (shift !== 'evening') return true;

    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, etc.
    // Tuesday=2, Thursday=4
    return !APP_CONFIG.EVENING_OPTIONAL_DAYS.includes(dayOfWeek);
}
