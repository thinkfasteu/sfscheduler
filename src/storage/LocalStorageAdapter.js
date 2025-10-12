import { appState } from '../../modules/state.js';

// Local adapter proxies to in-memory appState while coordinating persistence via appState.save().
export class LocalStorageAdapter {
  constructor(){ }

  // ---- Staff ----
  listStaff(){ return Array.isArray(appState.staffData)? appState.staffData : []; }
  createStaff(data){
    if (!Array.isArray(appState.staffData)) appState.staffData = [];
    const nextId = (appState.staffData.reduce((m,s)=>Math.max(m, s.id||0),0)||0)+1;
    const rec = { id: nextId, ...data };
    appState.staffData.push(rec); appState.save(); return rec;
  }
  updateStaff(id, patch){ const s = appState.staffData.find(x=>x.id===id); if (!s) return null; Object.assign(s, patch); appState.save(); return s; }
  deleteStaff(id){ const idx = appState.staffData.findIndex(x=>x.id===id); if (idx<0) return false; appState.staffData.splice(idx,1); appState.save(); return true; }

  // ---- Schedule ----
  getMonthSchedule(month){ return appState.scheduleData[month]; }
  setMonthSchedule(month, data){ 
    appState.scheduleData[month] = data; 
    appState.save(); 
    return true; 
  }
  clearMonthSchedule(month){ 
    if (appState.scheduleData[month]) {
      delete appState.scheduleData[month]; 
      appState.save(); 
      return true;
    }
    return false;
  }
  assign(dateStr, shiftKey, staffId){
    const month = dateStr.substring(0,7);
    const sched = appState.scheduleData[month] || (appState.scheduleData[month] = {});
    if (!sched[dateStr]) sched[dateStr] = { assignments: {} };
    sched[dateStr].assignments[shiftKey] = staffId;
    appState.save();
    return true;
  }
  unassign(dateStr, shiftKey){
    const month = dateStr.substring(0,7);
    const sched = appState.scheduleData[month];
    if (!sched || !sched[dateStr] || !sched[dateStr].assignments) return false;
    delete sched[dateStr].assignments[shiftKey];
    appState.save();
    return true;
  }
  bulkAssign(changes){
    changes.forEach(c=> this.assign(c.date, c.shiftKey, c.staffId));
    return true;
  }

  // ---- Availability ----
  availabilityUpsert(staffId, dateStr, shiftKey, status){
    if (!appState.availabilityData[staffId]) appState.availabilityData[staffId] = {};
    if (!appState.availabilityData[staffId][dateStr]) appState.availabilityData[staffId][dateStr] = {};
    if (!status){
      delete appState.availabilityData[staffId][dateStr][shiftKey];
      if (Object.keys(appState.availabilityData[staffId][dateStr]).length===0) delete appState.availabilityData[staffId][dateStr];
      if (Object.keys(appState.availabilityData[staffId]).length===0) delete appState.availabilityData[staffId];
    } else {
      appState.availabilityData[staffId][dateStr][shiftKey] = status;
    }
    appState.save();
    return true;
  }
  availabilitySetDayOff(staffId, dateStr, isOff){
    const key = `staff:${staffId}`;
    if (!appState.availabilityData[key]) appState.availabilityData[key] = {};
    if (isOff){ appState.availabilityData[key][dateStr] = 'off'; }
    else { delete appState.availabilityData[key][dateStr]; }
    appState.save();
    return true;
  }
  availabilityIsDayOff(staffId, dateStr){
    const key = `staff:${staffId}`;
    return appState.availabilityData?.[key]?.[dateStr] === 'off';
  }
  availabilitySetVoluntary(staffId, dateStr, kind, checked){
    if (!['evening','closing'].includes(kind)) return false;
    if (!appState.voluntaryEveningAvailability) appState.voluntaryEveningAvailability = {};
    const k = `${staffId}::${dateStr}::${kind}`;
    if (checked) appState.voluntaryEveningAvailability[k] = true; else delete appState.voluntaryEveningAvailability[k];
    appState.save();
    return true;
  }
  availabilityIsVoluntary(staffId, dateStr, kind){
    const k = `${staffId}::${dateStr}::${kind}`;
    const legacy = `${staffId}::${dateStr}`; // legacy combined key
    return !!(appState.voluntaryEveningAvailability?.[k] || appState.voluntaryEveningAvailability?.[legacy]);
  }
  availabilityListForRange(staffId, fromDate, toDate){
    const out = {};
    const data = appState.availabilityData?.[staffId] || {};
    const from = new Date(fromDate); const to = new Date(toDate);
    Object.keys(data).forEach(d=>{ const dt = new Date(d); if (dt>=from && dt<=to) out[d] = data[d]; });
    return out;
  }

