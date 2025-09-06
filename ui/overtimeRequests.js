import { appState } from '../modules/state.js';
import { SHIFTS } from '../modules/config.js';
import { parseYMD } from '../utils/dateUtils.js';
import { ScheduleValidator } from '../validation.js';

export class OvertimeRequestsUI {
  constructor(containerId = '#overtimeRequestsList'){
    this.container = document.querySelector(containerId);
  }

  render(){
    if (!this.container) return;
    const reqState = appState.overtimeRequests || {};
    const requests = [];
    Object.entries(reqState).forEach(([monthKey, byDate]) => {
      Object.entries(byDate||{}).forEach(([dateStr, list]) => {
        (list||[]).forEach(r => {
          if (!r) return;
          if (r.status === 'requested' || r.status === 'consented'){
            const s = (window.DEBUG?.state?.staffData||[]).find(x=>String(x.id)===String(r.staffId));
            requests.push({
              staffId: Number(r.staffId),
              staffName: s?.name||String(r.staffId),
              dateStr,
              shiftKey: r.shiftKey,
              status: r.status,
              lastError: r.lastError || ''
            });
          }
        });
      });
    });
    if (requests.length === 0){
      this.container.innerHTML = '<p style="color:#6c757d; font-style: italic;">Keine ausstehenden Überstunden-Anfragen</p>';
      return;
    }
    requests.sort((a,b)=> new Date(a.dateStr) - new Date(b.dateStr));
    this.container.innerHTML = requests.map(r => this._renderItem(r)).join('');
    // Bind handlers
    this.container.querySelectorAll('[data-consent]')?.forEach(btn => btn.addEventListener('click', (e)=>{
      const { staffId, dateStr, shiftKey } = e.currentTarget.dataset;
      this.handleResponse(Number(staffId), dateStr, shiftKey, 'consented');
    }));
    this.container.querySelectorAll('[data-decline]')?.forEach(btn => btn.addEventListener('click', (e)=>{
      const { staffId, dateStr, shiftKey } = e.currentTarget.dataset;
      this.handleResponse(Number(staffId), dateStr, shiftKey, 'declined');
    }));
    this.container.querySelectorAll('[data-assign-now]')?.forEach(btn => btn.addEventListener('click', (e)=>{
      const { staffId, dateStr, shiftKey } = e.currentTarget.dataset;
      this.assignNow(Number(staffId), dateStr, shiftKey);
    }));
  }

  _renderItem({ staffId, staffName, dateStr, shiftKey, status, lastError }){
    const shift = (SHIFTS||{})[shiftKey] || {};
    const dateDE = (parseYMD(dateStr)||new Date(dateStr)).toLocaleDateString('de-DE');
    const actions = status === 'consented'
      ? `<button class="btn btn-primary" data-assign-now data-staff-id="${staffId}" data-date-str="${dateStr}" data-shift-key="${shiftKey}">Jetzt zuweisen</button>`
      : `<button class="btn btn-success" data-consent data-staff-id="${staffId}" data-date-str="${dateStr}" data-shift-key="${shiftKey}">Zustimmen</button>
         <button class="btn btn-danger" data-decline data-staff-id="${staffId}" data-date-str="${dateStr}" data-shift-key="${shiftKey}">Ablehnen</button>`;
    const statusBadge = status === 'consented' ? '<span class="badge" style="background:#0dcaf0; color:#00303d;">Zugestimmt</span>' : '';
    const errorNote = status === 'consented' && lastError ? `<div style="color:#b02a37; font-size:0.9em; margin-top:4px;">Letzter Fehler: ${lastError}</div>` : '';
    return `
      <div class="staff-card" style="border-left:4px solid #ffc107; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
          <div>
            <div><strong>${staffName}</strong> ${statusBadge}</div>
            <div><strong>Datum:</strong> ${dateDE}</div>
            <div><strong>Schicht:</strong> ${shift.name||shiftKey} ${shift.time?`(${shift.time})`:''}</div>
            ${errorNote}
          </div>
          <div style="display:flex; gap:8px;">
            ${actions}
          </div>
        </div>
      </div>
    `;
  }

