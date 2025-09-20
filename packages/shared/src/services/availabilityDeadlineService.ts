import { addDays, endOfDay, format, startOfMonth, getDay } from 'date-fns'
import type { Staff } from '../types'
import { holidayService } from './holidayService'

/**
 * Service for calculating availability submission deadlines and reminder dates
 * Now includes holiday awareness for Christmas and New Year's Day
 */
export class AvailabilityDeadlineService {
  /**
   * Calculate the availability submission deadline for a given month
   * Deadline is at the end of the second week of the month (Sunday at 23:59)
   * If the calculated deadline falls on a holiday (Christmas or New Year), 
   * it will be moved to the next business day
   */
  static async getDeadline(month: Date): Promise<Date> {
    const firstDayOfMonth = startOfMonth(month)
    
    // Find the first Monday of the month
    let firstMonday = firstDayOfMonth
    const firstDayWeekday = getDay(firstDayOfMonth) // 0 = Sunday, 1 = Monday, etc.
    
    if (firstDayWeekday === 0) {
      // If month starts on Sunday, first Monday is on the 2nd
      firstMonday = addDays(firstDayOfMonth, 1)
    } else if (firstDayWeekday > 1) {
      // If month starts on Tuesday or later, first Monday is next week
      firstMonday = addDays(firstDayOfMonth, 8 - firstDayWeekday)
    }
    // If month starts on Monday, firstMonday is already correct
    
    // End of second week is 13 days after first Monday (Sunday)
    let deadline = addDays(firstMonday, 13)
    
    // Ensure holidays are loaded for this year
    try {
      await holidayService.fetchHolidaysForYear(deadline.getFullYear())
    } catch (error) {
      console.warn('[AvailabilityDeadlineService] Could not load holidays, using standard deadline calculation:', error)
    }
    
    // Check if deadline falls on a holiday and adjust if needed
    deadline = this.adjustDeadlineForHolidays(deadline)
    
    return endOfDay(deadline)
  }

  /**
   * Synchronous version for backward compatibility
   * Note: This won't adjust for holidays unless they're already loaded
   */
  static getDeadlineSync(month: Date): Date {
    const firstDayOfMonth = startOfMonth(month)
    
    // Find the first Monday of the month
    let firstMonday = firstDayOfMonth
    const firstDayWeekday = getDay(firstDayOfMonth) // 0 = Sunday, 1 = Monday, etc.
    
    if (firstDayWeekday === 0) {
      // If month starts on Sunday, first Monday is on the 2nd
      firstMonday = addDays(firstDayOfMonth, 1)
    } else if (firstDayWeekday > 1) {
      // If month starts on Tuesday or later, first Monday is next week
      firstMonday = addDays(firstDayOfMonth, 8 - firstDayWeekday)
    }
    // If month starts on Monday, firstMonday is already correct
    
    // End of second week is 13 days after first Monday (Sunday)
    let deadline = addDays(firstMonday, 13)
    
    // Check if deadline falls on a holiday and adjust if needed
    deadline = this.adjustDeadlineForHolidays(deadline)
    
    return endOfDay(deadline)
  }

  /**
   * Adjust deadline if it falls on a holiday
   * Moves deadline to the next non-holiday weekday (Monday-Friday)
   */
  private static adjustDeadlineForHolidays(deadline: Date): Date {
    let adjustedDeadline = deadline
    const maxAdjustmentDays = 7 // Prevent infinite loops
    let adjustmentDays = 0
    
    while (adjustmentDays < maxAdjustmentDays) {
      const deadlineStr = format(adjustedDeadline, 'yyyy-MM-dd')
      const dayOfWeek = getDay(adjustedDeadline) // 0 = Sunday, 6 = Saturday
      
      // Check if it's a holiday (Christmas or New Year specifically)
      const isHoliday = holidayService.isHoliday(deadlineStr)
      const isChristmas = holidayService.isChristmas(deadlineStr)
      const isNewYear = holidayService.isNewYear(deadlineStr)
      const isSpecialNonBusinessDay = isChristmas || isNewYear
      
      // Check if it's a weekend
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6
      
      // If deadline is on a holiday (especially Christmas/New Year) or weekend, move to next day
      if (isHoliday || isSpecialNonBusinessDay || isWeekend) {
        adjustedDeadline = addDays(adjustedDeadline, 1)
        adjustmentDays++
        
        if (adjustmentDays === 1 && (isSpecialNonBusinessDay || isHoliday)) {
          console.log(`[AvailabilityDeadlineService] Deadline moved from ${deadlineStr} (${
            isChristmas ? 'Christmas' : isNewYear ? 'New Year' : 'Holiday'
          }) to ${format(adjustedDeadline, 'yyyy-MM-dd')}`)
        }
      } else {
        // Found a valid business day
        break
      }
    }
    
    return adjustedDeadline
  }

