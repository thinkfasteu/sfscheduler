function onDomReady(fn) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  } else {
    fn();
  }
}

function bind(id, type, handler) {
  const attach = () => {
    const el = document.getElementById(id);
    if (!el) {
      console.warn(`[bind] #${id} not found at bind time`);
      return;
    }
    el.addEventListener(type, handler);
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
  // Modal action buttons - bind with deferred setup
  __bindModalActionHandlers();
  // Search modal
  bind('searchModalCloseBtn','click', ()=> { try { window.modalManager ? window.modalManager.close('searchModal') : window.closeModal?.('searchModal'); } catch(e){ console.warn('[eventBindings] close searchModal failed', e); } });
  // Backup / Restore
  bind('exportBackupBtn','click', ()=> window.__backup && window.__backup.export());
  bind('importBackupBtn','click', ()=> { const inp=document.getElementById('backupFileInput'); if (inp) inp.click(); });
  const fileInput = document.getElementById('backupFileInput');
  if (fileInput){ fileInput.addEventListener('change', e=>{ const f=e.target.files && e.target.files[0]; if (f && window.__backup){ window.__backup.importFile(f); e.target.value=''; } }); }
}

if (document.readyState === 'loading'){
  document.addEventListener('DOMContentLoaded', __initEventBindings, { once:true });
} else {
  __initEventBindings();
}

// Deferred binding for schedule handlers that may not be available immediately
function __bindScheduleHandlers() {
  const scheduleButtons = [
    { id: 'showHolidaysBtn', handler: null, action: () => { window.__toast && window.__toast('Show holidays clicked'); window.showHolidaysPopup && window.showHolidaysPopup(); } },
    { id: 'openSearchAssignBtn', handler: null, action: () => { 
      window.__toast && window.__toast('Search & assign clicked'); 
      // Use current month or today's date for search modal
      const today = new Date().toISOString().split('T')[0];
      window.showSearchModal && window.showSearchModal(today); 
    }},
    { id: 'generateScheduleBtn', handler: 'generateSchedule', toast: 'Generate button clicked' },
    { id: 'finalizeScheduleBtn', handler: 'finalizeSchedule', toast: 'Finalize button clicked' },
    { id: 'clearScheduleBtn', handler: 'clearSchedule', toast: 'Clear button clicked' },
    { id: 'exportScheduleBtn', handler: 'exportSchedule', toast: 'Export CSV clicked' },
    { id: 'exportPdfBtn', handler: 'exportPdf', toast: 'Export PDF clicked' }
  ];

  // Try to bind immediately, or defer until handlers are available
  function tryBind() {
    scheduleButtons.forEach(({ id, handler, action, toast }) => {
      const element = document.getElementById(id);
      if (element && !element.__eventBound) {
        if (handler ? window.handlers?.[handler] : action) {
          element.addEventListener('click', (e) => {
            if (toast) window.__toast && window.__toast(toast);
            e?.preventDefault?.();
            if (handler) {
              window.handlers[handler]();
            } else if (action) {
              action();
            }
          });
          element.__eventBound = true;
          console.log(`[eventBindings] Bound ${id} successfully`);
        } else {
          console.log(`[eventBindings] ${id} handler not ready yet, deferring`);
        }
      }
    });

    // Special case for print button
    const printBtn = document.getElementById('printScheduleBtn');
    if (printBtn && !printBtn.__eventBound) {
      printBtn.addEventListener('click', () => {
        if (typeof window.print === 'function') {
          window.print();
        } else {
          console.warn('[eventBindings] window.print not available');
        }
      });
      printBtn.__eventBound = true;
    }
  }

  // Try binding immediately
  tryBind();

  // If handlers not available yet, poll until they are
  const requiredHandlers = ['generateSchedule', 'finalizeSchedule', 'clearSchedule', 'exportSchedule', 'exportPdf'];
  const hasAllHandlers = requiredHandlers.every(h => window.handlers?.[h]);
  
  if (!hasAllHandlers || !window.showHolidaysPopup || !window.showSearchModal) {
    let attempts = 0;
    const poll = () => {
      attempts++;
      tryBind();
      const stillMissing = requiredHandlers.filter(h => !window.handlers?.[h]);
      const missingModals = [];
      if (!window.showHolidaysPopup) missingModals.push('showHolidaysPopup');
      if (!window.showSearchModal) missingModals.push('showSearchModal');
      if ((stillMissing.length > 0 || missingModals.length > 0) && attempts < 50) {
        setTimeout(poll, 100);
      } else if (stillMissing.length === 0 && missingModals.length === 0) {
        console.log('[eventBindings] All schedule handlers bound successfully');
      }
    };
    poll();
  }
}

window.__bindScheduleHandlers = __bindScheduleHandlers;

// Deferred binding for modal action handlers that may be created dynamically
function __bindModalActionHandlers() {
  const modalButtons = [
    { id: 'executeSwapBtn', handler: 'executeSwap', toast: 'Swap executed' },
    { id: 'executeAssignBtn', handler: 'executeAssign', toast: 'Assignment executed' }
  ];

  function tryBind() {
    modalButtons.forEach(({ id, handler, toast }) => {
      const element = document.getElementById(id);
      if (element && !element.__eventBound) {
        if (window.handlers?.[handler] || window[handler]) {
          element.addEventListener('click', (e) => {
            if (toast) window.__toast && window.__toast(toast);
            e?.preventDefault?.();
            if (window.handlers?.[handler]) {
              window.handlers[handler]();
            } else if (window[handler]) {
              window[handler]();
            }
          });
          element.__eventBound = true;
          console.log(`[eventBindings] Bound ${id} successfully`);
        } else {
          console.log(`[eventBindings] ${id} handler not ready yet, deferring`);
        }
      }
    });
  }

  // Try binding immediately
  tryBind();

  // If handlers not available yet, poll until they are
  const requiredHandlers = ['executeSwap', 'executeAssign'];
  const hasAllHandlers = requiredHandlers.every(h => window.handlers?.[h] || window[h]);
  
  if (!hasAllHandlers) {
    let attempts = 0;
    const poll = () => {
      attempts++;
      tryBind();
      const stillMissing = requiredHandlers.filter(h => !window.handlers?.[h] && !window[h]);
      if (stillMissing.length > 0 && attempts < 50) {
        setTimeout(poll, 100);
      } else if (stillMissing.length === 0) {
        console.log('[eventBindings] All modal action handlers bound successfully');
      }
    };
    poll();
  }
}

window.__bindModalActionHandlers = __bindModalActionHandlers;
