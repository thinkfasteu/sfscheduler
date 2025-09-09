// Boot loader with dev vs dist auto-detection; config.local.js (optional) loads first.
(async()=>{
  // 1. Ergonomic optional local config load (dev only).
  //    Loads config.local.js ONLY when on localhost and either:
  //    a) EXPECT_LOCAL_CONFIG === true (explicit opt‑in), OR
  //    b) File actually exists (HEAD 200) even without flag (convenience auto-detect).
  //    Never runs on production hosts; prevents 404 -> HTML parse errors in prod.
  async function loadLocalConfig(){
    window.CONFIG = window.CONFIG || {};
    const host = location.hostname;
    const isLocalHost = ['localhost','127.0.0.1','::1'].includes(host);
    if (!isLocalHost) return; // production/staging skip
    const explicit = window.CONFIG.EXPECT_LOCAL_CONFIG === true;
    // Probe existence (HEAD). If explicit flag set we still probe to give a helpful log if missing.
    let exists = false;
    try {
      const head = await fetch('./config.local.js', { method:'HEAD', cache:'no-store' });
      exists = head.ok;
    } catch {}
    if (!explicit && !exists) return; // silent auto-skip
    if (explicit && !exists){ console.info('[dev] EXPECT_LOCAL_CONFIG=true but config.local.js not found – skipping'); return; }
    if (exists){
      await new Promise(resolve=>{
        const s = document.createElement('script');
        s.src = './config.local.js';
        s.async = false;
        s.onload = ()=>{ console.info('[dev] loaded config.local.js'); resolve(); };
        s.onerror = ()=>{ console.info('[dev] failed to load config.local.js'); resolve(); };
        (document.head||document.documentElement).appendChild(s);
      });
    }
  }

  // 2. Core app load sequences
  async function loadDev(){
    console.info('[boot] mode=dev');
    await import('./src/config/bootstrap.js');
    await import('./src/ui/eventBindings.js');
    await import('./main.js');
  }
  async function loadDist(manifest){
    console.info('[boot] mode=dist');
    // Pre-import chunks then entry
    if (Array.isArray(manifest.chunks)){
      for (const c of manifest.chunks){
        try { await import('./dist/' + c + '?v=' + encodeURIComponent(manifest.built)); } catch(e){ console.warn('[boot] chunk load failed', c, e); }
      }
    }
    try {
      await import('./dist/' + manifest.app + '?v=' + encodeURIComponent(manifest.built));
    } catch(e){
      console.warn('[boot] app load failed, refetching manifest', e);
      try {
        const m2 = await (await fetch('./dist/manifest.json', { cache:'no-store' })).json();
        if (m2.app && m2.app !== manifest.app){
          console.info('[boot] retry with new app', m2.app);
          if (m2.version) window.__APP_VERSION__ = m2.version;
          await import('./dist/' + m2.app + '?v=' + encodeURIComponent(m2.built));
        } else throw e;
      } catch(e2){ throw e2; }
    }
  }

  // 3. Supabase warning gating: patch console.warn temporarily until config loaded.
  const originalWarn = console.warn;
  let configLoaded = false; let pendingSupabaseWarn = null;
  console.warn = function(...args){
    if (!configLoaded && /SupabaseAdapter\] Missing keys/.test(args[0]||'')){
      pendingSupabaseWarn = args; return; }
    return originalWarn.apply(this,args);
  };

  await loadLocalConfig();
  configLoaded = true;
  // If Supabase requested, validate keys presence early and show guidance if missing
  try {
    if (window.CONFIG?.BACKEND === 'supabase'){
      const missing = !window.CONFIG.SUPABASE_URL || !window.CONFIG.SUPABASE_ANON_KEY;
      if (missing){
        const id='supabaseConfigMissing';
        if (!document.getElementById(id)){
          const div=document.createElement('div');
          div.id=id; div.style.cssText='position:fixed;top:0;left:0;right:0;background:#ffdede;color:#222;padding:6px 10px;font:13px system-ui;z-index:3500;box-shadow:0 2px 4px rgba(0,0,0,.2)';
          div.textContent='Supabase BACKEND requested but keys missing – edit config.local.js with SUPABASE_URL & SUPABASE_ANON_KEY (CSP connect-src must include its domain).';
          const close=document.createElement('button'); close.textContent='×'; close.style.cssText='margin-left:8px;background:transparent;border:none;cursor:pointer;font-size:16px'; close.onclick=()=>div.remove(); div.appendChild(close);
          document.body.appendChild(div);
        }
      }
    }
  } catch {}
  // Flush deferred Supabase warning once (if still relevant and backend intends supabase)
  if (pendingSupabaseWarn && (window.CONFIG?.BACKEND==='supabase')){
    originalWarn.apply(console, pendingSupabaseWarn);
  }

  // Test hook: allow early exit before network mode detection.
  if (window.CONFIG.__BOOT_TEST_ONLY){
    console.info('[boot] test-only early exit');
    console.warn = originalWarn;
    return;
  }

  // 4. Mode selection: explicit override or auto-detect manifest
  let mode = window.CONFIG?.BUILD_MODE;
  if (!mode){
    try {
      const res = await fetch('./dist/manifest.json',{ cache:'no-store' });
      if (res.ok){ mode='dist'; window.__BUILD_MANIFEST__ = await res.json(); }
      else mode='dev';
    } catch { mode='dev'; }
  }

  if (mode==='dist'){
    const manifest = window.__BUILD_MANIFEST__ || (await (await fetch('./dist/manifest.json')).json());
  if (manifest?.version) { window.__APP_VERSION__ = manifest.version; }
    try { await loadDist(manifest); } catch(e){ originalWarn('[boot] dist load failed – falling back to dev', e); await loadDev(); }
  } else {
    await loadDev();
  }

  // Restore console.warn
  console.warn = originalWarn;
})();
