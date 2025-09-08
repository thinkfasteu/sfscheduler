// Automated smoke test: health snapshot & backend hydration
(async function(){
  const results = [];
  function assert(name, cond, info){ results.push({ name, pass: !!cond, info }); }
  // Simulate minimal window / services
  global.window = global;
  // Fake services before import
  window.__APP_READY__ = true;
  window.CONFIG = { BACKEND:'local' };
  await import('../src/utils/errors.js');
  const h1 = window.health();
  assert('health-basic-shape', h1 && typeof h1 === 'object' && 'backend' in h1 && 'hydrated' in h1, h1);
  // Simulate hydrated supabase mode
  window.CONFIG.BACKEND='supabase';
  window.__services = { staff: { list: ()=>[{id:1}] } };
  const h2 = window.health();
  assert('health-supabase-hydrated', h2.backend==='supabase' && h2.hydrated===true, h2);
  const failed = results.filter(r=>!r.pass);
  if (failed.length){ console.error('[smoke.health.test] FAIL', failed); process.exitCode=1; } else { console.log('[smoke.health.test] PASS', results); }
})();
