/**
 * Shared Holiday Service for Staff Portal
 * Provides German public holidays for Hessen state using the Nager.at API
 * Ensures consistency between scheduler and staff portal
 */

const HOLIDAY_API_BASE_URL = 'https://date.nager.at/api/v3/PublicHolidays'
const HOLIDAY_API_STATE = 'HE' // Hessen by default

interface Holiday {
  date: string // YYYY-MM-DD format
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
  counties?: string[]
  launchYear?: number
}

interface HolidayStore {
  [year: string]: { [date: string]: string } // { "2024": { "2024-12-25": "1. Weihnachtstag" } }
}

class SharedHolidayService {
  private holidayStore: HolidayStore = {}
  private loadingPromises: Map<number, Promise<void>> = new Map()

  /**
   * Fetch holidays for a specific year from the Nager.at API
   */
  async fetchHolidaysForYear(year: number): Promise<{ [date: string]: string }> {
    const yearStr = String(year)

    // Return cached holidays if already loaded
    if (this.holidayStore[yearStr] && Object.keys(this.holidayStore[yearStr]).length > 0) {
      return this.holidayStore[yearStr]
    }

    // Check if we're already loading this year
    if (this.loadingPromises.has(year)) {
      await this.loadingPromises.get(year)
      return this.holidayStore[yearStr] || {}
    }

    // Start loading
    const loadingPromise = this.performHolidayFetch(year)
    this.loadingPromises.set(year, loadingPromise)

    try {
      await loadingPromise
      return this.holidayStore[yearStr] || {}
    } finally {
      this.loadingPromises.delete(year)
    }
  }

  private async performHolidayFetch(year: number): Promise<void> {
    try {
      const url = `${HOLIDAY_API_BASE_URL}/${year}/DE`
      console.log(`[HolidayService] Fetching holidays for ${year} from: ${url}`)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`)
      }

      const allGermanHolidays: Holiday[] = await response.json()
      
      // Filter holidays for our state (Hessen = DE-HE)
      const stateHolidays = allGermanHolidays.filter(holiday => {
        // Include holidays that either:
        // 1. Don't have county restrictions (national holidays)
        // 2. Explicitly include our state code
        return !holiday.counties || 
               (Array.isArray(holiday.counties) && holiday.counties.includes(`DE-${HOLIDAY_API_STATE}`))
      })

      // Convert to the format expected: { "YYYY-MM-DD": "Holiday Name" }
      const yearStr = String(year)
      this.holidayStore[yearStr] = {}
      stateHolidays.forEach(holiday => {
        this.holidayStore[yearStr][holiday.date] = holiday.localName
      })

      console.log(`[HolidayService] Loaded ${stateHolidays.length} holidays for ${year}:`, this.holidayStore[yearStr])

    } catch (error) {
      console.error(`[HolidayService] Error fetching holidays for ${year}:`, error)
      
      // Ensure we have an empty object to prevent repeated API calls
      const yearStr = String(year)
      if (!this.holidayStore[yearStr]) {
        this.holidayStore[yearStr] = {}
      }
      
      throw new Error(`Could not fetch holidays for ${year}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Check if a specific date is a holiday
   */
  isHoliday(dateStr: string): boolean {
    const year = dateStr.split('-')[0]
    return !!(this.holidayStore[year]?.[dateStr])
  }

  /**
   * Get the holiday name for a specific date
   */
  getHolidayName(dateStr: string): string | null {
    const year = dateStr.split('-')[0]
    return this.holidayStore[year]?.[dateStr] || null
  }

  /**
   * Check if a date is Christmas (December 25)
   */
  isChristmas(dateStr: string): boolean {
    return dateStr.endsWith('-12-25')
  }

  /**
   * Check if a date is New Year's Day (January 1)
   */
  isNewYear(dateStr: string): boolean {
    return dateStr.endsWith('-01-01')
  }

  /**
   * Get all holidays for a specific year
   */
  getHolidaysForYear(year: number): { [date: string]: string } {
    const yearStr = String(year)
    return this.holidayStore[yearStr] || {}
  }

  /**
   * Ensure holidays are loaded for the current year and next year
   */
  async ensureCurrentAndNextYearLoaded(): Promise<void> {
    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    try {
      await Promise.all([
        this.fetchHolidaysForYear(currentYear),
        this.fetchHolidaysForYear(nextYear)
      ])
    } catch (error) {
      console.warn('[HolidayService] Some holidays could not be loaded:', error instanceof Error ? error.message : 'Unknown error')
      // Continue execution - the app should work even without holiday data
    }
  }

  /**
   * Get day type classification consistent with scheduler logic
   */
  getDayType(dateStr: string): 'holiday' | 'weekend' | 'weekday' {
    const date = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
    const isHoliday = this.isHoliday(dateStr)

    if (isHoliday) return 'holiday'
    if (isWeekend) return 'weekend'
    return 'weekday'
  }

  /**
   * Check if holidays are loaded for a given year
   */
  areHolidaysLoaded(year: number): boolean {
    const yearStr = String(year)
    return !!this.holidayStore[yearStr] && Object.keys(this.holidayStore[yearStr]).length > 0
  }

  /**
   * Preload holidays for multiple years
   */
  async preloadHolidays(years: number[]): Promise<void> {
    try {
      await Promise.all(years.map(year => this.fetchHolidaysForYear(year)))
    } catch (error) {
      console.warn('[HolidayService] Some holidays could not be preloaded:', error instanceof Error ? error.message : 'Unknown error')
    }
  }
}

// Export singleton instance
export const holidayService = new SharedHolidayService()
export default holidayService