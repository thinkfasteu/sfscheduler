import { appState } from '../modules/state.js'; // TODO remove direct non-staff usage later
import { APP_CONFIG, SHIFTS } from '../modules/config.js';
import { toLocalISOMonth, toLocalISODate, pad2, parseYMD } from '../utils/dateUtils.js';
import { countOverlapDaysInYear } from '../src/domain/compute.js';
// Add audit message helper
import { auditMsg } from '../src/services/auditMessages.js';
// Services facade (migrating away from direct appState)
let __services = (typeof window!=='undefined' && window.__services) ? window.__services : null;
(async ()=>{ try { if (!__services) { const m = await import('../src/services/index.js'); __services = m.createServices({}); } } catch(e){ console.warn('Service init failed (fallback to appState)', e); } })();

function normalizeHolidayEntry(value, defaultSource = 'manual') {
  if (!value) return { name: '', closed: false, source: defaultSource };
  if (typeof value === 'string') return { name: value, closed: false, source: defaultSource };
  return {
    name: value.name || value.localName || '',
    closed: !!value.closed,
    source: value.source || defaultSource
  };
}

export class AppUI {
  constructor(scheduleUI){
    this.scheduleUI = scheduleUI;
    // Track when async service hydration (Supabase) finished so we can avoid showing an empty state prematurely
    this._servicesHydrated = false;
    this._lastAvailabilitySyncKey = null;
    this._availabilityHydrateTimer = null;
    this._availabilityHydrationInFlight = false;
    this._lastAvailabilityHydratedAt = 0;
    this._vacationControlsBound = false;
    this._auditHydrationPromise = null;
  }

  _defaultVacationAllowance(staff){
    const configured = Number(APP_CONFIG?.DEFAULT_VACATION_DAYS ?? APP_CONFIG?.DEFAULT_VACATION_ALLOWANCE);
    if (!Number.isNaN(configured) && configured > 0) return configured;
    return 30;
  }

  init(){
    // If services not yet initialized (dynamic import still loading), defer setup
    if (!__services){
      let attempts = 0;
      const spin = ()=>{
        if (__services){ this._postServicesInit(); return; }
        if (attempts++ < 60) { setTimeout(spin, 100); } else { console.warn('[UI] Services not initialized after timeout'); }
      };
      spin();
      // Show placeholder meanwhile
      const host = document.getElementById('staffList'); if (host) host.innerHTML = '<p>Lade Dienste…</p>';
      return;
    }
    this._postServicesInit();
  }

  _postServicesInit(){
    // If using async backend (supabase) and services not yet hydrated, defer initial staff render
    const backendMode = (window.__CONFIG__ && window.__CONFIG__.BACKEND) || (window.CONFIG && window.CONFIG.BACKEND) || 'local';
    if (backendMode === 'supabase' && __services?.ready) {
      // Show temporary loading indicator
      const host = document.getElementById('staffList'); if (host) host.innerHTML = '<p>Lade Mitarbeiter…</p>';
      __services.ready.then(()=>{ try { this._servicesHydrated = true; this.renderStaffList(); } catch(e){ console.warn('Post-ready staff render failed', e); } });
    } else {
      this.renderStaffList();
    }
    this.populateAvailabilitySelectors();
  this.populateVacationSelectors();
  this.renderVacationList();
  this.initHolidays();
  this.renderIcsSources();
  // Render temp lists (when editing)
  this.renderTempIllnessList();
  // Urlaub: Ledger init
  this.initVacationLedger();
  // Ensure vacation data hydrated across tabs
  try {
    this.loadVacationData().then(()=>{
      try { this.renderVacationList(); if (this.renderVacationSummaryTable) this.renderVacationSummaryTable(); }
      catch(err){ console.warn('Vacation render after load failed', err); }
    }).catch(err=> console.warn('loadVacationData init failed', err));
  } catch(err){ console.warn('Unable to schedule vacation data load', err); }
  if (!this._vacationControlsBound) {
    document.getElementById('addVacationPeriodBtn')?.addEventListener('click', () => this.addVacationPeriod());
    document.getElementById('quickIllnessBtn')?.addEventListener('click', () => this.showQuickIllnessModal());
    document.getElementById('quickIllnessModalCloseBtn')?.addEventListener('click', () => this.hideQuickIllnessModal());
    document.getElementById('quickIllnessAddBtn')?.addEventListener('click', () => this.addQuickIllness());
    this._vacationControlsBound = true;
  }
  // Register service event listeners (e.g., ledger conflicts)
  try { this._attachServiceEventListeners(); } catch(e) { /* ignore */ }
  // Andere Mitarbeitende init
  this.renderOtherStaff();
  // Reports init (wait for services to hydrate if async)
  if (__services?.ready){
    __services.ready.then(()=>{
      this._servicesHydrated = true;
      // Re-render staff + selectors now that remote data is available
      try { this.renderStaffList(); this.populateAvailabilitySelectors(); } catch(e){ console.warn('Post-hydration staff render failed', e); }
      try { this.initReports(); } catch(e){ console.warn('Reports init failed (delayed)', e); }
    });
  } else {
    try { this.initReports(); } catch(e){ console.warn('Reports init failed', e); }
   }
   // After services.ready resolved OR if already resolved by the time we attach
   if (__services?.staff?.list?.().length){
     this._servicesHydrated = true;
     try { this.renderStaffList(); this.populateAvailabilitySelectors(); } catch(e){ console.warn('[UI] late staff render failed', e); }
   }
  this.renderAuditLog();
  this._hydrateAuditLog().catch(err=> console.warn('[AppUI] initial audit hydration failed', err));
   // Fallback polling in case ready promise resolves before init or events missed
   if (backendMode==='supabase' && __services?.ready){
     let tries=0; const poll=()=>{ if (this._servicesHydrated) return; tries++; if ((__services?.staff?.list?.()||[]).length){ this._servicesHydrated=true; try{ this.renderStaffList(); }catch{} return; } if (tries<20) setTimeout(poll, 300); }; poll();
   }
   // Initialize role change handler for staff form
   initRoleChangeHandler();
  }

  _attachServiceEventListeners(){
    __services?.events?.on('ledgerConflict', (p)=>{ console.warn('[UI] ledger conflict', p); this.showLedgerConflictToast(p); });
    __services?.events?.on('staff:hydrated', ()=>{ try { this._servicesHydrated = true; this.renderStaffList(); this.populateAvailabilitySelectors(); } catch(e){ console.warn('[UI] staff:hydrated render failed', e); } });
    __services?.events?.on('staff:created', ()=>{ try { this.renderStaffList(); this.populateAvailabilitySelectors(); } catch(e){ console.warn('[UI] staff:created render failed', e); } });
    __services?.events?.on?.('audit:logged', ()=>{ try { this.renderAuditLog(); } catch(err){ console.warn('[UI] audit render after log failed', err); } });
  }

  // ==== Staff ====
  async addStaff(){
    const nameEl = document.getElementById('staffName');
    const roleEl = document.getElementById('staffType');
    const hoursEl = document.getElementById('contractHours');
    const daysEl = document.getElementById('typicalWorkdays');
    const prefEl = document.getElementById('weekendPreference');
    const permPrefEl = document.getElementById('permanentPreferredShift');
    // Practical limits fields
    const minPracticalEl = document.getElementById('weeklyHoursMinPractical');
    const maxPracticalEl = document.getElementById('weeklyHoursMaxPractical');
    const notesEl = document.getElementById('notesPracticalCaps');
    
    if (!nameEl || !roleEl) return;
    const name = nameEl.value?.trim();
    if (!name) { alert('Bitte Name eingeben'); return; }
    const role = roleEl.value || 'minijob';
    const contractHours = Number(hoursEl?.value || 0);
    const typicalWorkdays = Number(daysEl?.value || 0);
    const weekendPreference = !!prefEl?.checked;
    const permanentPreferredShift = role === 'permanent' ? (permPrefEl?.value || 'none') : 'none';
    
    // Practical limits (only for minijob/student)
    const weeklyHoursMinPractical = (role === 'minijob' || role === 'student') ? 
      (minPracticalEl?.value ? Number(minPracticalEl.value) : undefined) : undefined;
    const weeklyHoursMaxPractical = (role === 'minijob' || role === 'student') ? 
      (maxPracticalEl?.value ? Number(maxPracticalEl.value) : undefined) : undefined;
    const notesPracticalCaps = (role === 'minijob' || role === 'student') ? 
      (notesEl?.value?.trim() || undefined) : undefined;
    
    // Validate practical limits
    if (role === 'minijob' || role === 'student') {
      if (weeklyHoursMinPractical !== undefined && (weeklyHoursMinPractical < 0 || weeklyHoursMinPractical > 50)) {
        alert('Praktische Min-Stunden müssen zwischen 0 und 50 liegen'); return;
      }
      if (weeklyHoursMaxPractical !== undefined && (weeklyHoursMaxPractical < 0 || weeklyHoursMaxPractical > 50)) {
        alert('Praktische Max-Stunden müssen zwischen 0 und 50 liegen'); return;
      }
      if (weeklyHoursMinPractical !== undefined && weeklyHoursMaxPractical !== undefined && 
          weeklyHoursMinPractical > weeklyHoursMaxPractical) {
        alert('Praktische Min-Stunden dürfen nicht größer als Max-Stunden sein'); return;
      }
      if (role === 'student' && weeklyHoursMaxPractical > 20) {
        const confirm = window.confirm('Werkstudenten dürfen normalerweise max. 20h/Woche arbeiten. Trotzdem fortfahren?');
        if (!confirm) return;
      }
    }
    
    // Are we editing?
    const editIdEl = document.getElementById('staffIdToEdit');
    const editId = Number(editIdEl?.value || 0);
    const staffSvc = __services?.staff; // unified service (local or supabase via HydratingStore)
    if (!staffSvc){ alert('Dienstleistungen noch nicht initialisiert. Bitte kurz warten und erneut versuchen.'); return; }
    
    const staffData = { 
      name, role, contractHours, typicalWorkdays, weekendPreference, permanentPreferredShift,
      weeklyHoursMinPractical, weeklyHoursMaxPractical, notesPracticalCaps
    };
    
    if (editId) {
      const staff = staffSvc.update(editId, staffData);
      if (!staff) { alert('Mitarbeiter nicht gefunden'); return; }
      // Persist temp periods via unified helpers
      if (Array.isArray(appState.tempIllnessPeriods)){
        // Clear existing illness
        const existingIllness = appState.illnessByStaff[editId] || [];
        for (let i = existingIllness.length - 1; i >= 0; i--) {
          try { await this.deleteVacationRange(editId, i, true); } catch (err) { console.warn('Failed to remove old illness', err); }
        }
        // Add new illness
        for (const p of appState.tempIllnessPeriods) {
          try { await this.upsertVacationRange(editId, p, true); } catch (err) { console.warn('Failed to add illness', err); }
        }
      }
      await this.loadVacationData([editId]);
    } else {
      const staff = staffSvc.create({ ...staffData, alternativeWeekendDays: [] });
      const nextId = staff.id;
      if (Array.isArray(appState.tempIllnessPeriods) && appState.tempIllnessPeriods.length){
        for (const p of appState.tempIllnessPeriods) {
          try { await this.upsertVacationRange(nextId, p, true); } catch (err) { console.warn('Failed to add illness for new staff', err); }
        }
      }
      await this.loadVacationData([nextId]);
    }
    appState.save();
    this.resetStaffForm();
    this.renderStaffList();
    this.populateAvailabilitySelectors();
  }

