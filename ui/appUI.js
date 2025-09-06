import { appState } from '../modules/state.js';
import { APP_CONFIG, SHIFTS } from '../modules/config.js';
import { toLocalISOMonth, toLocalISODate, pad2, parseYMD } from '../utils/dateUtils.js';

export class AppUI {
  constructor(scheduleUI){
    this.scheduleUI = scheduleUI;
  }

  init(){
    this.renderStaffList();
    this.populateAvailabilitySelectors();
  this.populateVacationSelectors();
  this.renderVacationList();
  this.initHolidays();
  this.renderIcsSources();
  // Render temp lists (when editing)
  this.renderTempVacationList();
  this.renderTempIllnessList();
  // Urlaub: Ledger init
  this.initVacationLedger();
  // Andere Mitarbeitende init
  this.renderOtherStaff();
  // Reports init
  this.initReports();
  this.renderAuditLog();
  }

  // ==== Staff ====
  addStaff(){
    const nameEl = document.getElementById('staffName');
    const roleEl = document.getElementById('staffType');
    const hoursEl = document.getElementById('contractHours');
    const daysEl = document.getElementById('typicalWorkdays');
    const prefEl = document.getElementById('weekendPreference');
    const permPrefEl = document.getElementById('permanentPreferredShift');
    if (!nameEl || !roleEl) return;
    const name = nameEl.value?.trim();
    if (!name) { alert('Bitte Name eingeben'); return; }
    const role = roleEl.value || 'minijob';
    const contractHours = Number(hoursEl?.value || 0);
    const typicalWorkdays = Number(daysEl?.value || 0);
    const weekendPreference = !!prefEl?.checked;
    const permanentPreferredShift = role === 'permanent' ? (permPrefEl?.value || 'none') : 'none';
    // Are we editing?
    const editIdEl = document.getElementById('staffIdToEdit');
    const editId = Number(editIdEl?.value || 0);
    if (editId) {
      const staff = appState.staffData.find(s=>s.id===editId);
      if (!staff) { alert('Mitarbeiter nicht gefunden'); return; }
      staff.name = name; staff.role = role; staff.contractHours = contractHours; staff.typicalWorkdays = typicalWorkdays;
      staff.weekendPreference = weekendPreference;
      staff.permanentPreferredShift = permanentPreferredShift;
      // Persist temp periods to per-staff storage
      if (!appState.vacationsByStaff[editId]) appState.vacationsByStaff[editId] = [];
      appState.vacationsByStaff[editId] = [...(appState.tempVacationPeriods||[])];
      if (!appState.illnessByStaff) appState.illnessByStaff = {};
      if (!appState.illnessByStaff[editId]) appState.illnessByStaff[editId] = [];
      appState.illnessByStaff[editId] = [...(appState.tempIllnessPeriods||[])];
    } else {
      const nextId = (appState.staffData.reduce((m,s)=>Math.max(m, s.id||0), 0) || 0) + 1;
      const staff = { id: nextId, name, role, contractHours, typicalWorkdays, weekendPreference, permanentPreferredShift, alternativeWeekendDays: [] };
      appState.staffData.push(staff);
      // Attach temp periods captured in the form to this staff
      if (Array.isArray(appState.tempVacationPeriods) && appState.tempVacationPeriods.length){
        if (!appState.vacationsByStaff[nextId]) appState.vacationsByStaff[nextId] = [];
        appState.vacationsByStaff[nextId] = [...appState.tempVacationPeriods];
      }
      if (!appState.illnessByStaff) appState.illnessByStaff = {};
      if (Array.isArray(appState.tempIllnessPeriods) && appState.tempIllnessPeriods.length){
        appState.illnessByStaff[nextId] = [...appState.tempIllnessPeriods];
      }
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
      if (window.__openModal) return window.__openModal('holidaysModal');
      const modal = document.getElementById('holidaysModal');
      if (modal) modal.style.display = 'block';
      this.initHolidays();
    });
  }

  addHoliday(){
    const yearSel = document.getElementById('holidaysYear');
    const dateEl = document.getElementById('holidayDate');
    const nameEl = document.getElementById('holidayName');
    if (!yearSel || !dateEl || !nameEl) return;
    const year = yearSel.value;
    const date = dateEl.value;
    const name = nameEl.value?.trim();
    if (!year || !date || !name){ alert('Bitte Jahr, Datum und Name angeben'); return; }
    if (!appState.holidays[year]) appState.holidays[year] = {};
    appState.holidays[year][date] = name;
    appState.save();
    dateEl.value = ''; nameEl.value = '';
    this.renderHolidaysList();
  }

  removeHoliday(date){
    const yearSel = document.getElementById('holidaysYear');
    const year = yearSel?.value;
    if (!year || !appState.holidays[year]) return;
    delete appState.holidays[year][date];
    appState.save();
    this.renderHolidaysList();
  }

  renderHolidaysList(){
    const yearSel = document.getElementById('holidaysYear');
    const list = document.getElementById('holidaysList');
    if (!yearSel || !list) return;
    const year = yearSel.value;
    const items = Object.entries(appState.holidays[year]||{}).sort(([a],[b])=> a.localeCompare(b));
    list.innerHTML = items.length ? items.map(([d,n])=>
      `<li class="list-item"><span>${d} – ${n}</span><button class="btn btn-sm btn-danger" data-date="${d}" title="Entfernen">✕</button></li>`
    ).join('') : '<li class="list-item"><span>Keine Feiertage</span></li>';
    list.querySelectorAll('button[data-date]').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        const date = e.currentTarget.getAttribute('data-date');
        this.removeHoliday(date);
      });
    });
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
    // Load if not present
    if (!appState.holidays[String(year)] || Object.keys(appState.holidays[String(year)]).length===0){
      const stateCode = APP_CONFIG?.HOLIDAY_API_STATE || 'HE';
      const url = `https://date.nager.at/api/v3/PublicHolidays/${year}/DE`;
      try{
        const response = await fetch(url);
        if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
        const allGerman = await response.json();
        const filtered = allGerman.filter(h => !h.counties || (Array.isArray(h.counties) && h.counties.includes(`DE-${stateCode}`)) );
        appState.holidays[String(year)] = {};
        filtered.forEach(h => { appState.holidays[String(year)][h.date] = h.localName; });
        appState.save();
      }catch(e){
        console.error('Could not fetch holidays:', e);
        alert(`Fehler beim Laden der Feiertage für ${year}. Bitte versuchen Sie es später erneut.`);
      }
    }
  // Open modal and render
    if (window.__openModal) window.__openModal('holidaysModal'); else document.getElementById('holidaysModal').style.display='block';
    this.initHolidays();
  // Also refresh availability grid if visible
  try { this.handleAvailabilityDisplay(); } catch {}
  }

  resetStaffForm(){
    ['staffName','contractHours','typicalWorkdays'].forEach(id=>{ const el=document.getElementById(id); if (el) el.value=''; });
    const roleEl = document.getElementById('staffType'); if (roleEl) roleEl.value='minijob';
    const prefEl = document.getElementById('weekendPreference'); if (prefEl) prefEl.checked = false;
    const permPrefRow = document.getElementById('permanentPreferredRow'); if (permPrefRow) permPrefRow.style.display = 'none';
    const permPrefSel = document.getElementById('permanentPreferredShift'); if (permPrefSel) permPrefSel.value = 'none';
    const editIdEl = document.getElementById('staffIdToEdit'); if (editIdEl) editIdEl.value = '';
    const saveBtn = document.getElementById('saveStaffBtn'); if (saveBtn) saveBtn.textContent = 'Arbeitskraft speichern';
    const cancelBtn = document.getElementById('cancelEditBtn'); if (cancelBtn) cancelBtn.style.display = 'none';
    // Clear temp lists
    appState.tempVacationPeriods = [];
    appState.tempIllnessPeriods = [];
    this.renderTempVacationList();
    this.renderTempIllnessList();
  }

  renderStaffList(){
    const host = document.getElementById('staffList');
    if (!host) return;
    if (!appState.staffData.length){
      host.innerHTML = '<p>Keine Mitarbeiter hinzugefügt.</p>';
      return;
    }
    const weekdayOptions = (selected) => {
      const names = ['So','Mo','Di','Mi','Do','Fr','Sa'];
      // Only Mon..Fri are valid alt weekend days
      return [1,2,3,4,5].map(d => `<option value="${d}" ${String(selected)===String(d)?'selected':''}>${names[d]}</option>`).join('');
    };
    host.innerHTML = appState.staffData.map(s=>{
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
        const s = appState.staffData.find(x=>x.id===id);
        if (!s) return;
        document.getElementById('staffName').value = s.name || '';
        document.getElementById('staffType').value = s.role || 'minijob';
        document.getElementById('contractHours').value = s.contractHours || '';
        document.getElementById('typicalWorkdays').value = s.typicalWorkdays || '';
        const prefEl = document.getElementById('weekendPreference'); if (prefEl) prefEl.checked = !!s.weekendPreference;
        const permPrefRow = document.getElementById('permanentPreferredRow'); if (permPrefRow) permPrefRow.style.display = s.role==='permanent' ? '' : 'none';
        const permPrefSel = document.getElementById('permanentPreferredShift'); if (permPrefSel) permPrefSel.value = s.permanentPreferredShift || 'none';
        const editIdEl = document.getElementById('staffIdToEdit'); if (editIdEl) editIdEl.value = String(id);
        const saveBtn = document.getElementById('saveStaffBtn'); if (saveBtn) saveBtn.textContent = 'Änderungen speichern';
        const cancelBtn = document.getElementById('cancelEditBtn'); if (cancelBtn) cancelBtn.style.display = '';
        // Load per-staff vacations/illnesses to temp lists for editing
        appState.tempVacationPeriods = [...(appState.vacationsByStaff?.[id]||[])];
        appState.tempIllnessPeriods = [...(appState.illnessByStaff?.[id]||[])];
        this.renderTempVacationList();
        this.renderTempIllnessList();
        // Switch to tab remains in place
      });
    });
    host.querySelectorAll('button[data-action="remove"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = Number(e.currentTarget.dataset.id);
        const staff = appState.staffData.find(x=>x.id===id);
        if (!staff) return;
        const name = staff.name || id;
        const confirmed = window.confirm(`Mitarbeiter "${name}" wirklich löschen?\nDiese Aktion kann nicht rückgängig gemacht werden.`);
        if (!confirmed) return;
        const idx = appState.staffData.findIndex(x=>x.id===id);
        if (idx>=0){
          appState.staffData.splice(idx,1);
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
            if (appState.overtimeRequests){ Object.keys(appState.overtimeRequests).forEach(reqId=>{ const r = appState.overtimeRequests[reqId]; if (r && String(r.staffId)===String(id)) delete appState.overtimeRequests[reqId]; }); }
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
        const staff = appState.staffData.find(x=>x.id===id);
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
        const staff = appState.staffData.find(x=>x.id===id);
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

  // ==== Staff temp Vacation/Illness (form) ====
  addStaffVacationPeriod(){
    const startEl = document.getElementById('staffVacationStart');
    const endEl = document.getElementById('staffVacationEnd');
    const start = startEl?.value; const end = endEl?.value;
    if (!start || !end || end < start){ alert('Bitte gültigen Urlaubszeitraum wählen'); return; }
    appState.tempVacationPeriods = appState.tempVacationPeriods || [];
    appState.tempVacationPeriods.push({ start, end });
    appState.save();
    this.renderTempVacationList();
    if (startEl) startEl.value=''; if (endEl) endEl.value='';
  }
  renderTempVacationList(){
    const host = document.getElementById('staffVacationList');
    if (!host) return;
    const list = appState.tempVacationPeriods || [];
    host.innerHTML = list.length ? list.map((p,idx)=>`<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-vac="${idx}" title="Entfernen">✕</button></li>`).join('') : '<li class="list-item"><span>Keine Einträge</span></li>';
    host.querySelectorAll('button[data-rm-vac]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-rm-vac'));
        appState.tempVacationPeriods.splice(i,1); appState.save(); this.renderTempVacationList();
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
    appState.save();
    this.renderTempIllnessList();
    if (startEl) startEl.value=''; if (endEl) endEl.value='';
  }
  renderTempIllnessList(){
    const host = document.getElementById('staffIllnessList');
    if (!host) return;
    const list = appState.tempIllnessPeriods || [];
    host.innerHTML = list.length ? list.map((p,idx)=>`<li class="list-item"><span>${p.start} bis ${p.end}</span><button class="btn btn-sm btn-danger" data-rm-ill="${idx}" title="Entfernen">✕</button></li>`).join('') : '<li class="list-item"><span>Keine Einträge</span></li>';
    host.querySelectorAll('button[data-rm-ill]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.getAttribute('data-rm-ill'));
        appState.tempIllnessPeriods.splice(i,1); appState.save(); this.renderTempIllnessList();
      });
    });
  }

  // ==== Availability ====
  populateAvailabilitySelectors(){
    const staffSel = document.getElementById('availabilityStaffSelect');
    const monthSel = document.getElementById('availabilityMonth');
    if (staffSel){
      staffSel.innerHTML = '<option value="">– auswählen –</option>' + appState.staffData.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    }
    if (monthSel){
      if (!monthSel.options || monthSel.options.length===0){
        const now = new Date();
        for (let i=0;i<12;i++){
          const d = new Date(now.getFullYear(), now.getMonth()+i, 1);
          const val = `${d.getFullYear()}-${pad2(d.getMonth()+1)}`;
          const opt = document.createElement('option');
          opt.value = val; opt.textContent = d.toLocaleString(undefined,{month:'long', year:'numeric'});
          monthSel.appendChild(opt);
        }
      }
      if (!monthSel.value && monthSel.options[0]) monthSel.value = monthSel.options[0].value;
    }
  }

  handleAvailabilityDisplay(){
    const staffSel = document.getElementById('availabilityStaffSelect');
    const monthSel = document.getElementById('availabilityMonth');
    const host = document.getElementById('availabilityForm');
    if (!staffSel || !monthSel || !host) return;
  const staffId = Number(staffSel.value);
  const staff = appState.staffData.find(s=>s.id===staffId);
    const month = monthSel.value;
    if (!staffId || !month){ host.innerHTML = '<p>Bitte Mitarbeiter und Monat auswählen.</p>'; return; }
    // Per-shift availability: early/midday/evening/closing, plus day-level "Freiwunsch"
    const [y,m] = month.split('-').map(Number);
    const days = new Date(y, m, 0).getDate();
    const dayOffKey = `staff:${staffId}`;
    if (!appState.availabilityData[dayOffKey]) appState.availabilityData[dayOffKey] = {};
    if (!appState.availabilityData[staffId]) appState.availabilityData[staffId] = {};
    const dayOff = appState.availabilityData[dayOffKey];
    const detailed = appState.availabilityData[staffId];

    const getTypeForDate = (dateStr) => {
  const d = parseYMD(dateStr);
  const isWE = d.getDay()===0 || d.getDay()===6;
      const hol = appState.holidays[String(y)]?.[dateStr];
      return hol ? 'holiday' : (isWE ? 'weekend' : 'weekday');
    };
    const getShiftsForType = (type) => Object.entries(SHIFTS).filter(([_,v])=>v.type===type).map(([k])=>k);

    let html = '<div class="avail-grid">';
    const isPermanent = staff?.role === 'permanent';
    // Header differs by role
    if (isPermanent){
      html += '<div class="avail-row avail-head" style="grid-template-columns: 1.2fr 3.2fr 0.9fr 0.9fr 0.8fr">'
           + '<div class="avail-cell">Datum</div>'
           + '<div class="avail-cell">Blockierte Schichten</div>'
           + '<div class="avail-cell">Freiwillig Abend</div>'
           + '<div class="avail-cell">Freiwillig Spät</div>'
           + '<div class="avail-cell">Frei</div>'
           + '</div>';
    } else {
      html += '<div class="avail-row avail-head" style="grid-template-columns: 1.2fr 4fr;">'
           + '<div class="avail-cell">Datum</div>'
           + '<div class="avail-cell">Schichten</div>'
           + '</div>';
    }
    for (let d=1; d<=days; d++){
      const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
      const off = dayOff[dateStr] === 'off';
      const row = detailed[dateStr] || {};
      const type = getTypeForDate(dateStr);
      const shiftsForDay = getShiftsForType(type);
      const isWE = type==='weekend';
      const holName = type==='holiday' ? (appState.holidays[String(y)]?.[dateStr]||'') : '';
      const rowClasses = ['avail-row'];
      if (isWE) rowClasses.push('is-weekend');
      if (holName) rowClasses.push('is-holiday');
      const flags = [ isWE ? '<span class="day-flag">Wochenende</span>' : '', holName ? `<span class=\"day-flag\">${holName}</span>` : '' ].filter(Boolean).join(' ');
  html += `<div class="${rowClasses.join(' ')}" style="grid-template-columns: ${isPermanent ? '1.2fr 3.2fr 0.9fr 0.9fr 0.8fr' : '1.2fr 4fr'};">`;
  html += `<div class="avail-cell"><strong>${pad2(d)}.${pad2(m)}.${y}</strong> ${flags}
  </div>`;
      // Shifts cell: only relevant shifts for the day type
      html += '<div class="avail-cell" style="text-align:left;">';
      if (shiftsForDay.length===0){
        html += '<span class="na-cell">—</span>';
      } else {
        shiftsForDay.forEach(k => {
          const val = row[k]; // 'prefer'|'yes'|'no'|undefined
          // Permanents: block-only model (no/prefer/yes disabled)
          const isBlocked = isPermanent ? (val === 'no') : false;
          const stateClass = isPermanent ? (isBlocked ? 'state-no' : 'state-unset') : (val ? `state-${val}` : 'state-unset');
          const label = isPermanent ? (isBlocked ? '✗' : '—') : (val === 'prefer' ? '★' : val === 'yes' ? '✓' : val === 'no' ? '✗' : '—');
          const meta = SHIFTS[k] || {};
          const name = meta.name || k;
          const time = meta.time || '';
          html += `<button class="avail-btn ${stateClass}" title="${name} ${time}" style="margin:2px 6px 2px 0;" data-date="${dateStr}" data-shift="${k}" ${off?'disabled':''}>${name}: ${label}</button>`;
        });
      }
      html += '</div>';
      // Voluntary evening/closing toggles (weekday only) for permanents
      if (isPermanent){
        const isWeekday = !isWE && !holName;
        const kEven = `${staffId}::${dateStr}::evening`;
        const kClose = `${staffId}::${dateStr}::closing`;
        const vEven = !!appState.voluntaryEveningAvailability?.[kEven] || !!appState.voluntaryEveningAvailability?.[`${staffId}::${dateStr}`];
        const vClose = !!appState.voluntaryEveningAvailability?.[kClose] || !!appState.voluntaryEveningAvailability?.[`${staffId}::${dateStr}`];
        html += `<div class="avail-cell">${isWeekday ? `<label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" class="vol-evening" data-key="${kEven}" /> <span>Abend</span></label>` : '<span class="na-cell">—</span>'}</div>`;
        html += `<div class="avail-cell">${isWeekday ? `<label style="display:flex; align-items:center; gap:6px;"><input type="checkbox" class="vol-closing" data-key="${kClose}" /> <span>Spät</span></label>` : '<span class="na-cell">—</span>'}</div>`;
        // After DOM insert, we'll set checked state via handler to keep markup clean
      }
  // Day off toggle only for permanents; omit column entirely for others
      if (isPermanent){
        html += `<div class="avail-cell"><button class="btn ${off?'btn-secondary':''}" data-dayoff="1" data-date="${dateStr}" data-off="${off?1:0}">${off?'Freiwunsch':'Frei wünschen'}</button></div>`;
      }
      html += '</div>';
    }
    html += '</div>';
    // Carryover panel (manual monthly hours carryover)
    try {
      const prevMonth = this.getPrevMonthKey(month);
      const autoCarry = this.computeAutoCarryover(staff, month);
      const manualCarry = Number(appState.carryoverByStaffAndMonth?.[staffId]?.[month] ?? 0);
      html += `
        <div class="card" style="margin-top:12px; padding:12px;">
          <div style="font-weight:600; margin-bottom:4px;">Stundenübertrag (Vormonat → ${month})</div>
          <div style="color:#677684; font-size:0.9em; margin-bottom:8px;">
            Ein positiver Wert erhöht das Monatsziel (z. B. +3h), ein negativer Wert verringert es (z. B. -3h).
          </div>
          <div class="form-row" style="grid-template-columns: auto 120px auto auto; align-items:end; gap:10px;">
            <label for="carryoverInput">Manueller Übertrag</label>
            <input type="number" id="carryoverInput" value="${manualCarry}" step="0.25" style="width:120px;" />
            <div style="color:#677684;">Auto (${autoCarry.toFixed(2)} h)</div>
            <button class="btn" id="carryoverSaveBtn">Speichern</button>
          </div>
          <div style="color:#677684; font-size:0.85em; margin-top:6px;">Ergebnisse sind kumulativ; Ziel ist, den Übertrag bis zum Ende des Folgemonats auf 0 zu bringen.</div>
        </div>`;
    } catch(e) { console.warn('Carryover panel render failed', e); }

  host.innerHTML = html;

    // Handlers: tri-state per shift
    host.querySelectorAll('button.avail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const b = e.currentTarget;
        const dateStr = b.dataset.date;
        const shiftKey = b.dataset.shift;
        const current = (detailed[dateStr]||{})[shiftKey];
        // Permanents: only toggle between blocked ('no') and default (unset)
        const next = (staff?.role === 'permanent')
          ? (current === 'no' ? undefined : 'no')
          : (current === 'yes' ? 'prefer' : current === 'prefer' ? 'no' : current === 'no' ? undefined : 'yes');
        if (!detailed[dateStr]) detailed[dateStr] = {};
        if (next) detailed[dateStr][shiftKey] = next; else delete detailed[dateStr][shiftKey];
        // Clean empty date objects
        if (detailed[dateStr] && Object.keys(detailed[dateStr]).length === 0){ delete detailed[dateStr]; }
        appState.save();
        this.handleAvailabilityDisplay();
      });
    });

    // Handlers: day-off toggle (permanent only)
    if (staff?.role === 'permanent'){
      // Initialize checked state for volunteer toggles (support old combined key for backward compatibility)
      host.querySelectorAll('input.vol-evening, input.vol-closing').forEach(cb => {
        const key = cb.getAttribute('data-key');
        const combinedKey = key?.replace(/::(evening|closing)$/,'');
        const isChecked = !!(appState.voluntaryEveningAvailability?.[key] || (combinedKey && appState.voluntaryEveningAvailability?.[combinedKey]));
        cb.checked = isChecked;
      });
      // Voluntary (weekday) toggle handlers per shift
      const onToggle = (e) => {
        const key = e.currentTarget.getAttribute('data-key');
        if (!key) return;
        if (!appState.voluntaryEveningAvailability) appState.voluntaryEveningAvailability = {};
        if (e.currentTarget.checked) appState.voluntaryEveningAvailability[key] = true; else delete appState.voluntaryEveningAvailability[key];
        appState.save();
      };
      host.querySelectorAll('input.vol-evening').forEach(cb => cb.addEventListener('change', onToggle));
      host.querySelectorAll('input.vol-closing').forEach(cb => cb.addEventListener('change', onToggle));
      host.querySelectorAll('button[data-dayoff="1"]').forEach(btn => {
        btn.addEventListener('click', (e)=>{
          const b = e.currentTarget;
          const dateStr = b.dataset.date;
          const isOff = b.dataset.off === '1';
          if (isOff){ delete dayOff[dateStr]; }
          else dayOff[dateStr] = 'off';
          appState.save();
          this.handleAvailabilityDisplay();
        });
      });
    }

    // Handler: carryover save
    const carryBtn = host.querySelector('#carryoverSaveBtn');
    if (carryBtn){
      carryBtn.addEventListener('click', ()=>{
        const inp = host.querySelector('#carryoverInput');
        const val = Number(inp?.value || 0);
        if (!appState.carryoverByStaffAndMonth) appState.carryoverByStaffAndMonth = {};
        if (!appState.carryoverByStaffAndMonth[staffId]) appState.carryoverByStaffAndMonth[staffId] = {};
        appState.carryoverByStaffAndMonth[staffId][month] = Number.isFinite(val) ? val : 0;
        appState.save();
        // Re-render to refresh remaining UI
        this.handleAvailabilityDisplay();
      });
    }
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

  // ==== Carryover helpers ====
  getPrevMonthKey(month){
    if (!month || typeof month !== 'string' || !month.includes('-')) return month;
    const [y,m] = month.split('-').map(Number);
    const prevM = m === 1 ? 12 : (m-1);
    const prevY = m === 1 ? (y-1) : y;
    return `${prevY}-${pad2(prevM)}`;
  }

  sumStaffHoursForMonth(staffId, month){
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

  computeAutoCarryover(staff, month){
    try{
      const prev = this.getPrevMonthKey(month);
      const weeklyTarget = Number(staff?.weeklyHours ?? staff?.contractHours ?? 0);
      // Calendar-aware monthly target for previous month: compute weekdays in prev month
      if (!weeklyTarget) return 0;
      const [py, pm] = prev.split('-').map(Number);
      const daysInPrev = new Date(py, pm, 0).getDate();
      let weekdayCountPrev = 0;
      for (let d=1; d<=daysInPrev; d++){
        const dt = new Date(py, pm-1, d);
        const dow = dt.getDay();
        if (dow!==0 && dow!==6) weekdayCountPrev++;
      }
      const monthlyTarget = weeklyTarget * (weekdayCountPrev / 5);
      const achievedPrev = this.sumStaffHoursForMonth(staff?.id, prev);
      const carryInPrev = Number(appState.carryoverByStaffAndMonth?.[staff?.id]?.[prev] || 0);
      const out = (monthlyTarget - achievedPrev) + carryInPrev;
      return Math.round(out * 100) / 100;
    }catch{ return 0; }
  }

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
    const [y,m] = month.split('-').map(Number);
    const monthLabel = document.getElementById('hoursReportMonthLabel');
    if (monthLabel) monthLabel.textContent = month;
  const otLabel = document.getElementById('otReportMonthLabel');
  if (otLabel) otLabel.textContent = month;
  // Ensure latest overtime credits are computed and persisted
  this.recomputeOvertimeCredits(month);
  this.renderMonthlyHoursReport(month);
    this.renderStudentWeeklyReport(month);
  this.computeAndRenderOvertimeReport(month);
  }

  renderMonthlyHoursReport(month){
    const tbody = document.getElementById('monthlyHoursReport'); if (!tbody) return;
    const data = appState.scheduleData?.[month] || {};
    const wages = Number(APP_CONFIG?.MINIJOB_HOURLY_WAGE ?? 13.5);
    // Sum hours per staff
    const hoursByStaff = {};
    Object.values(data).forEach(day => {
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const h = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
        hoursByStaff[sid] = (hoursByStaff[sid]||0) + h;
      });
    });
    // Overtime totals (sum of weekly credits for month)
    const ot = appState.overtimeCredits?.[month] || {};
    const overtimeByStaff = Object.fromEntries(Object.entries(ot).map(([sid, weeks]) => [sid, Object.values(weeks||{}).reduce((a,b)=>a+Number(b||0),0)]));
    const rows = (appState.staffData||[]).map(s => {
      const h = Math.round((hoursByStaff[s.id]||0)*100)/100;
      const earn = s.role==='permanent' ? h * wages * (35/20) : h * wages; // crude example; adjust if permanent wage known
      let status = 'OK';
      if (s.role==='minijob'){
        const cap = Number(APP_CONFIG?.MINIJOB_MAX_EARNING ?? 556);
        if (earn > cap + 1e-6) status = `> Minijob-Cap (${cap.toFixed(0)}€)`;
      }
      const otH = Number(overtimeByStaff[s.id]||0);
      return `<tr>
        <td style="text-align:left;">${s.name}</td>
        <td>${s.role}</td>
        <td>${h.toFixed(2)}</td>
        <td>${otH>0?otH.toFixed(2):'—'}</td>
        <td>${(Math.round(earn*100)/100).toFixed(2)} €</td>
        <td>${status}</td>
      </tr>`;
    }).join('');
    tbody.innerHTML = rows || '<tr><td colspan="6" style="text-align:center; color:#677684;">Keine Daten</td></tr>';
  }

  renderStudentWeeklyReport(month){
    const tbody = document.getElementById('studentWeeklyReport'); if (!tbody) return;
    const data = appState.scheduleData?.[month] || {};
    // Build per-week aggregates for students
    const weeks = {};
    Object.entries(data).forEach(([dateStr, day]) => {
      const d = parseYMD(dateStr);
      const week = this.getWeekNumber(d);
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const staff = (appState.staffData||[]).find(x=>x.id==sid);
        if (!staff || staff.role!=='student') return;
        if (!weeks[sid]) weeks[sid] = {}; if (!weeks[sid][week]) weeks[sid][week] = { hours:0, nightWeekend:0, total:0 };
        const h = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
        weeks[sid][week].hours += h; weeks[sid][week].total += h;
        const isWE = ['weekend-early','weekend-late'].includes(shiftKey);
        const isNight = (shiftKey==='closing');
        if (isWE || isNight) weeks[sid][week].nightWeekend += h;
      });
    });
    const rows = [];
    Object.entries(weeks).forEach(([sid, wk]) => {
      const name = (appState.staffData||[]).find(s=>s.id==sid)?.name || sid;
      Object.entries(wk).sort(([a],[b])=>Number(a)-Number(b)).forEach(([w, agg]) => {
        const ratio = agg.total>0 ? Math.round((agg.nightWeekend/agg.total)*100) : 0;
        // Exception month flag
        const monthExc = !!appState.studentExceptionMonths?.[month];
        rows.push(`<tr>
          <td style="text-align:left;">${name}</td>
          <td>${w}</td>
          <td>${agg.hours.toFixed(2)}</td>
          <td>${ratio}%</td>
          <td>${monthExc ? '✓' : '-'}</td>
        </tr>`);
      });
    });
    tbody.innerHTML = rows.join('') || '<tr><td colspan="5" style="text-align:center; color:#677684;">Keine Daten</td></tr>';
  }

  // ==== Overtime credits (permanent weekend without preference, with consent) ====
  computeAndRenderOvertimeReport(month){
    const tbody = document.getElementById('overtimeCreditsReport'); if (!tbody) return;
    const creditsByStaffWeek = this.recomputeOvertimeCredits(month);
    // Render table rows
    const rows = [];
    Object.entries(creditsByStaffWeek).forEach(([sid, weeks]) => {
      const name = (appState.staffData||[]).find(s=>s.id==sid)?.name || sid;
      Object.entries(weeks).sort(([a],[b])=>Number(a)-Number(b)).forEach(([w, h]) => {
        rows.push(`<tr>
          <td style="text-align:left;">${name}</td>
          <td>${w}</td>
          <td>${Number(h||0).toFixed(2)}</td>
        </tr>`);
      });
    });
    tbody.innerHTML = rows.join('') || '<tr><td colspan="3" style="text-align:center; color:#677684;">Keine Daten</td></tr>';
  }

  // Shared: compute and persist overtime credits for a month
  recomputeOvertimeCredits(month){
    const data = appState.scheduleData?.[month] || {};
    const creditsByStaffWeek = {};
    Object.entries(data).forEach(([dateStr, day]) => {
      const d = parseYMD(dateStr);
      const week = this.getWeekNumber(d);
      const isWE = [0,6].includes(d.getDay());
      const assigns = day?.assignments || {};
      Object.entries(assigns).forEach(([shiftKey, sid]) => {
        const staff = (appState.staffData||[]).find(x=>x.id==sid);
        if (!staff || staff.role!=='permanent') return;
        const hours = Number((SHIFTS?.[shiftKey]||{}).hours || 0);
        if (!isWE && !(APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED && staff.weekendPreference)) return;
        const year = String(d.getFullYear());
        const consent = !!appState.permanentOvertimeConsent?.[sid]?.[year]?.[dateStr];
        // Standard: non-pref permanents on weekend with consent
        if (isWE && !staff.weekendPreference && consent){
          if (!creditsByStaffWeek[sid]) creditsByStaffWeek[sid] = {};
          creditsByStaffWeek[sid][week] = (creditsByStaffWeek[sid][week]||0) + hours;
          return;
        }
        // Alternative weekend day for pref permanents, when configured and consented
        if (!isWE && APP_CONFIG?.ALTERNATIVE_WEEKEND_ENABLED && APP_CONFIG?.ALTERNATIVE_WEEKEND_REQUIRES_CONSENT && staff.weekendPreference){
          const altDays = Array.isArray(staff.alternativeWeekendDays) ? staff.alternativeWeekendDays : [];
          if (altDays.includes(d.getDay()) && consent){
            if (!creditsByStaffWeek[sid]) creditsByStaffWeek[sid] = {};
            creditsByStaffWeek[sid][week] = (creditsByStaffWeek[sid][week]||0) + hours;
          }
        }
      });
    });
    if (!appState.overtimeCredits) appState.overtimeCredits = {};
    appState.overtimeCredits[month] = creditsByStaffWeek;
    appState.save?.();
    return creditsByStaffWeek;
  }

  // ISO week number helper
  getWeekNumber(d){
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  }

  // ==== Audit Log ====
  renderAuditLog(){
    const tbody = document.getElementById('auditLogTable');
    if (!tbody) return;
    const rows = (appState.auditLog||[]).slice().reverse().map(entry => {
      const ts = entry?.timestamp ? new Date(entry.timestamp) : new Date();
      const tsStr = `${String(ts.getDate()).padStart(2,'0')}.${String(ts.getMonth()+1).padStart(2,'0')}.${ts.getFullYear()} ${String(ts.getHours()).padStart(2,'0')}:${String(ts.getMinutes()).padStart(2,'0')}:${String(ts.getSeconds()).padStart(2,'0')}`;
      const msg = entry?.message || '';
      return `<tr><td style="text-align:left;">${tsStr}</td><td>${msg}</td></tr>`;
    }).join('');
    tbody.innerHTML = rows || '<tr><td colspan="2" style="text-align:center; color:#677684;">Keine Einträge</td></tr>';
  }

  addVacationPeriod(){
    const startEl = document.getElementById('vacationStart');
    const endEl = document.getElementById('vacationEnd');
    const staffSel = document.getElementById('vacationStaffSelect');
    if (!startEl || !endEl) return;
    const start = startEl.value; const end = endEl.value;
    const staffId = Number(staffSel?.value || 0);
    if (!staffId){ alert('Bitte Mitarbeiter wählen'); return; }
    if (!start || !end){ alert('Bitte Zeitraum wählen'); return; }
    if (!appState.vacationsByStaff[staffId]) appState.vacationsByStaff[staffId] = [];
    appState.vacationsByStaff[staffId].push({ start, end });
    appState.save();
    this.renderVacationList();
    startEl.value = ''; endEl.value='';
  }

  renderVacationList(){
    const host = document.getElementById('vacationList');
    const staffSel = document.getElementById('vacationStaffSelect');
    if (!host || !staffSel) return;
    const staffId = Number(staffSel.value || 0);
    const list = staffId ? (appState.vacationsByStaff[staffId]||[]) : [];
    host.innerHTML = list.length
      ? list.map((p,idx)=>`<li>${p.start} bis ${p.end} <button class="btn btn-danger" data-idx="${idx}">Entfernen</button></li>`).join('')
      : '<li>Keine Einträge</li>';
    host.querySelectorAll('button[data-idx]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const i = Number(e.currentTarget.dataset.idx);
        if (!appState.vacationsByStaff[staffId]) return;
        appState.vacationsByStaff[staffId].splice(i,1); appState.save(); this.renderVacationList();
      });
    });
    staffSel.addEventListener('change', ()=> this.renderVacationList());
  }

  // ==== Vacation Ledger ====
  initVacationLedger(){
    try{
      const yearSel = document.getElementById('vacationYearSelect');
      if (!yearSel) return;
      // Populate year options if empty
      if (!yearSel.options || yearSel.options.length === 0){
        const now = new Date();
        for (let y = now.getFullYear() - 1; y <= now.getFullYear() + 2; y++){
          const opt = document.createElement('option');
          opt.value = String(y); opt.text = String(y);
          if (y === now.getFullYear()) opt.selected = true;
          yearSel.appendChild(opt);
        }
      }
      yearSel.addEventListener('change', ()=> this.renderVacationLedger());
      this.renderVacationLedger();
    }catch(e){ console.error('initVacationLedger failed', e); }
  }

  renderVacationLedger(){
    const tbody = document.getElementById('vacationLedgerTable');
    const yearSel = document.getElementById('vacationYearSelect');
    if (!tbody || !yearSel) return;
    const year = Number(yearSel.value || new Date().getFullYear());
    if (!appState.vacationLedger) appState.vacationLedger = {};
    if (!appState.vacationLedger[year]) appState.vacationLedger[year] = {};

    const rows = appState.staffData.map(s => {
      const rec = appState.vacationLedger[year][s.id] || { entitlement: undefined, takenManual: 0 };
      const defaultEnt = this.computeDefaultEntitlement(s, year);
      const entitlementVal = Number.isFinite(Number(rec.entitlement)) ? Number(rec.entitlement) : defaultEnt;
      const planned = this.countPlannedVacationDaysForYear(s.id, year, true);
      const sick = this.countSickDaysForYear(s.id, year, false);
    const carryPrev = this.getCarryoverFromPrevYear(s.id, year, s);
    const remaining = Math.max(0, (Number(entitlementVal)||0) + carryPrev - (Number(rec.takenManual)||0) - planned);
      const entId = `ent_${year}_${s.id}`;
      const manId = `man_${year}_${s.id}`;
      return `
        <tr>
          <td style="text-align:left;">${s.name}</td>
          <td>
            <input id="${entId}" type="number" min="0" step="1" value="${entitlementVal}" style="width:80px;" />
            <div style="font-size:0.8em; color:#677684;">Empf.: ${defaultEnt}</div>
          </td>
          <td><input id="${manId}" type="number" min="0" step="1" value="${Number(rec.takenManual)||0}" style="width:80px;" /></td>
      <td style="text-align:center;">${carryPrev}</td>
          <td style="text-align:center;">${planned}</td>
          <td style="text-align:center;">${remaining}</td>
          <td style="text-align:center;">${sick}</td>
          <td><button class="btn" data-save-ledger="${s.id}">Speichern</button></td>
        </tr>`;
    }).join('');

  tbody.innerHTML = rows || '<tr><td colspan="8" style="text-align:center; color:#677684;">Keine Mitarbeiter</td></tr>';

    // Bind save handlers
    tbody.querySelectorAll('button[data-save-ledger]').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        const staffId = Number(e.currentTarget.getAttribute('data-save-ledger'));
        const entEl = document.getElementById(`ent_${year}_${staffId}`);
        const manEl = document.getElementById(`man_${year}_${staffId}`);
        const entitlement = Math.max(0, Number(entEl?.value || 0));
        const takenManual = Math.max(0, Number(manEl?.value || 0));
        if (!appState.vacationLedger[year]) appState.vacationLedger[year] = {};
    // Compute and store this year's carryover for use by next year
    const carryPrev = this.getCarryoverFromPrevYear(staffId, year);
    const planned = this.countPlannedVacationDaysForYear(staffId, year, true);
    const carryThis = Math.max(0, (entitlement + carryPrev) - takenManual - planned);
    appState.vacationLedger[year][staffId] = { entitlement, takenManual, carryover: carryThis };
        appState.save();
        // Re-render to update remaining
        this.renderVacationLedger();
      });
    });
  }

  // Helpers: counting days within a year
  getAverageWeekdayShiftHours(){
    try{
      const entries = Object.values(SHIFTS || {}).filter(s=>s.type==='weekday');
      if (!entries.length) return 6; // reasonable fallback
      const avg = entries.reduce((sum,s)=>sum+(Number(s.hours)||0),0) / entries.length;
      return avg || 6;
    }catch{return 6;}
  }

  computeDefaultEntitlement(staff, year){
    // Company policy: permanent (full/part-time) get 30 days.
    if (staff?.role === 'permanent') return 30;
    // German law baseline: 20 days for a 5-day week (BUrlG, 24 Werktage at 6-day week).
    const statutoryFiveDay = 20;
    let avgDays = Number(staff?.typicalWorkdays || 0);
    if (!avgDays || !Number.isFinite(avgDays) || avgDays <= 0){
      // Estimate from contract hours and average weekday shift length
      const h = Number(staff?.contractHours || 0);
      const perDay = this.getAverageWeekdayShiftHours();
      const est = h > 0 && perDay > 0 ? (h / perDay) : 0;
      avgDays = Math.min(5, Math.max(1, Math.round(est)));
    }
    avgDays = Math.min(5, Math.max(1, Number(avgDays)));
    const entitlement = Math.round((statutoryFiveDay * (avgDays / 5)));
    return entitlement;
  }

  getCarryoverFromPrevYear(staffId, year, staffObj){
    const prevYear = Number(year) - 1;
    if (prevYear < 1970) return 0;
    const prevRec = (appState.vacationLedger?.[prevYear]||{})[staffId];
  const prevEnt = Number((prevRec?.entitlement ?? this.computeDefaultEntitlement(staffObj || appState.staffData.find(s=>s.id===staffId), prevYear)) || 0);
    const prevManual = Number(prevRec?.takenManual || 0);
    const prevPlanned = this.countPlannedVacationDaysForYear(staffId, prevYear, true);
    const prevCarryStored = Number(prevRec?.carryover || 0);
    // If carryover stored, include it in previous year's available pool; else assume none.
    const availablePrev = prevEnt + prevCarryStored;
    const carry = Math.max(0, availablePrev - prevManual - prevPlanned);
    return carry;
  }
  countPlannedVacationDaysForYear(staffId, year, weekdaysOnly=true){
    const periods = appState.vacationsByStaff?.[staffId] || [];
    let total = 0;
    for (const p of periods){
      total += this.countOverlapDaysInYear(p.start, p.end, year, weekdaysOnly);
    }
    return total;
  }

  countSickDaysForYear(staffId, year, weekdaysOnly=false){
    const periods = appState.illnessByStaff?.[staffId] || [];
    let total = 0;
    for (const p of periods){
      total += this.countOverlapDaysInYear(p.start, p.end, year, weekdaysOnly);
    }
    return total;
  }

  countOverlapDaysInYear(startStr, endStr, year, weekdaysOnly){
    if (!startStr || !endStr) return 0;
    const start = parseYMD(startStr);
    const end = parseYMD(endStr);
    if (isNaN(start) || isNaN(end)) return 0;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31);
    const s = start > yearStart ? start : yearStart;
    const e = end < yearEnd ? end : yearEnd;
    if (e < s) return 0;
    let count = 0;
    const cur = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    while (cur <= e){
      const day = cur.getDay(); // 0=Sun .. 6=Sat
      if (!weekdaysOnly || (day >= 1 && day <= 5)) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }
}

// Attach role change handler to toggle permanent preferred row
document.addEventListener('DOMContentLoaded', () => {
  const roleEl = document.getElementById('staffType');
  const row = document.getElementById('permanentPreferredRow');
  if (roleEl && row){
    const sync = () => { row.style.display = roleEl.value === 'permanent' ? '' : 'none'; };
    roleEl.addEventListener('change', sync);
    sync();
  }
});
