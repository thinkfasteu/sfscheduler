import { appState } from './modules/state.js';
import { ScheduleUI } from './ui/scheduleUI.js';  // Updated path
import { EventHandler } from './ui/eventHandlers.js';  // Updated path
import { APP_CONFIG, SHIFTS } from './modules/config.js';
import { AppUI } from './ui/appUI.js';
import { OvertimeRequestsUI } from './ui/overtimeRequests.js';
import { MonitoringDashboard } from './ui/monitoringDashboard.js';
import { publicAPI } from './src/api/public.js';
import { triggerDownload, importBackupFile } from './src/utils/backup.js';
import './ui/checklistOverlay.js';

function initApp(){
    if (window.__APP_READY__) return; // idempotent guard
    appState.load();
        // --- Multi-tab synchronization & cooperative edit lock (Sprint 3) ---
        const TAB_ID = Math.random().toString(36).slice(2);
        const bc = ('BroadcastChannel' in window) ? new BroadcastChannel('scheduler_sync') : null;
        function announce(type, payload){ try{ bc && bc.postMessage({ type, from:TAB_ID, ts:Date.now(), payload }); }catch{} }
        let currentLockOwner = null;
        function showLockStatus(){
            let el = document.getElementById('tabLockStatus');
            if (!el){ el = document.createElement('div'); el.id='tabLockStatus'; el.style.cssText='position:fixed;bottom:8px;right:8px;font:11px system-ui;padding:4px 8px;border-radius:4px;background:#198754;color:#fff;z-index:3000;opacity:.9'; document.body.appendChild(el); }
            el.textContent = currentLockOwner===TAB_ID ? 'Bearbeitung: Dieser Tab' : 'Nur Ansicht (anderer Tab aktiv)';
            el.style.background = currentLockOwner===TAB_ID ? '#198754' : '#6c757d';
            const canEdit = currentLockOwner===TAB_ID;
            window.__TAB_CAN_EDIT = canEdit;
            document.body.classList.toggle('view-only', !canEdit);
        }
        function claimLock(){ if (currentLockOwner===TAB_ID) return; announce('lock-acquire'); }

        // Unified toast helper (ensure available early so later handlers can use it)
        if (!window.__toast){
            window.__toast = (msg, opts={})=>{
                try {
                    const c = document.querySelector('.toast-container') || (()=>{ const div=document.createElement('div'); div.className='toast-container'; document.body.appendChild(div); return div; })();
                    const el = document.createElement('div');
                    el.className='toast'+(opts.variant? ' toast-'+opts.variant:'')+(opts.small?' toast-sm':'');
                    el.textContent = msg;
                    c.appendChild(el);
                    setTimeout(()=>{ el.classList.add('fade-out'); setTimeout(()=>el.remove(),650); }, opts.ttl||4000);
                } catch {}
            };
        }
        // Unified banner helper (define early if not yet defined)
        if (!window.__banner){
            window.__banner = (id, text, variant='info', ttl=6000)=>{
                if (document.getElementById(id)) return;
                const div = document.createElement('div');
                div.id=id; div.className='app-banner '+(variant==='warn'?'warn':variant==='error'?'error':'');
                div.innerHTML = `<span>${text}</span>`;
                const btn = document.createElement('button'); btn.className='close'; btn.textContent='×'; btn.onclick=()=>div.remove(); div.appendChild(btn);
                document.body.appendChild(div);
                if (ttl>0) setTimeout(()=>{ div.style.transition='opacity .6s'; div.style.opacity='0'; setTimeout(()=>div.remove(),650); }, ttl);
            };
        }
        if (bc){
            bc.addEventListener('message', ev=>{
                const { data } = ev; if (!data || data.from===TAB_ID) return;
                if (data.type==='state-saved'){
                    try { Object.keys(localStorage).forEach(k=>{ if (appState.isDurableKey && appState.isDurableKey(k)){ const v = localStorage.getItem(k); if (v){ try { appState[k] = JSON.parse(v); } catch{} } } }); } catch{}
                    // External update banner
                    if (!document.getElementById('externalUpdateNotice')){
                        const div = document.createElement('div');
                        div.id='externalUpdateNotice';
                        div.style.cssText='position:fixed;bottom:8px;left:8px;background:#0d6efd;color:#fff;padding:6px 10px;font:12px system-ui;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,.3);cursor:pointer;z-index:3000';
                        div.textContent='Änderungen aus anderem Tab geladen – Aktualisieren?';
                        div.onclick=()=>{ try { window.appUI && window.appUI.refreshAll && window.appUI.refreshAll(); } catch{} div.remove(); };
                        document.body.appendChild(div);
                        setTimeout(()=>{ div.style.transition='opacity .6s'; div.style.opacity='0'; setTimeout(()=>div.remove(),800); }, 8000);
                    }
                } else if (data.type==='lock-acquire'){
                    if (!currentLockOwner){ announce('lock-granted', { to:data.from }); }
                } else if (data.type==='lock-granted'){
                    if (data.payload?.to===TAB_ID){ currentLockOwner = TAB_ID; announce('lock-claim'); showLockStatus(); }
                } else if (data.type==='lock-claim'){
                    if (currentLockOwner!==data.from){ currentLockOwner = data.from; showLockStatus(); }
                }
            });
        }
        setInterval(()=>{ claimLock(); showLockStatus(); }, 5000);
        claimLock();
        // Single-tab fallback: if no peer grants lock within 300ms, self-assign so UI is editable.
        setTimeout(()=>{
            if (!currentLockOwner){
                currentLockOwner = TAB_ID;
                showLockStatus();
                try { 
                    console.info('[lock] self-assigned (no competing tabs detected)'); 
                    // Also explicitly enable the generate button
                    const btn = document.getElementById('generateScheduleBtn');
                    if (btn && btn.disabled) {
                        btn.disabled = false;
                        console.info('[lock] enabled generateScheduleBtn');
                    }
                } catch {}
            }
        }, 300);
        // Fallback via storage events if BroadcastChannel unavailable
        window.addEventListener('storage', (e)=>{
            if (!e.key || !appState.isDurableKey || !appState.isDurableKey(e.key)) return;
            try { const v = localStorage.getItem(e.key); if (v){ appState[e.key] = JSON.parse(v); } } catch{}
            if (!document.getElementById('externalUpdateNotice')){
                const div = document.createElement('div');
                div.id='externalUpdateNotice';
                div.style.cssText='position:fixed;bottom:8px;left:8px;background:#0d6efd;color:#fff;padding:6px 10px;font:12px system-ui;border-radius:4px;box-shadow:0 2px 4px rgba(0,0,0,.3);cursor:pointer;z-index:3000';
                div.textContent='Änderungen in anderem Tab – Aktualisieren?';
                div.onclick=()=>{ try { window.appUI && window.appUI.refreshAll && window.appUI.refreshAll(); } catch{} div.remove(); };
                document.body.appendChild(div);
                setTimeout(()=>{ div.style.transition='opacity .6s'; div.style.opacity='0'; setTimeout(()=>div.remove(),800); }, 8000);
            }
        });
        // Guard editing actions in view-only mode
        document.addEventListener('click', (ev)=>{
            if (window.__TAB_CAN_EDIT || ev.defaultPrevented) return;
            const el = ev.target.closest('button, [data-editing], input, select, textarea');
            if (!el) return;
            const id = el.id || '';
            const editIds = new Set(['generateScheduleBtn','clearScheduleBtn','saveStaffBtn','addStaffVacationBtn','addStaffIllnessBtn','addVacationPeriodBtn','addOtherStaffBtn','addOtherVacationPeriodBtn','executeAssignBtn','executeSwapBtn','executeSearchAssignBtn']);
            if (editIds.has(id) || el.hasAttribute('data-editing')){
                ev.preventDefault(); ev.stopPropagation();
                // Replace legacy inline toast with unified helper
                if (!window.__TOAST_VIEWONLY_SHOWN){
                    window.__TOAST_VIEWONLY_SHOWN = Date.now();
                    window.__toast('Schreib-Lock in anderem Tab. Dort bearbeiten.', { variant:'error', small:true });
                }
            }
        }, true);
    // Seed demo data only once (if never seeded and no staff exist). Persist flag after first seed or after first manual modification.
    // Do not seed in production environment to avoid confusing real deployments.
    const DEMO_FLAG_KEY = 'demoSeeded';
    const demoFlag = (typeof localStorage !== 'undefined') ? localStorage.getItem(DEMO_FLAG_KEY) : null;
    if (window.CONFIG?.ENV !== 'production' && (!Array.isArray(appState.staffData) || appState.staffData.length === 0) && !demoFlag) {
        appState.staffData = [
            { id: 1, name: 'Anna', role: 'minijob', contractHours: 10, typicalWorkdays: 3 },
            { id: 2, name: 'Ben', role: 'student', contractHours: 20, typicalWorkdays: 4 },
            { id: 3, name: 'Clara', role: 'permanent', contractHours: 35, typicalWorkdays: 5 }
        ];
        try { localStorage.setItem(DEMO_FLAG_KEY, '1'); } catch {}
        appState.save();
    }

    // Ensure base markup exists (tabs + content areas)
    const hasTabs = document.querySelector('.tab-nav, .tabs');
    const hasSchedule = document.getElementById('scheduleContent');
    if (!hasTabs || !hasSchedule) {
        const container = document.body;
        const nav = document.createElement('div');
        nav.className = 'tab-nav';
        nav.innerHTML = `
            <button class="tab-button active" data-tab="schedule">Schedule</button>
            <button class="tab-button" data-tab="staff">Staff</button>
            <button class="tab-button" data-tab="settings">Settings</button>
        `;
        const schedule = document.createElement('div');
        schedule.id = 'scheduleContent';
        schedule.className = 'tab-content active';
        schedule.textContent = 'Loading...';
        const staff = document.createElement('div');
        staff.id = 'staffContent';
        staff.className = 'tab-content';
        const settings = document.createElement('div');
        settings.id = 'settingsContent';
        settings.className = 'tab-content';
        container.prepend(settings);
        container.prepend(staff);
        container.prepend(schedule);
        container.prepend(nav);
        console.info('Injected base UI markup (tabs and content containers).');
    }

    // Initialize UI components
    const scheduleUI = new ScheduleUI('#scheduleContent');
    // Render UI first so buttons/inputs exist
    scheduleUI.refreshDisplay();
    // Then bind handlers to the rendered elements
    console.log('[main.js] About to create EventHandler');
    const eventHandler = new EventHandler(scheduleUI);
    console.log('[main.js] EventHandler created:', eventHandler);
    // App UI for staff/availability/vacation
    const appUI = new AppUI(scheduleUI);
    appUI.init();
    // Overtime Requests panel
    const overtimeUI = new OvertimeRequestsUI('#overtimeRequestsList');
    overtimeUI.render();
    // Monitoring Dashboard
    const monitoringDashboard = new MonitoringDashboard('#monitoring-dashboard');
    monitoringDashboard.render();
    
    // Initialize Public API namespace for external integrations
    publicAPI.init();
    
    // Re-render requests list on simple schedule updates
        const _origSave = appState.save.bind(appState);
        appState.save = function(immediate){
            _origSave(immediate);
            try{ overtimeUI.render(); }catch{}
            announce('state-saved', { keys: Object.keys(appState).filter(k=> appState.isDurableKey && appState.isDurableKey(k)) });
        };
    // Expose for compatibility
    window.handlers = eventHandler;
    window.appUI = appUI;
    
    // Holiday functions (missing window mappings)
    window.showHolidaysPopup = function() { 
        if (window.appUI?.showHolidaysPopup) return window.appUI.showHolidaysPopup(); 
        console.error('[main] showHolidaysPopup: appUI not available'); 
    };
    window.addHoliday = function() { 
        if (window.appUI?.addHoliday) return window.appUI.addHoliday(); 
        console.error('[main] addHoliday: appUI not available'); 
    };
    
    // Tab switching function (replaces the one that was in prototypeCompat.js)
    window.showTab = function(evt, key) {
        if (!key && evt?.currentTarget) {
            key = evt.currentTarget.getAttribute('data-tab');
        }
        if (!key) return;
        
        // Remove active state from all tabs and sections
        document.querySelectorAll('.tabs .tab.active').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.section.active').forEach(sec => sec.classList.remove('active'));
        
        // Add active state to selected tab and section
        const btn = document.querySelector(`.tabs .tab[data-tab="${key}"]`);
        if (btn) btn.classList.add('active');
        const sec = document.getElementById(`${key}-tab`);
        if (sec) sec.classList.add('active');
    };
    
    // Ensure one tab active if none set yet
    try {
        if (!document.querySelector('.tabs .tab.active')) {
            const first = document.querySelector('.tabs .tab[data-tab]');
            if (first) {
                window.showTab(null, first.getAttribute('data-tab'));
            }
        }
    } catch {}
    
    window.__APP_READY__ = true;
    try { console.info('[app] UI initialized'); } catch {}
    // Debug overlay once ready (auto-removes after 4s)
    try {
        if (!document.getElementById('appReadyOverlay')){
            const o = document.createElement('div');
            o.id='appReadyOverlay';
            o.textContent='UI Ready';
            o.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);background:#198754;color:#fff;padding:4px 10px;font:12px system-ui;border-radius:4px;z-index:5000;box-shadow:0 2px 6px rgba(0,0,0,.3)';
            document.body.appendChild(o);
            setTimeout(()=>{ o.style.transition='opacity .6s'; o.style.opacity='0'; setTimeout(()=>o.remove(),700); }, 4000);
        }
    } catch {}
    // Backup API
    window.__backup = {
        export: ()=> triggerDownload(),
        importFile: async (file)=>{ try { const res = await importBackupFile(file); console.info('[backup] restored', res); window.appUI && window.appUI.refreshAll && window.appUI.refreshAll(); window.__toast('Backup importiert'); } catch(e){ console.error('[backup] import failed', e); window.__toast('Import fehlgeschlagen', { variant:'error' }); } }
    };
    // (toast & banner helpers already defined earlier if absent)
    // Simple metrics instrumentation (in-memory, logs every 30s)
    (function metrics(){
        const M = { counters:{}, timings:{} };
        window.__metrics = {
            inc(name,v=1){ M.counters[name]=(M.counters[name]||0)+v; },
            time(name,fn){ const s=performance.now(); try { return fn(); } finally { const d=performance.now()-s; (M.timings[name]||(M.timings[name]=[])).push(d); } },
            snapshot(){ return JSON.parse(JSON.stringify(M)); }
        };
        setInterval(()=>{
            const snap = window.__metrics.snapshot();
            // Derive simple p95 for each timing bucket
            Object.entries(snap.timings).forEach(([k,arr])=>{ arr.sort((a,b)=>a-b); const p95 = arr[Math.floor(arr.length*0.95)]||0; console.debug('[metrics]', k, { count:arr.length, p95:Math.round(p95) }); });
            console.debug('[metrics] counters', snap.counters);
        }, 30000);
    })();

    // Theme toggle
    try {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme) document.documentElement.setAttribute('data-theme', savedTheme);
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.addEventListener('click', () => {
                const cur = document.documentElement.getAttribute('data-theme') || '';
                const next = cur === 'dark' ? '' : 'dark';
                if (next) document.documentElement.setAttribute('data-theme', next); else document.documentElement.removeAttribute('data-theme');
                localStorage.setItem('theme', next);
                btn.textContent = next === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode';
            });
            const isDark = (document.documentElement.getAttribute('data-theme') === 'dark');
            btn.textContent = isDark ? '☀️ Light Mode' : '🌙 Dark Mode';
        }
        // Persist checklist toggle
        const checklistCb = document.getElementById('showChecklistToggle');
        if (checklistCb){
            const stored = localStorage.getItem('showChecklist');
            if (stored !== null){ checklistCb.checked = stored === '1'; }
            checklistCb.addEventListener('change', ()=>{
                try { localStorage.setItem('showChecklist', checklistCb.checked ? '1':'0'); } catch {}
            });
        }
    } catch {}
}