  /**
   * Get reminder dates for a given month
   * Returns array of dates when reminders should be sent
   */
  static async getReminderDates(month: Date): Promise<{
    monthStart: Date, // 1st of month
    weekTwoStart: Date, // Start of second week  
    dayBeforeDeadline: Date // Day before deadline
  }> {
    const firstDayOfMonth = startOfMonth(month)
    const deadline = await this.getDeadline(month)
    const dayBeforeDeadline = addDays(deadline, -1)
    
    // Find start of second week (Monday of second week)
    let firstMonday = firstDayOfMonth
    const firstDayWeekday = getDay(firstDayOfMonth)
    
    if (firstDayWeekday === 0) {
      firstMonday = addDays(firstDayOfMonth, 1)
    } else if (firstDayWeekday > 1) {
      firstMonday = addDays(firstDayOfMonth, 8 - firstDayWeekday)
    }
    
    const weekTwoStart = addDays(firstMonday, 7)
    
    return {
      monthStart: firstDayOfMonth,
      weekTwoStart,
      dayBeforeDeadline
    }
  }

  /**
   * Synchronous version for backward compatibility
   */
  static getReminderDatesSync(month: Date): {
    monthStart: Date,
    weekTwoStart: Date,
    dayBeforeDeadline: Date
  } {
    const firstDayOfMonth = startOfMonth(month)
    const deadline = this.getDeadlineSync(month)
    const dayBeforeDeadline = addDays(deadline, -1)
    
    // Find start of second week (Monday of second week)
    let firstMonday = firstDayOfMonth
    const firstDayWeekday = getDay(firstDayOfMonth)
    
    if (firstDayWeekday === 0) {
      firstMonday = addDays(firstDayOfMonth, 1)
    } else if (firstDayWeekday > 1) {
      firstMonday = addDays(firstDayOfMonth, 8 - firstDayWeekday)
    }
    
    const weekTwoStart = addDays(firstMonday, 7)
    
    return {
      monthStart: firstDayOfMonth,
      weekTwoStart,
      dayBeforeDeadline
    }
  }

  /**
   * Check if a staff member is required to submit availability
   * Permanent staff are not required (they're assumed available for daytime shifts)
   */
  static isSubmissionRequired(staff: Staff): boolean {
    return staff.role !== 'permanent'
  }

  /**
   * Check if a submission is overdue
   */
  static async isOverdue(month: Date, currentDate: Date = new Date()): Promise<boolean> {
    const deadline = await this.getDeadline(month)
    return currentDate > deadline
  }

  /**
   * Synchronous version for backward compatibility
   */
  static isOverdueSync(month: Date, currentDate: Date = new Date()): boolean {
    const deadline = this.getDeadlineSync(month)
    return currentDate > deadline
  }

  /**
   * Get days remaining until deadline
   */
  static async getDaysUntilDeadline(month: Date, currentDate: Date = new Date()): Promise<number> {
    const deadline = await this.getDeadline(month)
    const diffTime = deadline.getTime() - currentDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  /**
   * Synchronous version for backward compatibility
   */
  static getDaysUntilDeadlineSync(month: Date, currentDate: Date = new Date()): number {
    const deadline = this.getDeadlineSync(month)
    const diffTime = deadline.getTime() - currentDate.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return Math.max(0, diffDays)
  }

  /**
   * Format deadline for display
   */
  static async formatDeadline(month: Date): Promise<string> {
    const deadline = await this.getDeadline(month)
    return format(deadline, 'EEEE, MMMM do, yyyy')
  }

  /**
   * Synchronous version for backward compatibility
   */
  static formatDeadlineSync(month: Date): string {
    const deadline = this.getDeadlineSync(month)
    return format(deadline, 'EEEE, MMMM do, yyyy')
  }

  /**
   * Get the current submission period (month) that should be displayed
   * Usually the next month, but switches to current month after deadline passes
   */
  static async getCurrentSubmissionPeriod(currentDate: Date = new Date()): Promise<Date> {
    const currentMonth = startOfMonth(currentDate)
    const nextMonth = addDays(currentMonth, 32) // Will land in next month
    
    // If we're past the deadline for next month, show the month after that
    if (await this.isOverdue(nextMonth, currentDate)) {
      return addDays(nextMonth, 32) // Month after next
    }
    
    return nextMonth
  }

  /**
   * Synchronous version for backward compatibility
   */
  static getCurrentSubmissionPeriodSync(currentDate: Date = new Date()): Date {
    const currentMonth = startOfMonth(currentDate)
    const nextMonth = addDays(currentMonth, 32) // Will land in next month
    
    // If we're past the deadline for next month, show the month after that
    if (this.isOverdueSync(nextMonth, currentDate)) {
      return addDays(nextMonth, 32) // Month after next
    }
    
    return nextMonth
  }
}