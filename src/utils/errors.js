// Global error capture & reporting buffer
const errorBuffer = [];
const MAX_BUFFER = 100;
const listeners = [];
export function onError(fn){ if (typeof fn==='function') listeners.push(fn); }
export function pushError(entry){
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
  return {
    version: window.__APP_VERSION__ || 'dev',
    lastError: errorBuffer[errorBuffer.length-1]?.message || null,
    errorCount: errorBuffer.length,
  time: Date.now(),
  recent: errorBuffer.slice(-5)
  };
}