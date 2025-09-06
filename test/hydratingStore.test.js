import { createStore } from '../src/services/index.js';
import { appState } from '../modules/state.js';

(async function(){
  const cfg = (typeof window!=='undefined'? window.__CONFIG__ : global.__CONFIG__) || {};
  if (cfg.BACKEND !== 'supabase'){ console.log('hydratingStore.test skipped (not supabase backend)'); return; }
  const store = createStore({ backend:'supabase' });
  // Wait briefly for hydration
  await (store.readyPromise || Promise.resolve());
  // Sync API should return arrays immediately
  const pre = store.listStaff();
  if (!Array.isArray(pre)) throw new Error('HydratingStore listStaff not array');
  const rec = store.createStaff({ name:'HydrateUser', role:'minijob', contractHours:10, typicalWorkdays:5 });
  if (!rec.id) throw new Error('createStaff missing id');
  store.assign('2025-09-06','early', rec.id);
  const month = appState.scheduleData['2025-09'];
  if (!month || !month['2025-09-06'] || month['2025-09-06'].assignments.early!==rec.id) throw new Error('assign did not mutate in-memory schedule');
  console.log('hydratingStore.test passed');
})();
