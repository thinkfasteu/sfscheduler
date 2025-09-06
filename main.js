import { appState } from './modules/state.js';
import './ui/prototypeCompat.js';
import { ScheduleUI } from './ui/scheduleUI.js';  // Updated path
import { EventHandler } from './ui/eventHandlers.js';  // Updated path
import { APP_CONFIG, SHIFTS } from './modules/config.js';
import { AppUI } from './ui/appUI.js';
import { OvertimeRequestsUI } from './ui/overtimeRequests.js';

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    appState.load();
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
    const _save = appState.save.bind(appState);
    appState.save = function(){ _save(); try{ overtimeUI.render(); }catch{} };
    // Expose to prototype compatibility shim
    window.handlers = eventHandler;
    window.appUI = appUI;

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
