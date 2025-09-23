// Simple functionality test to identify what's broken
import { createServices } from './src/services/index.js';

async function testCore() {
    console.log('=== FUNCTIONALITY TEST ===');
    
    try {
        console.log('1. Creating services...');
        const services = createServices();
        console.log('2. Services created:', !!services);
        
        console.log('3. Waiting for services.ready...');
        await services.ready;
        console.log('4. Services ready!');
        
        console.log('5. Backend type:', services.backend);
        console.log('6. Staff service available:', !!services.staff);
        console.log('7. Availability service available:', !!services.availability);
        console.log('8. Schedule service available:', !!services.schedule);
        
        // Test basic staff operations
        console.log('9. Testing staff list...');
        const staffList = services.staff.list();
        console.log('10. Staff count:', staffList.length);
        
        // Test availability operations  
        console.log('11. Testing availability operations...');
        const testMonth = '2025-09';
        if (staffList.length > 0) {
            const testStaffId = staffList[0].id;
            console.log('12. Testing availability for staff', testStaffId, 'month', testMonth);
            await services.availability.listRange(testStaffId, testMonth);
            console.log('13. Availability operations work');
        }
        
        console.log('=== ALL TESTS PASSED ===');
        
    } catch (error) {
        console.error('=== TEST FAILED ===');
        console.error('Error:', error);
        console.error('Stack:', error.stack);
    }
}

// Run when page loads
if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', testCore);
} else {
    testCore();
}