import { SchedulingEngine, BUSINESS_RULES } from '../scheduler.js';
import { appState } from '../modules/state.js';
import { SHIFTS, APP_CONFIG } from '../modules/config.js';

function testRest(){
  appState.staffData=[{id:1, role:'student', typicalWorkdays:5, contractHours:20}];
  const eng=new SchedulingEngine('2025-09');
  eng.lastShiftEndTimes[1]=eng.parseShiftTime('2025-09-01','22:15');
  const resEarly=BUSINESS_RULES.REST_PERIOD.validate('2025-09-02','early', appState.staffData[0], SHIFTS.early.hours, eng);
  const start=eng.parseShiftTime('2025-09-02','06:45');
  const diffH=(start - eng.lastShiftEndTimes[1]) / 3600000;
  return { rule:'REST_PERIOD', resEarly, diffH };
}

function testConsecutive(){
  appState.staffData=[{id:2, role:'student', typicalWorkdays:5, contractHours:20}];
  const eng=new SchedulingEngine('2025-09');
  eng.consecutiveDaysWorked[2]=APP_CONFIG.MAX_CONSECUTIVE_DAYS || 6; // violation
  const res=BUSINESS_RULES.MAX_CONSECUTIVE_DAYS.validate('2025-09-07','early', appState.staffData[0], SHIFTS.early.hours, eng);
  return { rule:'MAX_CONSECUTIVE_DAYS', res, streak:eng.consecutiveDaysWorked[2] };
}

function testMinijob(){
  appState.staffData=[{id:3, role:'minijob', typicalWorkdays:4, contractHours:16}];
  const eng=new SchedulingEngine('2025-09');
  const wage=APP_CONFIG.MINIJOB_HOURLY_WAGE || 13.5; const cap=APP_CONFIG.MINIJOB_MAX_EARNING || 556; const shiftH=SHIFTS.early.hours; const current=(cap - shiftH*wage + 0.2*wage)/wage; eng.monthlyHours[3]=current;
  const projected=(eng.monthlyHours[3]+shiftH)*wage;
  const res=BUSINESS_RULES.MINIJOB_EARNINGS_CAP.validate('2025-09-05','early', appState.staffData[0], shiftH, eng);
  return { rule:'MINIJOB_EARNINGS_CAP', res, projected, cap };
}

function testStudentDaytime(){
  appState.staffData=[{id:4, role:'student', typicalWorkdays:5, contractHours:20}];
  const eng=new SchedulingEngine('2025-09');
  const wk=eng.getWeekNumber(new Date(2025,8,2));
  eng.studentDaytimePerWeek[4][wk]=APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS || 1; // at cap
  const res=BUSINESS_RULES.STUDENT_WEEKDAY_DAYTIME_CAP.validate('2025-09-02','early', appState.staffData[0], SHIFTS.early.hours, eng);
  return { rule:'STUDENT_WEEKDAY_DAYTIME_CAP', res, prior:eng.studentDaytimePerWeek[4][wk], cap:APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS };
}

function testPermWeekendConsent(){
  appState.staffData=[{id:5, role:'permanent', weekendPreference:false, typicalWorkdays:5, contractHours:38}];
  appState.permanentOvertimeConsent={};
  const eng=new SchedulingEngine('2025-09');
  const res=BUSINESS_RULES.PERMANENT_WEEKEND_CONSENT.validate('2025-09-06','weekend-early', appState.staffData[0], SHIFTS['weekend-early'].hours, eng);
  return { rule:'PERMANENT_WEEKEND_CONSENT', res };
}

console.log(JSON.stringify({ rest:testRest(), consecutive:testConsecutive(), minijob:testMinijob(), student:testStudentDaytime(), weekend:testPermWeekendConsent() }, null, 2));
