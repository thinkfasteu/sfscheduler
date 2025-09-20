# Availability Reminder System

This system automatically sends email reminders to non-permanent staff to submit their monthly availability by the deadline (end of second week each month).

## Overview

### Business Rules

1. **Deadline**: Availability must be submitted by the end of the second week of each month
2. **Who Gets Reminders**: Only non-permanent staff (minijob, werkstudent) - permanent staff are assumed available for daytime shifts
3. **Reminder Schedule**:
   - **1st of month**: Initial reminder
   - **Start of week 2**: Follow-up reminder
   - **Day before deadline**: Final urgent reminder

### Components

- `AvailabilityDeadlineService`: Calculates deadlines and reminder dates
- `AvailabilityReminderService`: Generates and sends email templates
- `AvailabilityReminderScheduler`: Manages reminder job scheduling
- UI deadline alerts in the staff portal

## Setup

### 1. Email Service Configuration

Update `AvailabilityReminderService.sendEmail()` to integrate with your email provider:

```typescript
// Example with SendGrid
import sgMail from '@sendgrid/mail'

export class AvailabilityReminderService {
  static async sendEmail(to: string, template: EmailTemplate, options: any) {
    const msg = {
      to,
      from: 'noreply@ftg-sportfabrik.de',
      subject: template.subject,
      text: template.textBody,
      html: template.htmlBody,
    }
    
    await sgMail.send(msg)
  }
}
```

### 2. Database Schema

Add the reminder tracking table to your database:

```sql
CREATE TABLE IF NOT EXISTS public.availability_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES public.staff(id),
  month DATE NOT NULL, -- YYYY-MM-01 format
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('month_start', 'week_two', 'final')),
  sent_at TIMESTAMPTZ NOT NULL,
  email_address TEXT NOT NULL,
  successful BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(staff_id, month, reminder_type)
);
```

### 3. Cron Job Setup

Set up a daily cron job to run the reminder script:

```bash
# Add to crontab (runs daily at 9:00 AM)
0 9 * * * cd /path/to/sfscheduler && node scripts/sendReminders.js

# For development/testing with dry run
0 9 * * * cd /path/to/sfscheduler && node scripts/sendReminders.js --dry-run
```

### 4. Environment Variables

Add required environment variables:

```env
# Email service configuration
SENDGRID_API_KEY=your_sendgrid_key
EMAIL_FROM=noreply@ftg-sportfabrik.de

# Staff portal URL for reminder links
VITE_APP_URL=https://staff.ftg-sportfabrik.de
```

## Usage

### Testing Reminders

Test the reminder system with dry run:

```bash
# Test what would happen today
node scripts/sendReminders.js --dry-run

# Test specific date
node scripts/sendReminders.js --dry-run --date=2025-10-01
```

### Manual Reminder Send

Force send reminders for a specific date:

```bash
# Send actual reminders
node scripts/sendReminders.js --date=2025-10-01
```

### UI Deadline Display

The staff portal automatically shows deadline information:

- **Blue alert**: More than 3 days remaining
- **Yellow alert**: 3 or fewer days remaining  
- **Red alert**: Deadline passed

## Email Templates

### Month Start Reminder (1st of month)
- Professional reminder about upcoming deadline
- Clear submission link
- Friendly tone

### Week Two Reminder (Start of week 2)
- More urgent tone
- Emphasizes limited time remaining
- Warning about missing deadline

### Final Reminder (Day before deadline)
- Urgent/critical styling
- Strong language about consequences
- Last chance messaging

## Integration Points

### Database Functions Needed

Update the reminder script to connect to your database:

```typescript
// Replace mock functions with actual database calls
async function getAllStaff(): Promise<Staff[]> {
  // Query staff table for non-permanent employees
}

async function getAvailabilitySubmissions(): Promise<AvailabilitySubmission[]> {
  // Query existing submissions for the target month
}

async function getSentReminders(): Promise<AvailabilityReminder[]> {
  // Query sent reminders to avoid duplicates
}

async function trackReminder(reminder: AvailabilityReminder): Promise<void> {
  // Insert reminder record to database
}
```

## Monitoring

Monitor the reminder system:

1. **Logs**: Check reminder job logs for failures
2. **Database**: Query reminder tracking table for send statistics
3. **Email Service**: Monitor email delivery rates
4. **Staff Feedback**: Track submission rates after reminders

## Troubleshooting

### Common Issues

1. **Duplicate Reminders**: Check reminder tracking table uniqueness constraint
2. **Email Failures**: Verify email service configuration and API limits
3. **Wrong Dates**: Verify deadline calculation logic with business requirements
4. **Missing Staff**: Ensure staff table has correct roles and email addresses

### Debug Commands

```bash
# Check what reminders would be sent for specific dates
node scripts/sendReminders.js --dry-run --date=2025-10-01
node scripts/sendReminders.js --dry-run --date=2025-10-08
node scripts/sendReminders.js --dry-run --date=2025-10-13
```