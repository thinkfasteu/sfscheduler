// Backup & restore utilities (Sprint 4)
import { appState } from '../../modules/state.js';

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

export function importBackupFile(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onerror = ()=> reject(reader.error);
    reader.onload = ()=>{
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || typeof obj !== 'object' || !obj.data) throw new Error('Invalid backup format');
        const keys = Object.keys(obj.data);
        keys.forEach(k=>{ if (appState.isDurableKey && appState.isDurableKey(k)){ appState[k] = obj.data[k]; } });
        appState.save?.(true);
        resolve({ keysRestored: keys });
      } catch(err){ reject(err); }
    };
    reader.readAsText(file);
  });
}
