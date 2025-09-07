// Minimal Supabase adapter implementing subset of LocalStorageAdapter (staff + schedule)
// Requires window.__CONFIG__ with SUPABASE_URL, SUPABASE_ANON_KEY
// Uses optimistic concurrency via a 'version' column on rows.

let __SUPABASE_MISSING_WARNED = false;
export class SupabaseAdapter {
  constructor(){
    const cfg = (typeof window!=='undefined'? window.__CONFIG__ : global.__CONFIG__) || {};
    this.url = cfg.SUPABASE_URL;
    this.key = cfg.SUPABASE_ANON_KEY;
    if (!this.url || !this.key){
      this.disabled = true;
      if (!__SUPABASE_MISSING_WARNED){
        console.warn('[SupabaseAdapter] Missing keys – falling back to local. Provide SUPABASE_URL & SUPABASE_ANON_KEY in config.local.js');
        __SUPABASE_MISSING_WARNED = true;
      }
    }
  // Track staff columns (camelCase) we attempt to persist (id excluded on create; server assigns identity)
  this._staffColumns = new Set(['name','role','contractHours','typicalWorkdays','weekendPreference']);
  }

  async _rpc(path, options={}){
    if (this.disabled) throw new Error('Supabase disabled');
    const res = await fetch(`${this.url}/rest/v1/${path}`, {
      ...options,
      headers: {
        apikey: this.key,
        Authorization: `Bearer ${this.key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
        ...(options.headers||{})
      }
    });
    if (!res.ok){
      const txt = await res.text();
      const table = String(path).split('?')[0];
      const permHint = (res.status===401 || res.status===403 || /permission denied|row level security|policy/i.test(txt));
      if (permHint){
        const msg = `Supabase RLS blocked this operation. Verify RLS policies for table ${table} allow anon in dev.`;
        console.error(msg, { status: res.status, detail: txt });
        try {
          if (typeof window !== 'undefined' && window.CONFIG?.BACKEND==='supabase'){
            if (!document.getElementById('rlsNotice')){
              const div = document.createElement('div');
              div.id = 'rlsNotice';
              div.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:2000;background:#ffc107;color:#222;padding:6px 10px;font:14px system-ui;box-shadow:0 2px 4px rgba(0,0,0,.2);';
              div.textContent = msg;
              document.body.appendChild(div);
              setTimeout(()=>{ div.style.transition='opacity .6s'; div.style.opacity='0'; setTimeout(()=>div.remove(),4000); }, 6000);
            }
          }
        } catch {}
      }
      throw new Error(`Supabase error ${res.status}: ${txt}`);
    }
    return res.json();
  }

  // ---- Staff (table: staff) dynamic columns (id, name, role, version plus optional workload prefs)
  async listStaff(){
    if (this.disabled) return [];
    const rows = await this._rpc('staff?select=*');
    return rows.map(r=>{
      // Detect snake_case variants and map to camelCase
      if ('contract_hours' in r && !('contractHours' in r)) r.contractHours = r.contract_hours;
      if ('typical_workdays' in r && !('typicalWorkdays' in r)) r.typicalWorkdays = r.typical_workdays;
      if ('weekend_preference' in r && !('weekendPreference' in r)) r.weekendPreference = r.weekend_preference;
      // Feed discovered camelCase columns back into whitelist so future writes include them (if we didn't previously prune)
      ['contractHours','typicalWorkdays','weekendPreference'].forEach(k=>{ if (r[k] !== undefined) this._staffColumns.add(k); });
      return {
        id: r.id,
        name: r.name,
        role: r.role,
        contractHours: r.contractHours,
        typicalWorkdays: r.typicalWorkdays,
        weekendPreference: r.weekendPreference,
        version: r.version
      };
    });
  }
  async createStaff(data){
    if (this.disabled) return null;
    // Shape: map camelCase -> snake_case; omit id so server assigns identity
    const shaped = {};
    if (data.name != null) shaped.name = data.name;
    if (data.role != null) shaped.role = data.role;
    if (data.contractHours != null) shaped.contract_hours = data.contractHours;
    if (data.typicalWorkdays != null) shaped.typical_workdays = data.typicalWorkdays;
    if (data.weekendPreference != null) shaped.weekend_preference = data.weekendPreference;
    try {
      const recs = await this._rpc('staff', { method:'POST', body: JSON.stringify([{ ...shaped, version:1 }]) });
      const r = recs[0];
      return { id:r.id, name:r.name, role:r.role, contractHours:r.contract_hours, typicalWorkdays:r.typical_workdays, weekendPreference:r.weekend_preference, version:r.version };
    } catch(e){
      const msg = String(e.message||'');
      const isConflict = /409|duplicate key/i.test(msg);
      if (isConflict && data.name){
        try {
          const existing = await this._rpc(`staff?name=eq.${encodeURIComponent(data.name)}&select=*`);
          const r = existing[0]; if (r){
            return { id:r.id, name:r.name, role:r.role, contractHours:r.contract_hours, typicalWorkdays:r.typical_workdays, weekendPreference:r.weekend_preference, version:r.version };
          }
        } catch {}
      }
      throw e;
    }
  }
  async updateStaff(id, patch){
    if (this.disabled) return null;
    // Fetch current version
    const cur = (await this._rpc(`staff?id=eq.${id}&select=id,version`))[0];
    if (!cur) return null;
    const nextVer = (cur.version||0)+1;
    // Map camelCase patch keys to snake_case
    const body = { version: nextVer };
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.role !== undefined) body.role = patch.role;
    if (patch.contractHours !== undefined) body.contract_hours = patch.contractHours;
    if (patch.typicalWorkdays !== undefined) body.typical_workdays = patch.typicalWorkdays;
    if (patch.weekendPreference !== undefined) body.weekend_preference = patch.weekendPreference;
    const recs = await this._rpc(`staff?id=eq.${id}&version=eq.${cur.version}`, { method:'PATCH', body: JSON.stringify(body) });
    const r = recs[0];
    return { id:r.id, name:r.name, role:r.role, contractHours:r.contract_hours, typicalWorkdays:r.typical_workdays, weekendPreference:r.weekend_preference, version:r.version };
  }
  async deleteStaff(id){ if (this.disabled) return false; await this._rpc(`staff?id=eq.${id}`, { method:'DELETE' }); return true; }

  // ---- Schedule (table: schedule_days) structure: month (text), date (date), assignments (jsonb), version (int8) PK: (date)
  async getMonthSchedule(month){
    if (this.disabled) return {};
    const rows = await this._rpc(`schedule_days?month=eq.${month}&select=date,assignments,version`);
    const out = {};
    rows.forEach(r=>{ out[r.date] = { assignments: r.assignments||{} }; });
    return out;
  }
  async assign(dateStr, shiftKey, staffId){
    if (this.disabled) return false;
    // Upsert pattern: fetch row, modify assignments, optimistic update
    const month = dateStr.substring(0,7);
    const existing = (await this._rpc(`schedule_days?date=eq.${dateStr}&select=date,assignments,version`))[0];
    if (!existing){
      const recs = await this._rpc('schedule_days', { method:'POST', body: JSON.stringify([{ date: dateStr, month, assignments: { [shiftKey]: staffId }, version:1 }]) });
      return !!recs[0];
    }
    const nextVer = (existing.version||0)+1;
    const assignments = { ...(existing.assignments||{}), [shiftKey]: staffId };
    const recs = await this._rpc(`schedule_days?date=eq.${dateStr}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ assignments, version: nextVer }) });
    return !!recs[0];
  }
  async unassign(dateStr, shiftKey){
    if (this.disabled) return false;
    const existing = (await this._rpc(`schedule_days?date=eq.${dateStr}&select=date,assignments,version`))[0];
    if (!existing) return false;
    const nextVer = (existing.version||0)+1;
    const assignments = { ...(existing.assignments||{}) };
    delete assignments[shiftKey];
    const recs = await this._rpc(`schedule_days?date=eq.${dateStr}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ assignments, version: nextVer }) });
    return !!recs[0];
  }

  // ---- Availability (row-per-shift schema) columns: id, staff_id, date, shift_key, status('no'|'prefer'|'yes'), note, version
  // Sentinel rows: shift_key='__day_off__' indicates full day off; shift_key='vol:evening' / 'vol:closing' for voluntary flags.
  async availabilityUpsert(staffId, dateStr, shiftKey, status){
    if (this.disabled) return true;
    if (!shiftKey) return true;
    const q = `availability?staff_id=eq.${staffId}&date=eq.${dateStr}&shift_key=eq.${shiftKey}&select=id,version`;
    const existing = (await this._rpc(q))[0];
    if (!status){
      if (existing){ await this._rpc(`availability?id=eq.${existing.id}`, { method:'DELETE' }); }
      return true;
    }
    if (!existing){
      await this._rpc('availability', { method:'POST', body: JSON.stringify([{ staff_id:staffId, date:dateStr, shift_key:shiftKey, status, version:1 }]) });
      return true;
    }
    const nextVer = (existing.version||0)+1;
    await this._rpc(`availability?id=eq.${existing.id}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ status, version: nextVer }) });
    return true;
  }
  async availabilitySetDayOff(staffId, dateStr, isOff){
    if (this.disabled) return true;
    const shiftKey='__day_off__';
    const existing = (await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&shift_key=eq.${shiftKey}&select=id,version`))[0];
    if (isOff){
      if (!existing){ await this._rpc('availability', { method:'POST', body: JSON.stringify([{ staff_id:staffId, date:dateStr, shift_key:shiftKey, status:'yes', version:1 }]) }); }
      else {
        const nextVer=(existing.version||0)+1;
        await this._rpc(`availability?id=eq.${existing.id}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ status:'yes', version: nextVer }) });
      }
    } else if (existing){ await this._rpc(`availability?id=eq.${existing.id}`, { method:'DELETE' }); }
    return true;
  }
  async availabilityIsDayOff(staffId, dateStr){
    if (this.disabled) return false;
    const rows = await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&shift_key=eq.__day_off__&select=id`);
    return rows.length>0;
  }
  async availabilitySetVoluntary(staffId, dateStr, kind, checked){
    if (this.disabled) return true;
    if (!['evening','closing'].includes(kind)) return false;
    const shiftKey = `vol:${kind}`;
    const existing = (await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&shift_key=eq.${shiftKey}&select=id,version`))[0];
    if (checked){
      if (!existing){ await this._rpc('availability', { method:'POST', body: JSON.stringify([{ staff_id:staffId, date:dateStr, shift_key:shiftKey, status:'yes', version:1 }]) }); }
      else { const nextVer=(existing.version||0)+1; await this._rpc(`availability?id=eq.${existing.id}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ status:'yes', version: nextVer }) }); }
    } else if (existing){ await this._rpc(`availability?id=eq.${existing.id}`, { method:'DELETE' }); }
    return true;
  }
  async availabilityIsVoluntary(staffId, dateStr, kind){
    if (this.disabled) return false;
    const shiftKey = `vol:${kind}`;
    const rows = await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&shift_key=eq.${shiftKey}&select=id`);
    return rows.length>0;
  }
  async availabilityListForRange(staffId, fromDate, toDate){
    if (this.disabled) return {};
    const rows = await this._rpc(`availability?staff_id=eq.${staffId}&date=gte.${fromDate}&date=lte.${toDate}&select=date,shift_key,status`);
    const out = {};
    rows.forEach(r=>{
      if (!out[r.date]) out[r.date] = {};
      if (r.shift_key==='__day_off__'){ out[r.date]._dayOff = true; }
      else if (r.shift_key.startsWith('vol:')){ const kind=r.shift_key.split(':')[1]; if(!out[r.date]._voluntary) out[r.date]._voluntary={}; out[r.date]._voluntary[kind]=true; }
      else { out[r.date][r.shift_key] = r.status; }
    });
    return out;
  }

  // ---- Vacation Ledger (table: vacation_ledger) columns: id (identity), staff_id, year (int4), allowance (int4), taken_manual (int4), carry_prev (int4), meta (jsonb), version
  async getVacationLedgerYear(year){
    if (this.disabled) return [];
    const rows = await this._rpc(`vacation_ledger?year=eq.${year}&select=*`);
    return rows.map(r=>({ id:r.id, staffId:r.staff_id, year:r.year, allowance:r.allowance, takenManual:r.taken_manual, carryPrev:r.carry_prev, meta:r.meta||{}, version:r.version }));
  }
  async upsertVacationLedgerEntry(year, staffId, patch){
    if (this.disabled) return { staffId, year, ...patch };
    // Try to fetch existing
    const existing = (await this._rpc(`vacation_ledger?year=eq.${year}&staff_id=eq.${staffId}&select=*`))[0];
    if (!existing){
      const body = [{ staff_id: staffId, year, allowance: patch.allowance||0, taken_manual: patch.takenManual||0, carry_prev: patch.carryPrev||0, meta: patch.meta||{}, version:1 }];
      const recs = await this._rpc('vacation_ledger', { method:'POST', body: JSON.stringify(body) });
      const r = recs[0];
      return { id:r.id, staffId:r.staff_id, year:r.year, allowance:r.allowance, takenManual:r.taken_manual, carryPrev:r.carry_prev, meta:r.meta||{}, version:r.version };
    }
  // If caller provided expected version enforce it; else use existing.version
  const expectedVersion = (typeof patch.version==='number') ? patch.version : existing.version;
  const nextVer = (expectedVersion||0)+1;
  const recs = await this._rpc(`vacation_ledger?id=eq.${existing.id}&version=eq.${expectedVersion}`, { method:'PATCH', body: JSON.stringify({ allowance: patch.allowance ?? existing.allowance, taken_manual: patch.takenManual ?? existing.taken_manual, carry_prev: patch.carryPrev ?? existing.carry_prev, meta: patch.meta ?? existing.meta, version: nextVer }) });
  if (!recs[0]) throw new Error('Conflict: ledger version changed');
  const r = recs[0];
  return { id:r.id, staffId:r.staff_id, year:r.year, allowance:r.allowance, takenManual:r.taken_manual, carryPrev:r.carry_prev, meta:r.meta||{}, version:r.version };
  }

  // ---- Absences unified (table: absences) vacation / illness via type column
  async listVacations(staffId){ if (this.disabled) return []; const rows = await this._rpc(`absences?staff_id=eq.${staffId}&type=eq.vacation&select=*`); return rows.map(r=>({ id:r.id, staffId:r.staff_id, start:r.start_date, end:r.end_date })); }
  async listIllness(staffId){ if (this.disabled) return []; const rows = await this._rpc(`absences?staff_id=eq.${staffId}&type=eq.illness&select=*`); return rows.map(r=>({ id:r.id, staffId:r.staff_id, start:r.start_date, end:r.end_date })); }
  async listAllVacations(){ if (this.disabled) return []; const rows = await this._rpc('absences?type=eq.vacation&select=*'); return rows.map(r=>({ id:r.id, staffId:r.staff_id, start:r.start_date, end:r.end_date })); }
  async listAllIllness(){ if (this.disabled) return []; const rows = await this._rpc('absences?type=eq.illness&select=*'); return rows.map(r=>({ id:r.id, staffId:r.staff_id, start:r.start_date, end:r.end_date })); }
  async addVacation(staffId, period){ if (this.disabled) return { id:`temp-${Date.now()}`, staffId, start:period.start, end:period.end }; const recs = await this._rpc('absences', { method:'POST', body: JSON.stringify([{ staff_id:staffId, start_date:period.start, end_date:period.end, type:'vacation', version:1 }]) }); const r = recs[0]; return { id:r.id, staffId:r.staff_id, start:r.start_date, end:r.end_date }; }
  async addIllness(staffId, period){ if (this.disabled) return { id:`temp-${Date.now()}`, staffId, start:period.start, end:period.end }; const recs = await this._rpc('absences', { method:'POST', body: JSON.stringify([{ staff_id:staffId, start_date:period.start, end_date:period.end, type:'illness', version:1 }]) }); const r = recs[0]; return { id:r.id, staffId:r.staff_id, start:r.start_date, end:r.end_date }; }
  async removeVacation(id){ if (this.disabled) return true; await this._rpc(`absences?id=eq.${id}`, { method:'DELETE' }); return true; }
  async removeIllness(id){ if (this.disabled) return true; await this._rpc(`absences?id=eq.${id}`, { method:'DELETE' }); return true; }

  // Overtime placeholders
  listOvertimeRequests(){ return []; }
  createOvertimeRequest(){ throw new Error('Not implemented'); }
  updateOvertimeRequest(){ throw new Error('Not implemented'); }
  transitionOvertimeRequest(){ throw new Error('Not implemented'); }
  setOvertimeConsent(){ throw new Error('Not implemented'); }
  hasOvertimeConsent(){ return false; }

  // Audit (local only for now)
  auditList(){ return []; }
  auditLog(){ /* no-op */ }

  // ---- Overtime Requests (tables: overtime_requests, overtime_consents) ----
  async listOvertimeRequests(){
    if (this.disabled) return [];
    const rows = await this._rpc('overtime_requests?select=*');
    return rows.map(r=>({
      id: r.id,
      staffId: r.staff_id,
      shiftKey: r.shift_key,
      status: r.status,
      reason: r.reason,
      lastError: r.last_error,
      dateStr: r.date,
      month: r.month,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
  }
  async createOvertimeRequest(month, dateStr, req){
    if (this.disabled) return { ...req, dateStr, month };
    if (!month) month = dateStr.substring(0,7);
    const recs = await this._rpc('overtime_requests', { method:'POST', body: JSON.stringify([{ month, date: dateStr, staff_id: req.staffId, shift_key: req.shiftKey, status: req.status||'requested', reason: req.reason||null, last_error: req.lastError||null, version:1 }]) });
    const r = recs[0];
    return { id:r.id, staffId:r.staff_id, shiftKey:r.shift_key, status:r.status, reason:r.reason, lastError:r.last_error, dateStr:r.date, month:r.month };
  }
  async updateOvertimeRequest(month, dateStr, predicate, patch){
    if (this.disabled) return true; // hydration layer handles local mut
    // Fetch rows for the date
    const rows = await this._rpc(`overtime_requests?month=eq.${month}&date=eq.${dateStr}&select=*`);
    for (const row of rows){
      const shaped = { id:row.id, staffId:row.staff_id, shiftKey:row.shift_key, status:row.status, dateStr:row.date, month: row.month };
      if (predicate(shaped)){
        const nextVer = (row.version||0)+1;
        await this._rpc(`overtime_requests?id=eq.${row.id}&version=eq.${row.version}`, { method:'PATCH', body: JSON.stringify({ ...patch, last_error: patch.lastError, updated_at: new Date().toISOString(), version: nextVer }) });
      }
    }
    return true;
  }
  async transitionOvertimeRequest(id, newStatus, extra={}){
    if (this.disabled) return null;
    const rows = await this._rpc(`overtime_requests?id=eq.${id}&select=*`);
    const row = rows[0]; if (!row) return null;
    const nextVer = (row.version||0)+1;
    const body = { status:newStatus, last_error: extra.lastError||row.last_error||null, updated_at: new Date().toISOString(), version: nextVer };
    const recs = await this._rpc(`overtime_requests?id=eq.${id}&version=eq.${row.version}`, { method:'PATCH', body: JSON.stringify(body) });
    const r = recs[0];
    return { id:r.id, staffId:r.staff_id, shiftKey:r.shift_key, status:r.status, reason:r.reason, lastError:r.last_error, dateStr:r.date, month:r.month };
  }
  async setOvertimeConsent(staffId, dateStr, value=true){
    if (this.disabled) return true;
    if (value){
      await this._rpc('overtime_consents', { method:'POST', body: JSON.stringify([{ staff_id:staffId, date: dateStr, granted_at: new Date().toISOString() }]) });
    } else {
      await this._rpc(`overtime_consents?staff_id=eq.${staffId}&date=eq.${dateStr}`, { method:'DELETE' });
    }
    return true;
  }
  async hasOvertimeConsent(staffId, dateStr){
    if (this.disabled) return false;
    const rows = await this._rpc(`overtime_consents?staff_id=eq.${staffId}&date=eq.${dateStr}&select=staff_id`);
    return rows.length>0;
  }
}
