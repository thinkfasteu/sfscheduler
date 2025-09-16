// Global error capture & reporting buffer
const errorBuffer = [];
const MAX_BUFFER = 100;
const listeners = [];
// Ignore patterns (benign browser/extension noise)
const IGNORE_ERROR_PATTERNS = [
  /runtime\/sendMessage: The message port closed/i,
  /chrome-extension:\/\//i
];
export function onError(fn){ if (typeof fn==='function') listeners.push(fn); }
export function pushError(entry){
  try {
    const msg = String(entry.message||entry.msg||'');
    if (IGNORE_ERROR_PATTERNS.some(r=> r.test(msg))) return; // skip benign noise
  } catch {}
  errorBuffer.push(entry);
  if (errorBuffer.length > MAX_BUFFER) errorBuffer.shift();
  if (entry.severity==='fatal') console.error('[fatal]', entry);
  else console.warn('[err]', entry);
  listeners.forEach(l=>{ try { l(entry); } catch {} });
}
export function getErrorBuffer(){ return [...errorBuffer]; }
export function installGlobalErrorHandlers(){
  if (window.__errorsInstalled) return; window.__errorsInstalled = true;
  window.addEventListener('error', e=>{
    pushError({ type:'error', message:e.message, filename:e.filename, lineno:e.lineno, colno:e.colno, error:e.error, time:Date.now() });
  });
  window.addEventListener('unhandledrejection', e=>{
    pushError({ type:'unhandledrejection', message: (e.reason && e.reason.message) || String(e.reason), stack: e.reason?.stack, time:Date.now() });
  });
}
// Minimal health snapshot
export function getHealthSnapshot(){
  const backend = (window.CONFIG && window.CONFIG.BACKEND) || (window.__CONFIG__ && window.__CONFIG__.BACKEND) || 'local';
  const hydrated = !!(window.__services && window.__services.staff && window.__services.staff.list && window.__services.staff.list().length >= 0);
  return {
    ts: Date.now(),
    version: window.__APP_VERSION__ || 'dev',
    ready: !!window.__APP_READY__,
    backend,
    hydrated,
    lockOwner: window.__TAB_CAN_EDIT ? 'self' : (window.__TAB_CAN_EDIT===false ? 'other-or-none' : 'unknown'),
    lastError: errorBuffer[errorBuffer.length-1]?.message || null,
    errorCount: errorBuffer.length,
    recent: errorBuffer.slice(-5)
  };
}

// Ensure a minimal diagnostic hook exists even when bundler entry isn't loaded.
// This supports tests that import only this module and expect window.health.
try {
  if (typeof window !== 'undefined' && !window.health) {
    window.health = () => getHealthSnapshot();
  }
} catch {}