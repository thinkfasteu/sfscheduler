// Test Minijob swap warning functionality
import { ScheduleValidator } from '../validation.js';
import { appState } from '../modules/state.js';
import { APP_CONFIG } from '../modules/config.js';

const testMonth = '2025-01';

// Mock a Minijob staff
const mockStaffData = [
  {
    id: 1,
    name: 'Test Minijobber',
    role: 'minijob',
    contractHours: 10
  }
];

// Create a schedule that puts minijob staff at/near earnings cap
// With default wage of 13.5€/hour and cap of 556€, limit is ~41.2 hours/month
const mockScheduleData = {};

// Add enough shifts to approach the earnings cap (let's say 42 hours total)
const daysWithShifts = [
  '2025-01-02', '2025-01-03', '2025-01-06', '2025-01-07', '2025-01-09', 
  '2025-01-10', '2025-01-13', '2025-01-14'
]; // 8 days

daysWithShifts.forEach(dateStr => {
  mockScheduleData[dateStr] = {
    assignments: {
      'early': 1 // 5.25 hours per shift * 8 shifts = 42 hours
    }
  };
});

// Set up mock state
appState.scheduleData = { [testMonth]: mockScheduleData };
appState.staffData = mockStaffData;

console.log('[test] Testing Minijob swap warning functionality...');

const validator = new ScheduleValidator(testMonth);
const validated = validator.validateSchedule(mockScheduleData);

// Calculate expected earnings
const totalHours = 8 * 5.25; // 42 hours
const wage = APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5;
const earnings = totalHours * wage;
const cap = APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556;

console.log(`Total hours: ${totalHours}, Earnings: €${earnings.toFixed(2)}, Cap: €${cap}`);
console.log('Earnings exceed cap:', earnings > cap);

// Check the validation results
const minijobIssues = validator.validateMinijobEarnings(mockScheduleData);
console.log('Minijob validation issues:', minijobIssues);

// Test: Should have minijob earnings warnings when above cap
const hasMinijobWarning = minijobIssues.some(issue => 
  issue.type === 'minijob' && 
  issue.severity === 'warning' && 
  issue.message.includes('Minijob earnings risk')
);

console.assert(hasMinijobWarning, 'Should have Minijob earnings warnings when above cap');
console.assert(earnings > cap, 'Test setup should put earnings above cap');

console.log('[test] Minijob swap warning tests completed! ✅');

// Clean up
delete appState.scheduleData[testMonth];
appState.staffData = [];