// Initialize application when DOM is ready or immediately if already loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp, { once:true });
} else {
    // DOM already parsed (late-loaded bundle) -> run immediately
    initApp();
}

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
    appState.save(true);
});

// Export limited debug only in non-production (BUILD_ENV!='production')
if (window.CONFIG?.ENV !== 'production'){
    window.DEBUG = { state: appState, APP_CONFIG, SHIFTS };
}
// Expose shifts for helpers like export without ESM imports in global scope (safe)
window.SHIFTS = SHIFTS;

// Collect CSP violations for triage (no-op if browser doesn’t support)
try{
    if (!window.__csp) window.__csp = { events:[], summarize(){
        const groups = {};
        this.events.forEach(e=>{ const k = `${e.violatedDirective} -> ${e.blockedURI||'inline'}`; groups[k]=(groups[k]||0)+1; });
        return groups;
    }};
    window.addEventListener('securitypolicyviolation', (e)=>{
        try{
            window.__csp.events.push({ ts: Date.now(), violatedDirective: e.violatedDirective, effectiveDirective: e.effectiveDirective, blockedURI: e.blockedURI, sourceFile: e.sourceFile, lineNumber: e.lineNumber, columnNumber: e.columnNumber });
            // Keep last 200 only
            if (window.__csp.events.length>200) window.__csp.events.shift();
        }catch{}
    });
}catch{}

