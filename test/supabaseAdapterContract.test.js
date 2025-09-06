import { createStore } from '../src/services/index.js';
import { LocalStorageAdapter } from '../src/storage/LocalStorageAdapter.js';

(async function(){
  const cfg = (typeof window!=='undefined'? window.__CONFIG__ : global.__CONFIG__) || {};
  if (!cfg.SUPABASE_URL || !cfg.SUPABASE_ANON_KEY || cfg.BACKEND!=='supabase'){
    console.log('supabaseAdapterContract.test skipped (no keys or not in supabase mode)');
    return;
  }
  const supa = createStore({ backend:'supabase' });
  const local = new LocalStorageAdapter();
  // Seed local
  local.createStaff({ name:'LocalUser', role:'minijob', contractHours:10, typicalWorkdays:5 });
  // Supabase operations (will throw if schema missing)
  const created = await supa.createStaff({ name:'RemoteUser', role:'minijob', contractHours:15, typicalWorkdays:4 });
  if (!created || !created.id) throw new Error('Supabase createStaff failed');
  const list = await supa.listStaff();
  if (!Array.isArray(list) || !list.some(s=>s.id===created.id)) throw new Error('Supabase listStaff missing created');
  const updated = await supa.updateStaff(created.id, { contractHours: 20 });
  if (!updated || updated.contractHours!==20) throw new Error('Supabase updateStaff failed');
  await supa.assign('2025-09-06','early', created.id);
  const month = await supa.getMonthSchedule('2025-09');
  if (!month['2025-09-06'] || month['2025-09-06'].assignments.early!==created.id) throw new Error('Supabase assign failed');
  await supa.unassign('2025-09-06', 'early');
  const month2 = await supa.getMonthSchedule('2025-09');
  if (month2['2025-09-06'] && month2['2025-09-06'].assignments.early) throw new Error('Supabase unassign failed');
  console.log('supabaseAdapterContract.test passed');
})();
