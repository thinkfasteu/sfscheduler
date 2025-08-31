import { appState } from '../modules/state.js';
import { toLocalISOMonth, toLocalISODate, pad2 } from '../utils/dateUtils.js';

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
  }

  // ==== Staff ====
  addStaff(){
    const nameEl = document.getElementById('staffName');
    const roleEl = document.getElementById('staffType');
    const hoursEl = document.getElementById('contractHours');
    const daysEl = document.getElementById('typicalWorkdays');
    if (!nameEl || !roleEl) return;
    const name = nameEl.value?.trim();
    if (!name) { alert('Bitte Name eingeben'); return; }
    const role = roleEl.value || 'minijob';
    const contractHours = Number(hoursEl?.value || 0);
    const typicalWorkdays = Number(daysEl?.value || 0);
    const nextId = (appState.staffData.reduce((m,s)=>Math.max(m, s.id||0), 0) || 0) + 1;
    appState.staffData.push({ id: nextId, name, role, contractHours, typicalWorkdays });
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
  if (window.__openModal) return window.__openModal('holidaysModal');
  const modal = document.getElementById('holidaysModal');
  if (modal) modal.style.display = 'block';
    this.initHolidays();
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
    list.innerHTML = items.length ? items.map(([d,n],idx)=>
      `<li>${d} – ${n} <button class="btn btn-danger" data-date="${d}">Entfernen</button></li>`
    ).join('') : '<li>Keine Feiertage</li>';
    list.querySelectorAll('button[data-date]').forEach(btn => {
      btn.addEventListener('click', (e)=>{
        const date = e.currentTarget.getAttribute('data-date');
        this.removeHoliday(date);
      });
    });
  }

  resetStaffForm(){
    ['staffName','contractHours','typicalWorkdays'].forEach(id=>{ const el=document.getElementById(id); if (el) el.value=''; });
    const roleEl = document.getElementById('staffType'); if (roleEl) roleEl.value='minijob';
  }

  renderStaffList(){
    const host = document.getElementById('staffList');
    if (!host) return;
    if (!appState.staffData.length){
      host.innerHTML = '<p>Keine Mitarbeiter hinzugefügt.</p>';
      return;
    }
    host.innerHTML = appState.staffData.map(s=>`
      <div class="staff-card" style="display:flex; align-items:center; justify-content:space-between;">
        <div>
          <strong>${s.name}</strong> – ${s.role}
          <div class="badge">${s.contractHours||0} h/Woche</div>
          <div class="badge">${s.typicalWorkdays||0} Tage/Woche</div>
        </div>
        <button class="btn btn-danger" data-action="remove" data-id="${s.id}">Entfernen</button>
      </div>
    `).join('');
    host.querySelectorAll('button[data-action="remove"]').forEach(btn=>{
      btn.addEventListener('click', (e)=>{
        const id = Number(e.currentTarget.dataset.id);
        const idx = appState.staffData.findIndex(x=>x.id===id);
        if (idx>=0){ appState.staffData.splice(idx,1); appState.save(); this.renderStaffList(); this.populateAvailabilitySelectors(); }
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

    const SHIFTS_COLS = ['early','midday','evening','closing'];
    let html = '<div class="avail-grid">';
    // Header
    html += '<div class="avail-row avail-head">'
         + '<div class="avail-cell">Datum</div>'
         + SHIFTS_COLS.map(k=>`<div class="avail-cell">${k}</div>`).join('')
         + '<div class="avail-cell">Frei</div>'
         + '</div>';
    for (let d=1; d<=days; d++){
      const dateStr = `${y}-${pad2(m)}-${pad2(d)}`;
      const off = dayOff[dateStr] === 'off';
      const row = detailed[dateStr] || {};
      html += '<div class="avail-row">';
      html += `<div class="avail-cell"><strong>${pad2(d)}.${pad2(m)}.${y}</strong></div>`;
      SHIFTS_COLS.forEach(k => {
        const val = row[k]; // 'prefer'|'yes'|'no'|undefined
        const stateClass = val ? `state-${val}` : 'state-unset';
        const label = val === 'prefer' ? '★' : val === 'yes' ? '✓' : val === 'no' ? '✗' : '—';
        html += `<div class="avail-cell"><button class="avail-btn ${stateClass}" data-date="${dateStr}" data-shift="${k}" ${off?'disabled':''}>${label}</button></div>`;
      });
      html += `<div class="avail-cell"><button class="btn ${off?'btn-secondary':''}" data-dayoff="1" data-date="${dateStr}" data-off="${off?1:0}">${off?'Freiwunsch':'Frei wünschen'}</button></div>`;
      html += '</div>';
    }
    html += '</div>';
    host.innerHTML = html;

    // Handlers: tri-state per shift
    host.querySelectorAll('button.avail-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const b = e.currentTarget;
        const dateStr = b.dataset.date;
        const shiftKey = b.dataset.shift;
        const current = (detailed[dateStr]||{})[shiftKey];
        const next = current === 'yes' ? 'prefer' : current === 'prefer' ? 'no' : current === 'no' ? undefined : 'yes';
        if (!detailed[dateStr]) detailed[dateStr] = {};
        if (next) detailed[dateStr][shiftKey] = next; else delete detailed[dateStr][shiftKey];
        // Clean empty date objects
        if (detailed[dateStr] && Object.keys(detailed[dateStr]).length === 0){ delete detailed[dateStr]; }
        appState.save();
        this.handleAvailabilityDisplay();
      });
    });

    // Handlers: day-off toggle
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

  // ==== Vacation ====
  populateVacationSelectors(){
    const staffSel = document.getElementById('vacationStaffSelect');
    if (staffSel){
      staffSel.innerHTML = '<option value="">– Mitarbeiter –</option>' + appState.staffData.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
    }
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
}
