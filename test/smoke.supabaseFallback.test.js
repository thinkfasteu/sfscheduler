// Smoke test: fallback banner logic when Supabase keys missing
import { applyRuntimeGuards, isSupabaseConfigured } from '../src/config/env.js';
import { SupabaseAdapter } from '../src/storage/SupabaseAdapter.js';

(async function(){
  const results=[]; function assert(name, cond, info){ results.push({ name, pass:!!cond, info }); }
  global.window = global;
  // Minimal DOM for banner insertion
  global.document = { getElementById: (id)=> null, createElement: (tag)=>({ id:'', style:{}, appendChild:()=>{}, remove:()=>{} }), body:{ appendChild:()=>{} } };
  window.CONFIG = { BACKEND:'supabase', SUPABASE_URL:'', SUPABASE_ANON_KEY:'' };
  const adapter = new SupabaseAdapter(); // will be disabled
  const configured = isSupabaseConfigured();
  assert('not-configured', configured===false);
  applyRuntimeGuards(adapter);
  assert('adapter-disabled-fallback', adapter.disabled===true);
  const failed = results.filter(r=>!r.pass);
  if (failed.length){ console.error('[smoke.supabaseFallback.test] FAIL', failed); process.exitCode=1; } else { console.log('[smoke.supabaseFallback.test] PASS', results); }
})();
