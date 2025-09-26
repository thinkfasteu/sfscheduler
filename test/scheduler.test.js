import { SchedulingEngine } from '../scheduler.js';
import { appState } from '@state';  // Updated path
import { TestDataGenerator, TestAssertions } from '../utils.js';  // Updated path

const tests = {
    async testBasicScheduleGeneration() {
        console.log('Testing basic schedule generation...');
        // Setup
        TestDataGenerator.setupBasicState();
        const month = '2024-01';
        const engine = new SchedulingEngine(month);
        
        // Add test data
        TestDataGenerator.addAvailability('P1', '2024-01-01', ['early', 'midday']);
        TestDataGenerator.addAvailability('S1', '2024-01-01', ['evening']);
        
        // Execute
        const schedule = engine.generateSchedule();
        
        // Verify
        if (!schedule.data['2024-01-01']) {
            throw new Error('Schedule not generated for test date');
        }
        return true;
    },

    async testWorkloadLimits() {
        console.log('Testing workload limits...');
        // Setup
        TestDataGenerator.setupBasicState();
        const month = '2024-01';
        const engine = new SchedulingEngine(month);
        
        // Add excessive availability
        for (let day = 1; day <= 31; day++) {
            const date = `2024-01-${String(day).padStart(2, '0')}`;
            TestDataGenerator.addAvailability('S1', date, ['early', 'midday', 'evening']);
        }
        
        const schedule = engine.generateSchedule();
        
        // Verify student hours don't exceed 20/week
        let weeklyHours = {};
        Object.entries(schedule.data).forEach(([date, day]) => {
            // Add verification logic here
        });
        
        return true;
    }
};

// Test runner
async function runTests() {
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

// Run tests
runTests().then(success => {
    process.exit(success ? 0 : 1);
});
