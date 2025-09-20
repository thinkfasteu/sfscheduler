import { format, isSameDay } from 'date-fns'
import { AvailabilityDeadlineService } from './availabilityDeadlineService'
import { AvailabilityReminderService } from './availabilityReminderService'
import type { Staff, AvailabilitySubmission, AvailabilityReminder, ReminderType } from '../types'

export interface ReminderJob {
  staffId: number
  month: Date
  reminderType: ReminderType
  scheduledDate: Date
}

/**
 * Service for scheduling and processing availability reminder jobs
 */
export class AvailabilityReminderScheduler {
  /**
   * Check if a staff member needs reminders for the given month
   */
  static shouldSendReminders(staff: Staff, month: Date): boolean {
    return AvailabilityDeadlineService.isSubmissionRequired(staff)
  }

  /**
   * Check if availability has been submitted for a month
   */
  static hasSubmittedAvailability(
    staffId: number, 
    month: Date, 
    submissions: AvailabilitySubmission[]
  ): boolean {
    const monthKey = format(month, 'yyyy-MM-01')
    return submissions.some(sub => 
      sub.staffId === staffId && 
      sub.month === monthKey && 
      (sub.status === 'submitted' || sub.status === 'locked')
    )
  }

  /**
   * Check if a reminder has already been sent
   */
  static hasReminderBeenSent(
    staffId: number,
    month: Date,
    reminderType: ReminderType,
    sentReminders: AvailabilityReminder[]
  ): boolean {
    const monthKey = format(month, 'yyyy-MM-01')
    return sentReminders.some(reminder =>
      reminder.staffId === staffId &&
      reminder.month === monthKey &&
      reminder.reminderType === reminderType &&
      reminder.successful
    )
  }

  /**
   * Generate reminder jobs for a specific date
   */
  static generateReminderJobs(
    currentDate: Date,
    allStaff: Staff[],
    submissions: AvailabilitySubmission[],
    sentReminders: AvailabilityReminder[]
  ): ReminderJob[] {
    const jobs: ReminderJob[] = []

    // Get the month we're creating reminders for
    // This is usually next month (since we remind people about next month's availability)
    const targetMonth = AvailabilityDeadlineService.getCurrentSubmissionPeriod(currentDate)
    const reminderDates = AvailabilityDeadlineService.getReminderDates(targetMonth)

    // Determine which type of reminder to send today
    let reminderType: ReminderType | null = null
    
    if (isSameDay(currentDate, reminderDates.monthStart)) {
      reminderType = 'month_start'
    } else if (isSameDay(currentDate, reminderDates.weekTwoStart)) {
      reminderType = 'week_two'
    } else if (isSameDay(currentDate, reminderDates.dayBeforeDeadline)) {
      reminderType = 'final'
    }

    if (!reminderType) {
      return jobs // No reminders to send today
    }

    // Create jobs for eligible staff
    for (const staff of allStaff) {
      // Skip if staff doesn't need reminders
      if (!this.shouldSendReminders(staff, targetMonth)) {
        continue
      }

      // Skip if availability already submitted
      if (this.hasSubmittedAvailability(staff.id, targetMonth, submissions)) {
        continue
      }

      // Skip if this reminder type was already sent
      if (this.hasReminderBeenSent(staff.id, targetMonth, reminderType, sentReminders)) {
        continue
      }

      jobs.push({
        staffId: staff.id,
        month: targetMonth,
        reminderType,
        scheduledDate: currentDate
      })
    }

    return jobs
  }

  /**
   * Process a single reminder job
   */
  static async processReminderJob(
    job: ReminderJob,
    staff: Staff,
    trackReminder: (reminder: Omit<AvailabilityReminder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  ): Promise<void> {
    try {
      const context = AvailabilityReminderService.getReminderContext(staff, job.month)
      let template

      switch (job.reminderType) {
        case 'month_start':
          template = AvailabilityReminderService.generateMonthStartReminder(context)
          break
        case 'week_two':
          template = AvailabilityReminderService.generateWeekTwoReminder(context)
          break
        case 'final':
          template = AvailabilityReminderService.generateFinalReminder(context)
          break
        default:
          throw new Error(`Unknown reminder type: ${job.reminderType}`)
      }

      // Send the email
      await AvailabilityReminderService.sendEmail(
        staff.email || `${staff.name.toLowerCase().replace(/\s+/g, '.')}@ftg-sportfabrik.de`,
        template,
        {
          staffId: staff.id,
          month: job.month,
          reminderType: job.reminderType
        }
      )

      // Track successful reminder
      await trackReminder({
        staffId: staff.id,
        month: format(job.month, 'yyyy-MM-01'),
        reminderType: job.reminderType,
        sentAt: new Date().toISOString(),
        emailAddress: staff.email || `${staff.name.toLowerCase().replace(/\s+/g, '.')}@ftg-sportfabrik.de`,
        successful: true
      })

      console.log(`✅ Sent ${job.reminderType} reminder to ${staff.name} for ${format(job.month, 'MMMM yyyy')}`)

    } catch (error) {
      console.error(`❌ Failed to send ${job.reminderType} reminder to ${staff.name}:`, error)

      // Track failed reminder
      await trackReminder({
        staffId: staff.id,
        month: format(job.month, 'yyyy-MM-01'),
        reminderType: job.reminderType,
        sentAt: new Date().toISOString(),
        emailAddress: staff.email || `${staff.name.toLowerCase().replace(/\s+/g, '.')}@ftg-sportfabrik.de`,
        successful: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  /**
   * Process all reminders for a given date
   */
  static async processReminders(
    currentDate: Date,
    getAllStaff: () => Promise<Staff[]>,
    getAvailabilitySubmissions: () => Promise<AvailabilitySubmission[]>,
    getSentReminders: () => Promise<AvailabilityReminder[]>,
    trackReminder: (reminder: Omit<AvailabilityReminder, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>
  ): Promise<void> {
    console.log(`🔍 Processing availability reminders for ${format(currentDate, 'yyyy-MM-dd')}`)

    try {
      const [allStaff, submissions, sentReminders] = await Promise.all([
        getAllStaff(),
        getAvailabilitySubmissions(),
        getSentReminders()
      ])

      const jobs = this.generateReminderJobs(currentDate, allStaff, submissions, sentReminders)

      if (jobs.length === 0) {
        console.log('📭 No reminders to send today')
        return
      }

      console.log(`📬 Processing ${jobs.length} reminder job${jobs.length === 1 ? '' : 's'}`)

      // Process jobs sequentially to avoid overwhelming email service
      for (const job of jobs) {
        const staff = allStaff.find(s => s.id === job.staffId)
        if (staff) {
          await this.processReminderJob(job, staff, trackReminder)
          // Small delay between emails
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }

      console.log(`✅ Completed processing ${jobs.length} reminder${jobs.length === 1 ? '' : 's'}`)

    } catch (error) {
      console.error('❌ Error processing availability reminders:', error)
      throw error
    }
  }
}