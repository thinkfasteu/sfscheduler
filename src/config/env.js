// Unified environment/config loader.
// Precedence: window.CONFIG -> import.meta.env (Vite style) -> optional config.local.js (attached to window.CONFIG_LOCAL) -> fallback defaults.

const PLACEHOLDER_REGEX = /your[-_]?supabase|example|changeme/i;
export const EXPECTED_SCHEMA_VERSION = 7; // bumped to align with deployed DB schema

function readGlobal(name){
  try { return (typeof window!=='undefined'? window[name] : global[name]); } catch { return undefined; }
}

function mergeConfig(){
  const out = {};
  // 1. window.CONFIG (already defined inline early)
  const winCfg = readGlobal('CONFIG') || {};
  Object.assign(out, winCfg);
  // 2. import.meta.env (if bundler injects)
  // Note: import.meta.env support intentionally skipped in plain runtime; bundler will inject before execution.
  // 3. config.local.js attached export (window.CONFIG_LOCAL)
  const localCfg = readGlobal('CONFIG_LOCAL') || {};
  Object.keys(localCfg).forEach(k=>{ if (out[k] === undefined) out[k] = localCfg[k]; });
  return out;
}

export const runtimeConfig = mergeConfig();

export function isSupabaseConfigured(){
  return !!runtimeConfig.SUPABASE_URL && !!runtimeConfig.SUPABASE_ANON_KEY && !PLACEHOLDER_REGEX.test(runtimeConfig.SUPABASE_URL) && !PLACEHOLDER_REGEX.test(runtimeConfig.SUPABASE_ANON_KEY);
}

// Banner shim: delegate to global unified helper if present
export function showBanner(id, text, bg='#ffc107', ttl=8000){
  if (typeof window !== 'undefined' && typeof window.__banner === 'function'){
    // Map background color to variant heuristically
    let variant = 'info';
    if (/ffecb5|ffdede|ffc/.test(bg)) variant='warn';
    if (/d1e7dd/.test(bg)) variant='info';
    if (/ff|dc3545|danger/i.test(bg)) variant='error';
    window.__banner(id, text, variant, ttl);
    return;
  }
  // Fallback inline (rare: early boot before main.js)
  if (typeof document==='undefined' || document.getElementById(id)) return;
  const div = document.createElement('div');
  div.id=id; div.className='app-banner';
  div.textContent=text;
  document.body.appendChild(div);
  if (ttl>0) setTimeout(()=>{ div.style.transition='opacity .6s'; div.style.opacity='0'; setTimeout(()=>div.remove(),650); }, ttl);
}

// Schema version check
export async function checkSchemaVersion(adapter){
  if (!adapter || adapter.disabled) return; // only in supabase mode
  try {
    const res = await fetch(`${adapter.url}/rest/v1/app_meta?key=eq.schema_version&select=value`, {
      headers:{ apikey: adapter.key, Authorization:`Bearer ${adapter.key}` }
    });
    if(!res.ok) return;
    const rows = await res.json();
    const row = rows[0];
    const v = row && row.value && (row.value.v || row.value.version);
    if (typeof v==='number'){
      // Expose for ad‑hoc diagnostics
      try { if (typeof window!=='undefined'){ window.__SCHEMA_EXPECTED__ = EXPECTED_SCHEMA_VERSION; window.__SCHEMA_DB__ = v; } } catch {}
      if (v === EXPECTED_SCHEMA_VERSION){
        if (typeof window!== 'undefined' && !window.__SCHEMA_VERSION_LOGGED__){
          window.__SCHEMA_VERSION_LOGGED__ = true;
          console.info(`[schema] OK (expected=${EXPECTED_SCHEMA_VERSION} db=${v})`);
        }
      } else if (v > EXPECTED_SCHEMA_VERSION){
        // DB is ahead of frontend bundle – likely stale cached JS
  showBanner('schemaVersionAhead', `Backend schema is newer (expected ${EXPECTED_SCHEMA_VERSION}, db ${v}). Hard refresh (Ctrl+Shift+R) or deploy updated bundle.`, '#d1e7dd');
        console.warn('[schema] backend newer than bundle',{expected:EXPECTED_SCHEMA_VERSION,db:v});
      } else { // v < expected
  showBanner('schemaVersionNotice', `DB schema version mismatch (expected ${EXPECTED_SCHEMA_VERSION}, got ${v}); some features may be limited.`, '#ffecb5');
        console.warn('[schema] backend older than expected',{expected:EXPECTED_SCHEMA_VERSION,db:v});
      }
    } else {
      console.debug('[schema] could not determine numeric schema version from row', row);
    }
  } catch {/* silent */}
}

// Lightweight client error batch logger
class ClientErrorLogger {
  constructor(){
    this.queue = [];
    this.timer = null;
    this.lastFlush = 0;
    this.intervalMs = 30000; // 30s throttle
    this.maxBatch = 20;
  this.retryAttempts = 0;
  this.maxRetries = 3;
  }
  init(adapter){
    if (!adapter || adapter.disabled) return;
    if (this._inited) return; this._inited = true;
    window.addEventListener('error', (e)=>{ this.push({ type:'error', msg:String(e.message), source:e.filename, line:e.lineno, stack: e.error && e.error.stack }); });
    window.addEventListener('unhandledrejection', (e)=>{ this.push({ type:'unhandledrejection', msg: String(e.reason), stack: e.reason && e.reason.stack }); });
  window.addEventListener('beforeunload', ()=>{ try { this.forceFlush(); } catch {} });
    this.adapter = adapter;
  }
  push(evt){
    if (!this.adapter || this.adapter.disabled) return;
    this.queue.push({ ...evt, ts: new Date().toISOString() });
    if (this.queue.length > this.maxBatch) this.queue.splice(0, this.queue.length - this.maxBatch);
    this.schedule();
  }
  schedule(){
    if (this.timer) return;
    const delay = Date.now() - this.lastFlush > this.intervalMs ? 2000 : this.intervalMs; // first flush sooner
    this.timer = setTimeout(()=> this.flush(), delay);
  }
  async flush(){
    this.timer = null;
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      const rows = batch.map(b=>({ event_type: b.type, message: b.msg, source: b.source||null, line: b.line||null, stack: b.stack||null, ts: b.ts }));
      const res = await fetch(`${this.adapter.url}/rest/v1/client_errors`, {
        method:'POST',
        headers:{ apikey:this.adapter.key, Authorization:`Bearer ${this.adapter.key}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify(rows)
      });
      if (!res.ok){
        // If table is missing (404) or permission denied, stop further attempts to avoid console noise
        if (res.status === 404){ this._disabledMissingTable = true; }
        else if (res.status === 401 || res.status === 403){ this._disabledMissingTable = true; }
      }
      this.retryAttempts = 0;
    } catch {/* swallow network errors */}
    this.lastFlush = Date.now();
    if (this.queue.length && !this._disabledMissingTable){ this.schedule(); }
  }
  forceFlush(){ if (this.timer){ clearTimeout(this.timer); this.timer=null; } return this.flush(); }
}

export const clientErrorLogger = new ClientErrorLogger();

// Boot hook used by services/index to finalize environment hardening
export function applyRuntimeGuards(adapter){
  if (!isSupabaseConfigured()){
  showBanner('configPlaceholder', 'Supabase config missing or placeholder – using local backend fallback.', '#ffdede');
    if (typeof window!=='undefined'){ window.CONFIG = { ...(window.CONFIG||{}), BACKEND:'local' }; }
  }
  if (adapter && !adapter.disabled){
    checkSchemaVersion(adapter);
    clientErrorLogger.init(adapter);
  }
}