  // ---- Vacation / Illness ----
  listVacations(staffId){ return appState.vacationsByStaff?.[staffId] || []; }
  addVacation(staffId, period){ if (!appState.vacationsByStaff[staffId]) appState.vacationsByStaff[staffId]=[]; appState.vacationsByStaff[staffId].push(period); appState.save(); return true; }
  removeVacation(staffId, idx){ const arr = appState.vacationsByStaff?.[staffId]; if (!arr||!arr[idx]) return false; arr.splice(idx,1); appState.save(); return true; }
  listIllness(staffId){ return appState.illnessByStaff?.[staffId] || []; }
  addIllness(staffId, period){ if (!appState.illnessByStaff[staffId]) appState.illnessByStaff[staffId]=[]; appState.illnessByStaff[staffId].push(period); appState.save(); return true; }
  removeIllness(staffId, idx){ const arr = appState.illnessByStaff?.[staffId]; if (!arr||!arr[idx]) return false; arr.splice(idx,1); appState.save(); return true; }
  // ---- Vacation Ledger (local) ----
  getVacationLedgerYear(year){
    if (!appState.vacationLedger[year]) appState.vacationLedger[year] = {};
    return appState.vacationLedger[year];
  }
  upsertVacationLedgerEntry(year, staffId, patch){
    if (!appState.vacationLedger[year]) appState.vacationLedger[year] = {};
    const cur = appState.vacationLedger[year][staffId] || { staffId, year, version:0 };
    const next = { ...cur, ...patch, version: (cur.version||0)+1 };
    appState.vacationLedger[year][staffId] = next; appState.save();
    return next;
  }

  // ---- Overtime Requests ----
  listOvertimeRequests(){
    return Object.entries(appState.overtimeRequests||{})
      .flatMap(([month, monthObj])=> Object.entries(monthObj||{})
        .flatMap(([dateStr, arr])=> (arr||[]).map(r=> ({ ...r, month, dateStr }))));
  }
  listOvertimeByMonth(month){
    const monthObj = appState.overtimeRequests?.[month] || {}; return Object.entries(monthObj)
      .flatMap(([dateStr, arr]) => (arr||[]).map(r=> ({ ...r, month, dateStr })));
  }
  listOvertimeByDate(month, dateStr){
    return (appState.overtimeRequests?.[month]?.[dateStr]||[]).map(r=> ({ ...r, month, dateStr }));
  }
  ensureOvertimeContainer(month, dateStr){
    if (!appState.overtimeRequests[month]) appState.overtimeRequests[month] = {};
    if (!Array.isArray(appState.overtimeRequests[month][dateStr])) appState.overtimeRequests[month][dateStr] = [];
    return appState.overtimeRequests[month][dateStr];
  }
  createOvertimeRequest(month, dateStr, req){
    const list = this.ensureOvertimeContainer(month, dateStr);
    // Backwards-compatible: add id + timestamps if missing
    const id = req.id || `${dateStr}:${req.staffId}:${req.shiftKey}:${Date.now()}`;
    const record = { id, createdAt: Date.now(), status: 'requested', ...req };
    list.push(record); appState.save(); return record;
  }
  updateOvertimeRequest(month, dateStr, predicate, patch){
    const list = appState.overtimeRequests?.[month]?.[dateStr]; if (!Array.isArray(list)) return false;
    list.forEach(r=>{ if (predicate(r)) Object.assign(r, patch, { updatedAt: Date.now() }); }); appState.save(); return true;
  }
  transitionOvertimeRequest(id, newStatus, extra={}){
    let found = null;
    Object.entries(appState.overtimeRequests||{}).forEach(([month, monthObj])=>{
      Object.entries(monthObj||{}).forEach(([dateStr, arr])=>{
        (arr||[]).forEach(r=>{ if(!found && r && (r.id===id || (!r.id && `${dateStr}:${r.staffId}:${r.shiftKey}`===id))){ Object.assign(r, extra, { status:newStatus, updatedAt: Date.now() }); found = { ...r, month, dateStr }; } });
      });
    });
    if(found) appState.save();
    return found;
  }
  setOvertimeConsent(staffId, dateStr, value=true){
    const year = String(new Date(dateStr).getFullYear());
    if (!appState.permanentOvertimeConsent) appState.permanentOvertimeConsent = {};
    if (!appState.permanentOvertimeConsent[staffId]) appState.permanentOvertimeConsent[staffId] = {};
    if (!appState.permanentOvertimeConsent[staffId][year]) appState.permanentOvertimeConsent[staffId][year] = {};
    if (value) appState.permanentOvertimeConsent[staffId][year][dateStr] = true; else delete appState.permanentOvertimeConsent[staffId][year][dateStr];
    appState.save();
    return true;
  }
  hasOvertimeConsent(staffId, dateStr){
    const year = String(new Date(dateStr).getFullYear());
    return !!appState.permanentOvertimeConsent?.[staffId]?.[year]?.[dateStr];
  }

  // ---- Audit ----
  auditList(){ return Array.isArray(appState.auditLog)? appState.auditLog : []; }
  auditLog(message, meta){ if (!Array.isArray(appState.auditLog)) appState.auditLog = []; appState.auditLog.push({ timestamp: Date.now(), message, meta }); appState.save(); }
}

