import { appState } from '../../modules/state.js';

// Wraps an async adapter (SupabaseAdapter) and provides a synchronous API compatible with LocalStorageAdapter
// by maintaining an in-memory mirror (appState) and performing remote writes asynchronously.
export class HydratingStore {
  constructor(asyncAdapter){
    this.remote = asyncAdapter;
    this.ready = false;
    this.retryQueue = [];
    this.nextStaffId = 1;
  // localId -> remoteId mapping (persisted in appState.meta if available)
  this.staffIdMap = (typeof appState.__staffIdMap === 'object' && appState.__staffIdMap) ? appState.__staffIdMap : {};
    this.readyPromise = this._hydrate();
    this._startRetryLoop();
  }

  async _hydrate(){
    try {
      if (this.remote.disabled){ this.ready = true; return; }
      // Staff hydration
      const preLocal = Array.isArray(appState.staffData) ? appState.staffData.slice() : [];
      let staff = await this.remote.listStaff();
      // Build reverse mapping if remote already contains rows we mapped earlier
      if (Array.isArray(staff) && staff.length){
        // Clean any local entries already migrated (remove temp duplicates by name or mapped id)
        if (preLocal.length){
          const remoteIds = new Set(staff.map(s=> String(s.id)));
          const seenNames = new Set();
          appState.staffData = preLocal.filter(s=>{
            if (this.staffIdMap[s.id] && remoteIds.has(String(this.staffIdMap[s.id]))) return false; // temp copy; remote authoritative
            if (remoteIds.has(String(s.id))) return true; // already remote id stored locally
            if (seenNames.has(s.name)) return false; // duplicate name leftover
            seenNames.add(s.name);
            return true;
          });
        }
      }
      // One-time bulk migration/backfill with id remap (server assigns ids). Flag in localStorage to avoid repeat.
      const remoteEmpty = Array.isArray(staff) && staff.length === 0;
      const remoteSubset = Array.isArray(staff) && staff.length > 0 && preLocal.length > staff.length && staff.length <= 1; // heuristic
      const alreadyMigrated = (typeof localStorage!=='undefined') && localStorage.getItem('ftg_staff_migrated') === '1';
      if (!alreadyMigrated && (remoteEmpty || remoteSubset) && preLocal.length > 0){
        console.info('[HydratingStore] Bulk migrating local staff -> Supabase (local:', preLocal.length, 'remote:', staff.length, ')');
        const nameToRemote = new Map((staff||[]).map(s=>[s.name,s]));
        const idMap = {}; // oldId -> newId
        for (const s of preLocal){
          try {
            // Skip if remote already has staff with same name; map old id to existing remote id
            if (nameToRemote.has(s.name)) { idMap[s.id] = nameToRemote.get(s.name).id; continue; }
            const created = await this.remote.createStaff({ name:s.name, role:s.role, contractHours:s.contractHours, typicalWorkdays:s.typicalWorkdays, weekendPreference:s.weekendPreference });
            if (created && created.id){ idMap[s.id] = created.id; }
          } catch(e){ console.warn('[HydratingStore] staff migrate failed', s.name, e); }
        }
        // Remap related local structures to new ids
        const remapId = (oldId)=> idMap[oldId] || oldId;
        // Staff list rebuild
  appState.staffData = preLocal.map(s=> ({ ...s, id: remapId(s.id) })); // provisional until refetch canonical rows
        // Vacations
        if (appState.vacationsByStaff){ const newVac={}; Object.entries(appState.vacationsByStaff).forEach(([oid,list])=>{ newVac[remapId(oid)] = list.map(v=>({ ...v })); }); appState.vacationsByStaff = newVac; }
        if (appState.illnessByStaff){ const newIll={}; Object.entries(appState.illnessByStaff).forEach(([oid,list])=>{ newIll[remapId(oid)] = list.map(v=>({ ...v })); }); appState.illnessByStaff = newIll; }
        if (appState.availabilityData){
          const newAvail = {};
          Object.entries(appState.availabilityData).forEach(([k,val])=>{
            if (k.startsWith('staff:')){
              // Day-off sentinel map uses key namespace 'staff:ID'
              const oid = k.split(':')[1];
              newAvail['staff:'+remapId(oid)] = val;
            } else {
              // Per-staff per-shift availability is keyed by numeric staffId; remap those too
              const isNumericId = /^\d+$/.test(String(k));
              if (isNumericId){
                const nk = String(remapId(k));
                newAvail[nk] = val;
              } else {
                // Preserve any other non-standard keys just in case
                newAvail[k] = val;
              }
            }
          });
          appState.availabilityData = newAvail;
        }
        if (appState.voluntaryEveningAvailability){ const newVol={}; Object.entries(appState.voluntaryEveningAvailability).forEach(([k,val])=>{ const parts = k.split('::'); const oid = parts[0]; parts[0] = String(remapId(oid)); newVol[parts.join('::')] = val; }); appState.voluntaryEveningAvailability = newVol; }
        if (appState.scheduleData){ Object.values(appState.scheduleData).forEach(monthObj=>{ if(!monthObj||!monthObj.data) return; Object.values(monthObj.data).forEach(dayObj=>{ if(!dayObj.assignments) return; Object.keys(dayObj.assignments).forEach(sh=>{ const oid = dayObj.assignments[sh]; dayObj.assignments[sh] = remapId(oid); }); }); }); }
        if (appState.vacationLedger){ Object.keys(appState.vacationLedger).forEach(yearKey=>{ if (/^_hydrated_/.test(yearKey)) return; const yearMap = appState.vacationLedger[yearKey]; if (yearMap){ const newYear={}; Object.entries(yearMap).forEach(([oid,entry])=>{ if (entry && typeof entry==='object' && !('_hydrated_' in entry)){ newYear[remapId(oid)] = { ...entry, staffId: remapId(oid) }; } }); appState.vacationLedger[yearKey] = newYear; } }); }
        try { if (typeof localStorage!=='undefined') localStorage.setItem('ftg_staff_migrated','1'); } catch {}
        staff = await this.remote.listStaff();
        // Replace with authoritative remote objects where names match (pick up server-side defaults, version, etc.)
        if (Array.isArray(staff) && staff.length){
          const byName = new Map(staff.map(r=>[r.name,r]));
          appState.staffData = appState.staffData.map(s=> byName.get(s.name) ? { ...s, ...byName.get(s.name) } : s);
        }
      }
  if (Array.isArray(staff)){
        // If after a backfill attempt the remote is still empty but we had local staff, keep the local list (avoid destructive wipe)
        if (staff.length === 0 && preLocal.length > 0){
          console.warn('[HydratingStore] Remote staff still empty after backfill attempt; preserving local staff list locally.');
          staff = preLocal;
        }
        appState.staffData = staff.slice();
        this.nextStaffId = (staff.reduce((m,s)=> Math.max(m, Number(s.id)||0),0) || 0) + 1;
      }
      // Schedule hydration - load all months that have data
      try {
        const scheduleMonths = await this.remote.listScheduleMonths();
        if (!appState.scheduleData) appState.scheduleData = {};
        for (const month of scheduleMonths) {
          const sched = await this.remote.getMonthSchedule(month);
          if (sched && typeof sched === 'object') {
            appState.scheduleData[month] = sched;
          }
        }
      } catch(e){ console.warn('[HydratingStore] schedule hydration failed', e); }
      // Overtime hydration
      try {
        const ot = await this.remote.listOvertimeRequests();
        appState.overtimeRequests = {};
        ot.forEach(r => {
          const m = r.month || r.dateStr?.substring(0,7) || (r.date&&r.date.substring(0,7));
          const dateStr = r.dateStr || r.date;
          if (!m || !dateStr) return;
          if (!appState.overtimeRequests[m]) appState.overtimeRequests[m] = {};
          if (!Array.isArray(appState.overtimeRequests[m][dateStr])) appState.overtimeRequests[m][dateStr] = [];
          appState.overtimeRequests[m][dateStr].push({ staffId: r.staffId, shiftKey: r.shiftKey, status: r.status, reason: r.reason, lastError: r.lastError, id: r.id });
        });
      } catch(e){ console.warn('[HydratingStore] overtime hydration failed', e); }
      // Absences hydration (vacations + illness from unified table via helper methods)
      try {
        if (typeof this.remote.listAllVacations === 'function'){
          const vacs = await this.remote.listAllVacations();
          appState.vacationsByStaff = {};
          vacs.forEach(v=>{ if(!appState.vacationsByStaff[v.staffId]) appState.vacationsByStaff[v.staffId]=[]; appState.vacationsByStaff[v.staffId].push({ id:v.id, start:v.start, end:v.end }); });
        }
      } catch(e){ console.warn('[HydratingStore] vacation hydration failed', e); }
      try {
        if (typeof this.remote.listAllIllness === 'function'){
          const ill = await this.remote.listAllIllness();
          appState.illnessByStaff = {};
          ill.forEach(v=>{ if(!appState.illnessByStaff[v.staffId]) appState.illnessByStaff[v.staffId]=[]; appState.illnessByStaff[v.staffId].push({ id:v.id, start:v.start, end:v.end }); });
        }
      } catch(e){ console.warn('[HydratingStore] illness hydration failed', e); }
      appState.save?.();
    } catch (e){
      console.warn('[HydratingStore] hydration failed', e);
    } finally {
      this.ready = true;
      try { window.__services?.events?.emit('staff:hydrated'); } catch {}
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
    const input = { ...data }; // clone to avoid mutation reuse
    // Idempotency: if a temp local record with same normalized signature exists and already mapped, reuse
    const signature = (s)=> `${(s.name||'').trim().toLowerCase()}|${s.role||''}|${s.contractHours||''}|${s.typicalWorkdays||''}`;
    const existingRemote = appState.staffData.find(s=> signature(s) === signature(input) && this.staffIdMap[s.id]);
    if (existingRemote){
      return existingRemote; // already created & mapped
    }
    const id = this.nextStaffId++;
    const rec = { id, ...input };
    appState.staffData.push(rec); appState.save?.();
    if (!this.remote.disabled){
      const payload = { name: rec.name, role: rec.role, contractHours: rec.contractHours, typicalWorkdays: rec.typicalWorkdays, weekendPreference: rec.weekendPreference };
      const attemptCreate = async () => {
        try {
          // Before creating, attempt to find existing remote by exact name+role (most stable unique business key here)
          let created = null;
          try {
            const possible = await this.remote.listStaff();
            created = possible.find(r=> r.name === rec.name && r.role === rec.role && (rec.contractHours==null || r.contractHours===rec.contractHours));
          } catch {}
          if (!created){
            created = await this.remote.createStaff(payload);
          }
          if (created && created.id){
            const oldId = rec.id;
            // Map and replace temp record with canonical remote row (avoid duplicate lingering entry)
            this.staffIdMap[oldId] = created.id;
            appState.__staffIdMap = this.staffIdMap; // persist in appState container
            // Replace in staffData: remove any existing entry with same remote id or same name (prevent duplicates)
            const canonical = { id: created.id, name: created.name, role: created.role, contractHours: created.contractHours, typicalWorkdays: created.typicalWorkdays, weekendPreference: created.weekendPreference, version: created.version };
            const filtered = [];
            const seen = new Set();
            for (const s of appState.staffData){
              if (s.id === oldId){ continue; }
              if (String(s.id) === String(created.id)) continue;
              if (s.name === canonical.name && !seen.has(canonical.name)) { continue; }
              filtered.push(s); seen.add(s.name);
            }
            filtered.push(canonical);
            appState.staffData = filtered.sort((a,b)=> String(a.name).localeCompare(String(b.name)));
            // Side-effect remap of structures if id changed
            if (oldId !== created.id){
              try {
                if (appState.vacationsByStaff?.[oldId]){ appState.vacationsByStaff[created.id] = appState.vacationsByStaff[oldId]; delete appState.vacationsByStaff[oldId]; }
                if (appState.illnessByStaff?.[oldId]){ appState.illnessByStaff[created.id] = appState.illnessByStaff[oldId]; delete appState.illnessByStaff[oldId]; }
                if (appState.availabilityData){
                  Object.keys(appState.availabilityData).forEach(k=>{
                    // Remap day-off sentinel namespace
                    if (k===`staff:${oldId}`){
                      appState.availabilityData[`staff:${created.id}`] = appState.availabilityData[k];
                      delete appState.availabilityData[k];
                    }
                    // Remap per-staff numeric availability buckets
                    if (String(k)===String(oldId)){
                      appState.availabilityData[created.id] = appState.availabilityData[k];
                      delete appState.availabilityData[k];
                    }
                  });
                }
                if (appState.voluntaryEveningAvailability){ Object.keys(appState.voluntaryEveningAvailability).forEach(k=>{ if (k.startsWith(oldId+"::")){ const suffix=k.substring(String(oldId).length); appState.voluntaryEveningAvailability[created.id+suffix]=appState.voluntaryEveningAvailability[k]; delete appState.voluntaryEveningAvailability[k]; } }); }
                if (appState.scheduleData){ Object.values(appState.scheduleData).forEach(monthObj=>{ if (!monthObj||!monthObj.data) return; Object.values(monthObj.data).forEach(dayObj=>{ if (!dayObj?.assignments) return; Object.keys(dayObj.assignments).forEach(shiftKey=>{ if (dayObj.assignments[shiftKey]===oldId) dayObj.assignments[shiftKey]=created.id; }); }); }); }
              } catch(err){ console.warn('[HydratingStore] staff id remap side-effects failed', err); }
            }
            appState.save?.();
            try { window.__services?.events?.emit('staff:created', { id: created.id }); } catch {}
            // Post-create canonical refresh to ensure no duplicates remain
            try {
              const fresh = await this.remote.listStaff();
              if (Array.isArray(fresh) && fresh.length){
                const byId = new Map(fresh.map(r=>[String(r.id), r]));
                appState.staffData = Array.from(byId.values()).map(r=>({ id:r.id, name:r.name, role:r.role, contractHours:r.contractHours, typicalWorkdays:r.typicalWorkdays, weekendPreference:r.weekendPreference, version:r.version }))
                  .sort((a,b)=> String(a.name).localeCompare(String(b.name)));
                appState.save?.();
                try { window.__services?.events?.emit('staff:hydrated'); } catch {}
              }
            } catch(refreshErr){ console.warn('[HydratingStore] post-create refresh failed', refreshErr); }
          }
        } catch(e){
          console.warn('remote createStaff immediate attempt failed; queuing retry', e);
          // Fallback to retry queue
          this._enqueue('createStaffRetry', attemptCreate);
        }
      };
      // Fire immediate attempt (don't wait for retry loop)
      attemptCreate();
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
  getMonthSchedule(month){ return appState.scheduleData?.[month] || {}; }
  setMonthSchedule(month, data){
    appState.scheduleData[month] = data;
    appState.save?.();
    if (!this.remote.disabled) {
      this._enqueue('setMonthSchedule', async () => {
        try {
          await this.remote.setMonthSchedule(month, data);
        } catch (error) {
          console.error('[HydratingStore] Backend save failed for month:', month, error);
          // Re-throw to be caught by the caller
          throw error;
        }
      });
    }
    return true;
  }
  clearMonthSchedule(month){
    if (appState.scheduleData[month]) {
      delete appState.scheduleData[month];
      appState.save?.();
    }
    if (!this.remote.disabled) {
      this._enqueue('clearMonthSchedule', async () => {
        try {
          await this.remote.clearMonthSchedule(month);
        } catch (error) {
          console.error('[HydratingStore] Backend clear failed for month:', month, error);
        }
      });
    }
    return true;
  }
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
  availabilityUpsert(staffId, dateStr, shiftKey, status){
    // Maintain local mirror synchronously
    if (!appState.availabilityData) appState.availabilityData = {};
    if (!appState.availabilityData[staffId]) appState.availabilityData[staffId] = {};
    if (!appState.availabilityData[staffId][dateStr]) appState.availabilityData[staffId][dateStr] = {};
    if (!status){
      delete appState.availabilityData[staffId][dateStr][shiftKey];
      if (Object.keys(appState.availabilityData[staffId][dateStr]).length===0) delete appState.availabilityData[staffId][dateStr];
      if (Object.keys(appState.availabilityData[staffId]).length===0) delete appState.availabilityData[staffId];
    } else {
      appState.availabilityData[staffId][dateStr][shiftKey] = status;
    }
    appState.save?.();
    // Queue remote write if applicable
    if (!this.remote.disabled){
      this._enqueue('availabilityUpsert', async ()=> { await this.remote.availabilityUpsert(staffId, dateStr, shiftKey, status); });
    }
    return true;
  }
  availabilitySetDayOff(staffId, dateStr, isOff){
    const key = `staff:${staffId}`;
    if (!appState.availabilityData[key]) appState.availabilityData[key] = {};
    if (isOff) appState.availabilityData[key][dateStr] = 'off'; else delete appState.availabilityData[key][dateStr];
    appState.save?.();
    if (!this.remote.disabled){ this._enqueue('availabilitySetDayOff', async ()=> { await this.remote.availabilitySetDayOff(staffId, dateStr, isOff); }); }
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
    appState.save?.();
    if (!this.remote.disabled){ this._enqueue('availabilitySetVoluntary', async ()=> { await this.remote.availabilitySetVoluntary(staffId, dateStr, kind, checked); }); }
    return true;
  }
  availabilityIsVoluntary(staffId, dateStr, kind){
    const k = `${staffId}::${dateStr}::${kind}`;
    const legacy = `${staffId}::${dateStr}`; // migrate support
    return !!(appState.voluntaryEveningAvailability?.[k] || appState.voluntaryEveningAvailability?.[legacy]);
  }
  async availabilityListForRange(staffId, fromDate, toDate){
    // If remote disabled use local only
    if (this.remote.disabled){
      const out = {}; const data = appState.availabilityData?.[staffId] || {}; const from = new Date(fromDate); const to = new Date(toDate);
      Object.keys(data).forEach(d=>{ const dt = new Date(d); if (dt>=from && dt<=to) out[d] = data[d]; });
      return out;
    }
    // Return snapshot after attempting immediate remote fetch/merge (so callers awaiting this get hydrated data)
    const mergeFresh = (fresh)=>{
      if (!fresh) return;
      if (!appState.availabilityData[staffId]) appState.availabilityData[staffId] = {};
      Object.entries(fresh||{}).forEach(([d,val])=>{
        if (!appState.availabilityData[staffId][d]) appState.availabilityData[staffId][d] = {};
        // Merge shift statuses (exclude meta keys starting with _)
        Object.entries(val).forEach(([k,v])=>{
          if (k.startsWith('_')) return;
          if (v) appState.availabilityData[staffId][d][k] = v; else delete appState.availabilityData[staffId][d][k];
        });
        if (val._dayOff){
          if (!appState.availabilityData[`staff:${staffId}`]) appState.availabilityData[`staff:${staffId}`] = {};
          appState.availabilityData[`staff:${staffId}`][d] = 'off';
        }
        if (val._voluntary){
          Object.entries(val._voluntary).forEach(([kind,flag])=>{
            if (flag){ if (!appState.voluntaryEveningAvailability) appState.voluntaryEveningAvailability = {}; appState.voluntaryEveningAvailability[`${staffId}::${d}::${kind}`] = true; }
          });
        }
      });
      appState.save?.();
    };
    try {
      const fresh = await this.remote.availabilityListForRange(staffId, fromDate, toDate);
      mergeFresh(fresh);
    } catch(e){
      console.warn('[HydratingStore] availability range fetch failed (will retry in background)', e);
      // Best-effort: enqueue background retry
      this._enqueue('availabilityListForRangeFetch', async ()=>{
        try { const f = await this.remote.availabilityListForRange(staffId, fromDate, toDate); mergeFresh(f); }
        catch(err){ console.warn('[HydratingStore] availability retry failed', err); }
      });
    }
    // Return current snapshot in requested range after merge
    const out = {}; const from = new Date(fromDate); const to = new Date(toDate);
    const data = appState.availabilityData?.[staffId] || {};
    Object.keys(data).forEach(d=>{ const dt = new Date(d); if (dt>=from && dt<=to) out[d] = data[d]; });
    return out;
  }
  listVacations(staffId){ return appState.vacationsByStaff?.[staffId] || []; }
  addVacation(staffId, period){
    if (!appState.vacationsByStaff[staffId]) appState.vacationsByStaff[staffId] = [];
    const rec = { id: period.id || `v-${Date.now()}-${Math.random().toString(36).slice(2)}`, start:period.start, end:period.end };
    appState.vacationsByStaff[staffId].push(rec); appState.save?.();
    if (!this.remote.disabled){ this._enqueue('addVacation', async ()=> { await this.remote.addVacation(staffId, period); }); }
    return rec;
  }
  removeVacation(staffId, idx){
    const list = appState.vacationsByStaff?.[staffId]; if (!Array.isArray(list) || idx<0 || idx>=list.length) return false;
    const [removed] = list.splice(idx,1); appState.save?.();
    const recordId = removed?.id || removed?.meta?.id;
    if (recordId && !this.remote.disabled){ this._enqueue('removeVacation', async ()=> { await this.remote.removeVacation(recordId); }); }
    return true;
  }
  listIllness(staffId){ return appState.illnessByStaff?.[staffId] || []; }
  addIllness(staffId, period){
    if (!appState.illnessByStaff[staffId]) appState.illnessByStaff[staffId] = [];
    const rec = { id: period.id || `i-${Date.now()}-${Math.random().toString(36).slice(2)}`, start:period.start, end:period.end };
    appState.illnessByStaff[staffId].push(rec); appState.save?.();
    if (!this.remote.disabled){ this._enqueue('addIllness', async ()=> { await this.remote.addIllness(staffId, period); }); }
    return rec;
  }
  // ---- Vacation Ledger ----
  getVacationLedgerYear(year){
    if (!appState.vacationLedger[year]) appState.vacationLedger[year] = {};
    // Lazy hydrate once per year (marker _hydrated)
    const markKey = `_hydrated_${year}`;
    if (!appState.vacationLedger[markKey] && !this.remote.disabled){
      appState.vacationLedger[markKey] = true;
      this._enqueue(`hydrateVacationLedger:${year}`, async ()=>{
        try {
          if (typeof this.remote.getVacationLedgerYear==='function'){
            const rows = await this.remote.getVacationLedgerYear(year);
            rows.forEach(r=>{ appState.vacationLedger[year][r.staffId] = { allowance:r.allowance, takenManual:r.takenManual, carryPrev:r.carryPrev, meta:r.meta||{}, version:r.version, id:r.id }; });
            appState.save?.();
          }
        } catch(e){ console.warn('[HydratingStore] ledger hydration failed', e); }
      });
    }
    return appState.vacationLedger[year];
  }
  upsertVacationLedgerEntry(year, staffId, patch){
    if (!appState.vacationLedger[year]) appState.vacationLedger[year] = {};
    const cur = appState.vacationLedger[year][staffId] || { staffId, year, version:0 };
    const next = { ...cur, ...patch };
    appState.vacationLedger[year][staffId] = next; appState.save?.();
    if (!this.remote.disabled){
      this._enqueue('upsertVacationLedgerEntry', async ()=> {
        try {
          const result = await this.remote.upsertVacationLedgerEntry(year, staffId, { ...patch, version: cur.version });
          if (result){
            appState.vacationLedger[year][staffId] = { allowance: result.allowance, takenManual: result.takenManual, carryPrev: result.carryPrev, meta: result.meta||{}, version: result.version, id: result.id, staffId: result.staffId, year: result.year };
            appState.save?.();
          }
        } catch(e){
          // Conflict path: refetch then reapply once
            const isConflict = /409|version/i.test(String(e.message));
            if (isConflict){
              try {
                const refreshed = await this.remote.getVacationLedgerYear(year);
                refreshed.forEach(r=>{ appState.vacationLedger[year][r.staffId] = { allowance:r.allowance, takenManual:r.takenManual, carryPrev:r.carryPrev, meta:r.meta||{}, version:r.version, id:r.id, staffId:r.staffId, year:r.year }; });
                const updatedCur = appState.vacationLedger[year][staffId] || { staffId, year };
                const reapplied = { ...updatedCur, ...patch };
                appState.vacationLedger[year][staffId] = reapplied; appState.save?.();
                try {
                  const final = await this.remote.upsertVacationLedgerEntry(year, staffId, { ...patch, version: updatedCur.version });
                  if (final){ appState.vacationLedger[year][staffId] = { allowance: final.allowance, takenManual: final.takenManual, carryPrev: final.carryPrev, meta: final.meta||{}, version: final.version, id: final.id, staffId: final.staffId, year: final.year }; appState.save?.(); }
                } catch(second){ console.warn('[HydratingStore] ledger conflict second attempt failed', second); }
                try { window.__services?.events?.emit('ledgerConflict', { year, staffId, action:'resolved-after-retry' }); } catch {}
              } catch(refreshErr){ console.warn('[HydratingStore] ledger conflict refresh failed', refreshErr); }
              try { window.__services?.events?.emit('ledgerConflict', { year, staffId, action:'conflict', message:'Ledger changed remotely. Reload latest or retry.' }); } catch {}
            } else {
              console.warn('[HydratingStore] ledger upsert error', e);
            }
        }
      });
    }
    return next;
  }
  removeIllness(staffId, idx){
    const list = appState.illnessByStaff?.[staffId]; if (!Array.isArray(list) || idx<0 || idx>=list.length) return false;
    const [removed] = list.splice(idx,1); appState.save?.();
    const recordId = removed?.id || removed?.meta?.id;
    if (recordId && !this.remote.disabled){ this._enqueue('removeIllness', async ()=> { await this.remote.removeIllness(recordId); }); }
    return true;
  }
  listOvertimeRequests(){ return Object.values(appState.overtimeRequests||{}).flatMap(m=> Object.values(m||{}).flat()); }
  createOvertimeRequest(month, dateStr, req){
    if (!appState.overtimeRequests[month]) appState.overtimeRequests[month] = {};
    if (!Array.isArray(appState.overtimeRequests[month][dateStr])) appState.overtimeRequests[month][dateStr] = [];
    const rec = { id: req.id || `${dateStr}:${req.staffId}:${req.shiftKey}:${Date.now()}`, status: req.status||'requested', ...req };
    appState.overtimeRequests[month][dateStr].push(rec); appState.save?.();
    if (!this.remote.disabled){ this._enqueue('createOvertimeRequest', async ()=> { await this.remote.createOvertimeRequest(month, dateStr, req); }); }
    return rec;
  }
  updateOvertimeRequest(month, dateStr, predicate, patch){
    const list = appState.overtimeRequests?.[month]?.[dateStr]; if (!Array.isArray(list)) return false;
    list.forEach(r=>{ if (predicate(r)) Object.assign(r, patch); }); appState.save?.();
    if (!this.remote.disabled){ this._enqueue('updateOvertimeRequest', async ()=> { await this.remote.updateOvertimeRequest(month, dateStr, predicate, patch); }); }
    return true;
  }
  transitionOvertimeRequest(id, newStatus, extra={}){
    let found=null;
    Object.entries(appState.overtimeRequests||{}).forEach(([m,dates])=>{
      Object.entries(dates||{}).forEach(([d,list])=>{
        list.forEach(r=>{ if(!found && (r.id===id || (!r.id && `${d}:${r.staffId}:${r.shiftKey}`===id))){ r.status=newStatus; if (extra.lastError) r.lastError=extra.lastError; found={...r, month:m, dateStr:d}; }});
      });
    });
    appState.save?.();
    if(found && !this.remote.disabled){ this._enqueue('transitionOvertimeRequest', async ()=> { await this.remote.transitionOvertimeRequest(found.id, newStatus, extra); }); }
    return found;
  }
  setOvertimeConsent(staffId, dateStr, value=true){
    const year = String(new Date(dateStr).getFullYear());
    if (!appState.permanentOvertimeConsent) appState.permanentOvertimeConsent = {};
    if (!appState.permanentOvertimeConsent[staffId]) appState.permanentOvertimeConsent[staffId] = {};
    if (!appState.permanentOvertimeConsent[staffId][year]) appState.permanentOvertimeConsent[staffId][year] = {};
    if (value) appState.permanentOvertimeConsent[staffId][year][dateStr] = true; else delete appState.permanentOvertimeConsent[staffId][year][dateStr];
    appState.save?.();
    if (!this.remote.disabled){ this._enqueue('setOvertimeConsent', async ()=> { await this.remote.setOvertimeConsent(staffId, dateStr, value); }); }
    return true;
  }
  hasOvertimeConsent(staffId, dateStr){
    const year = String(new Date(dateStr).getFullYear());
    return !!appState.permanentOvertimeConsent?.[staffId]?.[year]?.[dateStr];
  }
  auditList(){ return Array.isArray(appState.auditLog)? appState.auditLog : []; }
  auditLog(message, meta){
    if (!Array.isArray(appState.auditLog)) appState.auditLog = [];
    appState.auditLog.push({ timestamp: Date.now(), message, meta });
    appState.save?.();
    if (!this.remote.disabled){ this._enqueue('auditLog', async ()=> { await this.remote.auditLog(message, meta); }); }
  }
}
