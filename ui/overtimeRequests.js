import { appState } from '../modules/state.js';
import { SHIFTS } from '../modules/config.js';
import { parseYMD } from '../utils/dateUtils.js';
import { ScheduleValidator } from '../validation.js';
import { createServices } from '../src/services/index.js';

export class OvertimeRequestsUI {
  constructor(containerId = '#overtimeRequestsList'){
    this.container = document.querySelector(containerId);
  }

  render(){
    if (!this.container) return;
    // Ensure services
    try { if (!window.__services) window.__services = createServices({}); } catch {}
    const svc = window.__services?.overtime;
    const requestsRaw = svc?.listAll?.()||[];
    const requests = requestsRaw.filter(r=> ['requested','consented'].includes(r.status)).map(r=>{
      const s = (appState.staffData||[]).find(x=>String(x.id)===String(r.staffId));
      return { id: r.id || `${r.dateStr}:${r.staffId}:${r.shiftKey}`, staffId: Number(r.staffId), staffName: s?.name||String(r.staffId), dateStr: r.dateStr, shiftKey: r.shiftKey, status: r.status, lastError: r.lastError||'' };
    });
    if (requests.length === 0){
      this.container.innerHTML = '<p style="color:#6c757d; font-style: italic;">Keine ausstehenden Überstunden-Anfragen</p>';
      return;
    }
    requests.sort((a,b)=> new Date(a.dateStr) - new Date(b.dateStr));
    this.container.innerHTML = requests.map(r => this._renderItem(r)).join('');
    // Bind handlers
    this.container.querySelectorAll('[data-consent]')?.forEach(btn => btn.addEventListener('click', (e)=>{
      const { id } = e.currentTarget.dataset; this.handleConsent(id);
    }));
    this.container.querySelectorAll('[data-decline]')?.forEach(btn => btn.addEventListener('click', (e)=>{
      const { id } = e.currentTarget.dataset; this.handleDecline(id);
    }));
    this.container.querySelectorAll('[data-assign-now]')?.forEach(btn => btn.addEventListener('click', (e)=>{
      const { id } = e.currentTarget.dataset; this.assignNow(id);
    }));
  }

  _renderItem({ id, staffId, staffName, dateStr, shiftKey, status, lastError }){
    const shift = (SHIFTS||{})[shiftKey] || {};
    const dateDE = (parseYMD(dateStr)||new Date(dateStr)).toLocaleDateString('de-DE');
    const actions = status === 'consented'
      ? `<button class="btn btn-primary" data-assign-now data-id="${id}">Jetzt zuweisen</button>`
      : `<button class="btn btn-success" data-consent data-id="${id}">Zustimmen</button>
         <button class="btn btn-danger" data-decline data-id="${id}">Ablehnen</button>`;
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

  handleConsent(id){
    const svc = window.__services?.overtime; if (!svc) return;
    const req = svc.listAll().find(r=> (r.id||`${r.dateStr}:${r.staffId}:${r.shiftKey}`)===id); if(!req) return;
    // Set permanent consent flag then attempt assignment
    svc.setConsent(req.staffId, req.dateStr, true);
    this._attemptAutoAssign(req, true);
  }
  handleDecline(id){
    const svc = window.__services?.overtime; if (!svc) return;
    svc.setStatus(id,'declined');
    this.render();
  }
  assignNow(id){
    const svc = window.__services?.overtime; if (!svc) return;
    const req = svc.listAll().find(r=> (r.id||`${r.dateStr}:${r.staffId}:${r.shiftKey}`)===id); if(!req) return;
    this._attemptAutoAssign(req, false, true);
  }
  _attemptAutoAssign(req, fromConsent=false, manual=false){
    const { staffId, dateStr, shiftKey } = req; const month = dateStr.substring(0,7);
    const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
    if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
    const existing = schedule[dateStr].assignments?.[shiftKey];
    let success=false, failureReason='';
    if (existing && Number(existing)!==Number(staffId)){
      failureReason='Schicht bereits belegt';
    } else {
      const original = { ...schedule[dateStr].assignments };
      schedule[dateStr].assignments[shiftKey] = staffId;
      try{
        const validator = new ScheduleValidator(month);
        const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
        const hasBlocker = consolidated?.[dateStr]?.blockers?.[shiftKey];
        if (hasBlocker){ schedule[dateStr].assignments = original; failureReason = String(hasBlocker); }
        else { appState.scheduleData[month] = consolidated; success=true; }
      }catch(e){ schedule[dateStr].assignments = original; failureReason = e?.message||'Unbekannter Fehler'; }
    }
    const id = req.id || `${req.dateStr}:${req.staffId}:${req.shiftKey}`;
    const overtimeSvc = window.__services?.overtime;
    if (success) overtimeSvc?.setStatus(id,'completed'); else overtimeSvc?.setStatus(id, fromConsent? 'consented':'consented', { lastError: failureReason });
    appState.save();
    try { this.render(); } catch {}
    try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
    try { window.handlers?.ui?.updateCalendarFromSelect?.(); } catch {}
  }
}
