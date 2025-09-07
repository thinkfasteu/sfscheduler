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
  // Staff form specific adders to avoid confusion with vacation tab
  window.addStaffVacationPeriod = function(){ if (window.appUI?.addStaffVacationPeriod) return window.appUI.addStaffVacationPeriod(); return noop('addStaffVacationPeriod')(); };
  window.addStaffIllnessPeriod = function(){ if (window.appUI?.addStaffIllnessPeriod) return window.appUI.addStaffIllnessPeriod(); return noop('addStaffIllnessPeriod')(); };
  // Vacation tab handler
  window.addVacationPeriod = function(){ if (window.appUI?.addVacationPeriod) return window.appUI.addVacationPeriod(); return noop('addVacationPeriod')(); };
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
  window.addIcsSource = function(){ if (window.appUI?.addIcsSource) return window.appUI.addIcsSource(); return noop('addIcsSource')(); };
  window.refreshAcademicTerms = function(){ if (window.appUI?.refreshAcademicTerms) return window.appUI.refreshAcademicTerms(); return noop('refreshAcademicTerms')(); };
  window.addOtherStaff = function(){ if (window.appUI?.addOtherStaff) return window.appUI.addOtherStaff(); return noop('addOtherStaff')(); };
  window.addOtherVacationPeriod = function(){ if (window.appUI?.addOtherVacationPeriod) return window.appUI.addOtherVacationPeriod(); return noop('addOtherVacationPeriod')(); };
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
  // Generate a formatted monthly PDF using jsPDF + AutoTable
  window.exportPDF = function(){
    try{
      const month = document.getElementById('scheduleMonth')?.value;
      if (!month){ alert('Bitte Monat wählen'); return; }
      const data = window.DEBUG?.state?.scheduleData?.[month] || {};
      const staffById = Object.fromEntries((window.DEBUG?.state?.staffData||[]).map(s=>[s.id, s]));
      const { jsPDF } = window.jspdf || {};
      if (!jsPDF || !window.jspdf || !window.jspdf.jsPDF){
        alert('PDF Bibliothek nicht geladen');
        return;
      }
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const [y,m] = month.split('-').map(Number);
      const monthLabel = new Date(y, m-1, 1).toLocaleString(undefined,{month:'long', year:'numeric'});
      const headerTitle = `Dienstplan – ${monthLabel}`;
      const printDate = new Date().toLocaleString();
      doc.setFontSize(16); doc.text(headerTitle, 10, 12);
      doc.setFontSize(9); doc.text(`Erstellt: ${printDate}`, 10, 18);
      // Determine shift columns for weekday/weekend/holiday
      const shiftKeys = Object.keys(window.SHIFTS||{});
      const byType = { weekday: [], weekend: [], holiday: [] };
      shiftKeys.forEach(k => { const t=(window.SHIFTS||{})[k]?.type; if (byType[t]) byType[t].push(k); });
      // Build a per-day table with columns per shift: Date | [shift names]
      const headers = ['Datum'].concat(byType.weekday.length?byType.weekday:byType.weekend);
      const rows = [];
      Object.keys(data).sort().forEach(dateStr => {
        const assigns = data[dateStr]?.assignments || {};
        // Pick appropriate shift set for this date
        const dt = new Date(dateStr);
        const isWE = [0,6].includes(dt.getDay());
        const hol = window.DEBUG?.state?.holidays?.[String(dt.getFullYear())]?.[dateStr] || null;
        const cols = hol ? byType.holiday : isWE ? byType.weekend : byType.weekday;
        const base = [dateStr + (hol?` (${hol})`: '')];
        cols.forEach(k => {
          const sid = assigns[k];
          const nm = sid ? (staffById[sid]?.name || String(sid)) : '—';
          base.push(nm);
        });
        rows.push(base);
      });
      if (rows.length === 0){ rows.push(['—']); }
      const pageWidth = doc.internal.pageSize.getWidth();
      // AutoTable with zebra striping and compact style
      doc.autoTable({
        startY: 22,
        head: [headers],
        body: rows,
        styles: { fontSize: 8, cellPadding: 1.5, lineWidth: 0.1 },
        headStyles: { fillColor: [33, 150, 243], textColor: [255,255,255] },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        margin: { left: 10, right: 10 },
        didDrawPage: (dataArg) => {
          // Footer with page number
          const str = `Seite ${doc.internal.getNumberOfPages()}`;
          doc.setFontSize(8);
          doc.text(str, pageWidth - 10, doc.internal.pageSize.getHeight() - 5, { align: 'right' });
        }
      });
      doc.save(`dienstplan_${month}.pdf`);
    }catch(e){ console.error('PDF export failed', e); alert('PDF Export fehlgeschlagen'); }
  };
  // If schedule UI exists, hook month change/select
  document.addEventListener('change', (e)=>{
    if (e.target && e.target.id === 'scheduleMonth' && window.ui && window.ui.updateCalendarFromSelect) {
      window.ui.updateCalendarFromSelect();
    }
  });

  // Modal UX: backdrop click closes; lock body scroll while open
  let modalDepth = 0;
  function lockBody(lock){
    if (lock){ modalDepth++; document.body.style.overflow='hidden'; }
    else { modalDepth = Math.max(0, modalDepth-1); if (modalDepth===0) document.body.style.overflow=''; }
  }
  document.addEventListener('click', (e)=>{
    const tgt = e.target;
    if (tgt && tgt.classList && tgt.classList.contains('modal')){
      tgt.style.display = 'none';
      lockBody(false);
    }
  });
  const openModal = (id) => { const el = document.getElementById(id); if (el){ el.classList.add('open'); lockBody(true);} };
  const closeModal = (id) => { const el = document.getElementById(id); if (el){ el.classList.remove('open'); lockBody(false);} };
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
