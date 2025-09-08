function bind(id, evt, handler){ const el = document.getElementById(id); if (el) el.addEventListener(evt, handler); }

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
  ['availabilityStaffSelect','availabilityMonth'].forEach(id=> bind(id,'change', ()=> window.handleAvailabilityDisplay && window.handleAvailabilityDisplay()));
  bind('showHolidaysBtn','click', ()=> window.showHolidaysPopup && window.showHolidaysPopup());
  // Schedule
  bind('generateScheduleBtn','click', ()=> window.generateSchedule && window.generateSchedule());
  bind('clearScheduleBtn','click', ()=> window.clearSchedule && window.clearSchedule());
  bind('exportScheduleBtn','click', ()=> window.exportSchedule && window.exportSchedule());
  bind('exportPdfBtn','click', ()=> window.exportPDF && window.exportPDF());
  bind('printScheduleBtn','click', ()=> window.printSchedule && window.printSchedule());
  // Vacation
  bind('addVacationPeriodBtn','click', ()=> window.addVacationPeriod && window.addVacationPeriod());
  bind('addOtherStaffBtn','click', ()=> window.addOtherStaff && window.addOtherStaff());
  bind('addOtherVacationPeriodBtn','click', ()=> window.addOtherVacationPeriod && window.addOtherVacationPeriod());
  // Holidays modal
  bind('holidaysModalCloseBtn','click', ()=> { const m=document.getElementById('holidaysModal'); if (m){ m.classList.remove('open'); document.body.style.overflow=''; } });
  bind('addHolidayBtn','click', ()=> window.addHoliday && window.addHoliday());
  bind('addIcsSourceBtn','click', ()=> window.addIcsSource && window.addIcsSource());
  bind('refreshAcademicTermsBtn','click', ()=> window.refreshAcademicTerms && window.refreshAcademicTerms());
  // Swap modal
  bind('swapModalCloseBtn','click', ()=> { const m=document.getElementById('swapModal'); if (m){ m.classList.remove('open'); document.body.style.overflow=''; } });
  bind('executeSwapBtn','click', ()=> window.executeSwap && window.executeSwap());
  bind('executeAssignBtn','click', ()=> window.executeAssign && window.executeAssign());
  // Search modal
  bind('searchModalCloseBtn','click', ()=> { const m=document.getElementById('searchModal'); if (m){ m.classList.remove('open'); document.body.style.overflow=''; } });
  bind('executeSearchAssignBtn','click', ()=> window.executeSearchAssign && window.executeSearchAssign());
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
