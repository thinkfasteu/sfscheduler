#!/usr/bin/env node

/**
 * Daily reminder job script
 * Run this via cron job daily to send availability reminders
 * 
 * Usage:
 *   npx tsx scripts/sendReminders.ts [--dry-run] [--date=YYYY-MM-DD]
 */

const { AvailabilityReminderScheduler } = require('../packages/shared/dist/services/availabilityReminderScheduler')

// Mock data functions (replace with actual database calls in production)
async function getAllStaff() {
  // TODO: Replace with actual database query
  return [
    {
      id: 1,
      name: 'John Doe',
      email: 'john.doe@ftg-sportfabrik.de',
      role: 'minijob',
      version: 1
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane.smith@ftg-sportfabrik.de',
      role: 'werkstudent',
      version: 1
    },
    {
      id: 3,
      name: 'Manager Brown',
      email: 'manager.brown@ftg-sportfabrik.de',
      role: 'permanent', // This staff member won't get reminders
      version: 1
    }
  ]
}

async function getAvailabilitySubmissions() {
  // TODO: Replace with actual database query
  return [
    // Add actual submissions here
  ]
}

async function getSentReminders() {
  // TODO: Replace with actual database query
  return [
    // Add sent reminders here to avoid duplicates
  ]
}

async function trackReminder(reminder) {
  // TODO: Replace with actual database insert
  console.log('📝 Tracking reminder:', {
    staffId: reminder.staffId,
    month: reminder.month,
    type: reminder.reminderType,
    success: reminder.successful
  })
}

async function main() {
  const args = process.argv.slice(2)
  const isDryRun = args.includes('--dry-run')
  const dateArg = args.find(arg => arg.startsWith('--date='))
  
  let currentDate = new Date()
  if (dateArg) {
    currentDate = new Date(dateArg.split('=')[1])
  }
  
  console.log(`🚀 Starting availability reminder job for ${currentDate.toISOString().split('T')[0]}`)
  
  if (isDryRun) {
    console.log('🔍 DRY RUN MODE - No emails will be sent')
  }
  
  try {
    if (isDryRun) {
      // In dry run mode, just log what would happen
      const allStaff = await getAllStaff()
      const submissions = await getAvailabilitySubmissions()
      const sentReminders = await getSentReminders()
      
      const jobs = AvailabilityReminderScheduler.generateReminderJobs(
        currentDate,
        allStaff,
        submissions,
        sentReminders
      )
      
      console.log(`📋 Would send ${jobs.length} reminder${jobs.length === 1 ? '' : 's'}:`)
      for (const job of jobs) {
        const staff = allStaff.find(s => s.id === job.staffId)
        console.log(`  - ${job.reminderType} reminder to ${staff?.name} for ${job.month.toISOString().split('T')[0]}`)
      }
    } else {
      // Actually process reminders
      await AvailabilityReminderScheduler.processReminders(
        currentDate,
        getAllStaff,
        getAvailabilitySubmissions,
        getSentReminders,
        trackReminder
      )
    }
    
    console.log('✅ Reminder job completed successfully')
  } catch (error) {
    console.error('❌ Reminder job failed:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}