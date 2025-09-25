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
      Object.keys(localStorage).forEach(k => {
        if (this.isDurableKey(k)) {
          const stored = localStorage.getItem(k);
          if (stored) { try { this[k] = JSON.parse(stored); } catch {} }
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
        // Persist only durable keys
        Object.keys(this).forEach(key => {
          if (this.isDurableKey(key)) {
            try { localStorage.setItem(key, JSON.stringify(this[key])); } catch {}
          } else {
            if (localStorage.getItem(key) !== null) {
              // Cleanup legacy persisted ephemeral keys
              try { localStorage.removeItem(key); } catch {}
            }
          }
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
    if (!this.isDurableKey(key)) {
      // Development hint; won't block runtime.
      if (typeof console !== 'undefined' && !this._ephemeralWarned) {
        console.warn('[persistence] Attempted to set non-durable key:', key);
      }
    }
    this.save();
  }

  // Whitelist helper for durable persistence
  isDurableKey(key){
    return [
      'staffData',
      'availabilityData',
      'scheduleData',
      'vacationsByStaff',
      'illnessByStaff',
      'overtimeRequests',
      'vacationLedger',
  'carryoverByStaffAndMonth',
  '__staffIdMap', // mapping of temp -> remote staff IDs for hydration & remap
  'holidays' // holiday data from API
    ].includes(key);
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
