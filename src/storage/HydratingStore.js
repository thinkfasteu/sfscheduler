import { appState } from '../../modules/state.js';

// Wraps an async adapter (SupabaseAdapter) and provides a synchronous API compatible with LocalStorageAdapter
// by maintaining an in-memory mirror (appState) and performing remote writes asynchronously.
export class HydratingStore {
  constructor(asyncAdapter){
    this.remote = asyncAdapter;
    this.ready = false;
    this.retryQueue = [];
    this.nextStaffId = 1;
    this.readyPromise = this._hydrate();
    this._startRetryLoop();
  }

  async _hydrate(){
    try {
      if (this.remote.disabled){ this.ready = true; return; }
      // Staff hydration
      const staff = await this.remote.listStaff();
      if (Array.isArray(staff)){
        appState.staffData = staff.slice();
        this.nextStaffId = (staff.reduce((m,s)=> Math.max(m, Number(s.id)||0),0) || 0) + 1;
      }
      // Current month schedule hydration
      const now = new Date();
      const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
      const sched = await this.remote.getMonthSchedule(monthKey);
      if (!appState.scheduleData) appState.scheduleData = {};
      if (sched && typeof sched === 'object') appState.scheduleData[monthKey] = sched;
      appState.save?.();
    } catch (e){
      console.warn('[HydratingStore] hydration failed', e);
    } finally {
      this.ready = true;
    }
  }

  _startRetryLoop(){
    const tick = ()=>{
      if (this.retryQueue.length===0){ setTimeout(tick, 4000); return; }
      const now = Date.now();
      this.retryQueue = this.retryQueue.filter(job => {
        if (job.nextAttempt > now) return true;
        job.fn().then(()=> job.done = true).catch(err => {
          job.attempts += 1;
          job.nextAttempt = Date.now() + Math.min(30000, 1000 * Math.pow(2, job.attempts));
          if (job.attempts>5){ console.error('[HydratingStore] giving up job', job.desc, err); job.done = true; }
        });
        return !job.done;
      });
      setTimeout(tick, 3000);
    };
    setTimeout(tick, 3000);
  }

  _enqueue(desc, fn){
    this.retryQueue.push({ desc, fn, attempts:0, nextAttempt: Date.now() });
  }

  // ---- Staff (sync facade) ----
  listStaff(){ return Array.isArray(appState.staffData)? appState.staffData : []; }
  createStaff(data){
    if (!Array.isArray(appState.staffData)) appState.staffData = [];
    const id = this.nextStaffId++;
    const rec = { id, ...data };
    appState.staffData.push(rec); appState.save?.();
    if (!this.remote.disabled){
      const payload = { ...rec }; // same id so remote matches
      this._enqueue('createStaff', async ()=> { await this.remote.createStaff(payload); });
    }
    return rec;
  }
  updateStaff(id, patch){
    const s = appState.staffData.find(x=>x.id===id); if (!s) return null;
    Object.assign(s, patch); appState.save?.();
    if (!this.remote.disabled){ this._enqueue('updateStaff', async ()=> { await this.remote.updateStaff(id, patch); }); }
    return s;
  }
  deleteStaff(id){
    const idx = appState.staffData.findIndex(x=>x.id===id); if (idx<0) return false;
    appState.staffData.splice(idx,1); appState.save?.();
    if (!this.remote.disabled){ this._enqueue('deleteStaff', async ()=> { await this.remote.deleteStaff(id); }); }
    return true;
  }

  // ---- Schedule (sync facade) ----
  getMonthSchedule(month){ return appState.scheduleData?.[month]; }
  assign(dateStr, shiftKey, staffId){
    const month = dateStr.substring(0,7);
    const sched = appState.scheduleData[month] || (appState.scheduleData[month] = {});
    if (!sched[dateStr]) sched[dateStr] = { assignments: {} };
    sched[dateStr].assignments[shiftKey] = staffId; appState.save?.();
    if (!this.remote.disabled){ this._enqueue('assign', async ()=> { await this.remote.assign(dateStr, shiftKey, staffId); }); }
    return true;
  }
  unassign(dateStr, shiftKey){
    const month = dateStr.substring(0,7);
    const sched = appState.scheduleData[month]; if (!sched?.[dateStr]?.assignments) return false;
    delete sched[dateStr].assignments[shiftKey]; appState.save?.();
    if (!this.remote.disabled){ this._enqueue('unassign', async ()=> { await this.remote.unassign(dateStr, shiftKey); }); }
    return true;
  }

  // Unimplemented (compat stubs)
  availabilityUpsert(){ throw new Error('Not implemented in HydratingStore (supabase mode)'); }
  availabilitySetDayOff(){ throw new Error('Not implemented'); }
  availabilityIsDayOff(){ return false; }
  availabilitySetVoluntary(){ throw new Error('Not implemented'); }
  availabilityIsVoluntary(){ return false; }
  availabilityListForRange(){ return {}; }
  listVacations(){ return []; }
  addVacation(){ throw new Error('Not implemented'); }
  removeVacation(){ throw new Error('Not implemented'); }
  listIllness(){ return []; }
  addIllness(){ throw new Error('Not implemented'); }
  removeIllness(){ throw new Error('Not implemented'); }
  listOvertimeRequests(){ return []; }
  createOvertimeRequest(){ throw new Error('Not implemented'); }
  updateOvertimeRequest(){ throw new Error('Not implemented'); }
  transitionOvertimeRequest(){ throw new Error('Not implemented'); }
  setOvertimeConsent(){ throw new Error('Not implemented'); }
  hasOvertimeConsent(){ return false; }
  auditList(){ return Array.isArray(appState.auditLog)? appState.auditLog : []; }
  auditLog(message, meta){ if (!Array.isArray(appState.auditLog)) appState.auditLog = []; appState.auditLog.push({ timestamp: Date.now(), message, meta }); appState.save?.(); }
}
