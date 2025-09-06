import { appState } from '../../modules/state.js';

export function createStaffService(store){
  return {
  list(){ return store.listStaff(); },
    get(id){ return (appState.staffData||[]).find(s=>s.id===id) || null; },
  create(data){ return store.createStaff(data); },
  update(id, patch){ return store.updateStaff(id, patch); },
  remove(id){ return store.deleteStaff(id); }
  };
}
