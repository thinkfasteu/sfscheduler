import { appState } from './modules/state.js';
import './ui/prototypeCompat.js';
import { ScheduleUI } from './ui/scheduleUI.js';  // Updated path
import { EventHandler } from './ui/eventHandlers.js';  // Updated path
import { APP_CONFIG, SHIFTS } from './modules/config.js';
import { AppUI } from './ui/appUI.js';
import { OvertimeRequestsUI } from './ui/overtimeRequests.js';
import { triggerDownload, importBackupFile } from './src/utils/backup.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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
                if (!document.getElementById('viewOnlyToast')){
                    const t = document.createElement('div');
                    t.id='viewOnlyToast';
                    t.style.cssText='position:fixed;bottom:44px;right:8px;background:#dc3545;color:#fff;font:12px system-ui;padding:6px 10px;border-radius:4px;z-index:3000;box-shadow:0 2px 4px rgba(0,0,0,.3)';
                    t.textContent='Schreib-Lock in anderem Tab. Dort bearbeiten.';
                    document.body.appendChild(t);
                    setTimeout(()=>{ t.style.transition='opacity .6s'; t.style.opacity='0'; setTimeout(()=>t.remove(),700); }, 4000);
                }
            }
        }, true);
    // Seed demo data only once (if never seeded and no staff exist). Persist flag after first seed or after first manual modification.
    const DEMO_FLAG_KEY = 'demoSeeded';
    const demoFlag = (typeof localStorage !== 'undefined') ? localStorage.getItem(DEMO_FLAG_KEY) : null;
    if ((!Array.isArray(appState.staffData) || appState.staffData.length === 0) && !demoFlag) {
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
    const eventHandler = new EventHandler(scheduleUI);
    // App UI for staff/availability/vacation
    const appUI = new AppUI(scheduleUI);
    appUI.init();
    // Overtime Requests panel
    const overtimeUI = new OvertimeRequestsUI('#overtimeRequestsList');
    overtimeUI.render();
    // Re-render requests list on simple schedule updates
        const _origSave = appState.save.bind(appState);
        appState.save = function(immediate){
            _origSave(immediate);
            try{ overtimeUI.render(); }catch{}
            announce('state-saved', { keys: Object.keys(appState).filter(k=> appState.isDurableKey && appState.isDurableKey(k)) });
        };
    // Expose to prototype compatibility shim
    window.handlers = eventHandler;
    window.appUI = appUI;
    // Backup API
    window.__backup = {
        export: ()=> triggerDownload(),
        importFile: async (file)=>{ try { const res = await importBackupFile(file); console.info('[backup] restored', res); window.appUI && window.appUI.refreshAll && window.appUI.refreshAll(); toast('Backup importiert'); } catch(e){ console.error('[backup] import failed', e); toast('Import fehlgeschlagen','error'); } }
    };
    function toast(msg, variant){
        let t = document.createElement('div');
        t.className='toast-msg';
        t.style.cssText='position:fixed;top:8px;right:8px;background:'+(variant==='error'?'#dc3545':'#198754')+';color:#fff;padding:6px 10px;font:12px system-ui;border-radius:4px;z-index:4000;box-shadow:0 2px 6px rgba(0,0,0,.35)';
        t.textContent=msg; document.body.appendChild(t);
        setTimeout(()=>{ t.style.transition='opacity .6s'; t.style.opacity='0'; setTimeout(()=>t.remove(),650); }, 3500);
    }
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
    } catch {}
});

// Handle cleanup on page unload
window.addEventListener('beforeunload', () => {
    appState.save(true);
});

// Export for console debugging
window.DEBUG = {
    state: appState,
    APP_CONFIG,
    SHIFTS
};
// Expose shifts for helpers like export without ESM imports in global scope
window.SHIFTS = SHIFTS;
