import { useState, useEffect } from 'react'
import { holidayService } from '@shared/services/holidayService'

interface UseHolidaysResult {
  holidays: { [date: string]: string }
  isLoading: boolean
  error: string | null
  isHoliday: (dateStr: string) => boolean
  getHolidayName: (dateStr: string) => string | null
  getDayType: (dateStr: string) => 'holiday' | 'weekend' | 'weekday'
  isChristmas: (dateStr: string) => boolean
  isNewYear: (dateStr: string) => boolean
}

/**
 * React hook for managing holiday data in the staff portal
 * Automatically loads holidays for the current and next year
 */
export function useHolidays(): UseHolidaysResult {
  const [holidays, setHolidays] = useState<{ [date: string]: string }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadHolidays() {
      try {
        setIsLoading(true)
        setError(null)

        // Load holidays for current and next year
        await holidayService.ensureCurrentAndNextYearLoaded()

        if (isMounted) {
          const currentYear = new Date().getFullYear()
          const currentYearHolidays = holidayService.getHolidaysForYear(currentYear)
          const nextYearHolidays = holidayService.getHolidaysForYear(currentYear + 1)

          // Combine both years into one object
          setHolidays({
            ...currentYearHolidays,
            ...nextYearHolidays
          })
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load holidays'
          setError(errorMessage)
          console.error('[useHolidays] Error loading holidays:', err)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadHolidays()

    return () => {
      isMounted = false
    }
  }, [])

  return {
    holidays,
    isLoading,
    error,
    isHoliday: (dateStr: string) => holidayService.isHoliday(dateStr),
    getHolidayName: (dateStr: string) => holidayService.getHolidayName(dateStr),
    getDayType: (dateStr: string) => holidayService.getDayType(dateStr),
    isChristmas: (dateStr: string) => holidayService.isChristmas(dateStr),
    isNewYear: (dateStr: string) => holidayService.isNewYear(dateStr)
  }
}

/**
 * Hook for loading holidays for specific years
 * Useful when you need holidays for years other than current/next
 */
export function useHolidaysForYears(years: number[]): UseHolidaysResult {
  const [holidays, setHolidays] = useState<{ [date: string]: string }>({})
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function loadHolidays() {
      if (years.length === 0) {
        setIsLoading(false)
        return
      }

      try {
        setIsLoading(true)
        setError(null)

        // Load holidays for specified years
        await holidayService.preloadHolidays(years)

        if (isMounted) {
          const allHolidays: { [date: string]: string } = {}
          years.forEach(year => {
            const yearHolidays = holidayService.getHolidaysForYear(year)
            Object.assign(allHolidays, yearHolidays)
          })

          setHolidays(allHolidays)
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to load holidays'
          setError(errorMessage)
          console.error('[useHolidaysForYears] Error loading holidays:', err)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadHolidays()

    return () => {
      isMounted = false
    }
  }, [JSON.stringify(years)]) // Re-run when years array changes

  return {
    holidays,
    isLoading,
    error,
    isHoliday: (dateStr: string) => holidayService.isHoliday(dateStr),
    getHolidayName: (dateStr: string) => holidayService.getHolidayName(dateStr),
    getDayType: (dateStr: string) => holidayService.getDayType(dateStr),
    isChristmas: (dateStr: string) => holidayService.isChristmas(dateStr),
    isNewYear: (dateStr: string) => holidayService.isNewYear(dateStr)
  }
}