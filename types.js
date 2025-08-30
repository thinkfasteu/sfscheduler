/**
 * @typedef {Object} Staff
 * @property {string} id - Unique staff identifier
 * @property {'permanent'|'student'|'minijob'} role - Employment role
 * @property {number} weeklyHours - Target hours per week
 * @property {number} typicalDays - Typical workdays per week
 * @property {boolean} weekendPreference - Prefers weekend shifts
 * @property {number} [hourlyWage] - Optional override for minijob wage
 */

/**
 * @typedef {Object} ShiftDefinition
 * @property {string} name - Display name
 * @property {string} time - Time range (HH:mm-HH:mm)
 * @property {'weekday'|'weekend'|'holiday'} type - Shift type
 * @property {number} hours - Duration in hours
 */

/**
 * @typedef {Object} ScheduleDay
 * @property {Object.<string, string>} assignments - Map of shift->staffId
 * @property {string|null} holidayName - Holiday name if applicable
 */

/**
 * @typedef {Object} Availability
 * @property {'yes'|'no'|'prefer'} status - Availability status
 * @property {string} [note] - Optional note
 */

/**
 * @typedef {Object} ValidationIssue
 * @property {string} type - Issue category
 * @property {string} staffId - Affected staff member
 * @property {Object} details - Issue-specific details
 */

export const ROLE_TYPES = /** @type {const} */ ({
    PERMANENT: 'permanent',
    STUDENT: 'student',
    MINIJOB: 'minijob'
});

export const SHIFT_TYPES = /** @type {const} */ ({
    WEEKDAY: 'weekday',
    WEEKEND: 'weekend',
    HOLIDAY: 'holiday'
});

export const AVAILABILITY_STATUS = /** @type {const} */ ({
    YES: 'yes',
    NO: 'no',
    PREFER: 'prefer'
});
