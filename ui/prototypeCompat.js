// Prototype compatibility shim: maps inline onclicks to modular handlers and toggles sections
(function(){
  function qs(sel, root=document){ return root.querySelector(sel); }
  function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

  function showTab(evt, key){
    // Toggle .tab active
    qsa('.tabs .tab').forEach(b => b.classList.remove('active'));
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');
    // Toggle sections with ids like #staff-tab, #schedule-tab, etc.
    qsa('.section').forEach(sec => sec.classList.remove('active'));
    const target = qs(`#${key}-tab`);
    if (target) target.classList.add('active');
  }

  // Wire to window for prototype inline onclicks
  window.showTab = showTab;

  // Bridge to modular event handler if available
  function getHandler(){ return window.handlers; }

  window.generateSchedule = function(){
    const h = getHandler();
    if (h && h.generateSchedule) return h.generateSchedule();
    console.warn('generateSchedule: handler missing');
  }
  window.clearSchedule = function(){
    const h = getHandler();
    if (h && h.clearSchedule) return h.clearSchedule();
    console.warn('clearSchedule: handler missing');
  }

  // No-ops / placeholders to avoid errors when clicking prototype controls
  const noop = (name)=>()=>console.info(`${name} clicked (not implemented yet)`);
  // Delegate to AppUI if present
  window.addStaff = function(){ if (window.appUI?.addStaff) return window.appUI.addStaff(); return noop('addStaff')(); };
  window.resetStaffForm = function(){ if (window.appUI?.resetStaffForm) return window.appUI.resetStaffForm(); return noop('resetStaffForm')(); };
  window.addVacationPeriod = function(){ if (window.appUI?.addVacationPeriod) return window.appUI.addVacationPeriod(); return noop('addVacationPeriod')(); };
  window.addIllnessPeriod = noop('addIllnessPeriod');
  window.displayVacationLedger = noop('displayVacationLedger');
  window.handleAvailabilityDisplay = function(){ if (window.appUI?.handleAvailabilityDisplay) return window.appUI.handleAvailabilityDisplay(); return noop('handleAvailabilityDisplay')(); };
  window.updateShiftOptionsForDate = noop('updateShiftOptionsForDate');
  window.findCandidates = noop('findCandidates');
  window.applyManualAssignment = noop('applyManualAssignment');
  window.toggleStudentTempException = noop('toggleStudentTempException');
  window.toggleStudentFairness = noop('toggleStudentFairness');
  window.exportSchedule = noop('exportSchedule');
  window.showHolidaysPopup = function(){ if (window.appUI?.showHolidaysPopup) return window.appUI.showHolidaysPopup(); return noop('showHolidaysPopup')(); };
  window.addHoliday = function(){ if (window.appUI?.addHoliday) return window.appUI.addHoliday(); return noop('addHoliday')(); };
  window.addOtherStaff = noop('addOtherStaff');
  window.addOtherVacationPeriod = noop('addOtherVacationPeriod');
  window.resetOtherStaffForm = noop('resetOtherStaffForm');
  window.onScheduleMonthChange = noop('onScheduleMonthChange');
  window.exportSchedule = function(){
    try{
      const month = document.getElementById('scheduleMonth')?.value;
      if (!month){ alert('Bitte Monat wählen'); return; }
      const data = window.DEBUG?.state?.scheduleData?.[month] || {};
      const rows = [['Date','Shift','Shift Name','Time','Staff ID','Staff Name']];
      const staffById = Object.fromEntries((window.DEBUG?.state?.staffData||[]).map(s=>[s.id, s]));
      Object.keys(data).sort().forEach(dateStr => {
        const day = data[dateStr]; const assigns = day?.assignments||{};
        Object.entries(assigns).forEach(([shiftKey, staffId]) => {
          const shift = (window.SHIFTS || window.__SHIFTS || {})[shiftKey] || {};
          const name = shift.name || shiftKey; const time = shift.time || '';
          const staff = staffById[staffId];
          rows.push([dateStr, shiftKey, name, time, String(staffId||''), staff?.name||'']);
        });
      });
      const csv = rows.map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dienstplan_${month}.csv`; a.click();
      URL.revokeObjectURL(url);
    }catch(e){ console.error('Export failed', e); alert('Export fehlgeschlagen'); }
  };
  window.printSchedule = function(){
    const month = document.getElementById('scheduleMonth')?.value;
    if (!month){ alert('Bitte Monat wählen'); return; }
    const grid = document.getElementById('scheduleGrid');
    if (!grid){ alert('Kein Kalender gefunden'); return; }
    const w = window.open('', '_blank');
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(l=>`<link rel="stylesheet" href="${l.href}">`).join('');
    w.document.write(`<!doctype html><html><head><title>Dienstplan ${month}</title>${styles}<style>@media print{ .btn{display:none} }</style></head><body>${grid.outerHTML}</body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };
  // If schedule UI exists, hook month change/select
  document.addEventListener('change', (e)=>{
    if (e.target && e.target.id === 'scheduleMonth' && window.ui && window.ui.updateCalendarFromSelect) {
      window.ui.updateCalendarFromSelect();
    }
  });

  // Modal UX: backdrop click closes; lock body scroll while open
  function lockBody(lock){
    document.body.style.overflow = lock ? 'hidden' : '';
  }
  document.addEventListener('click', (e)=>{
    const tgt = e.target;
    if (tgt && tgt.classList && tgt.classList.contains('modal')){
      tgt.style.display = 'none';
      lockBody(false);
    }
  });
  const openModal = (id) => { const el = document.getElementById(id); if (el){ el.style.display='block'; lockBody(true);} };
  const closeModal = (id) => { const el = document.getElementById(id); if (el){ el.style.display='none'; lockBody(false);} };
  window.__openModal = openModal;
  window.__closeModal = closeModal;

  // Simple demo generator: fills grid cells with placeholders (until real engine is connected)
  window.generateSchedule = function(){
    const h = getHandler();
    if (h && h.generateSchedule) return h.generateSchedule();
    // Fallback demo if handler missing
    const grid = document.getElementById('scheduleGrid');
    if (!grid) return;
    grid.querySelectorAll('.cal-body').forEach((cell, idx) => {
      if (idx % 7 < 5) cell.textContent = '—';
    });
  }
})();
