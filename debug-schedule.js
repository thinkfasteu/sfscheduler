// Debug helper now focused on auto-generation diagnostics (generate button removed)
(function(){
  console.log('=== AUTO-GENERATION DEBUG HELPER LOADED ===');
  function reportStatus(){
    const monthEl = document.getElementById('scheduleMonth');
    const month = monthEl?.value;
    const hasData = month ? !!Object.keys(window.appState?.scheduleData?.[month]||{}).length : false;
    console.log('[auto-gen][status]', { month, hydratedMonths:[...(window.ui?._hydratedMonths||[])], hasData, generating: !!window.ui?._generating });
  }
  setInterval(()=>{ try { reportStatus(); } catch(e){ /* ignore */ } }, 4000);
})();