  handleResponse(staffId, dateStr, shiftKey, response){
    const monthKey = dateStr.substring(0,7);
    if (!appState.overtimeRequests[monthKey]) appState.overtimeRequests[monthKey] = {};
    const list = appState.overtimeRequests[monthKey][dateStr] || [];
    list.forEach(item => { if (item.staffId===staffId && item.shiftKey===shiftKey) item.status = response; });
    appState.overtimeRequests[monthKey][dateStr] = list;
    // Audit log for decision
    try {
      if (!Array.isArray(appState.auditLog)) appState.auditLog = [];
      const staffName = (appState.staffData||[]).find(s=>String(s.id)===String(staffId))?.name || String(staffId);
      const shiftName = (SHIFTS?.[shiftKey]?.name || shiftKey);
      const msg = response==='consented'
        ? `Überstunden-Anfrage zugestimmt: ${staffName} – ${dateStr} (${shiftName})`
        : `Überstunden-Anfrage abgelehnt: ${staffName} – ${dateStr} (${shiftName})`;
      appState.auditLog.push({ timestamp: Date.now(), message: msg });
    } catch {}

    if (response === 'consented'){
      // Persist consent acceptance before retry so hard rules pass
      const year = String(parseYMD(dateStr).getFullYear());
      if (!appState.permanentOvertimeConsent[staffId]) appState.permanentOvertimeConsent[staffId] = {};
      if (!appState.permanentOvertimeConsent[staffId][year]) appState.permanentOvertimeConsent[staffId][year] = {};
      appState.permanentOvertimeConsent[staffId][year][dateStr] = true;

      // Attempt auto-assignment for the requested shift
      const month = monthKey;
      const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
      if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
      const existing = schedule[dateStr].assignments?.[shiftKey];
      let success = false;
      let failureReason = '';
      if (existing && Number(existing) !== Number(staffId)){
        // Don't override an already assigned shift; just log and keep as consented
        failureReason = 'Schicht bereits belegt';
      } else {
        const original = { ...schedule[dateStr].assignments };
        schedule[dateStr].assignments[shiftKey] = staffId;
        try{
          const validator = new ScheduleValidator(month);
          const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
          const hasBlocker = consolidated?.[dateStr]?.blockers?.[shiftKey];
          if (hasBlocker){
            schedule[dateStr].assignments = original;
            failureReason = String(hasBlocker);
          } else {
            appState.scheduleData[month] = consolidated;
            success = true;
          }
        } catch (e){
          schedule[dateStr].assignments = original;
          failureReason = e?.message || 'Unbekannter Fehler';
        }
      }
      // Update request status and log outcome
      try {
        const item = list.find(i=>i.staffId===staffId && i.shiftKey===shiftKey);
        if (item){ item.status = success ? 'completed' : 'consented'; if (!success) item.lastError = failureReason; else delete item.lastError; }
        if (!Array.isArray(appState.auditLog)) appState.auditLog = [];
        const staffName = (appState.staffData||[]).find(s=>String(s.id)===String(staffId))?.name || String(staffId);
        const shiftName = (SHIFTS?.[shiftKey]?.name || shiftKey);
        if (success){
          appState.auditLog.push({ timestamp: Date.now(), message: `Auto-Zuweisung nach Zustimmung erfolgreich: ${staffName} – ${dateStr} (${shiftName})` });
        } else {
          appState.auditLog.push({ timestamp: Date.now(), message: `Auto-Zuweisung nach Zustimmung fehlgeschlagen: ${staffName} – ${dateStr} (${shiftName}) – Grund: ${failureReason}` });
        }
      } catch {}
      appState.save();
      // Refresh UI: requests panel and schedule view
      try { this.render(); } catch {}
  try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
  try { window.handlers?.ui?.updateCalendarFromSelect?.(); } catch {}
      return;
    }

    // Decline path or other statuses
    appState.save();
    this.render();
  }

  assignNow(staffId, dateStr, shiftKey){
    const month = dateStr.substring(0,7);
    if (!appState.overtimeRequests[month]) appState.overtimeRequests[month] = {};
    const list = appState.overtimeRequests[month][dateStr] || [];
    const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
    if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
    const existing = schedule[dateStr].assignments?.[shiftKey];
    let success = false; let failureReason = '';
    if (existing && Number(existing) !== Number(staffId)){
      failureReason = 'Schicht bereits belegt';
    } else {
      const original = { ...schedule[dateStr].assignments };
      schedule[dateStr].assignments[shiftKey] = staffId;
      try{
        const validator = new ScheduleValidator(month);
        const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
        const hasBlocker = consolidated?.[dateStr]?.blockers?.[shiftKey];
        if (hasBlocker){
          schedule[dateStr].assignments = original;
          failureReason = String(hasBlocker);
        } else {
          appState.scheduleData[month] = consolidated;
          success = true;
        }
      } catch(e){
        schedule[dateStr].assignments = original;
        failureReason = e?.message || 'Unbekannter Fehler';
      }
    }
    try{
      const item = list.find(i=>i.staffId===staffId && i.shiftKey===shiftKey);
      if (item){ item.status = success ? 'completed' : 'consented'; if (!success) item.lastError = failureReason; else delete item.lastError; }
      if (!Array.isArray(appState.auditLog)) appState.auditLog = [];
      const staffName = (appState.staffData||[]).find(s=>String(s.id)===String(staffId))?.name || String(staffId);
      const shiftName = (SHIFTS?.[shiftKey]?.name || shiftKey);
      appState.auditLog.push({ timestamp: Date.now(), message: success
        ? `Manuelle Zuweisung aus Anfrage erfolgreich: ${staffName} – ${dateStr} (${shiftName})`
        : `Manuelle Zuweisung aus Anfrage fehlgeschlagen: ${staffName} – ${dateStr} (${shiftName}) – Grund: ${failureReason}` });
    } catch {}
    appState.save();
  try { this.render(); } catch {}
  try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
  try { window.handlers?.ui?.updateCalendarFromSelect?.(); } catch {}
  }
}
