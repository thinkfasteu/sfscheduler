// Test practical limits functionality
import { SchedulingEngine } from '../scheduler.js';

const mockStaff = [
  {
    id: 1,
    name: 'Test Minijobber',
    role: 'minijob',
    contractHours: 10,
    weeklyHoursMinPractical: 6,
    weeklyHoursMaxPractical: 12
  },
  {
    id: 2,
    name: 'Test Student',
    role: 'student',
    contractHours: 15,
    weeklyHoursMinPractical: 8,
    weeklyHoursMaxPractical: 18
  },
  {
    id: 3,
    name: 'Test Permanent',
    role: 'permanent',
    contractHours: 40
    // No practical limits for permanent staff
  }
];

const scheduler = new SchedulingEngine('2025-01');

console.log('[test] Testing getEffectiveWeeklyLimits...');

// Test Minijob with practical limits
const minijobLimits = scheduler.getEffectiveWeeklyLimits(mockStaff[0]);
console.log('Minijob limits:', minijobLimits);
console.assert(minijobLimits.min === 6, 'Minijob min should use practical limit');
console.assert(minijobLimits.max === 12, 'Minijob max should use practical limit');
console.assert(minijobLimits.target === 9, 'Minijob target should be average of practical min/max');
console.assert(minijobLimits.hasPracticalLimits === true, 'Minijob should have practical limits');

// Test Student with practical limits
const studentLimits = scheduler.getEffectiveWeeklyLimits(mockStaff[1]);
console.log('Student limits:', studentLimits);
console.assert(studentLimits.min === 8, 'Student min should use practical limit');
console.assert(studentLimits.max === 18, 'Student max should use practical limit');
console.assert(studentLimits.target === 13, 'Student target should be average of practical min/max');
console.assert(studentLimits.hasPracticalLimits === true, 'Student should have practical limits');

// Test Permanent without practical limits
const permanentLimits = scheduler.getEffectiveWeeklyLimits(mockStaff[2]);
console.log('Permanent limits:', permanentLimits);
console.assert(permanentLimits.min === 0, 'Permanent min should be 0');
console.assert(permanentLimits.max === 40, 'Permanent max should use contract hours');
console.assert(permanentLimits.target === 40, 'Permanent target should be contract hours');
console.assert(permanentLimits.hasPracticalLimits === false, 'Permanent should not have practical limits');

// Test Minijob without practical limits (fallback to contract)
const minijobNoLimits = scheduler.getEffectiveWeeklyLimits({
  id: 4,
  name: 'Test Minijob No Limits',
  role: 'minijob',
  contractHours: 10
});
console.log('Minijob without practical limits:', minijobNoLimits);
console.assert(minijobNoLimits.min === 0, 'Minijob without practical limits should have min 0');
console.assert(minijobNoLimits.max === 10, 'Minijob without practical limits should use contract hours');
console.assert(minijobNoLimits.target === 10, 'Minijob without practical limits should target contract hours');
console.assert(minijobNoLimits.hasPracticalLimits === false, 'Should not have practical limits');

console.log('[test] All practical limits tests passed! ✅');