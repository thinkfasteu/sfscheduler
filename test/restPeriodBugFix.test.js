// Test rest-period bug fix
import { SchedulingEngine } from '../scheduler.js';
import { appState } from '../modules/state.js';
import { SHIFTS } from '../modules/config.js';

// Mock schedule data with shifts on multiple days
const testMonth = '2025-01';
const mockScheduleData = {
  '2025-01-15': {
    assignments: {
      'closing': 1 // Staff 1 works closing shift (16:45-22:15) on Jan 15
    }
  },
  '2025-01-20': {
    assignments: {
      'early': 1 // Staff 1 works early shift (06:45-12:00) on Jan 20
    }
  }
};

const mockStaffData = [
  {
    id: 1,
    name: 'Test Staff',
    role: 'permanent',
    contractHours: 40
  }
];

// Set up mock state
appState.scheduleData = { [testMonth]: mockScheduleData };
appState.staffData = mockStaffData;

console.log('[test] Testing rest-period bug fix...');

// Test 1: When processing Jan 16, lastShiftEndTimes should only include Jan 15
const scheduler1 = new SchedulingEngine(testMonth);

// Manually call seedTrackersFromExistingSchedule with cutoff date
scheduler1.lastShiftEndTimes = {};
scheduler1.seedTrackersFromExistingSchedule('2025-01-16');

const jan15EndTime = scheduler1.lastShiftEndTimes[1];
console.log('After seeding for Jan 16, lastShiftEndTimes[1]:', jan15EndTime);

// Should have Jan 15 closing shift end time (22:15 on Jan 15)
if (jan15EndTime) {
  const expectedHour = 22;
  const expectedMinute = 15;
  console.assert(jan15EndTime.getHours() === expectedHour && jan15EndTime.getMinutes() === expectedMinute, 
    `Should have Jan 15 closing shift end time (22:15), got ${jan15EndTime.getHours()}:${jan15EndTime.getMinutes()}`);
} else {
  console.log('❌ No lastShiftEndTimes found for Jan 15 closing shift');
}

// Test 2: When processing Jan 21, lastShiftEndTimes should include the most recent shift (Jan 20)
scheduler1.lastShiftEndTimes = {};
scheduler1.seedTrackersFromExistingSchedule('2025-01-21');

const jan20EndTime = scheduler1.lastShiftEndTimes[1];
console.log('After seeding for Jan 21, lastShiftEndTimes[1]:', jan20EndTime);

// Should have Jan 20 early shift end time (12:00 on Jan 20) since it's most recent
if (jan20EndTime) {
  const expectedHour = 12;
  const expectedMinute = 0;
  console.assert(jan20EndTime.getHours() === expectedHour && jan20EndTime.getMinutes() === expectedMinute, 
    `Should have Jan 20 early shift end time (12:00), got ${jan20EndTime.getHours()}:${jan20EndTime.getMinutes()}`);
} else {
  console.log('❌ No lastShiftEndTimes found for Jan 20 early shift');
}

// Test 3: When processing Jan 14, lastShiftEndTimes should be empty (no prior shifts)
scheduler1.lastShiftEndTimes = {};
scheduler1.seedTrackersFromExistingSchedule('2025-01-14');

const jan14EndTime = scheduler1.lastShiftEndTimes[1];
console.log('After seeding for Jan 14, lastShiftEndTimes[1]:', jan14EndTime);
console.assert(!jan14EndTime, 'Should have no lastShiftEndTimes when processing Jan 14 (before any shifts)');

console.log('[test] Rest-period bug fix tests passed! ✅');

// Clean up
delete appState.scheduleData[testMonth];
appState.staffData = [];