import { SchedulingEngine } from '../scheduler.js';
import { appState } from '../modules/state.js';
import { SHIFTS, APP_CONFIG } from '../modules/config.js';

// Basic fairness distribution test focusing on weekend assignment balance & student daytime cap
(function(){
  // Setup synthetic month (2025-09 has 30 days); choose small subset
  const month = '2025-09';
  appState.scheduleData[month] = {}; // start empty
  appState.staffData = [
    { id:1, role:'student', weekendPreference:false, typicalWorkdays:5, contractHours:20 },
    { id:2, role:'student', weekendPreference:false, typicalWorkdays:5, contractHours:20 },
    { id:3, role:'minijob', weekendPreference:false, typicalWorkdays:4, contractHours:16 },
    { id:4, role:'minijob', weekendPreference:false, typicalWorkdays:4, contractHours:16 }
  ];
  // Minimal config tweaks for deterministic scoring
  APP_CONFIG.WEEKEND_DISTRIBUTION_ENABLED = true;
  APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE = 2;
  APP_CONFIG.WEEKEND_FAIRNESS_PENALTY = 100;
  APP_CONFIG.WEEKEND_SATURATION_PENALTY = 250;
  APP_CONFIG.STUDENT_WEEKDAY_DAYTIME_ENABLED = true;
  APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS = 1; // cap 1 early/midday per week

  // Pre-populate some availability: everyone available for all shifts to let scoring drive decisions
  for (let d=1; d<=14; d++){ // first two weeks
    const ds = `${month}-${String(d).padStart(2,'0')}`;
    appState.scheduleData[month][ds] = { assignments:{} };
  }

  const engine = new SchedulingEngine(month);
  engine.generateSchedule();

  // Collect weekend counts for non-permanent
  const weekendCounts = engine.weekendAssignmentsCount;
  const studentDaytimeWeek1 = engine.studentDaytimePerWeek[1]?.[engine.getWeekNumber(new Date(2025,8,1))] || 0;

  // Assertions: weekend distribution difference between staff 3 & 4 should be <=1 early in month
  const diff = Math.abs((weekendCounts[3]||0) - (weekendCounts[4]||0));
  if (diff > 1) throw new Error('Weekend distribution imbalance diff='+diff);
  if (studentDaytimeWeek1 > 1) throw new Error('Student daytime cap exceeded week1: '+studentDaytimeWeek1);

  console.log('fairness.test passed');
})();
