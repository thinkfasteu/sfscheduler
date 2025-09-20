import { format } from 'date-fns'
import { AvailabilityDeadlineService } from './availabilityDeadlineService'
import type { Staff } from '../types'

export interface EmailTemplate {
  subject: string
  htmlBody: string
  textBody: string
}

export interface ReminderContext {
  staff: Staff
  month: Date
  deadline: Date
  daysRemaining: number
  submissionUrl: string
}

/**
 * Service for generating and sending availability reminder emails
 */
export class AvailabilityReminderService {
  private static baseUrl: string = process.env.VITE_APP_URL || 'http://localhost:3001'

  /**
   * Generate email template for month start reminder (1st of month)
   */
  static generateMonthStartReminder(context: ReminderContext): EmailTemplate {
    const { staff, month, deadline, submissionUrl } = context
    const monthName = format(month, 'MMMM yyyy')
    const deadlineFormatted = format(deadline, 'EEEE, MMMM do')

    return {
      subject: `📅 Availability Submission Required - ${monthName}`,
      
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <h2 style="color: #333; margin: 0;">Monthly Availability Submission</h2>
          </div>
          
          <p>Hello ${staff.name},</p>
          
          <p>This is a reminder to submit your availability for <strong>${monthName}</strong>.</p>
          
          <div style="background: #e3f2fd; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0;"><strong>📋 Submission deadline:</strong> ${deadlineFormatted}</p>
          </div>
          
          <p>Please submit your availability as soon as possible to help us create the best possible schedule for everyone.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${submissionUrl}" 
               style="background: #2196f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Submit Availability Now
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            If you have any questions about submitting your availability, please contact your manager.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated reminder from the FTG Sportfabrik Staff Portal.
          </p>
        </div>
      `,
      
      textBody: `
Monthly Availability Submission - ${monthName}

Hello ${staff.name},

This is a reminder to submit your availability for ${monthName}.

Submission deadline: ${deadlineFormatted}

Please submit your availability as soon as possible to help us create the best possible schedule for everyone.

Submit your availability here: ${submissionUrl}

If you have any questions about submitting your availability, please contact your manager.

---
This is an automated reminder from the FTG Sportfabrik Staff Portal.
      `.trim()
    }
  }

  /**
   * Generate email template for week 2 reminder
   */
  static generateWeekTwoReminder(context: ReminderContext): EmailTemplate {
    const { staff, month, deadline, daysRemaining, submissionUrl } = context
    const monthName = format(month, 'MMMM yyyy')
    const deadlineFormatted = format(deadline, 'EEEE, MMMM do')

    return {
      subject: `⏰ Availability Submission Due Soon - ${monthName}`,
      
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #ffc107;">
            <h2 style="color: #856404; margin: 0;">⏰ Availability Submission Reminder</h2>
          </div>
          
          <p>Hello ${staff.name},</p>
          
          <p>We haven't received your availability submission for <strong>${monthName}</strong> yet.</p>
          
          <div style="background: #f8d7da; padding: 15px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #dc3545;">
            <p style="margin: 0;"><strong>⚠️ Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining!</strong></p>
            <p style="margin: 5px 0 0 0;">Deadline: ${deadlineFormatted}</p>
          </div>
          
          <p>Please submit your availability as soon as possible to avoid missing the deadline.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${submissionUrl}" 
               style="background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              Submit Availability Now
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Late submissions may affect schedule planning. If you have any issues, please contact your manager immediately.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated reminder from the FTG Sportfabrik Staff Portal.
          </p>
        </div>
      `,
      
      textBody: `
Availability Submission Due Soon - ${monthName}

Hello ${staff.name},

We haven't received your availability submission for ${monthName} yet.

⚠️ Only ${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining!
Deadline: ${deadlineFormatted}

Please submit your availability as soon as possible to avoid missing the deadline.

Submit your availability here: ${submissionUrl}

Late submissions may affect schedule planning. If you have any issues, please contact your manager immediately.

---
This is an automated reminder from the FTG Sportfabrik Staff Portal.
      `.trim()
    }
  }

