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
  bind('showHolidaysBtn','click', ()=> {
    window.__toast && window.__toast('Show holidays clicked');
    window.showHolidaysPopup && window.showHolidaysPopup();
  });
  // Schedule tab
  bind('generateScheduleBtn','click', (e)=> {
    console.log('[eventBindings] Generate button clicked - calling handler');
    const btn = document.getElementById('generateScheduleBtn');
    console.log('[eventBindings] Button element:', btn, 'handlers exists:', !!window.handlers, 'generateSchedule exists:', !!window.handlers?.generateSchedule);
    window.__toast && window.__toast('Generate button clicked');
    e?.preventDefault?.();
    if (window.handlers?.generateSchedule) {
      window.handlers.generateSchedule();
    } else {
      console.error('[eventBindings] No generateSchedule handler found!');
    }
  });

  bind('clearScheduleBtn','click', (e)=> {
    window.__toast && window.__toast('Clear button clicked');
    e?.preventDefault?.();
    if (window.handlers?.clearSchedule) {
      window.handlers.clearSchedule();
    } else {
      console.error('[eventBindings] No clearSchedule handler found!');
    }
  });

  bind('exportScheduleBtn','click', ()=> {
    window.__toast && window.__toast('Export CSV clicked');
    if (window.handlers?.exportSchedule) {
      window.handlers.exportSchedule();
    } else {
      console.error('[eventBindings] No exportSchedule handler found!');
    }
  });

  bind('exportPdfBtn','click', ()=> {
    window.__toast && window.__toast('Export PDF clicked');
    if (window.handlers?.exportPdf) {
      window.handlers.exportPdf();
    } else {
      console.error('[eventBindings] No exportPdf handler found!');
    }
  });

  bind('printScheduleBtn','click', ()=> {
    console.error('[eventBindings] Print button clicked');
    console.log('[eventBindings] Print clicked');
    if (typeof window.print === 'function') {
      window.print();
    } else {
      console.warn('[eventBindings] window.print not available');
    }
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
  bind('executeSwapBtn','click', ()=> {
    if (window.handlers?.executeSwap) {
      window.handlers.executeSwap();
    } else if (window.executeSwap) {
      window.executeSwap(); // legacy global fallback
    } else {
      console.error('[eventBindings] No executeSwap handler found');
    }
  });
  bind('executeAssignBtn','click', ()=> {
    if (window.handlers?.executeAssign) {
      window.handlers.executeAssign();
    } else if (window.executeAssign) {
      window.executeAssign();
    } else {
      console.error('[eventBindings] No executeAssign handler found');
    }
  });
  // Search modal
  bind('searchModalCloseBtn','click', ()=> { try { window.modalManager ? window.modalManager.close('searchModal') : window.closeModal?.('searchModal'); } catch(e){ console.warn('[eventBindings] close searchModal failed', e); } });
  // Backup / Restore
  bind('exportBackupBtn','click', ()=> window.__backup && window.__backup.export());
  bind('importBackupBtn','click', ()=> { const inp=document.getElementById('backupFileInput'); if (inp) inp.click(); });
  const fileInput = document.getElementById('backupFileInput');
  if (fileInput){ fileInput.addEventListener('change', e=>{ const f=e.target.files && e.target.files[0]; if (f && window.__backup){ window.__backup.importFile(f); e.target.value=''; } }); }
  
  // Debug: log all clicks to see if button clicks are detected
  document.addEventListener('click', (e) => {
    console.log('[DEBUG] Click detected on target:', e.target.id || e.target.tagName, e.target);
  });
  
  // TEMP: Debug clicks on scheduleControls specifically
  const scheduleControls = document.getElementById('scheduleControls');
  if (scheduleControls) {
    scheduleControls.addEventListener('click', (e) => {
      console.log('[DEBUG] Click on scheduleControls:', e.target.id || e.target.tagName, e.target);
    }, true); // capture phase
  }
  
  console.log('[eventBindings] ✅ Event binding initialization COMPLETE!');
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', __initEventBindings, { once:true });
} else {
  __initEventBindings();
}
