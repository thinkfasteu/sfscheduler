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

type HolidaySource = 'api' | 'manual' | 'legacy'

export interface HolidayEntry {
  name: string
  closed?: boolean
  source?: HolidaySource
}

interface HolidayStore {
  [year: string]: { [date: string]: HolidayEntry }
}

class SharedHolidayService {
  private holidayStore: HolidayStore = {}
  private loadingPromises: Map<number, Promise<void>> = new Map()

  /**
   * Fetch holidays for a specific year from the Nager.at API
   */
  async fetchHolidaysForYear(year: number): Promise<{ [date: string]: HolidayEntry }> {
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
      const previous = this.holidayStore[yearStr] || {}
      const next: { [date: string]: HolidayEntry } = {}
      stateHolidays.forEach(holiday => {
        const existing = previous[holiday.date]
        next[holiday.date] = {
          name: holiday.localName,
          closed: existing?.closed ?? false,
          source: 'api'
        }
      })
      // Preserve custom/manual holidays
      Object.entries(previous).forEach(([date, entry]) => {
        if (!next[date]) {
          next[date] = { ...entry, source: entry.source || 'manual' }
        }
      })

      this.holidayStore[yearStr] = next

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

  private ensureYearContainer(year: number | string): { [date: string]: HolidayEntry } {
    const yearStr = String(year)
    if (!this.holidayStore[yearStr]) {
      this.holidayStore[yearStr] = {}
    }
    return this.holidayStore[yearStr]
  }

  private getEntry(dateStr: string): HolidayEntry | null {
    const year = dateStr.split('-')[0]
    const entry = this.holidayStore[year]?.[dateStr]
    return entry ? { ...entry } : null
  }

  /**
   * Check if a specific date is a holiday
   */
  isHoliday(dateStr: string): boolean {
    const entry = this.getEntry(dateStr)
    return !!(entry && entry.name)
  }

  /**
   * Get the holiday name for a specific date
   */
  getHolidayName(dateStr: string): string | null {
    const entry = this.getEntry(dateStr)
    return entry ? entry.name : null
  }

  /**
   * Retrieve the full holiday entry for a date
   */
  getHoliday(dateStr: string): HolidayEntry | null {
    return this.getEntry(dateStr)
  }

  /**
   * Mark or unmark a date as closed
   */
  setHolidayClosed(dateStr: string, closed: boolean): void {
    const year = dateStr.split('-')[0]
    const store = this.ensureYearContainer(year)
    const current = store[dateStr] || { name: '', closed: false, source: 'manual' }
    store[dateStr] = { ...current, closed }
  }

  /**
   * Add or update a manual holiday entry
   */
  upsertHoliday(dateStr: string, entry: HolidayEntry): void {
    const year = dateStr.split('-')[0]
    const store = this.ensureYearContainer(year)
    store[dateStr] = {
      name: entry.name || '',
      closed: !!entry.closed,
      source: entry.source || 'manual'
    }
  }

  bulkUpsert(entries: { [date: string]: HolidayEntry }): void {
    Object.entries(entries).forEach(([dateStr, entry]) => {
      this.upsertHoliday(dateStr, entry)
    })
  }

  removeHoliday(dateStr: string): void {
    const year = dateStr.split('-')[0]
    const store = this.holidayStore[year]
    if (store && store[dateStr]) {
      delete store[dateStr]
    }
  }

  /**
   * Determine if a day is marked closed
   */
  isClosed(dateStr: string): boolean {
    const entry = this.getEntry(dateStr)
    return !!entry?.closed
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
  getHolidaysForYear(year: number): { [date: string]: HolidayEntry } {
    const store = this.ensureYearContainer(year)
    return { ...store }
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
  getDayType(dateStr: string): 'holiday' | 'weekend' | 'weekday' | 'closed' {
    const date = new Date(dateStr + 'T00:00:00')
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6 // Sunday = 0, Saturday = 6
    const entry = this.getEntry(dateStr)

    if (entry?.closed) return 'closed'
    if (entry?.name) return 'holiday'
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