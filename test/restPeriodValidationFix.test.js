// Test rest period validation fixes - same-day vs cross-day
import { ScheduleValidator } from '../validation.js';
import { appState } from '../modules/state.js';

(function(){
  const month = '2025-09';
  const cases = [];

  function runIsolated(name, builder) {
    cases.push({ name, builder });
  }

  // Test same-day assignments are allowed (no rest period check)
  runIsolated('validateRestPeriods allows same-day early+midday', () => {
    appState.reset();
    const validator = new ScheduleValidator(month);
    const schedule = {
      '2025-09-01': {
        assignments: {
          'early': 1,    // 06:45-12:00
          'midday': 1    // 12:30-17:45
        }
      }
    };
    const issues = validator.validateRestPeriods(schedule);
    return issues.length === 0; // Should allow same-day assignments
  });

  runIsolated('validateRestPeriods allows same-day early+closing', () => {
    appState.reset();
    const validator = new ScheduleValidator(month);
    const schedule = {
      '2025-09-01': {
        assignments: {
          'early': 1,    // 06:45-12:00
          'closing': 1   // 16:45-22:15
        }
      }
    };
    const issues = validator.validateRestPeriods(schedule);
    return issues.length === 0; // Should allow same-day assignments
  });

  // Test cross-day violations are blocked
  runIsolated('validateRestPeriods blocks closing->next-day-early', () => {
    appState.reset();
    const validator = new ScheduleValidator(month);
    const schedule = {
      '2025-09-01': {
        assignments: {
          'closing': 1   // 16:45-22:15 on Sep 1
        }
      },
      '2025-09-02': {
        assignments: {
          'early': 1     // 06:45-12:00 on Sep 2 (only ~8.5h rest)
        }
      }
    };
    const issues = validator.validateRestPeriods(schedule);
    return issues.length === 1 && issues[0].type === 'rest'; // Should block cross-day violation
  });

  runIsolated('validateRestPeriods allows sufficient cross-day rest', () => {
    appState.reset();
    const validator = new ScheduleValidator(month);
    const schedule = {
      '2025-09-01': {
        assignments: {
          'closing': 1   // 16:45-22:15 on Sep 1
        }
      },
      '2025-09-02': {
        assignments: {
          'midday': 1    // 12:30-17:45 on Sep 2 (sufficient rest)
        }
      }
    };
    const issues = validator.validateRestPeriods(schedule);
    return issues.length === 0; // Should allow sufficient rest
  });

  // Execute tests
  let passed = 0, failed = 0;
  for (const c of cases) {
    let ok = false;
    try {
      ok = c.builder();
    } catch (e) {
      console.error(`Test "${c.name}" failed with exception:`, e);
      ok = false;
    }
    if (ok) {
      console.log('✓', c.name);
      passed++;
    } else {
      console.error('✗', c.name);
      failed++;
    }
  }
  console.log(`restPeriodValidationFix.test summary: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
})();