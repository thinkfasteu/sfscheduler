// Comprehensive holiday debugging - step-by-step analysis
console.log('=== HOLIDAY DEBUGGING SCRIPT LOADED ===');

function runComprehensiveHolidayTest() {
    console.log('\n🔍 === COMPREHENSIVE HOLIDAY DEBUG ===');
    
    // Step 1: Environment Check
    console.log('\n📋 1. ENVIRONMENT CHECK:');
    console.log('   Document ready state:', document.readyState);
    console.log('   Current URL:', window.location.href);
    console.log('   AppState available:', typeof window.appState, !!window.appState);
    console.log('   Services available:', typeof window.__services, !!window.__services);
    
    // Step 2: DOM Elements Check
    console.log('\n🎯 2. DOM ELEMENTS CHECK:');
    const holidayBtn = document.getElementById('showHolidaysBtn');
    const modal = document.getElementById('holidaysModal');
    const yearSelect = document.getElementById('holidaysYear');
    const addBtn = document.getElementById('addHolidayBtn');
    const closeBtn = document.getElementById('holidaysModalCloseBtn');
    const holidaysList = document.getElementById('holidaysList');
    
    console.log('   Holiday button:', holidayBtn?.outerHTML.substring(0, 100) + '...');
    console.log('   Holiday modal:', !!modal, modal?.className);
    console.log('   Year select:', !!yearSelect);
    console.log('   Add button:', !!addBtn);
    console.log('   Close button:', !!closeBtn);
    console.log('   Holidays list:', !!holidaysList);
    
    // Step 3: AppUI Check
    console.log('\n🏗️ 3. APPUI CHECK:');
    console.log('   window.appUI:', typeof window.appUI, !!window.appUI);
    if (window.appUI) {
        console.log('   appUI.showHolidaysPopup:', typeof window.appUI.showHolidaysPopup);
        console.log('   appUI.addHoliday:', typeof window.appUI.addHoliday);
        console.log('   appUI.fetchAndShowHolidays:', typeof window.appUI.fetchAndShowHolidays);
        console.log('   appUI.initHolidays:', typeof window.appUI.initHolidays);
        console.log('   appUI.renderHolidaysList:', typeof window.appUI.renderHolidaysList);
    }
    
    // Step 4: Window Functions Check
    console.log('\n🌐 4. WINDOW FUNCTIONS CHECK:');
    console.log('   window.showHolidaysPopup:', typeof window.showHolidaysPopup);
    console.log('   window.addHoliday:', typeof window.addHoliday);
    
    // Step 5: Services Check
    console.log('\n⚙️ 5. SERVICES CHECK:');
    if (window.__services) {
        console.log('   __services.holiday:', typeof window.__services.holiday, !!window.__services.holiday);
        if (window.__services.holiday) {
            console.log('   holiday.fetchHolidaysForYear:', typeof window.__services.holiday.fetchHolidaysForYear);
            console.log('   holiday.list:', typeof window.__services.holiday.list);
            console.log('   holiday.add:', typeof window.__services.holiday.add);
            console.log('   holiday.remove:', typeof window.__services.holiday.remove);
        }
    }
    
    // Step 6: Data Check
    console.log('\n📊 6. DATA CHECK:');
    if (window.appState) {
        console.log('   appState.holidays:', typeof window.appState.holidays, !!window.appState.holidays);
        if (window.appState.holidays) {
            const years = Object.keys(window.appState.holidays);
            console.log('   Available years:', years);
            years.forEach(year => {
                const count = Object.keys(window.appState.holidays[year] || {}).length;
                console.log(`   ${year}: ${count} holidays`);
            });
        }
    }
    
    // Step 7: Event Bindings Check
    console.log('\n🔗 7. EVENT BINDINGS CHECK:');
    if (holidayBtn) {
        console.log('   Holiday button listeners:', getEventListeners?.(holidayBtn) || 'getEventListeners not available');
        console.log('   Holiday button onclick:', typeof holidayBtn.onclick, !!holidayBtn.onclick);
    }
    
    // Step 8: Manual Function Tests
    console.log('\n🧪 8. MANUAL FUNCTION TESTS:');
    
    // Test window.showHolidaysPopup
    console.log('   Testing window.showHolidaysPopup...');
    try {
        if (window.showHolidaysPopup) {
            console.log('   Function exists, calling...');
            const result = window.showHolidaysPopup();
            console.log('   Result:', result);
        } else {
            console.log('   ❌ Function not available');
        }
    } catch (e) {
        console.error('   ❌ Error calling showHolidaysPopup:', e);
    }
    
    // Test appUI.showHolidaysPopup directly
    console.log('   Testing appUI.showHolidaysPopup directly...');
    try {
        if (window.appUI?.showHolidaysPopup) {
            console.log('   Method exists, calling...');
            const result = window.appUI.showHolidaysPopup();
            console.log('   Result:', result);
        } else {
            console.log('   ❌ Method not available');
        }
    } catch (e) {
        console.error('   ❌ Error calling appUI.showHolidaysPopup:', e);
    }
    
    // Step 9: API Test
    console.log('\n🌍 9. API TEST:');
    if (window.__services?.holiday?.fetchHolidaysForYear) {
        console.log('   Testing holiday API call...');
        window.__services.holiday.fetchHolidaysForYear(2025)
            .then(result => {
                console.log('   ✅ API call successful:', result);
                console.log('   Holidays loaded:', Object.keys(result).length);
            })
            .catch(error => {
                console.error('   ❌ API call failed:', error);
            });
    } else {
        console.log('   ❌ Holiday service fetchHolidaysForYear not available');
    }
    
    // Step 10: Button Click Simulation
    console.log('\n🖱️ 10. BUTTON CLICK SIMULATION:');
    if (holidayBtn) {
        console.log('   Simulating button click...');
        try {
            holidayBtn.click();
            console.log('   Click dispatched');
            
            // Check if modal opened
            setTimeout(() => {
                const modalAfterClick = document.getElementById('holidaysModal');
                console.log('   Modal after click:', modalAfterClick?.className);
                console.log('   Modal is open:', modalAfterClick?.classList.contains('open'));
            }, 100);
        } catch (e) {
            console.error('   ❌ Error clicking button:', e);
        }
    } else {
        console.log('   ❌ Holiday button not found');
    }
    
    console.log('\n=== HOLIDAY DEBUG COMPLETE ===\n');
}

// Auto-run when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(runComprehensiveHolidayTest, 1000);
    });
} else {
    setTimeout(runComprehensiveHolidayTest, 1000);
}

// Also expose for manual calling
window.debugHolidays = runComprehensiveHolidayTest;