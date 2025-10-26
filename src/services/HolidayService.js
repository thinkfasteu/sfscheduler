import { appState } from '../../modules/state.js';
import { APP_CONFIG } from '../../modules/config.js';

const HOLIDAY_SOURCE = {
  API: 'api',
  MANUAL: 'manual',
  LEGACY: 'legacy'
};

function normalizeHolidayEntry(value, fallbackSource = HOLIDAY_SOURCE.MANUAL) {
  if (!value) return null;
  if (typeof value === 'string') {
    return { name: value, closed: false, source: fallbackSource };
  }
  if (typeof value === 'object') {
    return {
      name: value.name || value.localName || '',
      closed: !!value.closed,
      source: value.source || fallbackSource
    };
  }
  return null;
}

function ensureYearContainer(year) {
  const yearStr = String(year);
  if (!appState.holidays) appState.holidays = {};
  if (!appState.holidays[yearStr]) appState.holidays[yearStr] = {};
  return appState.holidays[yearStr];
}

export function createHolidayService(){
  const baseUrl = 'https://date.nager.at/api/v3/PublicHolidays';
  const stateCode = APP_CONFIG?.HOLIDAY_API_STATE || 'HE'; // Hessen by default

  const getHolidayFromState = (dateStr) => {
    const year = dateStr.split('-')[0];
    const store = appState.holidays?.[year];
    if (!store) return null;
    return normalizeHolidayEntry(store[dateStr]);
  };

  const setHolidayInState = (year, date, entry) => {
    const yearStr = String(year);
    const store = ensureYearContainer(yearStr);
    store[date] = {
      name: entry.name || '',
      closed: !!entry.closed,
      source: entry.source || HOLIDAY_SOURCE.MANUAL
    };
    appState.save?.();
    const holidaySvc = window.holidayService;
    if (holidaySvc?.upsertHoliday) {
      try { holidaySvc.upsertHoliday(date, store[date]); } catch {} // best-effort sync for UI helpers
    }
  };

  const removeHolidayFromState = (year, date) => {
    const store = ensureYearContainer(year);
    if (store[date] != null) {
      delete store[date];
      appState.save?.();
      const holidaySvc = window.holidayService;
      if (holidaySvc?.removeHoliday) {
        try { holidaySvc.removeHoliday(date); } catch {}
      }
      return true;
    }
    return false;
  };

  return {
    list(year){
      const store = ensureYearContainer(year);
      return Object.entries(store).map(([date, value]) => {
        const entry = normalizeHolidayEntry(value, HOLIDAY_SOURCE.LEGACY) || { name: '', closed: false, source: HOLIDAY_SOURCE.LEGACY };
        return { date, ...entry };
      });
    },
    add(year, date, name, options = {}){
      const entry = {
        name: name || '',
        closed: !!options.closed,
        source: options.source || HOLIDAY_SOURCE.MANUAL
      };
      setHolidayInState(year, date, entry);
      return true;
    },
    setClosed(year, date, closed){
      const current = getHolidayFromState(date) || { name: '', closed: false, source: HOLIDAY_SOURCE.MANUAL };
      current.closed = !!closed;
      setHolidayInState(year, date, current);
      return true;
    },
    remove(year, date){
      return removeHolidayFromState(year, date);
    },
    ensureLoaded(year){ ensureYearContainer(year); return true; },

    // New API methods
    async fetchHolidaysForYear(year) {
      try {
        const yearStr = String(year);
        ensureYearContainer(yearStr);

        const existing = { ...appState.holidays[yearStr] };
        if (Object.keys(existing).length > 0) {
          return existing;
        }

        const url = `${baseUrl}/${year}/DE`;

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const allGermanHolidays = await response.json();
        
        const stateHolidays = allGermanHolidays.filter(holiday => {
          const hasNoCounties = !holiday.counties;
          const includesOurState = Array.isArray(holiday.counties) && holiday.counties.includes(`DE-${stateCode}`);
          return hasNoCounties || includesOurState;
        });

        const next = {};
        stateHolidays.forEach(holiday => {
          const prev = normalizeHolidayEntry(existing[holiday.date], HOLIDAY_SOURCE.API) || {};
          next[holiday.date] = {
            name: holiday.localName,
            closed: !!prev.closed,
            source: HOLIDAY_SOURCE.API
          };
        });
        // Preserve manual overrides (e.g. custom holidays)
        Object.entries(existing).forEach(([dateStr, value]) => {
          if (!next[dateStr]) {
            const entry = normalizeHolidayEntry(value, HOLIDAY_SOURCE.MANUAL);
            if (entry) next[dateStr] = entry;
          }
        });

        appState.holidays[yearStr] = next;
        appState.save?.();

        setTimeout(() => {
          const recheck = appState.holidays?.[yearStr];
          const recheckCount = recheck ? Object.keys(recheck).length : 0;
          if (recheckCount === 0) {
            console.error(`[HolidayService] ❌ HOLIDAYS LOST AFTER SAVE! This is the bug!`);
          }
        }, 100);

        const holidaySvc = window.holidayService;
        if (holidaySvc?.bulkUpsert) {
          try { holidaySvc.bulkUpsert(next); } catch {}
        }

        return appState.holidays[yearStr];

      } catch (error) {
        console.error(`Error fetching holidays for ${year}:`, error);
        ensureYearContainer(year);
        throw new Error(`Could not fetch holidays for ${year}: ${error.message}`);
      }
    },

    isHoliday(dateStr) {
      const entry = getHolidayFromState(dateStr);
      return !!(entry && entry.name);
    },

    isClosed(dateStr) {
      const entry = getHolidayFromState(dateStr);
      return !!(entry && entry.closed);
    },

    getHoliday(dateStr) {
      return getHolidayFromState(dateStr);
    },

    getHolidayName(dateStr) {
      const entry = getHolidayFromState(dateStr);
      return entry ? entry.name : null;
    },

    isChristmas(dateStr) {
      return dateStr.endsWith('-12-25');
    },

    isNewYear(dateStr) {
      return dateStr.endsWith('-01-01');
    },

    getHolidaysForYear(year, { includeMeta = false } = {}) {
      const store = ensureYearContainer(year);
      if (includeMeta) {
        return Object.fromEntries(Object.entries(store).map(([date, value]) => {
          const entry = normalizeHolidayEntry(value, HOLIDAY_SOURCE.LEGACY) || { name: '', closed: false, source: HOLIDAY_SOURCE.LEGACY };
          return [date, entry];
        }));
      }
      return Object.fromEntries(Object.entries(store).map(([date, value]) => {
        const entry = normalizeHolidayEntry(value, HOLIDAY_SOURCE.LEGACY);
        return [date, entry ? entry.name : ''];
      }));
    },

    async ensureCurrentAndNextYearLoaded() {
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;

      try {
        await Promise.all([
          this.fetchHolidaysForYear(currentYear),
          this.fetchHolidaysForYear(nextYear)
        ]);
      } catch (error) {
        console.warn('Some holidays could not be loaded:', error.message);
      }
    },

    getDayType(dateStr) {
      const entry = getHolidayFromState(dateStr);
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (entry?.closed) return 'closed';
      if (entry?.name) return 'holiday';
      if (isWeekend) return 'weekend';
      return 'weekday';
    }
  };
}