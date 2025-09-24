// Availability Debug Helper
(function() {
    console.log('=== AVAILABILITY DEBUG HELPER LOADED ===');
    
    function debugAvailability() {
        console.log('🔍 AVAILABILITY DEBUG:');
        
        // Check elements
        const staffSel = document.getElementById('availabilityStaffSelect');
        const monthSel = document.getElementById('availabilityMonth');
        const form = document.getElementById('availabilityForm');
        
        console.log('📋 Elements:');
        console.log('- Staff select:', staffSel, 'options:', staffSel?.options?.length);
        console.log('- Month select:', monthSel, 'options:', monthSel?.options?.length);
        console.log('- Form:', form);
        
        // Check values
        console.log('📊 Values:');
        console.log('- Staff value:', staffSel?.value);
        console.log('- Month value:', monthSel?.value);
        
        // Check handlers
        console.log('🛠️ Handlers:');
        console.log('- window.appUI:', !!window.appUI);
        console.log('- window.appUI.handleAvailabilityDisplay:', typeof window.appUI?.handleAvailabilityDisplay);
        console.log('- window.handleAvailabilityDisplay:', typeof window.handleAvailabilityDisplay);
        
        // Check services
        console.log('🚀 Services:');
        console.log('- window.__services:', !!window.__services);
        console.log('- window.__services.staff:', !!window.__services?.staff);
        console.log('- window.__services.availability:', !!window.__services?.availability);
        
        // Check staff data
        const staffList = window.__services?.staff?.list?.() || window.appState?.staffData || [];
        console.log('👥 Staff data:', staffList.length, 'staff members');
        
        // Try calling the handler
        if (window.appUI?.handleAvailabilityDisplay) {
            console.log('🎯 Calling window.appUI.handleAvailabilityDisplay()...');
            try {
                window.appUI.handleAvailabilityDisplay();
                console.log('✅ Handler called successfully');
            } catch (error) {
                console.error('❌ Handler failed:', error);
            }
        }
    }
    
    // Add button to test
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.createElement('button');
        btn.textContent = 'Debug Availability';
        btn.style.cssText = 'position:fixed;top:10px;right:10px;z-index:9999;background:#007bff;color:white;border:none;padding:8px;border-radius:4px;';
        btn.onclick = debugAvailability;
        document.body.appendChild(btn);
        
        // Auto-debug on load
        setTimeout(debugAvailability, 2000);
    });
    
})();