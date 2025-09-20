import { useState, useEffect } from 'react'
import { AvailabilityDeadlineService } from '@shared/services/availabilityDeadlineService'
import { holidayService } from '@shared/services/holidayService'

interface UseDeadlineResult {
  deadline: Date | null
  isLoading: boolean
  error: string | null
  isOverdue: boolean
  daysUntilDeadline: number
  formattedDeadline: string | null
}

/**
 * React hook for managing deadline calculations with holiday awareness
 */
export function useDeadline(month: Date): UseDeadlineResult {
  const [deadline, setDeadline] = useState<Date | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    async function calculateDeadline() {
      try {
        setIsLoading(true)
        setError(null)

        // Ensure holidays are loaded first
        await holidayService.fetchHolidaysForYear(month.getFullYear())
        
        // Calculate deadline with holiday awareness
        const calculatedDeadline = await AvailabilityDeadlineService.getDeadline(month)

        if (isMounted) {
          setDeadline(calculatedDeadline)
        }
      } catch (err) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to calculate deadline'
          setError(errorMessage)
          console.error('[useDeadline] Error calculating deadline:', err)
          
          // Fallback to sync calculation
          try {
            const fallbackDeadline = AvailabilityDeadlineService.getDeadlineSync(month)
            setDeadline(fallbackDeadline)
          } catch (fallbackErr) {
            console.error('[useDeadline] Fallback calculation also failed:', fallbackErr)
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    calculateDeadline()

    return () => {
      isMounted = false
    }
  }, [month])

  // Calculate derived values
  const currentDate = new Date()
  const isOverdue = deadline ? currentDate > deadline : false
  const daysUntilDeadline = deadline 
    ? Math.max(0, Math.ceil((deadline.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)))
    : 0
  const formattedDeadline = deadline 
    ? deadline.toLocaleDateString('de-DE', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : null

  return {
    deadline,
    isLoading,
    error,
    isOverdue,
    daysUntilDeadline,
    formattedDeadline
  }
}