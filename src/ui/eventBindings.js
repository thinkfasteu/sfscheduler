function onDomReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function bind(id, type, handler) {
  console.log(`[bind] Attempting to bind ${type} on #${id}`);
  const attach = () => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[bind] #${id} not found at bind time`);
      return;
    }
    el.addEventListener(type, handler);
    console.log(`[bind] ✅ SUCCESS: attached ${type} on #${id}`);
  };
  
  // Try immediate attachment first
  if (document.readyState !== 'loading') {
    attach();
  } else {
    // Fallback to DOM ready
    onDomReady(attach);
  }
}

function __initEventBindings(){
  console.log('[eventBindings] Starting event binding initialization...');
  // Debug instrumentation: log tab clicks until confirmed working
  if (!window.__TAB_DEBUG_INSTALLED__){
    window.__TAB_DEBUG_INSTALLED__=true;
    document.addEventListener('click', (e)=>{
      const t = e.target.closest('.tabs .tab[data-tab]');
      if (t) console.info('[tabs] click', t.getAttribute('data-tab'));
    }, true);
  }
  // Tabs
  document.querySelectorAll('.tabs .tab[data-tab]').forEach(btn => {
    btn.addEventListener('click', e => { if (typeof window.showTab==='function') window.showTab(e, btn.getAttribute('data-tab')); });
  });
  // Staff
  bind('addStaffVacationBtn','click', ()=> window.addStaffVacationPeriod && window.addStaffVacationPeriod());
  bind('addStaffIllnessBtn','click', ()=> window.addStaffIllnessPeriod && window.addStaffIllnessPeriod());
  bind('saveStaffBtn','click', ()=> window.addStaff && window.addStaff());
  bind('cancelEditBtn','click', ()=> window.resetStaffForm && window.resetStaffForm());
  // Availability
  ['availabilityStaffSelect','availabilityMonth'].forEach(id=> {
    bind(id,'change', ()=> {
      console.log('[eventBindings] Availability selector changed:', id);
      if (window.appUI && window.appUI.handleAvailabilityDisplay) {
        window.appUI.handleAvailabilityDisplay();
      } else if (window.handleAvailabilityDisplay) {
        window.handleAvailabilityDisplay();
      } else {
        console.error('[eventBindings] No availability display handler found!');
        console.log('Available: window.appUI=', !!window.appUI, 'window.handleAvailabilityDisplay=', !!window.handleAvailabilityDisplay);
      }
    });
  });
  bind('showHolidaysBtn','click', ()=> window.showHolidaysPopup && window.showHolidaysPopup());
  // Schedule - direct bindings to window.handlers methods
  bind('generateScheduleBtn','click', ()=> {
    console.log('[eventBindings] Generate button clicked! window.handlers=', window.handlers);
    window.handlers?.generateNewSchedule?.();
  });
  bind('clearScheduleBtn','click', ()=> {
    console.log('[eventBindings] Clear button clicked! window.handlers=', window.handlers);
    window.handlers?.clearSchedule?.();
  });
  bind('exportScheduleBtn','click', ()=> {
    console.log('[eventBindings] Export CSV button clicked! window.handlers=', window.handlers);
    window.handlers?.exportSchedule?.();
  });
  bind('exportPdfBtn','click', ()=> {
    console.log('[eventBindings] Export PDF button clicked! window.handlers=', window.handlers);
    window.handlers?.exportPdf?.();
  });
  bind('printScheduleBtn','click', ()=> {
    console.log('[eventBindings] Print button clicked! window.print=', typeof window.print);
    window.print?.();
  });
  // Vacation
  bind('addVacationPeriodBtn','click', ()=> window.addVacationPeriod && window.addVacationPeriod());
  bind('addOtherStaffBtn','click', ()=> window.addOtherStaff && window.addOtherStaff());
  bind('addOtherVacationPeriodBtn','click', ()=> window.addOtherVacationPeriod && window.addOtherVacationPeriod());
  // Holidays modal
  bind('holidaysModalCloseBtn','click', ()=> { try { window.modalManager ? window.modalManager.close('holidaysModal') : window.closeModal?.('holidaysModal'); } catch(e){ console.warn('[eventBindings] close holidaysModal failed', e); } });
  bind('addHolidayBtn','click', ()=> window.addHoliday && window.addHoliday());
  bind('addIcsSourceBtn','click', ()=> window.addIcsSource && window.addIcsSource());
  bind('refreshAcademicTermsBtn','click', ()=> window.refreshAcademicTerms && window.refreshAcademicTerms());
  // Swap modal
  bind('swapModalCloseBtn','click', ()=> { try { window.modalManager ? window.modalManager.close('swapModal') : window.closeModal?.('swapModal'); } catch(e){ console.warn('[eventBindings] close swapModal failed', e); } });
  bind('executeSwapBtn','click', ()=> window.executeSwap && window.executeSwap());
  bind('executeAssignBtn','click', ()=> window.executeAssign && window.executeAssign());
  // Search modal
  bind('searchModalCloseBtn','click', ()=> { try { window.modalManager ? window.modalManager.close('searchModal') : window.closeModal?.('searchModal'); } catch(e){ console.warn('[eventBindings] close searchModal failed', e); } });
  bind('executeSearchAssignBtn','click', ()=> window.executeSearchAssign && window.executeSearchAssign());
  // Backup / Restore
  bind('exportBackupBtn','click', ()=> window.__backup && window.__backup.export());
  bind('importBackupBtn','click', ()=> { const inp=document.getElementById('backupFileInput'); if (inp) inp.click(); });
  const fileInput = document.getElementById('backupFileInput');
  if (fileInput){ fileInput.addEventListener('change', e=>{ const f=e.target.files && e.target.files[0]; if (f && window.__backup){ window.__backup.importFile(f); e.target.value=''; } }); }
  
  console.log('[eventBindings] ✅ Event binding initialization COMPLETE!');
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', __initEventBindings, { once:true });
} else {
  __initEventBindings();
}
