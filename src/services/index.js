import { createStaffService } from './StaffService.js';
import { createScheduleService } from './ScheduleService.js';
import { createAvailabilityService } from './AvailabilityService.js';
import { createVacationService } from './VacationService.js';
import { createOvertimeService } from './OvertimeService.js';
import { createAuditService } from './AuditService.js';
import { createConfigService } from './ConfigService.js';
import { createHolidayService } from './HolidayService.js';
import { createReportService } from './ReportService.js';
import { LocalStorageAdapter } from '../storage/LocalStorageAdapter.js';
import { SupabaseAdapter } from '../storage/SupabaseAdapter.js';
import { HydratingStore } from '../storage/HydratingStore.js';
import { appState } from '../../modules/state.js';
import { createCarryoverService } from './CarryoverService.js';

function createStateFacadeService(){
  return {
    get(key){ return appState[key]; },
    set(key, value){ appState[key] = value; appState.save?.(); },
    ensure(key, def){ if (appState[key]==null) appState[key] = (typeof def==='function'?def():def); return appState[key]; },
    mutate(key, fn){ const cur = appState[key]; const next = fn(cur); if (next !== undefined) { appState[key] = next; } appState.save?.(); return appState[key]; }
  };
}

// store param reserved for future (Supabase / adapter). Currently unused.
function loadConfig(){
  if (typeof window !== 'undefined'){
    window.__CONFIG__ = window.__CONFIG__ || {
      BACKEND: (window.__CONFIG__?.BACKEND)||'local',
      SUPABASE_URL: window.__CONFIG__?.SUPABASE_URL,
      SUPABASE_ANON_KEY: window.__CONFIG__?.SUPABASE_ANON_KEY
    };
    return window.__CONFIG__;
  }
  global.__CONFIG__ = global.__CONFIG__ || { BACKEND:'local' };
  return global.__CONFIG__;
}

export function createStore({ backend } = {}){
  const cfg = loadConfig();
  const mode = backend || cfg.BACKEND || 'local';
  if (mode === 'supabase'){
    const s = new SupabaseAdapter();
    if (s.disabled){ return new LocalStorageAdapter(); }
    return new HydratingStore(s);
  }
  return new LocalStorageAdapter();
}

export function createServices({ store, backend } = {}){
  if (!store) store = createStore({ backend });
  // Simple event emitter
  const listeners = {};
  const events = {
    on(evt, fn){ (listeners[evt]||(listeners[evt]=[])).push(fn); return ()=>{ listeners[evt] = (listeners[evt]||[]).filter(f=>f!==fn); }; },
    emit(evt, payload){ (listeners[evt]||[]).forEach(fn=>{ try{ fn(payload); }catch(e){ console.warn('[services.events] listener error', e); } }); }
  };
  const services = {
    staff: createStaffService(store),
    schedule: createScheduleService(store),
    availability: createAvailabilityService(store),
    vacation: createVacationService(store),
    overtime: createOvertimeService(store),
    audit: createAuditService(store),
    config: createConfigService(store),
    holiday: createHolidayService(store),
    carryover: createCarryoverService(store),
    report: createReportService(store),
  state: createStateFacadeService(),
  events
  };
  // Expose readiness (HydratingStore provides readyPromise)
  services.ready = store.readyPromise ? store.readyPromise : Promise.resolve();
  if (typeof window !== 'undefined') window.__services = services;
  return services;
}
