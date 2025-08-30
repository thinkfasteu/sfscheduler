import { state } from '../state.js';
import { ROLE_TYPES } from '../types.js';

/**
 * Test data generation utilities
 */
export class TestDataGenerator {
    static createStaff(id, role = ROLE_TYPES.PERMANENT) {
        return {
            id,
            role,
            weeklyHours: role === ROLE_TYPES.PERMANENT ? 40 : 20,
            typicalDays: role === ROLE_TYPES.PERMANENT ? 5 : 3,
            weekendPreference: false
        };
    }

    static setupBasicState() {
        state.reset();
        state.staffData = [
            this.createStaff('P1', ROLE_TYPES.PERMANENT),
            this.createStaff('S1', ROLE_TYPES.STUDENT),
            this.createStaff('M1', ROLE_TYPES.MINIJOB)
        ];
        return state;
    }

    static addAvailability(staffId, date, shifts, preference = 'yes') {
        if (!state.availabilityData[staffId]) {
            state.availabilityData[staffId] = {};
        }
        if (!state.availabilityData[staffId][date]) {
            state.availabilityData[staffId][date] = {};
        }
        
        shifts.forEach(shift => {
            state.availabilityData[staffId][date][shift] = preference;
        });
    }
}

/**
 * Test assertions
 */
export class TestAssertions {
    static assertScheduleValid(schedule, month) {
        const errors = [];
        
        // Check basic structure
        if (!schedule.data) {
            errors.push('Schedule data missing');
        }

        // Check assignments
        Object.entries(schedule.data).forEach(([date, day]) => {
            if (!day.assignments) {
                errors.push(`Missing assignments for ${date}`);
            }
        });

        if (errors.length > 0) {
            throw new Error(`Schedule validation failed:\n${errors.join('\n')}`);
        }
        return true;
    }

    static assertRestPeriods(schedule) {
        // Implementation for rest period validation
    }

    static assertWorkloadLimits(schedule) {
        // Implementation for workload validation
    }
}