// Lightweight console helpers gated by ?debug=1 (safe in production)
try{
    const url = new URL(location.href);
    const enableDebug = url.searchParams.get('debug') === '1';
    if (enableDebug){
        // Provide a small help index
        window.help = function(){
            console.info('Debug helpers available:', Object.keys(window.debug||{}));
            console.info('Examples:\n  window.debug.candidates("2025-09-10","early")\n  window.debug.ruleCheck(1,"2025-09-10","early")\n  window.debug.lastEnds()\n  window.debug.errors()\n  window.debug.csp()');
        };
        window.debug = window.debug || {};
        // Errors snapshot
        window.debug.errors = function(){ try { return (window.__ERRORS__ && window.__ERRORS__.recent) ? window.__ERRORS__.recent.slice() : []; } catch{ return []; } };
        // CSP snapshot summary
        window.debug.csp = function(){ try { return window.__csp ? { count: window.__csp.events.length, groups: window.__csp.summarize() } : { count:0, groups:{} }; } catch{ return { count:0, groups:{} }; } };
        // Scheduling helpers are loaded lazily to avoid upfront cost
        window.debug.candidates = async function(dateStr, shiftKey){
            const mod = await import('./scheduler.js');
            const { SchedulingEngine } = mod;
            const month = (dateStr||'').slice(0,7);
            const eng = new SchedulingEngine(month);
            const weekNum = eng.getWeekNumber(new Date(dateStr));
            const scheduledToday = new Set(Object.values(appState.scheduleData?.[month]?.[dateStr]?.assignments||{}));
            const list = eng.findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum);
            return list.map(c=>({ id:c.staff.id, name:(appState.staffData||[]).find(s=>s.id==c.staff.id)?.name||String(c.staff.id), role:c.staff.role, score:c.score }));
        };
        window.debug.ruleCheck = async function(staffId, dateStr, shiftKey){
            const mod = await import('./scheduler.js');
            const { SchedulingEngine, BUSINESS_RULES } = mod;
            const month = (dateStr||'').slice(0,7);
            const eng = new SchedulingEngine(month);
            const staff = (appState.staffData||[]).find(s=>s.id==staffId);
            if (!staff) return { ok:false, error:'staff not found' };
            const hours = SHIFTS[shiftKey]?.hours||0;
            const failures = [];
            for (const r of Object.values(BUSINESS_RULES)){
                try{
                    const ok = r.validate(dateStr, shiftKey, staff, hours, eng);
                    if (!ok) failures.push(r.id);
                }catch(e){ failures.push(r.id+':'+(e?.message||'err')); }
            }
            return { ok: failures.length===0, failures };
        };
        window.debug.lastEnds = function(staffId){
            const out = {};
            const month = Object.keys(appState.scheduleData||{})[0] || (new Date().toISOString().slice(0,7));
            const { SchedulingEngine } = window.__sched_mod || {};
            const build = async ()=>{
                if (!window.__sched_mod){ window.__sched_mod = await import('./scheduler.js'); }
                const { SchedulingEngine } = window.__sched_mod;
                const eng = new SchedulingEngine(month);
                // After seeding, expose lastShiftEndTimes
                return Object.fromEntries(Object.entries(eng.lastShiftEndTimes||{}).map(([k,v])=>[k, v?.toISOString?.()||String(v)]));
            };
            return build();
        };
                // Dry-run schedule generation summary (no mutations)
                window.debug.simulate = async function(monthKey, opts={}){
                    const mod = await import('./scheduler.js');
                    const { SchedulingEngine } = mod;
                    const month = monthKey || (document.getElementById('scheduleMonth')?.value) || (new Date().toISOString().slice(0,7));
                    // Shallow clone appState fields we read to avoid accidental mutation
                    const backup = { scheduleData: appState.scheduleData, auditLog: appState.auditLog };
                    try{
                        // Work on a local copy for the target month schedule only
                        const originalMonth = appState.scheduleData?.[month];
                        const cloneMonth = originalMonth ? JSON.parse(JSON.stringify(originalMonth)) : {};
                        if (!appState.scheduleData) appState.scheduleData = {}; // ensure defined
                        appState.scheduleData[month] = cloneMonth;
                        const eng = new SchedulingEngine(month);
                        const sched = eng.generateSchedule();
                        const data = sched?.data || (appState.scheduleData?.[month]||{});
                        const unfilled = [];
                        // Scan per day what shifts exist and which remain empty
                        const days = Object.keys(data).length ? Object.keys(data) : (()=>{ const out=[]; const [y,m]=month.split('-').map(Number); const daysInMonth=new Date(y,m,0).getDate(); for(let d=1; d<=daysInMonth; d++){ const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`; out.push(ds);} return out; })();
                        days.sort();
                        for (const ds of days){
                            const assigns = data[ds]?.assignments || {};
                            const shifts = sched ? sched.getShiftsForDate(ds) : (Object.keys(SHIFTS||{}));
                            for (const sh of shifts){
                                // Only consider defined shifts for this date type
                                const isDayShift = !!(SHIFTS[sh]);
                                if (!isDayShift) continue;
                                const needs = (sched ? sched.getShiftsForDate(ds) : []).includes(sh);
                                if (!needs) continue;
                                if (assigns[sh]) continue;
                                // Re-run candidate search to get reasonability context
                                const weekNum = eng.getWeekNumber(new Date(ds));
                                const scheduledToday = new Set(Object.values(assigns));
                                const cands = eng.findCandidatesForShift(ds, sh, scheduledToday, weekNum);
                                unfilled.push({ date: ds, shift: sh, candidates: cands.slice(0,5).map(c=>({ id:c.staff.id, name:(appState.staffData||[]).find(s=>s.id==c.staff.id)?.name||String(c.staff.id), score:c.score })) });
                            }
                        }
                        // Return compact summary
                        const filledCount = Object.values(data).reduce((acc,day)=> acc + Object.keys(day?.assignments||{}).length, 0);
                        return { month, filledCount, days: days.length, unfilledCount: unfilled.length, unfilled };
                    } finally {
                        // Restore references; do not persist changes
                        appState.scheduleData = backup.scheduleData;
                        appState.auditLog = backup.auditLog;
                    }
                };
    }
}catch{}

    // Backend fallback banner toggle (runs after services hydration if present)
    try {
        const evalBackendBanner = () => {
            const requestedSupabase = window.CONFIG?.BACKEND === 'supabase';
            const usingSupabase = !!(window.__services?.staff?.store?.remote || window.__services?.store?.remote);
            if (requestedSupabase && !usingSupabase){
                window.__banner && window.__banner('backendFallbackBanner', 'Hinweis: Verbindung zu Supabase nicht aktiv – lokale Speicherung wird verwendet.', 'warn', 0);
            } else {
                const existing = document.getElementById('backendFallbackBanner');
                if (existing) existing.remove();
            }
        };
        // Initial check (in case services already attached synchronously)
        evalBackendBanner();
        if (window.__services && window.__services.ready){
            window.__services.ready.then(()=>{ evalBackendBanner(); });
        } else {
            // Fallback: retry a few times until services appear
            let attempts = 0;
            const t = setInterval(()=>{
                attempts++;
                evalBackendBanner();
                if (window.__services && window.__services.ready || attempts>20){ clearInterval(t); }
            }, 300);
        }
    } catch {}
