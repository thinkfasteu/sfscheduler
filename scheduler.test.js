import { SchedulingEngine } from '../scheduler.js';
import { TestDataGenerator, TestAssertions } from './utils.js';

async function runTests() {
    const tests = {
        async testBasicScheduleGeneration() {
            const state = TestDataGenerator.setupBasicState();
            const month = '2024-01';
            const engine = new SchedulingEngine(month);
            
            // Add basic availability
            TestDataGenerator.addAvailability('P1', '2024-01-01', ['early', 'midday']);
            
            const schedule = engine.generateSchedule();
            TestAssertions.assertScheduleValid(schedule, month);
            
            return true;
        },

        async testWorkloadDistribution() {
            // Test workload distribution
        },

        async testWeekendFairness() {
            // Test weekend distribution
        }
    };

    let passed = 0;
    let failed = 0;

    for (const [name, test] of Object.entries(tests)) {
        try {
            console.log(`Running ${name}...`);
            await test();
            console.log(`✓ ${name} passed`);
            passed++;
        } catch (e) {
            console.error(`✗ ${name} failed:`, e);
            failed++;
        }
    }

    console.log(`\nTest Summary: ${passed} passed, ${failed} failed`);
    return failed === 0;
}

runTests().then(success => {
    process.exit(success ? 0 : 1);
});
