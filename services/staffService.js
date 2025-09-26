import { appState } from '@state';

// Minimal staff service (local adapter); to be swapped with Supabase implementation later.
export const staffService = {
  list() {
    return Array.isArray(appState.staffData) ? appState.staffData : [];
  },
  create(data) {
    if (!Array.isArray(appState.staffData)) appState.staffData = [];
    const nextId = (appState.staffData.reduce((m,s)=>Math.max(m, s.id||0), 0) || 0) + 1;
    const rec = { id: nextId, ...data };
    appState.staffData.push(rec);
    appState.save();
    return rec;
  },
  update(id, patch) {
    const s = appState.staffData.find(x=>x.id===id);
    if (!s) return null;
    Object.assign(s, patch);
    appState.save();
    return s;
  },
  remove(id) {
    const idx = appState.staffData.findIndex(x=>x.id===id);
    if (idx>=0){
      appState.staffData.splice(idx,1);
      appState.save();
      return true;
    }
    return false;
  }
};

// TODO: emit events for UI reactive updates later
