import { appState } from '../../modules/state.js';
import { APP_CONFIG } from '../../modules/config.js';

export function createHolidayService(){
  const baseUrl = 'https://date.nager.at/api/v3/PublicHolidays';
  const stateCode = APP_CONFIG?.HOLIDAY_API_STATE || 'HE'; // Hessen by default

  return {
    // Existing interface methods for backward compatibility
    list(year){ return Object.entries(appState.holidays?.[year] || {}).map(([date,name])=>({ date, name })); },
    add(year, date, name){ if (!appState.holidays[year]) appState.holidays[year]={}; appState.holidays[year][date]=name; appState.save(); return true; },
    remove(year, date){ if (!appState.holidays[year]) return false; delete appState.holidays[year][date]; appState.save(); return true; },
    ensureLoaded(year){ if (!appState.holidays[year]) appState.holidays[year]={}; return true; },

    // New API methods
    async fetchHolidaysForYear(year) {
      try {
        // Initialize holidays structure if needed
        if (!appState.holidays) {
          appState.holidays = {};
        }

        const yearStr = String(year);

        // Return cached holidays if already loaded
        if (appState.holidays[yearStr] && Object.keys(appState.holidays[yearStr]).length > 0) {
          return appState.holidays[yearStr];
        }

        const url = `${baseUrl}/${year}/DE`;
        console.log(`Fetching holidays for ${year} from: ${url}`);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`API request failed with status ${response.status}`);
        }

        const allGermanHolidays = await response.json();
        console.log(`[HolidayService] API returned ${allGermanHolidays.length} holidays total`);
        
        // Check for October 3rd specifically in raw API data
        const oct3Raw = allGermanHolidays.find(h => h.date === '2025-10-03');
        if (oct3Raw) {
          console.log(`[HolidayService] October 3rd in raw API:`, oct3Raw);
        } else {
          console.log(`[HolidayService] ❌ October 3rd NOT in raw API response`);
        }
        
        // Filter holidays for our state (Hessen = DE-HE)
        console.log(`[HolidayService] Filtering for state: ${stateCode}`);
        const stateHolidays = allGermanHolidays.filter(holiday => {
          // Include holidays that either:
          // 1. Don't have county restrictions (national holidays)
          // 2. Explicitly include our state code
          const hasNoCounties = !holiday.counties;
          const includesOurState = Array.isArray(holiday.counties) && holiday.counties.includes(`DE-${stateCode}`);
          const included = hasNoCounties || includesOurState;
          
          if (holiday.date === '2025-10-03') {
            console.log(`[HolidayService] October 3rd filter check:`, {
              counties: holiday.counties,
              hasNoCounties,
              includesOurState,
              stateCode: `DE-${stateCode}`,
              included
            });
          }
          
          return included;
        });

        console.log(`[HolidayService] Filtered to ${stateHolidays.length} holidays for state ${stateCode}`);
        
        // Convert to the format expected by the scheduler: { "YYYY-MM-DD": "Holiday Name" }
        appState.holidays[yearStr] = {};
        stateHolidays.forEach(holiday => {
          appState.holidays[yearStr][holiday.date] = holiday.localName;
          if (holiday.date === '2025-10-03') {
            console.log(`[HolidayService] ✅ Added October 3rd: ${holiday.date} = ${holiday.localName}`);
          }
        });

        // Persist to storage
        if (appState.save) {
          console.log(`[HolidayService] Saving appState with ${Object.keys(appState.holidays[yearStr]).length} holidays...`);
          appState.save();
          console.log(`[HolidayService] AppState saved successfully`);
        } else {
          console.log(`[HolidayService] ⚠️ No appState.save() function available`);
        }

        console.log(`Loaded ${stateHolidays.length} holidays for ${year}:`, appState.holidays[yearStr]);
        
        // Double-check the data is still there after save
        setTimeout(() => {
          const recheck = appState.holidays?.[yearStr];
          const recheckCount = recheck ? Object.keys(recheck).length : 0;
          console.log(`[HolidayService] Recheck after save - ${recheckCount} holidays still in appState for ${yearStr}`);
          if (recheckCount === 0) {
            console.error(`[HolidayService] ❌ HOLIDAYS LOST AFTER SAVE! This is the bug!`);
          }
        }, 100);
        
        return appState.holidays[yearStr];

      } catch (error) {
        console.error(`Error fetching holidays for ${year}:`, error);
        
        // Ensure we have an empty object to prevent repeated API calls
        if (!appState.holidays[String(year)]) {
          appState.holidays[String(year)] = {};
        }
        
        throw new Error(`Could not fetch holidays for ${year}: ${error.message}`);
      }
    },

    isHoliday(dateStr) {
      const year = dateStr.split('-')[0];
      return !!(appState.holidays?.[year]?.[dateStr]);
    },

    getHolidayName(dateStr) {
      const year = dateStr.split('-')[0];
      return appState.holidays?.[year]?.[dateStr] || null;
    },

    isChristmas(dateStr) {
      return dateStr.endsWith('-12-25');
    },

    isNewYear(dateStr) {
      return dateStr.endsWith('-01-01');
    },

    getHolidaysForYear(year) {
      const yearStr = String(year);
      return appState.holidays?.[yearStr] || {};
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
        // Continue execution - the app should work even without holiday data
      }
    },

    getDayType(dateStr) {
      const date = new Date(dateStr + 'T00:00:00');
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6; // Sunday = 0, Saturday = 6
      const isHoliday = this.isHoliday(dateStr);

      if (isHoliday) return 'holiday';
      if (isWeekend) return 'weekend';
      return 'weekday';
    }
  };
}