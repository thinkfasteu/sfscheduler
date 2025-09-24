function debugHolidays() {
    console.log('=== HOLIDAY FUNCTIONALITY DEBUG ===');
    
    // 1. Check if holiday button exists
    const holidayBtn = document.getElementById('showHolidaysBtn');
    console.log('1. Holiday button element:', holidayBtn);
    console.log('   Button text:', holidayBtn?.textContent);
    console.log('   Button click handler bound:', !!holidayBtn?.onclick);
    
    // 2. Check window functions
    console.log('2. Window functions:');
    console.log('   window.showHolidaysPopup:', typeof window.showHolidaysPopup, window.showHolidaysPopup);
    console.log('   window.addHoliday:', typeof window.addHoliday, window.addHoliday);
    
    // 3. Check AppUI
    console.log('3. AppUI methods:');
    console.log('   window.appUI:', !!window.appUI);
    console.log('   window.appUI.showHolidaysPopup:', typeof window.appUI?.showHolidaysPopup);
    console.log('   window.appUI.addHoliday:', typeof window.appUI?.addHoliday);
    console.log('   window.appUI.fetchAndShowHolidays:', typeof window.appUI?.fetchAndShowHolidays);
    
    // 4. Check holiday service
    console.log('4. Holiday service:');
    console.log('   __services available:', !!window.__services);
    console.log('   __services.holiday:', window.__services?.holiday);
    console.log('   __services.holiday.fetchHolidaysForYear:', typeof window.__services?.holiday?.fetchHolidaysForYear);
    
    // 5. Check holiday modal
    const modal = document.getElementById('holidaysModal');
    console.log('5. Holiday modal:');
    console.log('   Modal element:', modal);
    console.log('   Modal classes:', modal?.className);
    console.log('   Modal visible:', modal?.classList.contains('open'));
    
    // 6. Check holiday modal controls
    console.log('6. Holiday modal controls:');
    const yearSelect = document.getElementById('holidaysYear');
    const addBtn = document.getElementById('addHolidayBtn');
    const closeBtn = document.getElementById('holidaysModalCloseBtn');
    const holidaysList = document.getElementById('holidaysList');
    
    console.log('   Year select:', yearSelect);
    console.log('   Add button:', addBtn);
    console.log('   Close button:', closeBtn);
    console.log('   Holidays list:', holidaysList);
    
    // 7. Check current holiday data
    console.log('7. Holiday data:');
    console.log('   appState.holidays:', window.appState?.holidays);
    console.log('   Current year holidays:', window.appState?.holidays?.[new Date().getFullYear()]);
    
    // 8. Test button click
    console.log('8. Testing button click...');
    if (holidayBtn) {
        console.log('   Attempting to click holiday button...');
        try {
            holidayBtn.click();
            console.log('   Button click completed');
        } catch (e) {
            console.error('   Button click failed:', e);
        }
    } else {
        console.error('   No holiday button to click!');
    }
    
    // 9. Test API call directly
    console.log('9. Testing API call directly...');
    if (window.__services?.holiday?.fetchHolidaysForYear) {
        console.log('   Attempting to fetch holidays for 2025...');
        window.__services.holiday.fetchHolidaysForYear(2025)
            .then(holidays => {
                console.log('   ✓ API call successful:', holidays);
            })
            .catch(error => {
                console.error('   ✗ API call failed:', error);
            });
    } else {
        console.error('   Holiday service not available for direct testing');
    }
    
    console.log('=== END HOLIDAY DEBUG ===');
}

// Auto-run when loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', debugHolidays);
} else {
    debugHolidays();
}