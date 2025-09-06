// Minimal Supabase adapter implementing subset of LocalStorageAdapter (staff + schedule)
// Requires window.__CONFIG__ with SUPABASE_URL, SUPABASE_ANON_KEY
// Uses optimistic concurrency via a 'version' column on rows.

export class SupabaseAdapter {
  constructor(){
    const cfg = (typeof window!=='undefined'? window.__CONFIG__ : global.__CONFIG__) || {};
    this.url = cfg.SUPABASE_URL;
    this.key = cfg.SUPABASE_ANON_KEY;
    if (!this.url || !this.key){ this.disabled = true; console.warn('[SupabaseAdapter] Missing keys – falling back to local.'); }
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
      throw new Error(`Supabase error ${res.status}: ${txt}`);
    }
    return res.json();
  }

  // ---- Staff (table: staff) columns: id (pk, int8), name, role, contractHours, typicalWorkdays, weekendPreference, version (int8)
  async listStaff(){ if (this.disabled) return []; return this._rpc('staff?select=*'); }
  async createStaff(data){
    if (this.disabled) return null;
    const recs = await this._rpc('staff', { method:'POST', body: JSON.stringify([{ ...data, version:1 }]) });
    return recs[0];
  }
  async updateStaff(id, patch){
    if (this.disabled) return null;
    // Fetch current version
    const cur = (await this._rpc(`staff?id=eq.${id}&select=id,version`))[0];
    if (!cur) return null;
    const nextVer = (cur.version||0)+1;
    const recs = await this._rpc(`staff?id=eq.${id}&version=eq.${cur.version}`, { method:'PATCH', body: JSON.stringify({ ...patch, version: nextVer }) });
    return recs[0];
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

  // ---- Availability (table: availability) columns: staff_id, date, shifts jsonb, day_off boolean, voluntary jsonb, version
  async availabilityUpsert(staffId, dateStr, shiftKey, status){
    if (this.disabled) return true; // no-op fallback
    // Fetch row
    const existing = (await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&select=staff_id,date,shifts,version`))[0];
    if (!existing){
      const shifts = status ? { [shiftKey]: status } : {};
      await this._rpc('availability', { method:'POST', body: JSON.stringify([{ staff_id: staffId, date: dateStr, shifts, version:1 }]) });
      return true;
    }
    const nextVer = (existing.version||0)+1;
    const shifts = { ...(existing.shifts||{}) };
    if (!status) delete shifts[shiftKey]; else shifts[shiftKey] = status;
    await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ shifts, version: nextVer }) });
    return true;
  }
  async availabilitySetDayOff(staffId, dateStr, isOff){
    if (this.disabled) return true;
    const existing = (await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&select=staff_id,date,day_off,shifts,version`))[0];
    if (!existing){
      await this._rpc('availability', { method:'POST', body: JSON.stringify([{ staff_id: staffId, date: dateStr, day_off: !!isOff, shifts:{}, version:1 }]) });
      return true;
    }
    const nextVer = (existing.version||0)+1;
    await this._rpc(`availability?staff_id=eq.${staffId}&date=eq.${dateStr}&version=eq.${existing.version}`, { method:'PATCH', body: JSON.stringify({ day_off: !!isOff, version: nextVer }) });
    return true;
  }
  availabilityIsDayOff(){ return false; }
  availabilitySetVoluntary(){ /* optional: store in voluntary jsonb */ return true; }
  availabilityIsVoluntary(){ return false; }
  availabilityListForRange(){ return {}; }

  // ---- Vacation (tables: vacations, illness) columns: id (identity), staff_id, start_date, end_date
  async listVacations(staffId){ if (this.disabled) return []; return this._rpc(`vacations?staff_id=eq.${staffId}&select=*`); }
  async addVacation(staffId, period){ if (this.disabled) return true; await this._rpc('vacations', { method:'POST', body: JSON.stringify([{ staff_id: staffId, start_date: period.start, end_date: period.end }]) }); return true; }
  async removeVacation(id){ if (this.disabled) return true; await this._rpc(`vacations?id=eq.${id}`, { method:'DELETE' }); return true; }

  // Illness placeholders
  listIllness(){ return []; }
  addIllness(){ throw new Error('Not implemented'); }
  removeIllness(){ throw new Error('Not implemented'); }

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
}
