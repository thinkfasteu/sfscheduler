// Backup & restore utilities (Sprint 4)
import { appState } from '@state';

const DURABLE_KEYS = ()=> Object.keys(appState).filter(k=> appState.isDurableKey && appState.isDurableKey(k));

export function createBackupBlob(){
  const snapshot = { schemaVersion: 1, ts: new Date().toISOString(), data: {} };
  DURABLE_KEYS().forEach(k=>{ snapshot.data[k] = appState[k]; });
  return new Blob([JSON.stringify(snapshot, null, 2)], { type:'application/json' });
}

export function triggerDownload(){
  try {
    const blob = createBackupBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const date = new Date().toISOString().replace(/[:T]/g,'-').slice(0,16);
    a.href = url; a.download = `scheduler-backup-${date}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=> URL.revokeObjectURL(url), 2000);
  } catch(e){ console.error('[backup] download failed', e); }
}

const ACCEPTED_VERSION = 1;
const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2MB safety cap
const ALLOWED_ROOT_KEYS = ['schemaVersion','ts','data'];

export function validateBackupObject(obj){
  if (!obj || typeof obj !== 'object') throw new Error('Backup not an object');
  const extraneous = Object.keys(obj).filter(k=> !ALLOWED_ROOT_KEYS.includes(k));
  if (extraneous.length) throw new Error('Unexpected root keys: '+extraneous.join(','));
  if (obj.schemaVersion !== ACCEPTED_VERSION) throw new Error('Unsupported schemaVersion');
  if (!obj.ts || isNaN(Date.parse(obj.ts))) throw new Error('Invalid timestamp');
  if (!obj.data || typeof obj.data !== 'object') throw new Error('Missing data');
  const keys = Object.keys(obj.data);
  if (!keys.length) throw new Error('Empty data section');
  return keys;
}

export function importBackupFile(file){
  return new Promise((resolve,reject)=>{
    if (file.size > MAX_SIZE_BYTES){ reject(new Error('Backup file too large')); return; }
    const reader = new FileReader();
    reader.onerror = ()=> reject(reader.error);
    reader.onload = ()=>{
      try {
        const obj = JSON.parse(reader.result);
        const keys = validateBackupObject(obj);
        keys.forEach(k=>{ if (appState.isDurableKey && appState.isDurableKey(k)){ appState[k] = obj.data[k]; } });
        appState.save?.(true);
        resolve({ keysRestored: keys, schemaVersion: obj.schemaVersion });
      } catch(err){ reject(err); }
    };
    reader.readAsText(file);
  });
}
