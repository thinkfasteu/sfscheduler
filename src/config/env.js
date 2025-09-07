// Unified environment/config loader.
// Precedence: window.CONFIG -> import.meta.env (Vite style) -> optional config.local.js (attached to window.CONFIG_LOCAL) -> fallback defaults.

const PLACEHOLDER_REGEX = /your[-_]?supabase|example|changeme/i;
export const EXPECTED_SCHEMA_VERSION = 1; // bump when DB schema changes

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

// Non-blocking banner utility
export function showBanner(id, text, bg='#ffc107', ttl=8000){
  if (typeof document==='undefined') return;
  if (document.getElementById(id)) return;
  const div = document.createElement('div');
  div.id = id;
  div.textContent = text;
  div.style.cssText='position:fixed;top:0;left:0;right:0;z-index:3000;padding:6px 10px;font:13px system-ui;display:flex;justify-content:space-between;align-items:center;color:#222;background:'+bg+';box-shadow:0 2px 4px rgba(0,0,0,.25)';
  const close = document.createElement('button');
  close.textContent='×';
  close.style.cssText='background:transparent;border:none;font-size:16px;cursor:pointer;margin-left:12px;color:#222;';
  close.onclick=()=>div.remove();
  div.appendChild(close);
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
    if (typeof v==='number' && v !== EXPECTED_SCHEMA_VERSION){
      showBanner('schemaVersionNotice', `DB schema version mismatch (expected ${EXPECTED_SCHEMA_VERSION}, got ${v}); some features may be limited.`, '#ffecb5');
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
  }
  init(adapter){
    if (!adapter || adapter.disabled) return;
    if (this._inited) return; this._inited = true;
    window.addEventListener('error', (e)=>{ this.push({ type:'error', msg:String(e.message), source:e.filename, line:e.lineno, stack: e.error && e.error.stack }); });
    window.addEventListener('unhandledrejection', (e)=>{ this.push({ type:'unhandledrejection', msg: String(e.reason), stack: e.reason && e.reason.stack }); });
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
      await fetch(`${this.adapter.url}/rest/v1/client_errors`, {
        method:'POST',
        headers:{ apikey:this.adapter.key, Authorization:`Bearer ${this.adapter.key}`, 'Content-Type':'application/json', Prefer:'return=minimal' },
        body: JSON.stringify(rows)
      });
    } catch {/* swallow */}
    this.lastFlush = Date.now();
  }
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
