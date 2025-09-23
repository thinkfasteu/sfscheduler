// Debug helper for testing generate schedule functionality
(function() {
    console.log('=== SCHEDULE DEBUG HELPER LOADED ===');
    
    // Override the generate button click to add debugging
    function debugGenerateSchedule() {
        console.log('🔥 DEBUG: Generate schedule button clicked!');
        
        // Check if services are available
        console.log('Services available:', !!window.__services);
        console.log('EventHandler available:', !!window.handlers);
        console.log('AppState available:', !!window.appState);
        
        // Check if month is selected
        const monthEl = document.getElementById('scheduleMonth');
        console.log('Month element:', monthEl);
        console.log('Selected month:', monthEl?.value);
        
        // Try to call the actual method
        if (window.handlers && window.handlers.generateSchedule) {
            console.log('🚀 Calling handlers.generateSchedule()...');
            try {
                window.handlers.generateSchedule();
            } catch (error) {
                console.error('❌ Error in generateSchedule:', error);
            }
        } else {
            console.error('❌ No generateSchedule method found on handlers');
        }
    }
    
    // Override the generate schedule function globally
    const originalGenerate = window.generateSchedule;
    window.generateSchedule = function() {
        console.log('🎯 window.generateSchedule called');
        debugGenerateSchedule();
        if (originalGenerate) {
            try {
                return originalGenerate.apply(this, arguments);
            } catch (e) {
                console.error('Error in original generateSchedule:', e);
            }
        }
    };
    
    // Also add click listener directly to button
    document.addEventListener('DOMContentLoaded', () => {
        const btn = document.getElementById('generateScheduleBtn');
        if (btn) {
            console.log('✅ Found generate button, adding debug listener');
            btn.addEventListener('click', (e) => {
                console.log('🖱️ Direct click listener triggered');
                debugGenerateSchedule();
            }, true); // Use capture phase
        } else {
            console.log('❌ Generate button not found in DOM');
        }
    });
    
    // Check what's happening with handlers
    setInterval(() => {
        if (window.handlers && !window._debugHandlerReported) {
            console.log('📋 Handlers object detected:', window.handlers);
            console.log('📋 generateSchedule method:', typeof window.handlers.generateSchedule);
            window._debugHandlerReported = true;
        }
    }, 1000);
    
})();