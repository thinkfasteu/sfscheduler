import { TestDataGenerator } from './utils.js';
import { appState } from './modules/state.js';  // Updated path and name

export function setupDemoData() {
    appState.reset();
    
    // Set up basic staff
    TestDataGenerator.setupBasicState();
    
    // Add availability for next 3 months
    const months = ['2024-01', '2024-02', '2024-03'];
    months.forEach(month => {
        TestDataGenerator.addAvailability('P1', month, ['early', 'midday']);
        TestDataGenerator.addAvailability('S1', month, ['evening', 'weekend-early']);
    });
    
    appState.save(true);
}
