import { BUSINESS_RULES, SchedulingEngine } from '../scheduler.js';
import { appState } from '../modules/state.js';
import { SHIFTS, APP_CONFIG } from '../modules/config.js';

// Fully isolated per-case validator tests
(function(){
  const month='2025-09';
  const cases=[];

  function runIsolated(name, builder){
    cases.push({ name, builder });
  }

  // REST_PERIOD
  runIsolated('REST_PERIOD negative', () => {
    appState.reset();
    appState.staffData=[{id:1, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month);
    eng.lastShiftEndTimes[1]=eng.parseShiftTime('2025-09-01','22:15');
    return BUSINESS_RULES.REST_PERIOD.validate('2025-09-02','early', appState.staffData[0], SHIFTS.early.hours, eng) === false;
  });
  runIsolated('REST_PERIOD positive', () => {
    appState.reset();
    appState.staffData=[{id:2, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); eng.lastShiftEndTimes[2]=eng.parseShiftTime('2025-09-01','22:15');
    return BUSINESS_RULES.REST_PERIOD.validate('2025-09-02','midday', appState.staffData[0], SHIFTS.midday.hours, eng) === true;
  });
  runIsolated('REST_PERIOD ignores future lastShiftEndTimes', () => {
    appState.reset();
    appState.staffData=[{id:21, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month);
    // Seed last end time to a future date relative to the evaluated shift start
    eng.lastShiftEndTimes[21]=eng.parseShiftTime('2025-09-20','22:15');
    // Validating on an earlier date should not be blocked by REST_PERIOD
    return BUSINESS_RULES.REST_PERIOD.validate('2025-09-05','early', appState.staffData[0], SHIFTS.early.hours, eng) === true;
  });

  // MAX_CONSECUTIVE_DAYS
  runIsolated('MAX_CONSECUTIVE_DAYS negative', ()=>{
    appState.reset(); appState.staffData=[{id:3, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); eng.consecutiveDaysWorked[3]=APP_CONFIG.MAX_CONSECUTIVE_DAYS||6;
    return BUSINESS_RULES.MAX_CONSECUTIVE_DAYS.validate('2025-09-07','early', appState.staffData[0], SHIFTS.early.hours, eng) === false;
  });
  runIsolated('MAX_CONSECUTIVE_DAYS positive', ()=>{
    appState.reset(); appState.staffData=[{id:4, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); eng.consecutiveDaysWorked[4]=(APP_CONFIG.MAX_CONSECUTIVE_DAYS||6)-1;
    return BUSINESS_RULES.MAX_CONSECUTIVE_DAYS.validate('2025-09-07','early', appState.staffData[0], SHIFTS.early.hours, eng) === true;
  });

  // MINIJOB_EARNINGS_CAP
  runIsolated('MINIJOB_EARNINGS_CAP negative', ()=>{
    appState.reset(); appState.staffData=[{id:5, role:'minijob', typicalWorkdays:4, contractHours:16}];
    const eng=new SchedulingEngine(month);
    const wage=APP_CONFIG.MINIJOB_HOURLY_WAGE||13.5; const cap=APP_CONFIG.MINIJOB_MAX_EARNING||556; const shiftH=SHIFTS.early.hours;
    eng.monthlyHours[5]=(cap - shiftH*wage + 0.2*wage)/wage; // exceed after adding shift
    return BUSINESS_RULES.MINIJOB_EARNINGS_CAP.validate('2025-09-05','early', appState.staffData[0], shiftH, eng) === false;
  });
  runIsolated('MINIJOB_EARNINGS_CAP positive', ()=>{
    appState.reset(); appState.staffData=[{id:6, role:'minijob', typicalWorkdays:4, contractHours:16}];
    const eng=new SchedulingEngine(month); eng.monthlyHours[6]=20;
    return BUSINESS_RULES.MINIJOB_EARNINGS_CAP.validate('2025-09-05','early', appState.staffData[0], SHIFTS.early.hours, eng) === true;
  });

  // STUDENT_WEEKDAY_DAYTIME_CAP
  runIsolated('STUDENT_WEEKDAY_DAYTIME_CAP negative', ()=>{
    appState.reset(); appState.staffData=[{id:7, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); const wk=eng.getWeekNumber(new Date(2025,8,2)); eng.studentDaytimePerWeek[7][wk]=APP_CONFIG.STUDENT_MAX_WEEKDAY_DAYTIME_SHIFTS||1;
    return BUSINESS_RULES.STUDENT_WEEKDAY_DAYTIME_CAP.validate('2025-09-02','early', appState.staffData[0], SHIFTS.early.hours, eng) === false;
  });
  runIsolated('STUDENT_WEEKDAY_DAYTIME_CAP positive', ()=>{
    appState.reset(); appState.staffData=[{id:8, role:'student', typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); const wk=eng.getWeekNumber(new Date(2025,8,2)); eng.studentDaytimePerWeek[8][wk]=0;
    return BUSINESS_RULES.STUDENT_WEEKDAY_DAYTIME_CAP.validate('2025-09-02','early', appState.staffData[0], SHIFTS.early.hours, eng) === true;
  });

  // PERMANENT_WEEKEND_CONSENT
  runIsolated('PERMANENT_WEEKEND_CONSENT negative', ()=>{
    appState.reset(); appState.staffData=[{id:9, role:'permanent', weekendPreference:false, typicalWorkdays:5, contractHours:38}]; appState.permanentOvertimeConsent={};
    const eng=new SchedulingEngine(month);
    return BUSINESS_RULES.PERMANENT_WEEKEND_CONSENT.validate('2025-09-06','weekend-early', appState.staffData[0], SHIFTS['weekend-early'].hours, eng) === false;
  });
  runIsolated('PERMANENT_WEEKEND_CONSENT positive', ()=>{
    appState.reset(); appState.staffData=[{id:10, role:'permanent', weekendPreference:false, typicalWorkdays:5, contractHours:38}];
    appState.permanentOvertimeConsent={ 10: { '2025': { '2025-09-06': true } } };
    const eng=new SchedulingEngine(month);
    return BUSINESS_RULES.PERMANENT_WEEKEND_CONSENT.validate('2025-09-06','weekend-early', appState.staffData[0], SHIFTS['weekend-early'].hours, eng) === true;
  });

  // NON_PERMANENT_WEEKEND_MAX
  runIsolated('NON_PERMANENT_WEEKEND_MAX negative', ()=>{
    appState.reset(); appState.staffData=[{id:11, role:'student', weekendPreference:false, typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); eng.weekendAssignmentsCount[11]=(APP_CONFIG.MAX_WEEKENDS_WITHOUT_PREFERENCE||2);
    return BUSINESS_RULES.NON_PERMANENT_WEEKEND_MAX.validate('2025-09-07','weekend-early', appState.staffData[0], SHIFTS['weekend-early'].hours, eng) === false;
  });
  runIsolated('NON_PERMANENT_WEEKEND_MAX positive', ()=>{
    appState.reset(); appState.staffData=[{id:12, role:'student', weekendPreference:false, typicalWorkdays:5, contractHours:20}];
    const eng=new SchedulingEngine(month); eng.weekendAssignmentsCount[12]=0;
    return BUSINESS_RULES.NON_PERMANENT_WEEKEND_MAX.validate('2025-09-07','weekend-early', appState.staffData[0], SHIFTS['weekend-early'].hours, eng) === true;
  });

  // Execute sequentially
  let passed=0, failed=0;
  for (const c of cases){
    let ok=false; try { ok = c.builder(); } catch(e){ ok=false; }
    if (ok){ console.log('✓', c.name); passed++; } else { console.error('✗', c.name); failed++; }
  }
  console.log(`businessRulesEdgeCases.test summary: ${passed} passed, ${failed} failed`);
  if (failed>0) process.exit(1);
})();
