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

export class AppState {
  constructor() {
    this.staffData = [];
    this.availabilityData = {};
    this.scheduleData = {};
    this.holidays = {};
    this.auditLog = [];
    this.tempVacationPeriods = [];
    this.tempIllnessPeriods = [];
    this.studentTempException = {};
    this.otherStaffData = [];
    this.tempOtherVacations = [];
    this.carryoverByStaffAndMonth = {};
    this.monthHoursCache = {};
    this.vacationLedger = {};
    this.permanentOvertimeConsent = {};
    this.overtimeCredits = {};
    this.voluntaryEveningAvailability = {};
    this.weekendAssignments = {};
    this.studentWeekdayDaytimeShifts = {};
    this.studentExceptionWeeks = {};
    this.academicTermCache = {};
  // New per-staff vacations
  this.vacationsByStaff = {};
  }

  reset() {
    Object.keys(this).forEach(key => {
      this[key] = Array.isArray(this[key]) ? [] : {};
    });
  }

  // Load initial state from localStorage
  load() {
    // Only try to load from localStorage in browser environment
    if (typeof localStorage !== 'undefined') {
      Object.keys(this).forEach(key => {
        const stored = localStorage.getItem(key);
        if (stored) {
          this[key] = JSON.parse(stored);
        }
      });
    }
  }

  // Debounced save functionality
  save(immediate = false) {
    // Only try to save to localStorage in browser environment
    if (typeof localStorage !== 'undefined') {
      try {
        Object.entries(this).forEach(([key, value]) => {
          localStorage.setItem(key, JSON.stringify(value));
        });
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    }
  }

  // State getters and setters
  get(key) {
    return this[key];
  }

  set(key, value) {
    this[key] = value;
    this.save();
  }
}

// Export a single instance
export const appState = new AppState();