  /**
   * Generate email template for final reminder (day before deadline)
   */
  static generateFinalReminder(context: ReminderContext): EmailTemplate {
    const { staff, month, deadline, submissionUrl } = context
    const monthName = format(month, 'MMMM yyyy')
    const deadlineFormatted = format(deadline, 'EEEE, MMMM do')

    return {
      subject: `🚨 URGENT: Availability Submission Due Tomorrow - ${monthName}`,
      
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #f8d7da; padding: 20px; border-radius: 8px; margin-bottom: 20px; border-left: 4px solid #dc3545;">
            <h2 style="color: #721c24; margin: 0;">🚨 URGENT: Final Reminder</h2>
          </div>
          
          <p>Hello ${staff.name},</p>
          
          <p><strong>This is your final reminder</strong> to submit your availability for <strong>${monthName}</strong>.</p>
          
          <div style="background: #dc3545; color: white; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 18px;"><strong>⏰ DEADLINE TOMORROW!</strong></p>
            <p style="margin: 5px 0 0 0;">${deadlineFormatted}</p>
          </div>
          
          <p>Without your availability submission, we cannot guarantee you will be scheduled for your preferred shifts.</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${submissionUrl}" 
               style="background: #dc3545; color: white; padding: 15px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-size: 16px;">
              Submit Availability Immediately
            </a>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            <strong>Important:</strong> Failure to submit availability by the deadline may result in reduced hours or unfavorable shift assignments.
          </p>
          
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
          <p style="color: #999; font-size: 12px;">
            This is an automated reminder from the FTG Sportfabrik Staff Portal.
          </p>
        </div>
      `,
      
      textBody: `
🚨 URGENT: Availability Submission Due Tomorrow - ${monthName}

Hello ${staff.name},

This is your FINAL REMINDER to submit your availability for ${monthName}.

⏰ DEADLINE TOMORROW!
${deadlineFormatted}

Without your availability submission, we cannot guarantee you will be scheduled for your preferred shifts.

Submit your availability immediately: ${submissionUrl}

IMPORTANT: Failure to submit availability by the deadline may result in reduced hours or unfavorable shift assignments.

---
This is an automated reminder from the FTG Sportfabrik Staff Portal.
      `.trim()
    }
  }

  /**
   * Generate submission URL for a staff member and month
   */
  static generateSubmissionUrl(staffId: number, month: Date): string {
    const monthKey = format(month, 'yyyy-MM')
    return `${this.baseUrl}/availability?month=${monthKey}&staff=${staffId}`
  }

  /**
   * Get reminder context for a staff member and month
   */
  static getReminderContext(staff: Staff, month: Date): ReminderContext {
    const deadline = AvailabilityDeadlineService.getDeadline(month)
    const daysRemaining = AvailabilityDeadlineService.getDaysUntilDeadline(month)
    const submissionUrl = this.generateSubmissionUrl(staff.id, month)

    return {
      staff,
      month,
      deadline,
      daysRemaining,
      submissionUrl
    }
  }

  /**
   * Send email (integration point for actual email service)
   */
  static async sendEmail(
    to: string, 
    template: EmailTemplate, 
    options: { staffId: number; month: Date; reminderType: 'month_start' | 'week_two' | 'final' }
  ): Promise<void> {
    // TODO: Integrate with actual email service (SendGrid, AWS SES, etc.)
    console.log('📧 Sending email reminder:', {
      to,
      subject: template.subject,
      reminderType: options.reminderType,
      staffId: options.staffId,
      month: format(options.month, 'yyyy-MM'),
      preview: template.textBody.substring(0, 100) + '...'
    })
    
    // In production, implement actual email sending here
    // Example with SendGrid:
    // await sendGridClient.send({
    //   to,
    //   from: 'noreply@ftg-sportfabrik.de',
    //   subject: template.subject,
    //   html: template.htmlBody,
    //   text: template.textBody
    // })
  }
}