  // ==== Holidays ====
  initHolidays(){
    const yearSel = document.getElementById('holidaysYear');
    if (yearSel){
      yearSel.innerHTML = '';
      const now = new Date();
      for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++){
        const opt = document.createElement('option');
        opt.value = String(y); opt.text = String(y);
        if (y === now.getFullYear()) opt.selected = true;
        yearSel.appendChild(opt);
      }
      yearSel.addEventListener('change', ()=> this.renderHolidaysList());
      this.renderHolidaysList();
    }
  }

  showHolidaysPopup(){
    this.fetchAndShowHolidays().catch(()=>{
      // fallback to local modal if fetch fails
      try { window.modalManager ? window.modalManager.open('holidaysModal') : window.showModal?.('holidaysModal'); } catch(e){ console.warn('[AppUI] fallback open modal failed', e); }
      this.initHolidays();
    });
  }

  addHoliday(){
    const yearSel = document.getElementById('holidaysYear');
    const dateEl = document.getElementById('holidayDate');
    const nameEl = document.getElementById('holidayName');
    const closedEl = document.getElementById('holidayClosedToggle');
    if (!yearSel || !dateEl || !nameEl) return;
    const year = yearSel.value; const date = dateEl.value; const name = nameEl.value?.trim();
    if (!year || !date || !name){ alert('Bitte Jahr, Datum und Name angeben'); return; }
    const closed = !!closedEl?.checked;
    if (__services?.holiday){ __services.holiday.add(year, date, name, { closed }); } else {
      if (!appState.holidays[year]) appState.holidays[year] = {};
      appState.holidays[year][date] = { name, closed, source: 'manual' };
      appState.save();
    }
    dateEl.value=''; nameEl.value='';
    if (closedEl) closedEl.checked = false;
    this.renderHolidaysList();
    try { window.ui?.updateHolidayBadgesExt?.(Number(year), { retype:true }); } catch {}
    try { window.ui?.updateDay?.(date); } catch {}
  }

  removeHoliday(date){
    const yearSel = document.getElementById('holidaysYear');
    const year = yearSel?.value; if (!year) return;
    if (__services?.holiday){ __services.holiday.remove(year, date); } else {
      if (!appState.holidays[year]) return;
      delete appState.holidays[year][date];
      appState.save();
    }
    this.renderHolidaysList();
    try { window.ui?.updateHolidayBadgesExt?.(Number(year), { retype:true }); } catch {}
    try { window.ui?.updateDay?.(date); } catch {}
  }

  renderHolidaysList(){
    const yearSel = document.getElementById('holidaysYear');
    const list = document.getElementById('holidaysList'); if (!yearSel || !list) return;
    const year = yearSel.value;
    let entries = [];
    if (__services?.holiday){
      entries = (__services.holiday.list(year) || []).map(entry => ({
        date: entry.date,
        name: entry.name || '',
        closed: !!entry.closed,
        source: entry.source || 'manual'
      }));
    } else {
      const store = appState.holidays[year] || {};
      entries = Object.entries(store).map(([date, value]) => ({ date, ...normalizeHolidayEntry(value) }));
    }
    const items = entries.sort((a,b)=> a.date.localeCompare(b.date));
    list.innerHTML = items.length ? items.map(({ date: d, name: n, closed })=>{
      const label = n ? n : '(kein Name)';
      const closedBadge = closed ? '<span class="badge badge-error">Geschlossen</span>' : '';
      const closedChecked = closed ? 'checked' : '';
      return `<li class="list-item">
        <span>${d} &ndash; ${label}</span>
        ${closedBadge}
        <label class="inline holiday-toggle">
          <input type="checkbox" data-toggle-closed="${d}" ${closedChecked} />
          <span>Geschlossen</span>
        </label>
        <button class="btn btn-sm btn-danger" data-date="${d}" title="Entfernen">✕</button>
      </li>`;
    }).join('') : '<li class="list-item"><span>Keine Feiertage</span></li>';
    list.querySelectorAll('button[data-date]').forEach(btn=>btn.addEventListener('click', e=>{ const d=e.currentTarget.getAttribute('data-date'); this.removeHoliday(d); }));
    list.querySelectorAll('input[data-toggle-closed]').forEach(cb => cb.addEventListener('change', e => {
      const date = e.currentTarget.getAttribute('data-toggle-closed');
      const checked = e.currentTarget.checked;
      this.setHolidayClosed(date, checked);
    }));
  }

  setHolidayClosed(date, closed){
    const yearSel = document.getElementById('holidaysYear');
    const year = yearSel?.value;
    if (!year) return;
    if (__services?.holiday?.setClosed){
      __services.holiday.setClosed(year, date, closed);
    } else {
      if (!appState.holidays[year]) appState.holidays[year] = {};
      const entry = normalizeHolidayEntry(appState.holidays[year][date]);
      entry.closed = !!closed;
      appState.holidays[year][date] = entry;
      appState.save();
    }
    this.renderHolidaysList();
    try { window.ui?.updateHolidayBadgesExt?.(Number(year), { retype:true }); } catch {}
    try { window.ui?.updateDay?.(date); } catch {}
  }

  renderIcsSources(){
    const list = document.getElementById('icsSourcesList');
    if (!list) return;
  const items = (appState.academicTermSources||[]).map((u,idx)=>`<li class="list-item"><span>${u}</span><button class="btn btn-sm btn-danger" data-rm="${idx}" title="Entfernen">✕</button></li>`);
  list.innerHTML = items.length ? items.join('') : '<li class="list-item"><span>Keine Quellen hinterlegt</span></li>';
    list.querySelectorAll('button[data-rm]').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-rm'));
        appState.academicTermSources.splice(i,1); appState.save(); this.renderIcsSources();
      });
    });
  }

  addIcsSource(){
    const input = document.getElementById('icsUrlInput');
    if (!input) return;
    const url = input.value?.trim();
    if (!url) return;
    if (!appState.academicTermSources) appState.academicTermSources = [];
    if (!appState.academicTermSources.includes(url)) appState.academicTermSources.push(url);
    appState.save();
    input.value='';
    this.renderIcsSources();
  }

  async refreshAcademicTerms(){
    const { fetchAcademicTerms } = await import('../modules/academicTerms.js');
    try{
      await fetchAcademicTerms(true);
      alert('Vorlesungszeiten aktualisiert.');
    } catch(e){
      console.error(e); alert('Konnte Vorlesungszeiten nicht laden.');
    }
  }

  async fetchAndShowHolidays(){
    const now = new Date();
    const year = now.getFullYear();
    
    try {
      // Use the enhanced holiday service from __services
      const holidayService = __services?.holiday;
      if (holidayService && holidayService.fetchHolidaysForYear) {
        await holidayService.fetchHolidaysForYear(year);
      } else {
        console.warn('Holiday service not available in __services, holidays may not be loaded');
      }
    } catch(e) {
      console.error('Could not fetch holidays:', e);
      alert(`Fehler beim Laden der Feiertage für ${year}. Bitte versuchen Sie es später erneut.`);
    }
  // Open modal and render
  try { window.modalManager ? window.modalManager.open('holidaysModal') : window.showModal?.('holidaysModal'); } catch(e){ console.warn('[AppUI] open holidaysModal failed', e); }
    this.initHolidays();
  // Also refresh availability grid if visible
  try { this.handleAvailabilityDisplay(); } catch {}
  }

  resetStaffForm(){
    ['staffName','contractHours','typicalWorkdays','weeklyHoursMinPractical','weeklyHoursMaxPractical','notesPracticalCaps'].forEach(id=>{ const el=document.getElementById(id); if (el) el.value=''; });
    const roleEl = document.getElementById('staffType'); if (roleEl) roleEl.value='minijob';
    const prefEl = document.getElementById('weekendPreference'); if (prefEl) prefEl.checked = false;
  const permPrefRow = document.getElementById('permanentPreferredRow'); if (permPrefRow) permPrefRow.style.display = 'none';
  const practicalRow = document.getElementById('practicalLimitsRow'); if (practicalRow) practicalRow.style.display = 'none';
    const permPrefSel = document.getElementById('permanentPreferredShift'); if (permPrefSel) permPrefSel.value = 'none';
    const editIdEl = document.getElementById('staffIdToEdit'); if (editIdEl) editIdEl.value = '';
    const saveBtn = document.getElementById('saveStaffBtn'); if (saveBtn) saveBtn.textContent = 'Arbeitskraft speichern';
  const cancelBtn = document.getElementById('cancelEditBtn'); if (cancelBtn) cancelBtn.hidden = true;
    // Clear temp lists
    appState.tempIllnessPeriods = [];
    this.renderTempIllnessList();
  }

  renderStaffList(){
    const host = document.getElementById('staffList');
    if (!host) return; 
    const staffSvc = __services?.staff;
    if (!staffSvc){
      host.innerHTML = '<p>Dienste werden initialisiert…</p>';
      return;
    }
    const staffList = staffSvc.list();
    // If hydration not yet finished and list is empty, show loading instead of empty state
    if (!staffList.length){
      if (!this._servicesHydrated && __services?.ready){
        host.innerHTML = '<p>Lade Mitarbeiter…</p>';
        return;
      }
      host.innerHTML = '<p>Keine Mitarbeiter hinzugefügt.</p>';
      return;
    }
    const weekdayOptions = (selected) => {
      const names = ['So','Mo','Di','Mi','Do','Fr','Sa'];
      // Only Mon..Fri are valid alt weekend days
      return [1,2,3,4,5].map(d => `<option value="${d}" ${String(selected)===String(d)?'selected':''}>${names[d]}</option>`).join('');
    };
  host.innerHTML = staffList.map(s=>{
      const isPermanent = s.role === 'permanent';
      const pref = !!s.weekendPreference;
  const permPref = (s.permanentPreferredShift || 'none');
      const alt = Array.isArray(s.alternativeWeekendDays) ? s.alternativeWeekendDays : [];
      const showAlt = !!(isPermanent && APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED);
      return `
      <div class="staff-card card-col">
        <div class="card-row">
          <div>
            <strong>${s.name}</strong> – ${s.role}
            <div class="badge">${s.contractHours||0} h/Woche</div>
            <div class="badge">${s.typicalWorkdays||0} Tage/Woche</div>
    ${isPermanent && permPref !== 'none' ? `<div class="badge">Präferenz: ${permPref==='early' ? (SHIFTS?.early?.name||'Früh') : (SHIFTS?.midday?.name||'Mittel')}</div>` : ''}
          </div>
          <div class="btn-group">
            <button class="btn btn-secondary" data-action="edit" data-id="${s.id}">Bearbeiten</button>
            <button class="btn btn-danger" data-action="remove" data-id="${s.id}">Entfernen</button>
          </div>
        </div>
        ${isPermanent ? `
        <div class="form-row toggles">
          <label class="inline">
            <input type="checkbox" class="wknd-pref" data-id="${s.id}" ${pref?'checked':''} />
            <span>Wochenenden bevorzugen</span>
          </label>
        </div>
        ${showAlt ? `
        <div class="form-row compact ${pref?'':'disabled'}">
          <label>Alternative WE-Tage</label>
          <select class="alt-day" data-id="${s.id}" data-idx="0" ${pref?'':'disabled'}>
            <option value="">–</option>
            ${weekdayOptions(alt[0])}
          </select>
          <select class="alt-day" data-id="${s.id}" data-idx="1" ${pref?'':'disabled'}>
            <option value="">–</option>
            ${weekdayOptions(alt[1])}
          </select>
        </div>`: ''}
        ` : ''}
      </div>`;
    }).join('');
    // Edit
    host.querySelectorAll('button[data-action="edit"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = Number(e.currentTarget.dataset.id);
  const s = staffSvc.list().find(x=>x.id===id);
        if (!s) return;
        document.getElementById('staffName').value = s.name || '';
        document.getElementById('staffType').value = s.role || 'minijob';
        document.getElementById('contractHours').value = s.contractHours || '';
        document.getElementById('typicalWorkdays').value = s.typicalWorkdays || '';
        const prefEl = document.getElementById('weekendPreference'); if (prefEl) prefEl.checked = !!s.weekendPreference;
  const permPrefRow = document.getElementById('permanentPreferredRow'); if (permPrefRow) permPrefRow.style.display = (s.role==='permanent') ? '' : 'none';
  const practicalRow = document.getElementById('practicalLimitsRow'); if (practicalRow) practicalRow.style.display = ((s.role==='minijob' || s.role==='student')) ? '' : 'none';
        const permPrefSel = document.getElementById('permanentPreferredShift'); if (permPrefSel) permPrefSel.value = s.permanentPreferredShift || 'none';
        // Populate practical limits fields
        const minPracticalEl = document.getElementById('weeklyHoursMinPractical'); if (minPracticalEl) minPracticalEl.value = s.weeklyHoursMinPractical || '';
        const maxPracticalEl = document.getElementById('weeklyHoursMaxPractical'); if (maxPracticalEl) maxPracticalEl.value = s.weeklyHoursMaxPractical || '';
        const notesEl = document.getElementById('notesPracticalCaps'); if (notesEl) notesEl.value = s.notesPracticalCaps || '';
        const editIdEl = document.getElementById('staffIdToEdit'); if (editIdEl) editIdEl.value = String(id);
        const saveBtn = document.getElementById('saveStaffBtn'); if (saveBtn) saveBtn.textContent = 'Änderungen speichern';
  const cancelBtn = document.getElementById('cancelEditBtn'); if (cancelBtn) cancelBtn.hidden = false;
        // Load per-staff illnesses to temp lists for editing
        appState.tempIllnessPeriods = [...(appState.illnessByStaff?.[id]||[])];
        this.renderTempIllnessList();
        // Switch to tab remains in place
      });
    });
    host.querySelectorAll('button[data-action="remove"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = Number(e.currentTarget.dataset.id);
  const staff = staffSvc.list().find(x=>x.id===id);
        if (!staff) return;
        const name = staff.name || id;
        const confirmed = window.confirm(`Mitarbeiter "${name}" wirklich löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.`);
        if (!confirmed) return;
  if (staffSvc.remove(id)){
          // Deep cleanup of associated data
          try {
            // Availability
            if (appState.availabilityData && appState.availabilityData[id]) delete appState.availabilityData[id];
            // Vacations / Illness
            if (appState.vacationsByStaff && appState.vacationsByStaff[id]) delete appState.vacationsByStaff[id];
            if (appState.illnessByStaff && appState.illnessByStaff[id]) delete appState.illnessByStaff[id];
            // Carryover / month caches
            if (appState.carryoverByStaffAndMonth){ Object.keys(appState.carryoverByStaffAndMonth).forEach(k=>{ if (k.startsWith(id+':')) delete appState.carryoverByStaffAndMonth[k]; }); }
            if (appState.monthHoursCache){ Object.keys(appState.monthHoursCache).forEach(k=>{ if (k.startsWith(id+':')) delete appState.monthHoursCache[k]; }); }
            // Overtime consent / credits / requests
            if (appState.permanentOvertimeConsent){ Object.keys(appState.permanentOvertimeConsent).forEach(year=>{ const y = appState.permanentOvertimeConsent[year]; if (y && y[id]) delete y[id]; }); }
            if (appState.overtimeCredits){ Object.keys(appState.overtimeCredits).forEach(monthKey=>{ const rec = appState.overtimeCredits[monthKey]; if (rec && rec[id]) delete rec[id]; }); }
            // Overtime requests cleanup now handled via OvertimeService (no direct state mutation here)
            // Voluntary evening availability keys
            if (appState.voluntaryEveningAvailability){ Object.keys(appState.voluntaryEveningAvailability).forEach(k=>{ if (k.startsWith(id+"::")) delete appState.voluntaryEveningAvailability[k]; }); }
            // Weekend assignment tracking
            if (appState.weekendAssignments){ Object.keys(appState.weekendAssignments).forEach(k=>{ if (k.startsWith(id+':')) delete appState.weekendAssignments[k]; }); }
            // Student weekday daytime tracker
            if (appState.studentWeekdayDaytimeShifts){ Object.keys(appState.studentWeekdayDaytimeShifts).forEach(k=>{ if (k.startsWith(id+':')) delete appState.studentWeekdayDaytimeShifts[k]; }); }
            // Vacation ledger entries
            if (appState.vacationLedger){ Object.keys(appState.vacationLedger).forEach(yearKey=>{ const yrec = appState.vacationLedger[yearKey]; if (yrec && yrec[id]) delete yrec[id]; }); }
            // Schedule assignments (remove staff from any day)
            if (appState.scheduleData){
              Object.values(appState.scheduleData).forEach(monthObj=>{
                if (!monthObj || !monthObj.data) return;
                Object.values(monthObj.data).forEach(dayObj=>{
                  if (!dayObj || !dayObj.assignments) return;
                  Object.keys(dayObj.assignments).forEach(shiftKey=>{
                    if (String(dayObj.assignments[shiftKey])===String(id)) delete dayObj.assignments[shiftKey];
                  });
                });
              });
            }
            // Audit log entry
            try { if (!Array.isArray(appState.auditLog)) appState.auditLog = []; appState.auditLog.push({ timestamp: Date.now(), message: `Mitarbeiter gelöscht: ${name} (ID ${id})` }); } catch {}
          } catch (err){ console.warn('Cleanup after staff deletion fehlgeschlagen', err); }
          appState.save();
          // Re-render UI sections impacted
            this.renderStaffList();
            this.populateAvailabilitySelectors();
            if (this.renderVacationList) this.renderVacationList();
            if (this.renderVacationSummaryTable) this.renderVacationSummaryTable();
            if (this.renderIllnessList) this.renderIllnessList();
            if (this.renderAuditLog) this.renderAuditLog();
            if (this.renderOvertimeRequestsTable) this.renderOvertimeRequestsTable();
            // Reports tables
            if (this.renderMonthlyHoursTable) this.renderMonthlyHoursTable();
            if (this.renderFairnessTables) this.renderFairnessTables();
            if (this.renderOvertimeCreditsTable) this.renderOvertimeCreditsTable();
        }
      });
    });
    // Weekend preference toggles
    host.querySelectorAll('input.wknd-pref').forEach(cb => {
      cb.addEventListener('change', (e)=>{
        const id = Number(e.currentTarget.getAttribute('data-id'));
  const staff = staffSvc.list().find(x=>x.id===id);
        if (!staff) return;
        staff.weekendPreference = !!e.currentTarget.checked;
        if (!staff.weekendPreference) delete staff.alternativeWeekendDays;
        appState.save();
        this.renderStaffList();
      });
    });
    // Alternative weekend day selectors
    host.querySelectorAll('select.alt-day').forEach(sel => {
      sel.addEventListener('change', (e)=>{
        const id = Number(e.currentTarget.getAttribute('data-id'));
        const idx = Number(e.currentTarget.getAttribute('data-idx'));
  const staff = staffSvc.list().find(x=>x.id===id);
        if (!staff || !staff.weekendPreference) return;
        if (!Array.isArray(staff.alternativeWeekendDays)) staff.alternativeWeekendDays = [];
        const val = parseInt(e.currentTarget.value, 10);
        if (!isNaN(val)) staff.alternativeWeekendDays[idx] = val; else delete staff.alternativeWeekendDays[idx];
        // Deduplicate and clamp to 2 entries
        staff.alternativeWeekendDays = Array.from(new Set(staff.alternativeWeekendDays.filter(v=>Number.isInteger(v)))).slice(0,2);
        appState.save();
      });
    });
  }

  // ==== Staff temp Illness (form) ====
  renderTempIllnessList(){ /* already defined later if duplicated, guard */ }

  // ==== Vacation Ledger (summary panel) ==== 
  initVacationLedger(){
    // Basic setup: build year select for ledger table if present
    const yearSel = document.getElementById('vacationYearSelect');
    if (yearSel && (!yearSel.options || yearSel.options.length===0)){
      const now = new Date();
      for (let y = now.getFullYear()-1; y<= now.getFullYear()+1; y++){
        const opt = document.createElement('option'); opt.value=String(y); opt.textContent=String(y); if (y===now.getFullYear()) opt.selected=true; yearSel.appendChild(opt);
      }
      yearSel.addEventListener('change', ()=>{ this.renderVacationSummaryTable(); });
    }
    this.renderVacationSummaryTable();
  }

  renderVacationSummaryTable(){
    const tbody = document.getElementById('vacationLedgerTable');
    const yearSel = document.getElementById('vacationYearSelect');
    if (!tbody || !yearSel) return;
    const year = Number(yearSel.value)|| (new Date()).getFullYear();
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    const ledger = __services?.vacation?.getLedger ? __services.vacation.getLedger(year) : (appState.vacationLedger?.[year]||{});
    const rows = staffList.map(s => {
      const planned = this.countPlannedVacationDaysForYear ? this.countPlannedVacationDaysForYear(s.id, year) : 0;
      const sick = this.countSickDaysForYear ? this.countSickDaysForYear(s.id, year) : 0;
  const allowance = (ledger?.[s.id]?.allowance) ?? this._defaultVacationAllowance(s);
      const takenManual = (ledger?.[s.id]?.takenManual) ?? 0;
      const carryPrev = (ledger?.[s.id]?.carryPrev) ?? 0;
      const remaining = allowance + carryPrev - takenManual - planned;
  return `<tr data-staff="${s.id}" data-planned="${planned}">
    <td class="text-left">${s.name}</td>
    <td><input type="number" class="ledger-input" data-field="allowance" value="${allowance}" min="0" step="1"/></td>
    <td><input type="number" class="ledger-input" data-field="takenManual" value="${takenManual}" min="0" step="1"/></td>
    <td><input type="number" class="ledger-input" data-field="carryPrev" value="${carryPrev}" min="0" step="1"/></td>
    <td>${planned}</td>
    <td class="remaining-cell">${remaining}</td>
    <td>${sick}</td>
    <td><button class="btn btn-sm" data-ledger-save="${s.id}">Speichern</button></td>
  </tr>`;
    }).join('');
  tbody.innerHTML = rows || '<tr><td colspan=\"8\" class=\"text-center text-muted\">Keine Daten</td></tr>';

    // Live recompute remaining on input changes
    const recompute = (tr)=>{
      if (!tr) return;
      const planned = Number(tr.getAttribute('data-planned')) || 0;
      const getVal = (field)=> Number(tr.querySelector(`input[data-field="${field}"]`)?.value || 0) || 0;
      const allowance = getVal('allowance');
      const taken = getVal('takenManual');
      const carry = getVal('carryPrev');
      const remaining = allowance + carry - taken - planned;
      const cell = tr.querySelector('.remaining-cell'); if (cell) cell.textContent = String(remaining);
    };
    tbody.querySelectorAll('input.ledger-input').forEach(inp=>{
      inp.addEventListener('input', (e)=>{ const tr = e.currentTarget.closest('tr'); recompute(tr); });
    });
    // Save handlers
    tbody.querySelectorAll('button[data-ledger-save]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const tr = e.currentTarget.closest('tr'); if (!tr) return;
        const staffId = Number(e.currentTarget.getAttribute('data-ledger-save'));
        const getVal = (field)=> Number(tr.querySelector(`input[data-field="${field}"]`)?.value || 0) || 0;
        const payload = { allowance: getVal('allowance'), takenManual: getVal('takenManual'), carryPrev: getVal('carryPrev') };
        try { await __services?.vacation?.upsertLedgerEntry({ staffId, year, ...payload }); }
        catch(err){ console.warn('Ledger save failed', err); }
        // Re-render to reflect any server-updated version or normalization
        setTimeout(()=> this.renderVacationSummaryTable(), 50);
      });
    });
  }
  ensureToastContainer(){
    if (document.getElementById('toastContainer')) return;
    const div = document.createElement('div');
    div.id='toastContainer';
  div.className='toast-container';
    document.body.appendChild(div);
  }
  showLedgerConflictToast(payload){
    this.ensureToastContainer();
    const wrap = document.createElement('div');
    wrap.className='toast toast-warning';
    wrap.innerHTML = `<div class=\"fw-600\">Ledger geändert</div><div class=\"fs-13\">Ledger changed remotely. Reload latest or retry.</div><div class=\"flex-gap-6\">`+
      `<button class="btn btn-sm" data-act="reload">Reload</button>`+
      `<button class="btn btn-sm btn-secondary" data-act="retry">Retry</button>`+
      `<button class=\"btn btn-sm btn-danger ml-auto\" data-act=\"close\">✕</button>`+
      `</div>`;
    const container = document.getElementById('toastContainer');
    container.appendChild(wrap);
    const year = payload?.year || (new Date()).getFullYear();
    wrap.querySelectorAll('button[data-act]').forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const act = btn.getAttribute('data-act');
        if (act==='close'){ wrap.remove(); return; }
        if (act==='reload'){
          try { __services?.vacation?.getLedger(year); this.renderVacationSummaryTable(); } catch(e){ console.warn('reload failed', e); }
          wrap.remove();
        } else if (act==='retry'){
          if (payload?.staffId){
            const cur = __services?.vacation?.getLedger(year)?.[payload.staffId];
            if (cur){ __services?.vacation?.upsertLedgerEntry({ staffId: payload.staffId, year, allowance:cur.allowance, takenManual:cur.takenManual, carryPrev:cur.carryPrev, meta:cur.meta }); }
          }
          setTimeout(()=> this.renderVacationSummaryTable(), 300);
          wrap.remove();
        }
      });
    });
  setTimeout(()=>{ wrap.classList.add('fade-out'); setTimeout(()=>wrap.remove(), 600); }, 10000);
  }

  showSyncFailureToast(message = 'Synchronisation fehlgeschlagen, Änderung lokal gespeichert') {
    this.ensureToastContainer();
    const wrap = document.createElement('div');
    wrap.className = 'toast toast-warning';
    wrap.innerHTML = `<div class="fw-600">Sync-Fehler</div><div class="fs-13">${message}</div><div class="flex-gap-6"><button class="btn btn-sm btn-danger ml-auto" data-act="close">✕</button></div>`;
    const container = document.getElementById('toastContainer');
    container.appendChild(wrap);
    wrap.querySelector('button[data-act="close"]').addEventListener('click', () => wrap.remove());
    setTimeout(() => { wrap.classList.add('fade-out'); setTimeout(() => wrap.remove(), 600); }, 5000);
  }

  renderIllnessList(){
    const host = document.getElementById('staffIllnessList');
    if (!host) return;
    // For current edit form context only; uses temp list if editing.
    const list = appState.tempIllnessPeriods || [];
    host.innerHTML = list.length ? list.map((p,idx)=>`<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-ill="${idx}" title="Entfernen">✕</button></li>`).join('') : '<li class="list-item"><span>Keine Einträge</span></li>';
    host.querySelectorAll('button[data-rm-ill]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-rm-ill'));
        appState.tempIllnessPeriods.splice(i,1); appState.save(); this.renderIllnessList();
      });
    });
  }
  renderTempIllnessList(){
    const host = document.getElementById('staffIllnessList');
    if (!host) return;
    const list = appState.tempIllnessPeriods || [];
    host.innerHTML = list.length ? list.map((p,idx)=>`<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-ill="${idx}" title="Entfernen">✕</button></li>`).join('') : '<li class="list-item"><span>Keine Einträge</span></li>';
    host.querySelectorAll('button[data-rm-ill]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-rm-ill'));
        appState.tempIllnessPeriods.splice(i,1); 
        
        // For cross-tab persistence: also remove from main illnessByStaff if editing a staff member
        const editIdEl = document.getElementById('staffIdToEdit');
        const editId = Number(editIdEl?.value || 0);
        if (editId && appState.illnessByStaff?.[editId]) {
          // Remove the illness at the same index (assuming temp list mirrors main list during editing)
          if (i < appState.illnessByStaff[editId].length) {
            appState.illnessByStaff[editId].splice(i, 1);
          }
        }
        
        appState.save(); this.renderTempIllnessList();
      });
    });
  }
  addStaffIllnessPeriod(){
    const startEl = document.getElementById('staffIllnessStart');
    const endEl = document.getElementById('staffIllnessEnd');
    const start = startEl?.value; const end = endEl?.value;
    if (!start || !end || end < start){ alert('Bitte gültigen Krankheitszeitraum wählen'); return; }
    appState.tempIllnessPeriods = appState.tempIllnessPeriods || [];
    appState.tempIllnessPeriods.push({ start, end });
    
    // For cross-tab persistence: also add to main illnessByStaff if editing a staff member
    const editIdEl = document.getElementById('staffIdToEdit');
    const editId = Number(editIdEl?.value || 0);
    if (editId) {
      appState.illnessByStaff = appState.illnessByStaff || {};
      appState.illnessByStaff[editId] = appState.illnessByStaff[editId] || [];
      appState.illnessByStaff[editId].push({ start, end });
    }
    
    appState.save();
    this.renderTempIllnessList();
    if (startEl) startEl.value=''; if (endEl) endEl.value='';
  }
  // When persisting illness for staff (already migrated in staff save) audit via centralized helper occurs there.

  // ==== Availability ====
  populateAvailabilitySelectors(){
    const staffSel = document.getElementById('availabilityStaffSelect');
    const monthSel = document.getElementById('availabilityMonth');
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    if (staffSel){
      staffSel.innerHTML = '<option value="">– auswählen –</option>' + staffList.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    }
    if (monthSel){
      if (!monthSel.options || monthSel.options.length===0){
        const now = new Date();
        for (let i=0;i<12;i++){
          const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
          const val = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
          const opt = document.createElement('option'); opt.value = val; opt.textContent = d.toLocaleString(undefined,{month:'long', year:'numeric'}); monthSel.appendChild(opt);
        }
      }
      if (!monthSel.value && monthSel.options[0]) monthSel.value = monthSel.options[0].value;
    }
  }

  handleAvailabilityDisplay(){
    console.log('[Availability] handleAvailabilityDisplay called', { staffSel: document.getElementById('availabilityStaffSelect')?.value, month: document.getElementById('availabilityMonth')?.value });
    const availSvc = __services?.availability; // Fallback kept only for legacy sections
    const staffSel = document.getElementById('availabilityStaffSelect');
    const monthSel = document.getElementById('availabilityMonth');
    const host = document.getElementById('availabilityForm');
    if (!staffSel || !monthSel || !host) return;
  const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
  const staffValue = staffSel.value;
  const staff = staffList.find(s=> String(s.id) === staffValue);
  const staffId = staff ? staff.id : staffValue;
  const staffKey = String(staffId);
    const month = monthSel.value;
  if (!staffValue || !month){ host.innerHTML = '<p>Bitte Mitarbeiter und Monat auswählen.</p>'; return; }
    const [y,m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();

    const ensureSyncStatus = (message, variant) => {
      let statusLine = host.querySelector('.availability-sync-status');
      if (!statusLine) {
        statusLine = document.createElement('div');
        statusLine.className = 'status-line availability-sync-status';
        const spinner = document.createElement('span');
        spinner.className = 'spinner';
        const text = document.createElement('span');
        text.textContent = message || '';
        statusLine.appendChild(spinner);
        statusLine.appendChild(text);
        host.prepend(statusLine);
      } else {
        const spinner = statusLine.querySelector('.spinner');
        if (spinner) spinner.classList.toggle('hidden', variant === 'success');
        const text = statusLine.querySelector('span:last-child');
        if (text) text.textContent = message || '';
        statusLine.classList.remove('status-error','status-success');
        if (variant === 'error') statusLine.classList.add('status-error');
        if (variant === 'success') statusLine.classList.add('status-success');
      }
      return statusLine;
    };

    const getHolidayMeta = (dateStr) => {
      if (this.scheduleUI?.getHolidayMeta) {
        try { return this.scheduleUI.getHolidayMeta(dateStr); } catch (err) { console.warn('[Availability] getHolidayMeta via scheduleUI failed', err); }
      }
      try {
        const yearKey = String(y);
        const entry = appState.holidays?.[yearKey]?.[dateStr];
        return normalizeHolidayEntry(entry, 'legacy');
      } catch (err) {
        console.warn('[Availability] fallback holiday meta failed', err);
      }
      return null;
    };

    const getTypeForDate = (dateStr) => {
      const meta = getHolidayMeta(dateStr);
      const d = parseYMD(dateStr);
      const isWeekend = d.getDay()===0 || d.getDay()===6;
      if (meta?.closed) return 'closed';
      if (meta?.name) return 'holiday';
      return isWeekend ? 'weekend' : 'weekday';
    };
    const getShiftsForType = (type) => {
      if (type === 'closed') return [];
      return Object.entries(SHIFTS).filter(([_,v])=>v.type===type).map(([k])=>k);
    };
    const isPermanent = staff?.role === 'permanent';
    let html = '<div class="avail-grid">';
    if (isPermanent){
      html += '<div class="avail-row avail-head avail-cols-permanent"><div class="avail-cell">Datum</div><div class="avail-cell">Blockierte Schichten</div><div class="avail-cell">Freiwillig Abend</div><div class="avail-cell">Freiwillig Spät</div><div class="avail-cell">Frei</div></div>';
    } else {
      html += '<div class="avail-row avail-head avail-cols-regular"><div class="avail-cell">Datum</div><div class="avail-cell">Schichten</div></div>';
    }
    const getDaySnapshot = (dateStr) => {
      const remoteDay = availSvc?.getDay ? (availSvc.getDay(staffId, dateStr) || {}) : {};
      const localDay = appState.availabilityData?.[staffKey]?.[dateStr] || {};
      return { ...localDay, ...remoteDay };
    };
    const getShiftValue = (dateStr, shiftKey) => {
      const snapshot = getDaySnapshot(dateStr);
      return snapshot ? snapshot[shiftKey] : undefined;
    };
    const isDayOff = (dateStr) => {
      const remote = availSvc?.isDayOff ? availSvc.isDayOff(staffId, dateStr) : undefined;
      const localSentinel = appState.availabilityData?.[`staff:${staffKey}`]?.[dateStr];
      const normalizedLocal = localSentinel === 'off' || localSentinel === true;
      return !!(remote || normalizedLocal);
    };
    const isVoluntary = (dateStr, kind) => {
      if (availSvc?.isVoluntary && availSvc.isVoluntary(staffId, dateStr, kind)) return true;
      const key = `${staffKey}::${dateStr}::${kind}`;
      return !!appState.voluntaryEveningAvailability?.[key];
    };
    const applyLocalShift = (dateStr, shiftKey, status) => {
      if (!appState.availabilityData) appState.availabilityData = {};
      if (!appState.availabilityData[staffKey]) appState.availabilityData[staffKey] = {};
      if (!appState.availabilityData[staffKey][dateStr]) appState.availabilityData[staffKey][dateStr] = {};
      if (!status){
        delete appState.availabilityData[staffKey][dateStr][shiftKey];
        if (Object.keys(appState.availabilityData[staffKey][dateStr]).length===0) delete appState.availabilityData[staffKey][dateStr];
        if (Object.keys(appState.availabilityData[staffKey]).length===0) delete appState.availabilityData[staffKey];
      } else {
        appState.availabilityData[staffKey][dateStr][shiftKey] = status;
      }
      appState.save?.();
    };
    const applyLocalDayOff = (dateStr, isOff) => {
      const sentinelKey = `staff:${staffKey}`;
      if (!appState.availabilityData) appState.availabilityData = {};
      if (!appState.availabilityData[sentinelKey]) appState.availabilityData[sentinelKey] = {};
      if (isOff) {
        appState.availabilityData[sentinelKey][dateStr] = 'off';
      } else {
        delete appState.availabilityData[sentinelKey][dateStr];
        if (Object.keys(appState.availabilityData[sentinelKey]).length === 0) delete appState.availabilityData[sentinelKey];
      }
      appState.save?.();
    };
    const applyLocalVoluntary = (dateStr, kind, checked) => {
      if (!appState.voluntaryEveningAvailability) appState.voluntaryEveningAvailability = {};
      const key = `${staffKey}::${dateStr}::${kind}`;
      if (checked) appState.voluntaryEveningAvailability[key] = true; else delete appState.voluntaryEveningAvailability[key];
      appState.save?.();
    };

    for (let d=1; d<=days; d++){
      const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
      const meta = getHolidayMeta(dateStr) || null;
      const type = getTypeForDate(dateStr);
      const shiftsForDay = getShiftsForType(type);
      const isWE = type==='weekend';
      const isHolidayType = type==='holiday';
      const isClosed = type==='closed';
      const holName = meta?.name || '';
      const rowClasses = ['avail-row'];
      if (isWE) rowClasses.push('is-weekend');
      if (isHolidayType) rowClasses.push('is-holiday');
      if (isClosed) rowClasses.push('is-closed');
  const dateObj = parseYMD(dateStr);
  const dayIndex = (dateObj instanceof Date && !Number.isNaN(dateObj?.getTime?.())) ? dateObj.getDay() : new Date(`${dateStr}T00:00:00`).getDay();
  const weekdayLabel = ['So','Mo','Di','Mi','Do','Fr','Sa'][dayIndex] || '';
    const flags = [
        isWE ? '<span class="day-flag">Wochenende</span>' : '',
        holName ? `<span class="day-flag">${holName}</span>` : '',
        isClosed ? '<span class="day-flag badge-error">Geschlossen</span>' : ''
      ].filter(Boolean).join('');
      const off = isClosed ? true : isDayOff(dateStr);
  html += `<div class="${rowClasses.join(' ')} ${isPermanent ? 'avail-cols-permanent' : 'avail-cols-regular'}">`;
  html += `<div class="avail-cell"><span class="day-label">${weekdayLabel}</span><strong>${pad2(d)}.${pad2(m)}.${y}</strong> ${flags}</div>`;
  html += '<div class="avail-cell text-left">';
      if (shiftsForDay.length===0){
        html += isClosed ? '<span class="na-cell">Geschlossen</span>' : '<span class="na-cell">—</span>';
      }
      else {
        shiftsForDay.forEach(k=>{
          let val = getShiftValue(dateStr, k);
          // Treat legacy 'no' for non-permanent as unset
          if (!isPermanent && val === 'no') val = undefined;
          const isBlocked = isPermanent ? (val === 'no') : false;
          const stateClass = isPermanent ? (isBlocked ? 'state-no' : 'state-unset') : (val ? `state-${val}` : 'state-unset');
          const meta = SHIFTS[k] || {}; const name = meta.name || k; const time = meta.time || '';
          // Non-permanent: implicit not-available when no value. Only show ✓ (yes) or ★ (prefer).
          const label = isPermanent ? (isBlocked ? '✗' : '—') : (val === 'prefer' ? '★' : val === 'yes' ? '✓' : '—');
          html += `<button class="avail-btn ${stateClass} shift-btn" title="${name} ${time}" data-date="${dateStr}" data-shift="${k}" ${off?'disabled':''}>${name}: ${label}</button>`;
        });
      }
      html += '</div>';
      if (isPermanent){
        const isWeekday = type === 'weekday';
        const vEven = isWeekday ? isVoluntary(dateStr, 'evening') : false;
        const vClose = isWeekday ? isVoluntary(dateStr, 'closing') : false;
  html += `<div class="avail-cell">${isWeekday?`<label class="inline align-center gap-6"><input type="checkbox" class="vol-evening" data-date="${dateStr}" ${vEven?'checked':''}/> <span>Abend</span></label>`:'<span class="na-cell">—</span>'}</div>`;
  html += `<div class="avail-cell">${isWeekday?`<label class="inline align-center gap-6"><input type="checkbox" class="vol-closing" data-date="${dateStr}" ${vClose?'checked':''}/> <span>Spät</span></label>`:'<span class="na-cell">—</span>'}</div>`;
      }
      if (isPermanent){
        if (isClosed){
          html += '<div class="avail-cell"><span class="na-cell">Geschlossen</span></div>';
        } else {
          html += `<div class="avail-cell"><button class="btn ${off?'btn-secondary':''}" data-dayoff="1" data-date="${dateStr}" data-off="${off?1:0}">${off?'Freiwunsch':'Frei wünschen'}</button></div>`;
        }
      }
      html += '</div>';
    }
    html += '</div>';
    // Carryover panel preserved (TODO migrate to service later)
    try {
      const autoCarry = __services?.carryover?.auto ? __services.carryover.auto(staff, month, { getPrevMonthKey: this.getPrevMonthKey.bind(this), sumStaffHoursForMonth: this.sumStaffHoursForMonth.bind(this) }) : this.computeAutoCarryover(staff, month);
      const manualCarry = (__services?.carryover ? __services.carryover.get(staffId, month) : Number(appState.carryoverByStaffAndMonth?.[staffId]?.[month] ?? 0));
  html += `\n<div class="card mt-12 p-12">\n  <div class="fw-600 mb-4">Stundenübertrag (Vormonat → ${month})</div>\n  <div class="text-muted fs-90 mb-8">Ein positiver Wert erhöht das Monatsziel (z. B. +3h), ein negativer Wert verringert es (z. B. -3h).</div>\n  <div class="form-row grid-cols-auto-120px-auto-auto-auto align-end gap-10">\n    <label for="carryoverInput">Manueller Übertrag</label>\n    <input type="number" id="carryoverInput" value="${manualCarry}" step="0.25" class="w-120" />\n    <div class="text-muted">Auto (${autoCarry.toFixed(2)} h)</div>\n    <button class="btn" id="carryoverSaveBtn">Speichern</button>\n    <button class="btn btn-secondary" id="carryoverResetBtn">Zurücksetzen</button>\n  </div>\n  <div class="text-muted fs-85 mt-6">Ergebnisse sind kumulativ; Ziel ist, den Übertrag bis zum Ende des Folgemonats auf 0 zu bringen.</div>\n</div>`;
    } catch(e){ console.warn('Carryover panel render failed', e); }
    host.innerHTML = html;

  // Shift buttons
    host.querySelectorAll('button.avail-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        console.log('[Availability] Shift button clicked', { dateStr: e.currentTarget.dataset.date, shiftKey: e.currentTarget.dataset.shift, staffId, staffRole: staff?.role });
        const b = e.currentTarget; const dateStr = b.dataset.date; const shiftKey = b.dataset.shift;
        let current = getShiftValue(dateStr, shiftKey);
        if (staff?.role !== 'permanent' && current === 'no') current = undefined; // migrate legacy
        const next = (staff?.role === 'permanent')
          ? (current === 'no' ? undefined : 'no') // permanent keeps opt-out toggle
          : (current === 'yes' ? 'prefer' : current === 'prefer' ? undefined : 'yes'); // undefined -> yes -> prefer -> undefined
        console.log('[Availability] Updating shift', { dateStr, shiftKey, current, next });
        if (availSvc?.setShift) {
          try { availSvc.setShift(staffId, dateStr, shiftKey, next); console.log('[Availability] Remote setShift called'); } catch (err) { console.warn('[Availability] setShift failed (will rely on local state)', err); }
        }
        applyLocalShift(dateStr, shiftKey, next);
        // Incremental update instead of full re-render
        this.updateShiftButtonState(b, dateStr, shiftKey, staff?.role === 'permanent');
      });
    });
    // Voluntary checkboxes
    if (isPermanent){
      const toggleVol = (kind, cb) => {
        console.log('[Availability] Voluntary checkbox changed', { dateStr: cb.getAttribute('data-date'), kind, checked: cb.checked, staffId });
        const dateStr = cb.getAttribute('data-date');
        if (availSvc) {
          try { availSvc.setVoluntary(staffId, dateStr, kind, cb.checked); console.log('[Availability] Remote setVoluntary called'); } catch (err) { console.warn('[Availability] setVoluntary failed (will rely on local state)', err); }
        }
        applyLocalVoluntary(dateStr, kind, cb.checked);
      };
      host.querySelectorAll('input.vol-evening').forEach(cb => cb.addEventListener('change', e=>toggleVol('evening', e.currentTarget)));
      host.querySelectorAll('input.vol-closing').forEach(cb => cb.addEventListener('change', e=>toggleVol('closing', e.currentTarget)));
      host.querySelectorAll('button[data-dayoff="1"]').forEach(btn => btn.addEventListener('click', e => {
        console.log('[Availability] Day off button clicked', { dateStr: e.currentTarget.dataset.date, currentOff: e.currentTarget.dataset.off, staffId });
        const b = e.currentTarget; const dateStr = b.dataset.date; const isOff = b.dataset.off === '1';
        if (availSvc?.setDayOff) {
          try { availSvc.setDayOff(staffId, dateStr, !isOff); console.log('[Availability] Remote setDayOff called'); } catch (err) { console.warn('[Availability] setDayOff failed (will rely on local state)', err); }
        }
        applyLocalDayOff(dateStr, !isOff);
        // Incremental update instead of full re-render
        this.updateDayOffButtonState(b, dateStr);
        // Also disable/enable shift buttons in the same row
        const row = b.closest('.avail-row');
        if (row) {
          row.querySelectorAll('button.avail-btn').forEach(shiftBtn => {
            shiftBtn.disabled = !isOff; // if now off, disable; if now on, enable
          });
        }
      }));
    }
    const carryBtn = host.querySelector('#carryoverSaveBtn');
    if (carryBtn){
      carryBtn.addEventListener('click', ()=>{
        const inp = host.querySelector('#carryoverInput');
        const val = Number(inp?.value || 0);
        if (__services?.carryover){
          __services.carryover.set(staffId, month, Number.isFinite(val)?val:0);
          __services?.audit?.log?.(auditMsg('carryover.set',{staffId,month,value:val}));
        } else {
          if (!appState.carryoverByStaffAndMonth) appState.carryoverByStaffAndMonth = {};
          if (!appState.carryoverByStaffAndMonth[staffId]) appState.carryoverByStaffAndMonth[staffId] = {};
          appState.carryoverByStaffAndMonth[staffId][month] = Number.isFinite(val)?val:0;
          appState.save();
        }
        this.handleAvailabilityDisplay();
      });
    }
    const resetBtn = host.querySelector('#carryoverResetBtn');
    if (resetBtn){
      resetBtn.addEventListener('click', ()=>{
        const inp = host.querySelector('#carryoverInput');
        inp.value = 0;
        if (__services?.carryover){
          __services.carryover.set(staffId, month, 0);
          __services?.audit?.log?.(auditMsg('carryover.reset',{staffId,month,value:0}));
        } else {
          if (!appState.carryoverByStaffAndMonth) appState.carryoverByStaffAndMonth = {};
          if (!appState.carryoverByStaffAndMonth[staffId]) appState.carryoverByStaffAndMonth[staffId] = {};
          appState.carryoverByStaffAndMonth[staffId][month] = 0;
          appState.save();
        }
        this.handleAvailabilityDisplay();
      });
    }

    const runRemoteSync = async () => {
      if (!availSvc?.listRange) return;
      const store = window.__services?.store;
      const remote = !!(store && (store.remote || store.constructor?.name === 'SupabaseAdapter'));
      if (!remote) return;

      const syncKey = `${staffKey}::${month}`;
      if (this._availabilityHydrationInFlight && this._lastAvailabilitySyncKey === syncKey) return;
      if (this._lastAvailabilitySyncKey === syncKey && (Date.now() - this._lastAvailabilityHydratedAt) < 1500) return;

      const readyPromise = window.__services?.ready;
      try {
        if (readyPromise?.then) {
          await readyPromise;
        }
      } catch (readyErr) {
        console.warn('[Availability] service init wait failed', readyErr);
      }

      const [yy, mm] = month.split('-').map(Number);
      const fromDate = `${yy}-${String(mm).padStart(2,'0')}-01`;
      const toDate = `${yy}-${String(mm).padStart(2,'0')}-${String(new Date(yy, mm, 0).getDate()).padStart(2,'0')}`;

      const statusLine = ensureSyncStatus('Verfügbarkeiten laden…');
      const spinner = statusLine?.querySelector('.spinner');
      if (spinner) spinner.classList.remove('hidden');

      const selDisabled = { s: staffSel.disabled, m: monthSel.disabled };
      staffSel.disabled = true;
      monthSel.disabled = true;

      this._availabilityHydrationInFlight = true;
      this._lastAvailabilitySyncKey = syncKey;

      try {
        await availSvc.listRange(staffId, fromDate, toDate);
        ensureSyncStatus('Synchronisiert ✓', 'success');
        this._lastAvailabilityHydratedAt = Date.now();
      } catch (err) {
        console.warn('[Availability] pre-hydration failed', err);
        ensureSyncStatus('Synchronisation fehlgeschlagen', 'error');
      } finally {
        staffSel.disabled = selDisabled.s;
        monthSel.disabled = selDisabled.m;
        this._availabilityHydrationInFlight = false;
        const cleanup = () => {
          const line = host.querySelector('.availability-sync-status');
          if (line) line.remove();
        };
        setTimeout(cleanup, 1200);
      }
    };

    runRemoteSync().catch(err => console.warn('[Availability] sync failed', err));
  }

  // ==== Vacation ====
  populateVacationSelectors(){
    const staffSel = document.getElementById('vacationStaffSelect');
    if (staffSel){
      staffSel.innerHTML = '<option value="">– Mitarbeiter –</option>' + appState.staffData.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    }
  }

  // ==== Weitere Mitarbeitende (nur Urlaube) ====
  addOtherStaff(){
    const nameEl = document.getElementById('otherStaffName');
    const name = nameEl?.value?.trim();
    if (!name){ alert('Bitte Name angeben'); return; }
    if (!Array.isArray(appState.otherStaffData)) appState.otherStaffData = [];
    // Avoid duplicates by name
    if (!appState.otherStaffData.some(s=>s.name===name)){
      appState.otherStaffData.push({ name, vacations: [] });
      appState.save();
    }
    nameEl.value='';
    this.renderOtherStaff();
  }

  addOtherVacationPeriod(){
    const name = document.getElementById('otherStaffName')?.value?.trim();
    const start = document.getElementById('otherVacationStart')?.value;
    const end = document.getElementById('otherVacationEnd')?.value;
    if (!name){ alert('Bitte Name wählen oder eingeben'); return; }
    if (!start || !end || end < start){ alert('Bitte gültigen Zeitraum wählen'); return; }
    const rec = (appState.otherStaffData||[]).find(s=>s.name===name) || (()=>{ const r={ name, vacations: [] }; appState.otherStaffData.push(r); return r; })();
    rec.vacations.push({ start, end });
    appState.save();
    document.getElementById('otherVacationStart').value='';
    document.getElementById('otherVacationEnd').value='';
    this.renderOtherStaff();
  }

  renderOtherStaff(){
    const list = document.getElementById('otherStaffList');
    const vacList = document.getElementById('otherVacationList');
    if (!list || !vacList) return;
    const data = appState.otherStaffData || [];
    list.innerHTML = data.length ? data.map(s=>{
      const vacs = (s.vacations||[]).map((p,idx)=>`<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm="${s.name}::${idx}" title="Entfernen">✕</button></li>`).join('');
      return `<div class="staff-card card-col"><strong>${s.name}</strong><ul>${vacs||'<li class="list-item"><span>Keine Einträge</span></li>'}</ul></div>`;
    }).join('') : '<p>Keine weiteren Mitarbeitenden angelegt.</p>';
    // Show currently selected (by name input) list
    const name = document.getElementById('otherStaffName')?.value?.trim();
    const sel = data.find(s=>s.name===name);
    vacList.innerHTML = sel && sel.vacations?.length ? sel.vacations.map((p,idx)=>`<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-sel="${idx}" title="Entfernen">✕</button></li>`).join('') : '<li class="list-item"><span>Keine Einträge</span></li>';
    // Removal handlers
    list.querySelectorAll('button[data-rm]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const [n,idxStr] = String(e.currentTarget.getAttribute('data-rm')).split('::');
        const idx = Number(idxStr);
        const rec = (appState.otherStaffData||[]).find(s=>s.name===n);
        if (rec){ rec.vacations.splice(idx,1); appState.save(); this.renderOtherStaff(); }
      });
    });
    vacList.querySelectorAll('button[data-rm-sel]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const idx = Number(e.currentTarget.getAttribute('data-rm-sel'));
        const rec = (appState.otherStaffData||[]).find(s=>s.name===name);
        if (rec){ rec.vacations.splice(idx,1); appState.save(); this.renderOtherStaff(); }
      });
    });
  }

  // ==== Carryover helpers ==== // Keeping getPrevMonthKey & sumStaffHoursForMonth for carryover.auto context
  getPrevMonthKey(month){
    // unchanged
    if (!month || typeof month !== 'string' || !month.includes('-')) return month;
    const [y,m] = month.split('-').map(Number);
    const prevM = m === 1 ? 12 : (m-1);
    const prevY = m === 1 ? (y-1) : y;
    return `${prevY}-${pad2(prevM)}`;
  }

  sumStaffHoursForMonth(staffId, month){
    // unchanged
    const sched = appState.scheduleData?.[month] || {};
    let sum = 0;
    Object.values(sched).forEach(day => {
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        if (Number(sid) === Number(staffId)){
            const h = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
            sum += h;
        }
      });
    });
    return Math.round(sum * 100) / 100;
  }

  // (computeAutoCarryover removed – logic now in CarryoverService)

  // ==== Reports ====
  initReports(){
    const sel = document.getElementById('reportsMonth');
    if (!sel) return;
    if (!sel.options || sel.options.length===0){
      const now = new Date();
      for (let i=0;i<12;i++){
        const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
        const val = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
        const opt = document.createElement('option');
        opt.value = val; opt.text = d.toLocaleString(undefined,{month:'long', year:'numeric'});
        sel.appendChild(opt);
      }
      sel.value = `${now.getFullYear()}-${pad2(now.getMonth()+1)}`;
    }
    sel.addEventListener('change', ()=> this.renderReports());
    this.renderReports();
  }

  renderReports(){
    const sel = document.getElementById('reportsMonth');
    const month = sel?.value; if (!month) return;
  try { __services?.report?.getOvertimeCredits(month); } catch {}
  try { this.renderMonthlyHoursReport(month); } catch(e){ console.warn('renderMonthlyHoursReport failed', e); }
  try { this.renderStudentWeeklyReport(month); } catch(e){ console.warn('renderStudentWeeklyReport failed', e); }
  try { this.computeAndRenderOvertimeReport(month); } catch(e){ console.warn('computeAndRenderOvertimeReport failed', e); }
  }

  renderMonthlyHoursReport(month){
    const tbody = document.getElementById('monthlyHoursReport'); if (!tbody) return;
  const earnings = __services?.report?.computeEarnings ? __services.report.computeEarnings(month) : {};
    const contracted = __services?.report?.computeContractedHours ? __services.report.computeContractedHours(month) : {};
    const ot = appState.overtimeCredits?.[month] || {};
    const overtimeByStaff = Object.fromEntries(Object.entries(ot).map(([sid, weeks]) => [sid, Object.values(weeks||{}).reduce((a,b)=>a+Number(b||0),0)]));
    const rows = (appState.staffData||[]).map(s => {
      const rec = earnings[s.id] || { hours:0, earnings:0 };
      const h = Math.round(rec.hours*100)/100;
      const earn = rec.earnings;
      const contractedHours = Number(contracted[s.id] || s.contractHours || 0);
      let status = 'OK';
      
      // Practical limits status for Minijob and Student roles
      let practicalLimitsInfo = '';
      if ((s.role === 'minijob' || s.role === 'student') && (s.weekly_hours_min_practical || s.weekly_hours_max_practical)) {
        const min = Number(s.weekly_hours_min_practical || 0);
        const max = Number(s.weekly_hours_max_practical || 0);
        practicalLimitsInfo = ` (Prakt: ${min ? min + '–' : ''}${max ? max + 'h' : ''})`;
      }
      
      if (s.role==='minijob'){
        const cap = Number(APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556);
        const carryover = Number(appState.carryoverByStaffAndMonth?.[s.id]?.[month] ?? 0);
        if (earn !== null && earn > cap + 1e-6) {
          status = carryover < 0 ? 'OK (Ausgleich)' : `Überschreitung (${cap}€)`;
        }
      }
      const otH = Number(overtimeByStaff[s.id]||0);
      const earningsDisplay = (s.role === 'permanent' || earn === null) ? '—' : `${(Math.round(earn*100)/100).toFixed(2)} €`;
  return `<tr><td class=\"text-left\">${s.name}${practicalLimitsInfo}</td><td>${s.role}</td><td>${contractedHours.toFixed(2)}</td><td>${h.toFixed(2)}</td><td>${otH>0?otH.toFixed(2):'—'}</td><td>${earningsDisplay}</td><td>${status}</td></tr>`;
    }).join('');
  tbody.innerHTML = rows || '<tr><td colspan=\"7\" class=\"text-center text-muted\">Keine Daten</td></tr>';
  }

  renderStudentWeeklyReport(month){
    const tbody = document.getElementById('studentWeeklyReport'); if (!tbody) return;
  const weeks = __services?.report?.studentWeekly ? __services.report.studentWeekly(month) : {};
    const rows = [];
    Object.entries(weeks).forEach(([sid, wk]) => {
      const name = (appState.staffData||[]).find(s=>s.id==sid)?.name || sid;
      Object.entries(wk).sort(([a],[b])=>Number(a)-Number(b)).forEach(([w, agg]) => {
        const ratio = agg.total>0 ? Math.round((agg.nightWeekend/agg.total)*100) : 0;
        const monthExc = !!appState.studentExceptionMonths?.[month];
  rows.push(`<tr><td class=\"text-left\">${name}</td><td>${w}</td><td>${agg.hours.toFixed(2)}</td><td>${ratio}%</td><td>${monthExc ? '✓' : '-'}</td></tr>`);
      });
    });
  tbody.innerHTML = rows.join('') || '<tr><td colspan=\"5\" class=\"text-center text-muted\">Keine Daten</td></tr>';
  }

  computeAndRenderOvertimeReport(month){
    const tbody = document.getElementById('overtimeCreditsReport'); if (!tbody) return;
  const creditsByStaffWeek = __services?.report?.getOvertimeCredits ? __services.report.getOvertimeCredits(month) : {};
    const rows = [];
    Object.entries(creditsByStaffWeek).forEach(([sid, weeks]) => {
      const name = (appState.staffData||[]).find(s=>s.id==sid)?.name || sid;
      Object.entries(weeks).sort(([a],[b])=>Number(a)-Number(b)).forEach(([w, h]) => {
  rows.push(`<tr><td class=\"text-left\">${name}</td><td>${w}</td><td>${Number(h||0).toFixed(2)}</td></tr>`);
      });
    });
  tbody.innerHTML = rows.join('') || '<tr><td colspan=\"3\" class=\"text-center text-muted\">Keine Daten</td></tr>';
  }

  // Reports now fully powered by ReportService (no legacy fallbacks).

  // ==== Audit Log ====
  renderAuditLog(){
    const tbody = document.getElementById('auditLogTable');
    if (!tbody) return;
    const rows = (appState.auditLog||[]).slice().reverse().map(entry => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : new Date();
      const tsStr = `${String(ts.getDate()).padStart(2,'0')}.${String(ts.getMonth()+1).padStart(2,'0')}.${ts.getFullYear()} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}`;
      const msg = entry?.message || '';
  return `<tr><td class=\"text-left\">${tsStr}</td><td>${msg}</td></tr>`;
    }).join('');
  tbody.innerHTML = rows || '<tr><td colspan=\"2\" class=\"text-center text-muted\">Keine Einträge</td></tr>';
  }

  async _hydrateAuditLog(){
    if (this._auditHydrationPromise) return this._auditHydrationPromise;
    const run = async () => {
      try {
        const ready = __services?.ready;
        if (ready?.then) {
          try { await ready; } catch(e){ console.warn('[AppUI] audit hydration waiting on services failed', e); }
        }
        const auditSvc = __services?.audit;
        if (!auditSvc) return;
        let localEntries = [];
        try {
          const list = auditSvc.list?.();
          if (Array.isArray(list)) localEntries = list;
        } catch(e){ console.warn('[AppUI] audit local list failed', e); }

        let remoteEntries = [];
        const hasRemote = !!(__services?.store && (__services.store.remote || __services.store.constructor?.name === 'SupabaseAdapter'));
        if (hasRemote && typeof auditSvc.listRemote === 'function') {
          try {
            const fetched = await auditSvc.listRemote();
            if (Array.isArray(fetched)) remoteEntries = fetched;
          } catch(e){ console.warn('[AppUI] audit remote list failed', e); }
        }

        const merged = this._mergeAuditEntries(localEntries, remoteEntries);
        if (merged) {
          appState.auditLog = merged;
          appState.save?.();
        }
      } catch(err){
        console.warn('[AppUI] audit hydration run failed', err);
      }
      this.renderAuditLog();
    };
    this._auditHydrationPromise = run().finally(()=>{ this._auditHydrationPromise = null; });
    return this._auditHydrationPromise;
  }

  _mergeAuditEntries(localEntries = [], remoteEntries = []){
    const byKey = new Map();
    const push = (entry) => {
      const normalized = this._normalizeAuditEntry(entry);
      if (!normalized) return;
      const key = normalized.id ? `id:${normalized.id}` : `${normalized.timestamp}:${normalized.message}`;
      if (!byKey.has(key)) byKey.set(key, normalized);
    };
    (localEntries || []).forEach(push);
    (remoteEntries || []).forEach(push);
    if (!byKey.size) return [];
    return Array.from(byKey.values()).sort((a,b)=>{
      if (a.timestamp === b.timestamp) return 0;
      return a.timestamp < b.timestamp ? -1 : 1;
    });
  }

  _normalizeAuditEntry(entry){
    if (!entry) return null;
    const id = entry.id || entry.meta?.id || null;
    const rawTs = entry.timestamp ?? entry.ts ?? entry.created_at ?? entry.createdAt ?? entry.inserted_at ?? entry.time;
    let timestamp = typeof rawTs === 'number' && Number.isFinite(rawTs) ? rawTs : Date.parse(rawTs || '');
    if (!Number.isFinite(timestamp)) timestamp = Date.now();
    const message = entry.message ?? entry.action ?? entry.note ?? '';
    const meta = entry.meta ?? entry.metadata ?? entry.payload ?? null;
    return { id, timestamp, message, meta };
  }

  async addVacationPeriod(){
    const startEl = document.getElementById('vacationStart');
    const endEl = document.getElementById('vacationEnd');
    const staffSel = document.getElementById('vacationStaffSelect');
    if (!startEl || !endEl) return;
    const start = startEl.value; const end = endEl.value;
    const staffId = Number(staffSel?.value || 0);
    if (!staffId){ alert('Bitte Mitarbeiter wählen'); return; }
    if (!start || !end){ alert('Bitte Zeitraum wählen'); return; }
    try {
      await this.upsertVacationRange(staffId, { start, end });
      this.renderStaffList();
      this.renderVacationList();
      if (this.renderVacationSummaryTable) this.renderVacationSummaryTable();
      startEl.value = ''; endEl.value='';
    } catch (err) {
      alert(err.message);
    }
  }

  renderVacationList(){
    const host = document.getElementById('vacationList');
    const staffSel = document.getElementById('vacationStaffSelect');
    if (!host || !staffSel) return;
    const staffId = Number(staffSel.value || 0);
    const list = staffId ? (appState.vacationsByStaff[staffId] || []) : [];
    host.innerHTML = list.length
      ? list.map((p,idx)=>`<li>${p.start} bis ${p.end} <button class="btn btn-danger" data-idx="${idx}">Entfernen</button></li>`).join('')
      : '<li>Keine Einträge</li>';
    host.querySelectorAll('button[data-idx]').forEach(btn=>{
      btn.addEventListener('click', async (e)=>{
        const i = Number(e.currentTarget.dataset.idx);
        try {
          await this.deleteVacationRange(staffId, i);
          this.renderStaffList();
          this.renderVacationList();
          if (this.renderVacationSummaryTable) this.renderVacationSummaryTable();
        } catch (err) {
          alert(err.message);
        }
      });
    });
    staffSel.addEventListener('change', ()=> this.renderVacationList());
  }

  countPlannedVacationDaysForYear(staffId, year, weekdaysOnly=true){
    const periods = appState.vacationsByStaff?.[staffId] || [];
    let total = 0;
    for (const p of periods){ total += countOverlapDaysInYear(p.start, p.end, year, weekdaysOnly); }
    return total;
  }
  countSickDaysForYear(staffId, year, weekdaysOnly=false){
    const periods = appState.illnessByStaff?.[staffId] || [];
    let total = 0;
    for (const p of periods){ total += countOverlapDaysInYear(p.start, p.end, year, weekdaysOnly); }
    return total;
  }

  async syncVacationCaches(targetStaffIds){
    try {
      if (!appState.vacationsByStaff || typeof appState.vacationsByStaff !== 'object') appState.vacationsByStaff = {};
      if (!appState.illnessByStaff || typeof appState.illnessByStaff !== 'object') appState.illnessByStaff = {};

      const ready = __services?.ready;
      if (ready?.then){
        try { await ready; }
        catch(err){ console.warn('[AppUI] Vacation cache sync waiting for services failed', err); }
      }

      const staffSvc = __services?.staff;
      const vacSvc = __services?.vacation;

      let staffIds = Array.isArray(targetStaffIds) && targetStaffIds.length ? [...targetStaffIds] : [];
      if (!staffIds.length && staffSvc?.list){
        staffIds = staffSvc.list().map(s=>s.id).filter(id=>id!==undefined && id!==null);
      }
      if (!staffIds.length && Array.isArray(appState.staffData)){
        staffIds = appState.staffData.map(s=>s?.id).filter(id=>id!==undefined && id!==null);
      }
      if (!staffIds.length){
        staffIds = Object.keys(appState.vacationsByStaff || {}).map(id=>Number(id)).filter(id=>!Number.isNaN(id));
      }
      staffIds = Array.from(new Set(staffIds));

      if (!staffIds.length) return;

      if (!vacSvc){
        // Ensure structures exist even without service support
        staffIds.forEach(id=>{
          if (!Array.isArray(appState.vacationsByStaff[id])) appState.vacationsByStaff[id] = [...(appState.vacationsByStaff[id] || [])];
          if (!Array.isArray(appState.illnessByStaff[id])) appState.illnessByStaff[id] = [...(appState.illnessByStaff[id] || [])];
        });
        return;
      }

      const cloneList = (rows)=>Array.isArray(rows) ? rows.map(entry=>({ ...entry })) : [];

      for (const id of staffIds){
        try {
          const vacationsRaw = await Promise.resolve(vacSvc.listVacations(id));
          const illnessRaw = await Promise.resolve(vacSvc.listIllness(id));
          const vacations = cloneList(vacationsRaw || []);
          const illness = cloneList(illnessRaw || []);
          appState.vacationsByStaff[id] = vacations;
          appState.illnessByStaff[id] = illness;
        } catch(err){
          console.warn('[AppUI] Failed syncing vacations for staff', id, err);
        }
      }
      appState.save?.();
    } catch(err){
      console.warn('[AppUI] syncVacationCaches failed', err);
    }
  }

  // Vacation data management helpers - unify storage across tabs
  async loadVacationData(staffIds = null) {
    try {
      if (!appState.vacationsByStaff || typeof appState.vacationsByStaff !== 'object') appState.vacationsByStaff = {};
      if (!appState.illnessByStaff || typeof appState.illnessByStaff !== 'object') appState.illnessByStaff = {};

      const vacSvc = __services?.vacation;
      if (!vacSvc) {
        // Fallback to local state
        if (staffIds) {
          staffIds.forEach(id => {
            if (!Array.isArray(appState.vacationsByStaff[id])) appState.vacationsByStaff[id] = [];
            if (!Array.isArray(appState.illnessByStaff[id])) appState.illnessByStaff[id] = [];
          });
        }
        this.rebuildVacationRequests();
        return;
      }

      let targetIds = staffIds;
      if (!targetIds) {
        const staffSvc = __services?.staff;
        targetIds = staffSvc?.list?.().map(s => s.id).filter(id => id !== undefined && id !== null) || [];
        if (!targetIds.length) {
          targetIds = Object.keys(appState.vacationsByStaff || {}).map(id => Number(id)).filter(id => !Number.isNaN(id));
        }
      }

      const cloneList = (rows) => Array.isArray(rows) ? rows.map(entry => ({ ...entry })) : [];

      // Normalize vacation/illness data to use { start, end } keys
      const normalizePeriod = (row) => {
        const start = row.start ?? row.startDate;
        const end = row.end ?? row.endDate;
        if (!start || !end) {
          console.warn('[AppUI] Skipping vacation/illness entry with missing start/end:', row);
          return null;
        }
        // Preserve metadata in meta field
        const { start: _, end: __, startDate: ___, endDate: ____, ...meta } = row;
        return { start, end, meta: Object.keys(meta).length > 0 ? meta : undefined };
      };

      for (const id of targetIds) {
        try {
          const vacationsRaw = await Promise.resolve(vacSvc.listVacations(id));
          const illnessRaw = await Promise.resolve(vacSvc.listIllness(id));
          const vacations = cloneList(vacationsRaw || []).map(normalizePeriod).filter(Boolean);
          const illness = cloneList(illnessRaw || []).map(normalizePeriod).filter(Boolean);

          const existingVacations = Array.isArray(appState.vacationsByStaff[id]) ? appState.vacationsByStaff[id] : [];
          const existingIllness = Array.isArray(appState.illnessByStaff[id]) ? appState.illnessByStaff[id] : [];

          appState.vacationsByStaff[id] = this._mergePeriods(existingVacations, vacations);
          appState.illnessByStaff[id] = this._mergePeriods(existingIllness, illness);
        } catch (err) {
          console.warn('[AppUI] Failed loading vacations for staff', id, err);
        }
      }

      this.rebuildVacationRequests();
      appState.save?.();
    } catch (err) {
      console.warn('[AppUI] loadVacationData failed', err);
    }
  }

  _mergePeriods(existingList = [], incomingList = []) {
    const byRange = new Map();
    const byId = new Map();
    const place = (period, source) => {
      if (!period || !period.start || !period.end) return;
      const id = period.meta?.id || period.id;
      const rangeKey = `${period.start}::${period.end}`;

      if (id) {
        if (byId.has(id)) return;
      }

      const current = byRange.get(rangeKey);
      if (!current) {
        byRange.set(rangeKey, period);
        if (id) byId.set(id, period);
        return;
      }

      const currentId = current.meta?.id || current.id;
      const currentPending = !!current.meta?.pending;
      const incomingPending = !!period.meta?.pending;

      // Prefer entries with stable IDs over local placeholders
      if (!currentId && id) {
        byRange.set(rangeKey, period);
        if (id) byId.set(id, period);
        return;
      }

      // Prefer non-pending (synced) entries over pending ones
      if (currentPending && !incomingPending) {
        if (currentId) byId.delete(currentId);
        byRange.set(rangeKey, period);
        if (id) byId.set(id, period);
        return;
      }

      // If both represent the same canonical record (ID match), keep first
      if (id && currentId && String(id) === String(currentId)) {
        return;
      }

      // Otherwise keep existing (remote takes precedence because it is processed first)
      if (id && !byId.has(id)) {
        byId.set(id, current);
      }
    };

    (incomingList || []).forEach(period => place(period, 'remote'));
    (existingList || []).forEach(period => place(period, 'local'));
    return Array.from(byRange.values());
  }

  _generateLocalAbsenceId(prefix) {
    const base = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `local-${prefix}-${base}`;
  }

  _ensureLocalPeriod(staffId, collection, period, isIllness, markPending = false) {
    if (!period?.start || !period?.end) return false;
    if (!appState[collection]) appState[collection] = {};
    if (!Array.isArray(appState[collection][staffId])) appState[collection][staffId] = [];
    const list = appState[collection][staffId];
    const candidateId = period?.meta?.id || period?.id;
    const existing = list.find(item => {
      if (!item) return false;
      const itemId = item.meta?.id || item.id;
      if (candidateId && itemId) return String(itemId) === String(candidateId);
      return item.start === period.start && item.end === period.end;
    });
    if (existing) {
      if (markPending && !existing.meta?.pending) {
        existing.meta = { ...(existing.meta || {}), pending: true };
        return true;
      }
      return false;
    }
    const meta = { ...(period.meta || {}) };
    if (!meta.id) meta.id = this._generateLocalAbsenceId(isIllness ? 'ill' : 'vac');
    if (markPending) meta.pending = true;
    list.push({ start: period.start, end: period.end, meta });
    return true;
  }

  _removeAssignmentsForStaffRange(staffId, start, end) {
    if (!staffId || !start || !end) return;
    if (!appState.scheduleData || typeof appState.scheduleData !== 'object') return;
    let startDate;
    let endDate;
    try {
      startDate = parseYMD(start);
      endDate = parseYMD(end);
    } catch {
      return;
    }
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) return;
    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) return;
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    if (endTs < startTs) return;
    let removedAssignments = 0;
    const removedDetails = [];
    // Capture pre-removal assignment count for diagnostics
    const countAssignments = () => {
      let c = 0;
      Object.values(appState.scheduleData || {}).forEach(monthValue => {
        const container = monthValue && typeof monthValue === 'object' && monthValue.data && typeof monthValue.data === 'object'
          ? monthValue.data
          : monthValue;
        if (!container || typeof container !== 'object') return;
        Object.values(container).forEach(d => { if (d && d.assignments) c += Object.keys(d.assignments).length; });
      });
      return c;
    };
    const beforeCount = countAssignments();
    Object.values(appState.scheduleData).forEach(monthValue => {
      const container = monthValue && typeof monthValue === 'object' && monthValue.data && typeof monthValue.data === 'object'
        ? monthValue.data
        : monthValue;
      if (!container || typeof container !== 'object') return;
      Object.entries(container).forEach(([dateStr, dayObj]) => {
        if (!dayObj || !dayObj.assignments) return;
        let dateObj;
        try { dateObj = parseYMD(dateStr); } catch { return; }
        if (!(dateObj instanceof Date) || Number.isNaN(dateObj.getTime())) return;
        const dateTs = dateObj.getTime();
        if (dateTs < startTs || dateTs > endTs) return;
        let changed = false;
        Object.keys({ ...(dayObj.assignments || {}) }).forEach(shiftKey => {
          if (String(dayObj.assignments[shiftKey]) === String(staffId)) {
            // record detail before deleting
            removedDetails.push({ date: dateStr, shift: shiftKey, staffId: String(staffId) });
            delete dayObj.assignments[shiftKey];
            changed = true;
          }
        });
        if (changed) {
          removedAssignments += 1;
          if (dayObj.blockers) delete dayObj.blockers;
        }
      });
    });
    if (removedAssignments > 0) {
      appState.save?.();
      // Expose last removal for debugging in the console without persisting to durable state
      try {
        appState.__debugLastIllnessRemoval = { staffId, start, end, removedAssignments, removedDetails, beforeCount, afterCount: countAssignments(), ts: (new Date()).toISOString() };
      } catch(e) { /* noop */ }
      console.info('[AppUI] removed assignments for illness', appState.__debugLastIllnessRemoval);
      try {
        if (this.scheduleUI?.updateCalendarFromSelect) {
          this.scheduleUI.updateCalendarFromSelect();
        } else if (window.scheduleUI?.updateCalendarFromSelect) {
          window.scheduleUI.updateCalendarFromSelect();
        } else {
          window.handlers?.ui?.updateCalendarFromSelect?.();
        }
      } catch (err) {
        console.warn('[AppUI] calendar refresh after illness removal failed', err);
      }
    }
  }

  showQuickIllnessModal() {
    const modal = document.getElementById('quickIllnessModal');
    if (!modal) return;
    const staffSel = document.getElementById('quickIllnessStaffSelect');
    if (staffSel) {
      const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
      staffSel.innerHTML = '<option value="">-- Mitarbeiter wählen --</option>' + staffList.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
      const vacStaffSel = document.getElementById('vacationStaffSelect');
      if (vacStaffSel && vacStaffSel.value) {
        staffSel.value = vacStaffSel.value;
      }
    }
    try {
      if (window.modalManager?.open) {
        window.modalManager.open('quickIllnessModal');
        return;
      }
    } catch (err) {
      console.warn('[AppUI] quickIllnessModal open via modalManager failed', err);
    }
    modal.style.display = 'block';
  }

  hideQuickIllnessModal() {
    try {
      if (window.modalManager?.close) {
        window.modalManager.close('quickIllnessModal');
        return;
      }
    } catch (err) {
      console.warn('[AppUI] quickIllnessModal close via modalManager failed', err);
    }
    const modal = document.getElementById('quickIllnessModal');
    if (modal) modal.style.display = 'none';
  }

  async addQuickIllness() {
    const staffSel = document.getElementById('quickIllnessStaffSelect');
    const startEl = document.getElementById('quickIllnessStart');
    const endEl = document.getElementById('quickIllnessEnd');
    const staffId = Number(staffSel?.value);
    const start = startEl?.value;
    const end = endEl?.value;
    if (!staffId || !start || !end || end < start) {
      alert('Bitte Mitarbeiter und gültigen Krankheitszeitraum wählen');
      return;
    }
    try {
      await this.upsertVacationRange(staffId, { start, end }, true);
      this.renderIllnessList?.();
      this.hideQuickIllnessModal();
      if (startEl) startEl.value = '';
      if (endEl) endEl.value = '';
    } catch (err) {
      console.error('Failed to add illness', err);
      alert('Fehler beim Hinzufügen der Krankmeldung');
    }
  }

  rebuildVacationRequests() {
    // Rebuild appState.vacationRequests from canonical appState.vacationsByStaff for Urlaub tab compatibility
    const requests = [];
    Object.entries(appState.vacationsByStaff || {}).forEach(([staffId, periods]) => {
      if (Array.isArray(periods)) {
        periods.forEach(period => {
          if (period.start && period.end) {
            // Expand range to individual dates for Urlaub tab
            const start = new Date(period.start);
            const end = new Date(period.end);
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
              requests.push({
                id: `${staffId}-${period.start}-${period.end}-${d.toISOString().split('T')[0]}`,
                staffId: Number(staffId),
                date: d.toISOString().split('T')[0],
                type: 'vacation'
              });
            }
          }
        });
      }
    });
    appState.vacationRequests = requests;
  }

  async upsertVacationRange(staffId, period, isIllness = false) {
    const collection = isIllness ? 'illnessByStaff' : 'vacationsByStaff';
    const serviceMethod = isIllness ? 'addIllness' : 'addVacation';
    const auditAction = isIllness ? 'illness.add' : 'vacation.add';
    if (!appState[collection]) appState[collection] = {};
    if (!appState[collection][staffId]) appState[collection][staffId] = [];

    const service = __services?.vacation?.[serviceMethod];
    let localMutated = false;
    let rehydrated = false;

    const ensureLocal = (markPending = false) => {
      const changed = this._ensureLocalPeriod(staffId, collection, period, isIllness, markPending);
      localMutated = localMutated || changed;
    };

    if (!service) {
      ensureLocal(false);
    } else {
      try {
        await Promise.resolve(service(staffId, period));
        __services?.audit?.log?.(auditMsg(auditAction, { staffId, ...period }));
        await this.loadVacationData([staffId]);
        rehydrated = true;
      } catch (err) {
        console.warn(`[AppUI] Failed to persist ${isIllness ? 'illness' : 'vacation'} to service`, err);
        ensureLocal(true);
        this.showSyncFailureToast(`Fehler beim Speichern: ${err.message}`);
      }
    }

    if (!service || (localMutated && !rehydrated)) {
      this.rebuildVacationRequests();
      appState.save?.();
    }

    if (isIllness) {
      this._removeAssignmentsForStaffRange(staffId, period.start, period.end);
    }
  }

  async deleteVacationRange(staffId, index, isIllness = false) {
    const collection = isIllness ? 'illnessByStaff' : 'vacationsByStaff';
    const serviceMethod = isIllness ? 'removeIllnessById' : 'removeVacationById';
    const auditAction = isIllness ? 'illness.remove' : 'vacation.remove';

    if (!appState[collection][staffId] || !appState[collection][staffId][index]) {
      throw new Error('Eintrag nicht gefunden');
    }

    // Store for potential revert
    const removed = appState[collection][staffId][index];

    // Update local state first
    appState[collection][staffId].splice(index, 1);
    this.rebuildVacationRequests();
    appState.save?.();

    // Try to persist to service
    try {
      if (__services?.vacation?.[serviceMethod]) {
        const recordId = removed.meta?.id || removed.id;
        if (recordId) {
          await Promise.resolve(__services.vacation[serviceMethod](recordId));
          __services?.audit?.log?.(auditMsg(auditAction, { staffId, recordId, ...removed }));
          // Re-load data to ensure consistency with service
          await this.loadVacationData([staffId]);
        } else {
          console.warn(`[AppUI] Cannot delete ${isIllness ? 'illness' : 'vacation'} remotely: no record ID available (local only)`, removed);
        }
      }
    } catch (err) {
      console.warn(`[AppUI] Failed to delete ${isIllness ? 'illness' : 'vacation'} from service`, err);
      // Do not revert local changes; show toast instead
      this.showSyncFailureToast(`Fehler beim Löschen: ${err.message}`);
    }
  }

  // Incremental update helpers for availability toggles
  updateShiftButtonState(button, dateStr, shiftKey, isPermanent) {
    const val = this.getShiftValue(dateStr, shiftKey);
    const isBlocked = isPermanent ? (val === 'no') : false;
    const stateClass = isPermanent ? (isBlocked ? 'state-no' : 'state-unset') : (val ? `state-${val}` : 'state-unset');
    const meta = SHIFTS[shiftKey] || {}; const name = meta.name || shiftKey;
    const label = isPermanent ? (isBlocked ? '✗' : '—') : (val === 'prefer' ? '★' : val === 'yes' ? '✓' : '—');
    
    // Update button classes and text
    button.className = `avail-btn ${stateClass} shift-btn`;
    button.innerHTML = `${name}: ${label}`;
    const datasetState = isPermanent ? (isBlocked ? 'no' : '') : (val || '');
    if (datasetState) button.dataset.state = datasetState; else delete button.dataset.state;
  }

  updateDayOffButtonState(button, dateStr) {
    const isOff = this.isDayOff(dateStr);
    button.className = `btn ${isOff ? 'btn-secondary' : ''}`;
    button.innerHTML = isOff ? 'Freiwunsch' : 'Frei wünschen';
    button.dataset.off = isOff ? '1' : '0';
  }

  // Helper methods to access local state (duplicating logic from handleAvailabilityDisplay for incremental updates)
  getShiftValue(dateStr, shiftKey) {
    const availSvc = __services?.availability;
    const staffSel = document.getElementById('availabilityStaffSelect');
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    const staffValue = staffSel.value;
    const staff = staffList.find(s=> String(s.id) === staffValue);
    const staffId = staff ? staff.id : staffValue;
    const staffKey = String(staffId);

    const remoteDay = availSvc?.getDay ? (availSvc.getDay(staffId, dateStr) || {}) : {};
    const localDay = appState.availabilityData?.[staffKey]?.[dateStr] || {};
    const snapshot = { ...localDay, ...remoteDay };
    return snapshot ? snapshot[shiftKey] : undefined;
  }

  isDayOff(dateStr) {
    const availSvc = __services?.availability;
    const staffSel = document.getElementById('availabilityStaffSelect');
    const staffList = (__services?.staff?.list ? __services.staff.list() : appState.staffData) || [];
    const staffValue = staffSel.value;
    const staff = staffList.find(s=> String(s.id) === staffValue);
    const staffId = staff ? staff.id : staffValue;
    const staffKey = String(staffId);

    const remote = availSvc?.isDayOff ? availSvc.isDayOff(staffId, dateStr) : undefined;
    const localSentinel = appState.availabilityData?.[`staff:${staffKey}`]?.[dateStr];
    const normalizedLocal = localSentinel === 'off' || localSentinel === true;
    return !!(remote || normalizedLocal);
  }
}

// Attach role change handler to toggle permanent preferred row and practical limits
// Moved to _postServicesInit to ensure DOM is ready

function initRoleChangeHandler() {
  const roleEl = document.getElementById('staffType');
  const permRow = document.getElementById('permanentPreferredRow');
  const practicalRow = document.getElementById('practicalLimitsRow');
  if (roleEl && permRow && practicalRow){
    const sync = () => { 
      const isPermanent = roleEl.value === 'permanent';
      permRow.style.display = isPermanent ? '' : 'none';
      practicalRow.style.display = (roleEl.value === 'minijob' || roleEl.value === 'student') ? '' : 'none';
    };
    roleEl.addEventListener('change', sync);
    sync(); // Run initially
  }
}

