// Debug helper for manual schedule generation (no automatic generation)
(function(){
  console.log('=== MANUAL SCHEDULE GENERATION DEBUG HELPER LOADED ===');
  function reportStatus(){
    if (!window.ui) { console.warn('[debug] window.ui not available'); return; }
    const month = window.ui.currentCalendarMonth;
    const hasData = !!(window.appState?.scheduleData?.[month] && Object.keys(window.appState.scheduleData[month]).length);
    console.log('[manual-gen][status]', { month, hydratedMonths:[...(window.ui?._hydratedMonths||[])], hasData, generating: !!window.ui?._generating });
    console.log('[manual-gen] To generate schedule, click "Plan erstellen" button or call window.handlers?.generateNewSchedule()');
  }
  setTimeout(()=>{
    window.__reportScheduleStatus = reportStatus;
    console.log('Use window.__reportScheduleStatus() to check generation state');
    console.log('NOTE: No automatic generation - use "Plan erstellen" button only!');
    reportStatus();
  }, 1000);
})();