import { createStore } from '../src/services/index.js';

(async function(){
  const cfg = (typeof window!=='undefined'? window.__CONFIG__ : global.__CONFIG__) || {};
  if (cfg.BACKEND !== 'supabase'){ console.log('staffCreateIdempotency.test skipped (not supabase backend)'); return; }
  const store = createStore({ backend:'supabase' });
  await (store.readyPromise || Promise.resolve());
  const before = store.listStaff().length;
  const a = store.createStaff({ name:'TestUserA', role:'minijob', contractHours:10, typicalWorkdays:3 });
  const b = store.createStaff({ name:'TestUserB', role:'student', contractHours:15, typicalWorkdays:4 });
  if (!a.id || !b.id) throw new Error('Missing ids on created staff');
  // Allow async queue to flush (best-effort: wait 1.5s)
  await new Promise(r=> setTimeout(r, 1500));
  const afterFirst = store.listStaff();
  const names = afterFirst.map(s=>s.name);
  const dupA = names.filter(n=> n==='TestUserA').length;
  const dupB = names.filter(n=> n==='TestUserB').length;
  if (dupA!==1 || dupB!==1) throw new Error('Duplicate detected after first create sequence');
  // Create another user to ensure previous not duplicated
  const c = store.createStaff({ name:'TestUserC', role:'minijob', contractHours:8, typicalWorkdays:2 });
  await new Promise(r=> setTimeout(r, 1500));
  const finalList = store.listStaff();
  const dupA2 = finalList.filter(s=>s.name==='TestUserA').length;
  if (dupA2!==1) throw new Error('Previous staff duplicated after new create');
  console.log('staffCreateIdempotency.test passed');
})();
