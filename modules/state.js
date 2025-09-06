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
  this.overtimeRequests = {};
    this.voluntaryEveningAvailability = {};
    this.weekendAssignments = {};
    this.studentWeekdayDaytimeShifts = {};
    this.studentExceptionWeeks = {};
    this.academicTermCache = {};
  this.academicTermSources = [];
  this.studentExceptionMonths = {};
  this.studentFairnessMode = false;
  // New per-staff vacations
  this.vacationsByStaff = {};
  // New per-staff illness periods
  this.illnessByStaff = {};
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
  // Run light migrations after load (idempotent)
  try { this.migrateVoluntaryEveningKeys(); } catch {}
  // Persist if anything changed
  try { this.save(true); } catch {}
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

  // Migrations
  migrateVoluntaryEveningKeys(){
    const map = this.voluntaryEveningAvailability || {};
    let changed = false;
    Object.keys({ ...map }).forEach(k => {
      // Legacy format: staffId::YYYY-MM-DD (no ::evening/::closing suffix)
      if (!k.includes('::evening') && !k.includes('::closing')){
        const parts = k.split('::');
        if (parts.length === 2){
          const [staffId, dateStr] = parts;
          const evenKey = `${staffId}::${dateStr}::evening`;
          const closeKey = `${staffId}::${dateStr}::closing`;
          if (!map[evenKey]) { map[evenKey] = true; changed = true; }
          if (!map[closeKey]) { map[closeKey] = true; changed = true; }
          delete map[k];
          changed = true;
        }
      }
    });
    if (changed) this.voluntaryEveningAvailability = map;
  }
}

// Export a single instance
export const appState = new AppState();
