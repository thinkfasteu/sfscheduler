/**
 * @typedef {Object} StateSchema
 * @property {Array} staffData - Staff member records
 * @property {Object} availabilityData - Staff availability by date/shift
 * @property {Object} scheduleData - Schedule assignments
 * @property {Object} holidays - Holiday calendar by date
 * @property {Array} auditLog - Change tracking log
 * @property {Object} carryoverByStaffAndMonth - Hour carryover tracking
 * @property {Object} monthHoursCache - Cached monthly hour calculations
 * @property {Object} holidayConsent - Holiday work consent records
 * @property {Object} weekendAssignments - Weekend shift distribution tracking
 * @property {Object} studentWeekdayDaytimeShifts - Student daytime limits tracking
 * @property {Object} academicTermCache - Term period calculations cache
 */

class AppState {
    constructor() {
        this.staffData = [];
        this.availabilityData = {};
        this.scheduleData = {};
        this.holidays = {};
        this.auditLog = [];
        this.carryoverByStaffAndMonth = {};
        this.monthHoursCache = {};
        this.holidayConsent = {};
        this.weekendAssignments = {};
        this.studentWeekdayDaytimeShifts = {};
        this.academicTermCache = {};
    }

    reset() {
        Object.keys(this).forEach(key => {
            this[key] = Array.isArray(this[key]) ? [] : {};
        });
    }
}

export const state = new AppState();
