/* SCHEDULE UI - READY FOR INTEGRATION WITH NEW SCHEDULE TAB
 * 
 * This file contains the complete UI rendering logic for the schedule system.
 * It was working properly but the schedule tab has been removed for rebuild.
 * 
 * Key functionality this class provides:
 * - Monthly calendar rendering with 3 shifts per day
 * - Drag & drop assignment interface  
 * - Staff assignment validation and conflict detection
 * - Weekend/holiday shift handling
 * - Export functionality (CSV/PDF)
 * - Integration with SchedulingEngine for automatic generation
 * 
 * To use: new ScheduleUI('#scheduleContent') when schedule tab is rebuilt
 * Entry point: constructor takes containerId selector
 * Key methods: renderCalendar(), handleAssignments(), exportSchedule()
 */

import { APP_CONFIG, SHIFTS, isCriticalShift } from '../modules/config.js';
import { appState } from '../modules/state.js';
import { SchedulingEngine } from '../scheduler.js';
import { ScheduleValidator } from '../validation.js';
import { parseYMD } from '../utils/dateUtils.js';

export class ScheduleUI {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        if (!this.container) {
            console.error('ScheduleUI: container not found', containerId);
            return;
        }
    this.currentCalendarMonth = null; // track rendered month
    this._hydratedMonths = new Set(); // availability hydration cache per month
    this._validators = {}; // cache validators per month
    this._validationSummary = []; // store latest violations for accessibility
    if (!window.__perf) window.__perf = {}; // lightweight counters
    window.__perf.calendarFullRenders = window.__perf.calendarFullRenders || 0;
    window.__perf.calendarDiffUpdates = window.__perf.calendarDiffUpdates || 0;
        this._delegatesBound = false; // ensure we bind global delegation once
        this.setupTabs();
        // Set up handlers
        if (!window.handlers) window.handlers = {};
        // Note: finalizeSchedule handler is now in EventHandler.finalizeSchedule()
        // Expose modal helpers if not already present (scoped to this file's lifecycle)
        if (!window.__uiModalHelpersInstalled) {
            window.__uiModalHelpersInstalled = true;
            // Maintain a stack for focus restoration
            window.__modalFocusStack = [];
            const FOCUSABLE_SELECTOR = 'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex]:not([tabindex="-1"]), [contenteditable]';
            const trapFocus = (modal) => {
                const nodes = Array.from(modal.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el=>el.offsetParent!==null);
                if (!nodes.length) return;
                let first = nodes[0];
                let last = nodes[nodes.length-1];
                const handler = (e) => {
                    if (e.key !== 'Tab') return;
                    if (e.shiftKey){
                        if (document.activeElement === first){ e.preventDefault(); last.focus(); }
                    } else {
                        if (document.activeElement === last){ e.preventDefault(); first.focus(); }
                    }
                };
                modal.__focusHandler = handler;
                modal.addEventListener('keydown', handler);
            };
            const releaseFocus = (modal) => {
                if (modal?.__focusHandler) modal.removeEventListener('keydown', modal.__focusHandler);
            };
            window.showModal = function showModal(id, opts={}){
                const m = document.getElementById(id);
                if (!m){ console.warn('[showModal] missing modal', id); return; }
                // Record previously focused element
                window.__modalFocusStack.push({ id, el: document.activeElement });
                m.classList.add('open');
                m.setAttribute('aria-modal','true');
                m.setAttribute('role', m.getAttribute('role')||'dialog');
                // A11y: auto-bind aria-labelledby if absent
                try {
                    if (!m.hasAttribute('aria-labelledby')) {
                        let titleEl = m.querySelector('[data-modal-title]') || m.querySelector('h1,h2,h3,h4,h5') || document.getElementById(`${id}Title`);
                        if (titleEl){
                            if (!titleEl.id) titleEl.id = `${id}__title`;
                            m.setAttribute('aria-labelledby', titleEl.id);
                        }
                    }
                    // Add role=document to a primary content wrapper if present
                    const content = m.querySelector('.modal-content');
                    if (content && !content.hasAttribute('role')) content.setAttribute('role','document');
                } catch(a11yErr){ /* non-fatal */ }
                document.body.classList.add('no-scroll');
                document.getElementById('scheduleChecklistRoot')?.classList.add('modal-open');
                // Ensure focus sentinels (always enabled per design)
                if (!m.__sentinels){
                    const makeSentinel = (pos) => {
                        const s = document.createElement('div');
                        s.className = 'sr-only focus-sentinel';
                        s.tabIndex = 0;
                        s.dataset.sentinel = pos;
                        return s;
                    };
                    const start = makeSentinel('start');
                    const end = makeSentinel('end');
                    m.prepend(start);
                    m.appendChild(end);
                    const focusables = () => Array.from(m.querySelectorAll(FOCUSABLE_SELECTOR)).filter(el=> el.offsetParent!==null && !el.classList.contains('focus-sentinel'));
                    start.addEventListener('focus', ()=> {
                        const f = focusables();
                        if (f.length) f[f.length-1].focus(); else m.focus();
                    });
                    end.addEventListener('focus', ()=> {
                        const f = focusables();
                        if (f.length) f[0].focus(); else m.focus();
                    });
                    m.__sentinels = { start, end };
                }
                // Move focus to first focusable or modal itself
                const focusable = m.querySelector(FOCUSABLE_SELECTOR);
                if (focusable) focusable.focus(); else m.setAttribute('tabindex','-1'), m.focus();
                trapFocus(m);
                if (opts.onOpen) { try { opts.onOpen(m); } catch(e){ console.warn('[showModal:onOpen]', e); } }
            };
            // Backward compatible aliases
            window.openModal = function openModal(id, opts){ return window.showModal(id, opts); };
            window.__openModal = window.openModal; // canonical
            window.hideModal = function hideModal(id){ return window.closeModal(id); };
            window.closeModal = function closeModal(id, opts={}){
                const m = document.getElementById(id);
                if (!m) return;
                releaseFocus(m);
                m.classList.remove('open');
                m.removeAttribute('aria-modal');
                // Restore focus to previous element if top of stack
                const stack = window.__modalFocusStack;
                let prev; if (stack && stack.length){
                    while(stack.length){ const top = stack.pop(); if (top.id === id){ prev = top.el; break; } }
                }
                const anyOpen = !!document.querySelector('.modal.open');
                if (!anyOpen){
                    document.body.classList.remove('no-scroll');
                    document.getElementById('scheduleChecklistRoot')?.classList.remove('modal-open');
                }
                if (prev && typeof prev.focus==='function') setTimeout(()=>prev.focus(), 30);
                if (opts.onClose){ try { opts.onClose(m); } catch(e){ console.warn('[closeModal:onClose]', e); } }
            };
            window.__closeModal = window.closeModal;
            // If a modalManager exists, normalize its open/close to always use our a11y wrappers
            try {
                if (window.modalManager && !window.modalManager.__wrappedForA11y){
                    const mm = window.modalManager;
                    const origOpen = mm.open ? mm.open.bind(mm) : null; // keep for diagnostics if needed
                    const origClose = mm.close ? mm.close.bind(mm) : null;
                    mm.open = function(id, opts){
                        // Always route through showModal so focus trap & sentinels apply
                        window.showModal(id, opts||{});
                    };
                    mm.close = function(id, opts){
                        window.closeModal(id, opts||{});
                    };
                    mm.__wrappedForA11y = { origOpen: !!origOpen, origClose: !!origClose };
                    console.info('[modalManager] wrapped for unified a11y modal handling');
                }
            } catch(modWrapErr){ console.warn('[modalManager] wrap failed', modWrapErr); }
            // Global escape handler to close the top-most modal
            window.addEventListener('keydown', (e)=>{
                if (e.key === 'Escape'){ // close last opened modal
                    const openModals = Array.from(document.querySelectorAll('.modal.open'));
                    const last = openModals[openModals.length-1];
                    if (last){
                        const id = last.id;
                        if (window.__closeModal) window.__closeModal(id); else window.closeModal(id);
                    }
                }
            });
            // Click outside to close (optional)
            window.addEventListener('click', (e)=>{
                const open = document.querySelectorAll('.modal.open[data-backdrop-close="true"]');
                if (!open.length) return;
                open.forEach(m => {
                    if (!m.contains(e.target)){
                        window.closeModal(m.id);
                    }
                });
            });
            // Bind close buttons once DOM likely loaded; if not present yet, defer a tick
            const bindModalCloseButtons = () => {
                document.querySelectorAll('[data-modal-close]').forEach(btn => {
                    btn.addEventListener('click', ()=>{
                        const target = btn.getAttribute('data-modal-close') || btn.closest('.modal')?.id;
                        if (target) window.closeModal(target);
                    });
                });
                // Legacy ids
                document.getElementById('swapModalCloseBtn')?.addEventListener('click', ()=> window.closeModal('swapModal'));
                document.getElementById('searchModalCloseBtn')?.addEventListener('click', ()=> window.closeModal('searchModal'));
                document.getElementById('holidaysModalCloseBtn')?.addEventListener('click', ()=> window.closeModal('holidaysModal'));
            };
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', bindModalCloseButtons, { once:true });
            } else {
                setTimeout(bindModalCloseButtons, 0);
            }
        }
    }

    // Helper for performance: mutate schedule in place and revert after validation
    _withScheduleMutation(schedule, dateStr, shift, staffId, callback) {
        const original = schedule[dateStr]?.assignments?.[shift];
        if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
        if (!schedule[dateStr].assignments) schedule[dateStr].assignments = {};
        schedule[dateStr].assignments[shift] = staffId;
        try {
            return callback();
        } finally {
            if (original === undefined) {
                delete schedule[dateStr].assignments[shift];
                if (Object.keys(schedule[dateStr].assignments).length === 0) {
                    delete schedule[dateStr];
                }
            } else {
                schedule[dateStr].assignments[shift] = original;
            }
        }
    }

    // Helper to get base candidates for a shift without filtering out blockers
    _getBaseCandidatesForShift(dateStr, shift, includeManager = false) {
        const month = dateStr.substring(0, 7);
        const candidates = [];
        const staffList = window.appState?.staffData || [];
        
        // Include all staff with basic availability or permanent status
        staffList.forEach(staff => {
            const avail = appState.availabilityData?.[staff.id]?.[dateStr]?.[shift];
            const isAvailable = avail === 'yes' || avail === 'prefer';
            const isPermanent = staff.role === 'permanent';
            
            // Check for exclusions
            const vac = (appState.vacationsByStaff?.[staff.id] || []).some(p => {
                if (!p?.start || !p?.end) return false;
                const t = parseYMD(dateStr).getTime();
                const st = parseYMD(p.start).getTime();
                const en = parseYMD(p.end).getTime();
                return t >= st && t <= en;
            });
            const ill = (appState.illnessByStaff?.[staff.id] || []).some(p => {
                if (!p?.start || !p?.end) return false;
                const t = parseYMD(dateStr).getTime();
                const st = parseYMD(p.start).getTime();
                const en = parseYMD(p.end).getTime();
                return t >= st && t <= en;
            });
            const dayOff = appState.availabilityData?.[`staff:${staff.id}`]?.[dateStr] === 'off';
            
            if (!(vac || ill || dayOff) && (isAvailable || isPermanent)) {
                candidates.push({ staff, score: 0 });
            }
        });
        
        // Always include staff already assigned this month (for reassignment)
        const monthData = window.appState?.scheduleData?.[month] || {};
        Object.values(monthData).forEach(dayData => {
            if (dayData?.assignments) {
                Object.values(dayData.assignments).forEach(staffId => {
                    if (staffId && staffId !== 'manager' && !candidates.find(c => c.staff.id === staffId)) {
                        const staff = staffList.find(s => s.id === staffId);
                        if (staff) candidates.push({ staff, score: 0 });
                    }
                });
            }
        });
        
        // Add manager if requested
        if (includeManager) {
            candidates.push({ staff: { id: 'manager', name: 'Manager', role: 'manager' }, score: 0 });
        }
        
        return candidates;
    }

    setupTabs() {
        // Make UI instance available globally
        window.ui = this;
        // Check for tab system and set up handlers
        const hasPrototypeTabs = document.querySelector('.tabs');
        if (hasPrototypeTabs) {
            // Global tab system exists, don't override
            return; 
        }
        // Fallback: modular tab navigation (.tab-button with data-tab)
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.addEventListener('click', () => this.showTab(btn.dataset.tab));
        });
        this.showTab('schedule');
    }

    showTab(tabName) {
        // If prototype global showTab exists, delegate
        if (typeof window.showTab === 'function') {
            try {
                window.showTab(null, tabName);
                return;
            } catch (e) {
                // fall through to modular behavior if delegation fails
            }
        }
        // Modular behavior: expects .tab-content + .tab-button structure
        const targetContent = document.getElementById(`${tabName}Content`);
        const targetButton = document.querySelector(`[data-tab="${tabName}"]`);
        if (!targetContent || !targetButton) {
            console.warn('ScheduleUI: missing tab elements', { tabName, targetContent, targetButton });
            return;
        }
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                targetContent.classList.add('active');
                this.updateCalendarFromSelect(); // Ensure calendar updates when tab is shown
        targetButton.classList.add('active');
    }

    addVacationPeriod() {
        // Implementation will be added
        console.log('Add vacation period clicked');
    }

    setupHandlers() {
        // Event handlers are now bound directly via eventBindings.js
        // No need for delegation since direct binding is more reliable
    }

    // Compute canonical day type using latest holiday + weekend logic
    computeDayType(dateStr){
        try {
            const hol = this.getHolidayName(dateStr);
            if (hol) return 'holiday';
            const d = parseYMD(dateStr).getDay();
            if (d===0 || d===6) return 'weekend';
            return 'weekday';
        } catch(e){ return 'weekday'; }
    }

    // Reclassify all cells of the current month after late holiday load
    reclassifyMonthDayTypes(monthKey){
        if (!monthKey) return [];
        const nodes = Array.from(document.querySelectorAll(`.cal-body[data-date^="${monthKey}"]`));
        const changed = [];
        nodes.forEach(n => {
            const dateStr = n.getAttribute('data-date');
            const prevType = n.getAttribute('data-type');
            const newType = this.computeDayType(dateStr);
            if (prevType !== newType){
                n.setAttribute('data-type', newType);
                changed.push({ dateStr, from: prevType, to: newType });
            }
        });
        if (changed.length){
            console.log(`[reclassifyMonthDayTypes] ${changed.length} day(s) changed`, changed.slice(0,5));
            // Re-render assignments for changed dates (ensure shift set matches)
            changed.forEach(ch => this.updateDay(ch.dateStr));
        }
        return changed;
    }

    ensureHolidaysLoaded(year) {
        // Check if holidays are already loaded for this year
        const yearStr = String(year);
        const existing = window.appState?.holidays?.[yearStr];
        const existingCount = existing ? Object.keys(existing).length : 0;
        
        console.log(`[ensureHolidaysLoaded] Checking year ${year}:`, {
          hasHolidaysObject: !!window.appState?.holidays,
          hasYearData: !!existing,
          existingCount,
          existingKeys: existing ? Object.keys(existing).slice(0, 3) : [],
          callStack: new Error().stack.split('\n').slice(1, 4).map(line => line.trim())
        });
        
        if (existing && existingCount > 0) {
            console.log(`[ensureHolidaysLoaded] Already loaded ${existingCount} holidays for ${year}, skipping fetch`);
            return; // Already loaded
        }

        // Wait for services to be ready before attempting to fetch
        const attemptFetch = () => {
            if (window.__services?.holiday?.fetchHolidaysForYear) {
                console.log(`Auto-fetching holidays for ${year}...`);
                window.__services.holiday.fetchHolidaysForYear(year)
                    .then(() => {
                        console.log(`Successfully loaded holidays for ${year}`);
                        // Log the actual holiday data
                        const holidays = window.appState?.holidays?.[String(year)] || {};
                        // Mark log for split-brain detection
                        console.log('[holidays][reader] mark=', window.__STATE_MARK__, appState.holidays[String(year)]);
                        console.log(`Holiday data for ${year}:`, holidays);
                        const oct3 = holidays['2025-10-03'];
                        if (oct3) {
                            console.log(`✅ October 3rd found in data: "${oct3}"`);
                        } else {
                            console.log(`❌ October 3rd NOT found in loaded data`);
                        }
                        // Update calendar cells to show newly loaded holiday badges
                        console.log(`Calling updateHolidayBadges + reclassification for ${year}...`);
                        try {
                            if (this.currentCalendarMonth && this.currentCalendarMonth.startsWith(String(year))){
                                this.reclassifyMonthDayTypes(this.currentCalendarMonth);
                            }
                        } catch(e){ console.warn('[ensureHolidaysLoaded] reclassify failed', e); }
                        this.updateHolidayBadges(year);
                    })
                    .catch(err => {
                        console.warn(`Failed to load holidays for ${year}:`, err);
                    });
            } else {
                console.warn('Holiday service not available for auto-fetching');
            }
        };

        // If services are ready, fetch immediately
        if (window.__services?.ready) {
            window.__services.ready.then(attemptFetch);
        } else {
            // Fallback: retry a few times until services are available
            let attempts = 0;
            const checkServices = () => {
                attempts++;
                if (window.__services?.holiday?.fetchHolidaysForYear) {
                    attemptFetch();
                } else if (attempts < 10) {
                    setTimeout(checkServices, 200); // Check every 200ms
                } else {
                    console.warn(`Holiday service still not available after ${attempts} attempts`);
                }
            };
            setTimeout(checkServices, 100); // Start checking after 100ms
        }
    }

    // Helper function to get holiday name using TS singleton with appState fallback
    getHolidayName(dateStr) {
        const yearStr = dateStr.split('-')[0];
        // Prefer service only if it actually returns a value for this date
        try {
            const fromSvc = window.holidayService?.getHolidayName?.(dateStr) || null;
            if (fromSvc) return fromSvc;
        } catch(e){ /* swallow */ }
        return window.appState?.holidays?.[yearStr]?.[dateStr] || null;
    }
    // Canonical shift resolution based on computed day type
    getApplicableShifts(dateStr){
        const type = this.computeDayType(dateStr);
        return Object.entries(SHIFTS).filter(([_,v])=>v.type===type).map(([k])=>k);
    }

    updateHolidayBadges(year) {
        // Paint holiday badges only for the currently rendered month to avoid log spam
        const yearStr = String(year);
        const svcMap = window.holidayService?.getHolidaysForYear?.(Number(year)) || {};
        const holidays = Object.keys(svcMap).length ? svcMap : (window.appState?.holidays?.[yearStr] || {});
        const monthKey = this.currentCalendarMonth; // e.g. "2025-10"
        if (!monthKey) return;
        const entries = Object.entries(holidays).filter(([dateStr]) => dateStr.startsWith(monthKey));
        console.log(`[updateHolidayBadges] Painting ${entries.length} holiday(s) for ${monthKey}`);
        for (const [dateStr, holidayName] of entries) {
            const calBody = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
            if (!calBody) continue; // silently ignore days not in DOM
            const calCell = calBody.parentElement;
            const calDate = calCell?.querySelector('.cal-date');
            if (!calDate) continue;
            if (!calDate.querySelector('.badge')) {
                const dayText = calDate.textContent.trim();
                calDate.innerHTML = `${dayText} <span class="badge">${holidayName}</span>`;
            }
        }
    }

    // Extended version with options
    updateHolidayBadgesExt(year, { retype=false }={}){
        const yearStr = String(year);
        const svcMap = window.holidayService?.getHolidaysForYear?.(Number(year)) || {};
        const holidays = Object.keys(svcMap).length ? svcMap : (window.appState?.holidays?.[yearStr] || {});
        const monthKey = this.currentCalendarMonth;
        if (!monthKey) return 0;
        if (retype){
            try { this.reclassifyMonthDayTypes(monthKey); } catch(e){ console.warn('[holiday][retype] failed', e); }
        }
        const entries = Object.entries(holidays).filter(([dateStr]) => dateStr.startsWith(monthKey));
        console.log(`[updateHolidayBadges] Painting ${entries.length} holiday(s) for ${monthKey}${retype?' (after retype)':''}`);
        let painted=0;
        for (const [dateStr, holidayName] of entries) {
            const calBody = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
            if (!calBody) continue;
            const calCell = calBody.parentElement;
            const calDate = calCell?.querySelector('.cal-date');
            if (!calDate) continue;
            if (!calDate.querySelector('.badge')) {
                const dayText = calDate.textContent.trim();
                calDate.innerHTML = `${dayText} <span class="badge">${holidayName}</span>`;
                painted++;
            }
        }
        return painted;
    }

    refreshDisplay() {
        // Basic display implementation: simple toolbar + placeholder
        if (!this.container) {
            console.warn('ScheduleUI: no container to render into');
            return;
        }
        // Ensure schedule grid exists; toolbar/select lives in index.html prototype markup
        if (!document.getElementById('scheduleGrid')) {
            this.container.innerHTML = '<div id="scheduleGrid">Schedule UI Loading...</div>';
        }
        // Initialize month selector and calendar
        this.initMonthSelector();
        this.updateCalendarFromSelect();
    }
    initMonthSelector() {
        const el = document.getElementById('scheduleMonth');
        if (!el) return;
        // Populate if it's a <select>
        if (el.tagName === 'SELECT') {
            if (!el.options || el.options.length === 0) {
                const now = new Date();
                const months = 12; // next 12 months
                for (let i = 0; i < months; i++) {
                    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
                    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    const opt = document.createElement('option');
                    opt.value = val;
                    opt.textContent = d.toLocaleString(undefined, { month: 'long', year: 'numeric' });
                    el.appendChild(opt);
                }
            }
            // Default to current month if empty
            if (!el.value) {
                const now = new Date();
                el.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            }
        }
        // Re-render on change
        el.addEventListener('change', () => { this.updateCalendarFromSelect(); const v = el.value; if (v) this.prehydrateAvailability(v).catch(()=>{}); });
        // Initial pre-hydration for default value
        if (el.value) { this.prehydrateAvailability(el.value).catch(()=>{}); }
        // Hook student exception toggle
        const exc = document.getElementById('studentExceptionCheckbox');
        if (exc){
            exc.addEventListener('change', ()=>{
                const month = el.value;
                if (!month) return;
                appState.studentExceptionMonths[month] = !!exc.checked;
                appState.save?.();
            });
        }
        const fair = document.getElementById('studentFairnessCheckbox');
        if (fair){
            fair.checked = !!appState.studentFairnessMode;
            fair.addEventListener('change', ()=>{ appState.studentFairnessMode = !!fair.checked; appState.save?.(); });
        }
    }

    updateCalendarFromSelect() {
        const el = document.getElementById('scheduleMonth');
        const month = el?.value;
        if (!month) return;
        // If calendar already rendered for this month, skip full rebuild – just refresh assignments + weekend report
        if (this.currentCalendarMonth === month && document.getElementById('scheduleGrid')) {
            this.renderAssignments(month);
            this.renderWeekendReport(month);
            return;
        }
        // Ensure schedule grid host
        let grid = document.getElementById('scheduleGrid');
        if (!grid) {
            this.container.innerHTML = '<div id="scheduleGrid"></div>';
            grid = document.getElementById('scheduleGrid');
        }

    const [y, m] = month.split('-').map(Number);
        
        const first = new Date(y, m - 1, 1);
        const startDay = (first.getDay() + 6) % 7; // Monday=0
        const daysInMonth = new Date(y, m, 0).getDate();

        let html = '<div id="scheduleStatus" class="status-line hidden"><span class="spinner"></span><span id="scheduleStatusText">Synchronisiere Verfügbarkeiten…</span></div>'
            + '<div class="flex flex-wrap jc-end gap-8 mb-8">'
            + '<button class="btn btn-secondary" id="scheduleShowHolidaysBtn">Feiertage</button>'
            + '<button class="btn btn-secondary" id="openSearchAssignBtn">Suchen & Zuweisen (Datum wählen)</button>'
            + '</div>';
        html += '<div class="cal"><div class="cal-row cal-head">';
        const wk = ['Mo','Di','Mi','Do','Fr','Sa','So'];
        wk.forEach(d => html += `<div class="cal-cell cal-head-cell">${d}</div>`);
        html += '</div>';

        let day = 1;
        for (let r = 0; r < 6 && day <= daysInMonth; r++) {
            html += '<div class="cal-row">';
            for (let c = 0; c < 7; c++) {
                const cellIndex = r * 7 + c;
                if (cellIndex < startDay || day > daysInMonth) {
                    html += '<div class="cal-cell cal-empty"></div>';
                } else {
                    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                    const isWeekend = c >= 5;
                    // Use TS singleton as primary source, fallback to appState for compatibility
                    const holName = this.getHolidayName(dateStr);
                    const type = holName ? 'holiday' : (isWeekend ? 'weekend' : 'weekday');
                    html += `<div class="cal-cell ${isWeekend ? 'cal-weekend' : ''}">
                        <div class="cal-date">${day}${holName ? ` <span class=\"badge\">${holName}</span>` : ''}</div>
                        <div class="cal-body" data-date="${dateStr}" data-type="${type}"></div>
                    </div>`;
                    day++;
                }
            }
            html += '</div>';
        }
        html += '</div>';
    grid.innerHTML = html;
    // Set current month BEFORE attempting holiday badge update so filter works
    this.currentCalendarMonth = month;
    try { this.ensureHolidaysLoaded(y); } catch(e){ console.warn('[phase] ensureHolidaysLoaded failed', e); }
    // Bind event delegation for calendar interactions
    this.bindDelegatesOnce();
    try { this.updateHolidayBadgesExt(y, { retype:true }); } catch(e){ console.warn('[phase] updateHolidayBadges initial failed', e); }
    // Toolbar buttons now handled via direct binding in eventBindings.js
    window.__perf.calendarFullRenders++;
        // Track a selected date for search modal (stored on instance)
        this._selectedDateForSearch = null;
    // Click handlers
    // Calendar cell clicks handled via delegation

    // Sync checkboxes from state for this month
    const exc = document.getElementById('studentExceptionCheckbox');
    if (exc) exc.checked = !!appState.studentExceptionMonths?.[month];
    const fair = document.getElementById('studentFairnessCheckbox');
    if (fair) fair.checked = !!appState.studentFairnessMode;

    // After drawing the grid, render current assignments if any
        this.renderAssignments(month);
    // Render weekend distribution report
    this.renderWeekendReport(month);
        // Fire-and-forget availability hydration for this month; show status, re-render when done
        this.setStatus('Synchronisiere Verfügbarkeiten…', true);
            this.prehydrateAvailability(month).then(()=>{
      if (this.currentCalendarMonth === month){
        this.renderAssignments(month);
        this.renderWeekendReport(month);
        // NO automatic generation - user must click "Plan erstellen" button
      }
                // brief confirmation
                this.setStatus('Synchronisiert ✓', true, false);
                setTimeout(()=>{ this.clearStatus(); }, 900);
        }).catch((e)=>{ console.warn(e); this.clearStatus(); });
        if (window.CONFIG?.A11Y_AUDIT_AUTO){
            try {
                const issues = this.runA11yAudit?.();
                if (issues) {
                    const counts = issues.reduce((acc,i)=>{ acc[i.type]=(acc[i.type]||0)+1; return acc; },{});
                    console.info('[a11y] audit summary after render', { total: issues.length, counts });
                }
            } catch(ae){ console.warn('[a11y] audit invocation failed', ae); }
        }
    }

    bindDelegatesOnce(){
        // Delegation system removed - schedule buttons now use direct binding in eventBindings.js
        // Calendar interaction events are still handled separately
        if (this._delegatesBound) {
            return;
        }
        this._delegatesBound = true;
        // Calendar delegation only (toolbar buttons moved to direct binding)
        document.addEventListener('click', (e)=>{
            // Only handle specific calendar-related buttons and interactions
            // DO NOT handle schedule toolbar buttons (they use direct binding)
            
            // Modal-specific buttons that need delegation
            const btn = e.target.closest('button');
            if (btn){
                const id = btn.id;
                if (id === 'openSearchAssignBtn'){
                    const dateStr = this._selectedDateForSearch || document.querySelector('.cal-body[data-date]')?.getAttribute('data-date');
                    if (!dateStr){ alert('Bitte ein Datum im Kalender wählen.'); return; }
                    this.openSearchAssignModal(dateStr);
                } else if (id === 'executeSwapBtn'){
                    try { window.handlers?.executeSwap?.(); }
                    catch(err){ console.warn('[delegation] executeSwap failed', err); }
                }
                // Important: Don't prevent other button events from bubbling
                return;
            }
            // Modal backdrop click to close
            if (e.target.classList.contains('modal') && e.target.closest('.modal')?.classList.contains('open')){
                const modalId = e.target.id;
                if (modalId) window.closeModal?.(modalId);
            }
            const body = e.target.closest('.cal-body[data-date]');
            if (body){
                const dateStr = body.getAttribute('data-date');
                this._selectedDateForSearch = dateStr;
                if (e.detail === 2){
                    // double click -> open with first unassigned
                    try {
                        const allShifts = this.getApplicableShifts(dateStr);
                        const monthKey = dateStr.substring(0,7);
                        const cur = window.appState?.scheduleData?.[monthKey]?.[dateStr]?.assignments || {};
                        const firstUnassigned = allShifts.find(s => !cur[s]);
                        this.openAssignModal(dateStr, firstUnassigned);
                    } catch(err){ console.warn('[delegation] dblclick openAssign failed', err); }
                } else if (e.detail === 1){
                    this.openAssignModal(dateStr);
                }
            }
            // Delegated pill click (assignment or unassigned pill)
            const pill = e.target.closest('.staff-assignment[data-date]');
            if (pill && !e.target.closest('button')){
                e.stopPropagation();
                const dateStr = pill.getAttribute('data-date');
                const shiftKey = pill.getAttribute('data-shift');
                this.openAssignModal(dateStr, shiftKey);
            }
            // Delegated swap button inside pill
            const swap = e.target.closest('.swap-btn[data-date]');
            if (swap){
                e.stopPropagation();
                const dateStr = swap.getAttribute('data-date');
                const shiftKey = swap.getAttribute('data-shift');
                this.openAssignModal(dateStr, shiftKey);
            }
        }, true);
    }

    generateScheduleForCurrentMonth(){
        const month = this.currentCalendarMonth;
        console.log('[generateSchedule] manual generation called for month=', month);
        if (!month){ console.warn('[generateSchedule] no current month'); return; }
        if (this._generating){ console.warn('[generateSchedule] already in progress'); return; }
        
        // Manual generation - no automatic checks, always proceed
        this._generating = true;
        (async ()=> {
            const startedAt = performance.now?.()||0;
            try {
                this.setStatus('Erzeuge Plan…', true);
                this.setBusy(true);
                // Ensure availability hydration if not yet done
                if (!this._hydratedMonths.has(month)){
                    this.setStatus('Lade Verfügbarkeiten…', true);
                    try { await this.prehydrateAvailability(month); } catch(hErr){ console.warn('[generateSchedule] hydration failed (continuing)', hErr); }
                }
                // Ensure structure exists
                appState.scheduleData[month] = appState.scheduleData[month] || {};
                const engine = new SchedulingEngine(month);
                console.info('[generateSchedule] start compute', { month });
                const generated = engine.generateSchedule();
                const genDuration = (performance.now?.()||0) - startedAt;
                // Merge generated into state (basic replace)
                appState.scheduleData[month] = generated;
                appState.save?.();
                this.renderAssignments(month);
                this.renderWeekendReport(month);
                this.setStatus('Plan erstellt ✓', true, false);
                console.info('[generateSchedule] complete', { month, ms: Math.round(genDuration) });
                setTimeout(()=> this.clearStatus(), 1200);
            } catch(e){
                console.error('[generateSchedule] failed', e);
                this.setStatus('Fehler bei Planerzeugung', true, false);
                setTimeout(()=> this.clearStatus(), 1800);
            } finally {
                this._generating = false;
                this.setBusy(false);
            }
        })();
    }


    async prehydrateAvailability(month){
        let releasing = false;
        try {
            if (!month || this._hydratedMonths.has(month)) return;
            this.setBusy(true); releasing = true;
            // Ensure services are available
            if (!window.__services){
                const mod = await import('../src/services/index.js');
                window.__services = mod.createServices({});
            }
            await window.__services.ready;
            const store = window.__services?.store;
            const usingRemote = !!(store && (store.remote || (store.constructor && store.constructor.name==='SupabaseAdapter')));
            if (!usingRemote) { this._hydratedMonths.add(month); return; }
            const staffList = window.__services.staff?.list() || [];
            if (!staffList.length) { this._hydratedMonths.add(month); return; }
            const [y,m] = month.split('-').map(Number);
            const fromDate = `${y}-${String(m).padStart(2,'0')}-01`;
            const toDate = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`;
            const avail = window.__services.availability;
            if (!avail) { this._hydratedMonths.add(month); return; }
            const btns = this.disableScheduleControls(true);
            for (const s of staffList){
                try { await avail.listRange(s.id, fromDate, toDate); } catch {}
            }
            this._hydratedMonths.add(month);
            this.disableScheduleControls(false, btns);
        } catch(e){ console.warn('[ScheduleUI] prehydrateAvailability failed', e); }
        finally { if (releasing) this.setBusy(false); }
    }

    setStatus(text, show=true, withSpinner=true){
        const bar = document.getElementById('scheduleStatus'); const txt = document.getElementById('scheduleStatusText'); const sp = bar?.querySelector?.('.spinner');
        if (!bar || !txt) return;
        txt.textContent = text || '';
        bar.classList.toggle('hidden', !show);
        if (sp) sp.classList.toggle('hidden', !withSpinner);
    }
    clearStatus(){ this.setStatus('', false); }
    disableScheduleControls(disabled=true, snapshot=null){
        // Narrow set: only mutation-heavy controls are disabled during hydration
    const ids = ['generateScheduleBtn','clearScheduleBtn','exportScheduleBtn','exportPdfBtn','printScheduleBtn'];
        if (!snapshot){ snapshot = {}; }
        ids.forEach(id=>{ const el = document.getElementById(id); if (!el) return; if (disabled){ snapshot[id] = el.disabled; el.disabled = true; } else { el.disabled = false; } });
        return snapshot;
    }
    

    renderAssignments(month) {
        const data = window.appState?.scheduleData?.[month] || {};
        document.querySelectorAll('.cal-body[data-date]').forEach(cell => {
            const dateStr = cell.getAttribute('data-date');
            const type = cell.getAttribute('data-type');
            const shifts = Object.entries(SHIFTS).filter(([_, v]) => v.type === type).map(([k]) => k);
            const assignments = data[dateStr]?.assignments || {};
            const invalidKeys = Object.keys(assignments).filter(k => !shifts.includes(k));
            const validHtml = shifts.map(shift => {
                const staffId = assignments[shift];
                const meta = SHIFTS[shift] || {};
                if (staffId){
                    const staff = (window.appState?.staffData||[]).find(s=>s.id==staffId);
                    const name = staff?.name || (staffId === 'manager' ? 'Manager' : staffId);
                    const title = `${meta.name||shift} ${meta.time?`(${meta.time})`:''} - ${name}`;
                    return `<div class="staff-assignment" title="${title}" data-date="${dateStr}" data-shift="${shift}">
                        <span class="badge">${shift}</span>
                        <span class="assignee-name">${name}</span>
                    </div>`;
                }
                const title = `${meta.name||shift} ${meta.time?`(${meta.time})`:''} - nicht zugewiesen`;
                return `<div class="staff-assignment unassigned" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> —</div>`;
            }).join('');
            const invalidHtml = invalidKeys.map(shift => {
                const staffId = assignments[shift];
                const staff = (window.appState?.staffData||[]).find(s=>s.id==staffId);
                const name = staff?.name || staffId;
                return `<div class="staff-assignment invalid-shift" data-invalid="true" data-date="${dateStr}" data-shift="${shift}" title="Nicht gültig für ${type}">
                    <span class="badge badge-error">${shift}!</span>
                    <span class="assignee-name">${name}</span>
                </div>`;
            }).join('');
            cell.innerHTML = validHtml + invalidHtml;
        });
        // Per-pill listeners removed; handled by central delegation for performance & consistency
    }

    renderWeekendReport(month){
        const host = document.getElementById('weekendReport');
        if (!host) return;
    const data = window.appState?.scheduleData?.[month] || {};
        const [y, m] = month.split('-').map(Number);
        // Count weekends in month
        const daysInMonth = new Date(y, m, 0).getDate();
        let weekendDays = new Set();
        for (let d=1; d<=daysInMonth; d++){
            const ds = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const dow = parseYMD(ds).getDay();
            if (dow===0 || dow===6) weekendDays.add(ds);
        }
        const weekendCount = Math.ceil(weekendDays.size/2); // approx weekends in month
        // Aggregate assignments by staff on weekend dates
        const counts = {};
        Array.from(weekendDays).forEach(ds => {
            const assigns = data[ds]?.assignments || {};
            Object.values(assigns).forEach(staffId => {
                counts[staffId] = (counts[staffId]||0)+1;
            });
        });
        const staffList = (window.appState?.staffData||[]);
        const lines = staffList.map(s => {
            const isPerm = s.role==='permanent';
            const c = Math.floor((counts[s.id]||0)/2); // per-weekend count approx
            const emoji = isPerm ? '🔹' : (c>=1 ? '✅' : '⚠️');
            const suffix = isPerm ? 'Festangestellt (keine Anforderungen)' : '';
            return `${emoji} ${s.name}\n${c}/${weekendCount} Wochenenden\n${suffix}`;
        });
        // Other staff vacations overlapping month
        const others = (window.appState?.otherStaffData||[]);
        const mm = Number(m);
        const overlaps = [];
        others.forEach(os => {
            (os.vacations||[]).forEach(p => {
                const s = parseYMD(p.start); const e = parseYMD(p.end);
                if (!s || !e) return;
                const startInMonth = (s.getFullYear()===y && (s.getMonth()+1)===mm);
                const endInMonth = (e.getFullYear()===y && (e.getMonth()+1)===mm);
                const spansMonth = s <= new Date(y, mm-1, 31) && e >= new Date(y, mm-1, 1);
                if (spansMonth || startInMonth || endInMonth){
                    overlaps.push(`${os.name}: ${p.start} – ${p.end}`);
                }
            });
        });
        const otherInfo = overlaps.length ? `\n\nWeitere Mitarbeitende (Urlaub):\n- ${overlaps.join('\n- ')}` : '';
    host.innerHTML = `<div><strong>Wochenend-Verteilung für ${month}</strong><br/>Gesamt: ${weekendCount} Wochenenden im Monat</div><pre class="mt-8 pre-wrap">${lines.join('\n\n')}${otherInfo}</pre>`;
    }

    // Incremental update: update a single date cell's assignments only
    updateDay(dateStr){
        if (!dateStr) return;
        const month = dateStr.slice(0,7);
        if (this.currentCalendarMonth !== month){
            // fallback: month changed outside normal flow
            this.updateCalendarFromSelect();
            return;
        }
        const cell = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
        if (!cell){ return; }
        this.renderAssignmentsForDate(month, cell, dateStr);
        window.__perf.calendarDiffUpdates++;
    }

    renderAssignmentsForDate(month, cellEl, dateStr){
        const type = cellEl.getAttribute('data-type');
        const shifts = Object.entries(SHIFTS).filter(([_,v])=>v.type===type).map(([k])=>k);
        const data = window.appState?.scheduleData?.[month] || {};
        const assignments = data[dateStr]?.assignments || {};
        const invalidKeys = Object.keys(assignments).filter(k => !shifts.includes(k));
        const validHtml = shifts.map(shift => {
            const staffId = assignments[shift];
            const meta = SHIFTS[shift] || {};
            if (staffId){
                const staff = (window.appState?.staffData||[]).find(s=>s.id==staffId);
                const name = staff?.name || (staffId === 'manager' ? 'Manager' : staffId);
                const title = `${meta.name||shift} ${meta.time?`(${meta.time})`:''} - ${name}`;
                return `<div class="staff-assignment" title="${title}" data-date="${dateStr}" data-shift="${shift}">
                        <span class="badge">${shift}</span>
                        <span class="assignee-name">${name}</span>
                    </div>`;
            }
            const title = `${meta.name||shift} ${meta.time?`(${meta.time})`:''} - nicht zugewiesen`;
            return `<div class="staff-assignment unassigned" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> —</div>`;
        }).join('');
        const invalidHtml = invalidKeys.map(shift => {
            const staffId = assignments[shift];
            const staff = (window.appState?.staffData||[]).find(s=>s.id==staffId);
            const name = staff?.name || staffId;
            return `<div class="staff-assignment invalid-shift" data-invalid="true" data-date="${dateStr}" data-shift="${shift}" title="Nicht gültig für ${type}">
                <span class="badge badge-error">${shift}!</span>
                <span class="assignee-name">${name}</span>
            </div>`;
        }).join('');
        cellEl.innerHTML = validHtml + invalidHtml;
        // Per-pill listeners removed; central delegation covers interactions
    }

    // Busy state helpers (ref-counted)
    setBusy(b=true){
        if (b){ this._busyCount = (this._busyCount||0)+1; } else { this._busyCount = Math.max(0,(this._busyCount||0)-1); }
        const active = (this._busyCount||0) > 0;
        const root = this.container || document.body; if (!root) return;
        root.classList.toggle('busy', active);
        if (active) root.setAttribute('aria-busy','true'); else root.removeAttribute('aria-busy');
    }

    openAssignModal(dateStr, presetShift){
        const modal = document.getElementById('swapModal');
        if (!modal) return;

        // Ensure execute swap button exists
        let executeBtn = document.getElementById('executeSwapBtn');
        if (!executeBtn) {
            executeBtn = document.createElement('button');
            executeBtn.id = 'executeSwapBtn';
            executeBtn.className = 'btn btn-primary';
            executeBtn.textContent = 'Tausch ausführen';
            executeBtn.style.display = 'none'; // hidden by default
            modal.appendChild(executeBtn);
        }
        // Build shift list for that date based on SHIFTS and holiday/weekend detection
        const [y,m,d] = dateStr.split('-').map(Number);
    const date = new Date(y, m-1, d);
        const holName = this.getHolidayName(dateStr);
        const isWeekend = [0,6].includes(date.getDay());
        const allShifts = this.getApplicableShifts(dateStr);

        const shiftSel = document.getElementById('swapShiftSelect');
        shiftSel.innerHTML = allShifts.map(s=>`<option value="${s}">${s}</option>`).join('');
        // Default to preset, otherwise pick first unassigned if possible
        const month = dateStr.substring(0,7);
        const cur = window.appState?.scheduleData?.[month]?.[dateStr]?.assignments || {};
        const isSwapMode = presetShift && cur[presetShift];
        if (presetShift && allShifts.includes(presetShift)) {
            shiftSel.value = presetShift;
        } else {
            const firstUnassigned = allShifts.find(s => !cur[s]);
            if (firstUnassigned) shiftSel.value = firstUnassigned;
        }
        // Disable shift selection in swap mode to prevent confusion
        shiftSel.disabled = isSwapMode;

        const title = document.getElementById('swapTitle');
        const detail = document.getElementById('swapDetail');
        title.textContent = isSwapMode ? `Tausch ${dateStr}` : `Zuweisung ${dateStr}`;
        detail.textContent = holName ? `Feiertag: ${holName}` : isWeekend ? 'Wochenende' : 'Wochentag';

        // Show current assignment for first shift
        const currentAssignment = document.getElementById('currentAssignment');
        const updateCurrent = () => {
            const s = shiftSel.value;
            const sid = cur[s];
            const staff = (window.appState?.staffData||[]).find(x=>x.id==sid);
            currentAssignment.textContent = sid ? `Aktuell: ${staff?.name||sid}` : 'Aktuell: —';
            // Expose current staff to modal for swap handler
            modal.dataset.currentStaff = sid ? String(sid) : '';
        };
        shiftSel.onchange = updateCurrent; updateCurrent();

        // Build candidate list with scoring from engine
        const engine = new SchedulingEngine(month);
        const weekNum = engine.getWeekNumber(date);
        const getCandidates = (includePermanents=false) => {
            const sh = shiftSel.value;
            const scheduledToday = new Set(Object.values(cur||{}));
            if (isSwapMode) {
                // For swap mode, exclude the current assignee from scheduledToday for this shift
                scheduledToday.delete(cur[sh]);
            }
            const base = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
            const mapById = new Map(base.map(c => [c.staff.id, c]));
            // Always include currently assigned today to enable switching, except for the current shift in swap mode
            const assignedIds = new Set(Object.values(cur||{}));
            if (isSwapMode) assignedIds.delete(cur[sh]);
            assignedIds.forEach(id => {
                if (!mapById.has(Number(id))){
                    const st = (window.appState?.staffData||[]).find(s=>s.id==id);
                    if (st) mapById.set(st.id, { staff: st, score: 0 });
                }
            });
            // Permissive inclusion: include any staff with availability yes/prefer for this shift OR any permanent
            (window.appState?.staffData||[]).forEach(s => {
                const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
                const okAvail = (avail==='yes' || avail==='prefer');
                const isPerm = s.role === 'permanent';
                // Exclude absence and explicit off-day
                const vac = (appState.vacationsByStaff?.[s.id]||[]).some(p=>{ if(!p?.start||!p?.end) return false; const t=parseYMD(dateStr).getTime(); const st=parseYMD(p.start).getTime(); const en=parseYMD(p.end).getTime(); return t>=st && t<=en; });
                const ill = (appState.illnessByStaff?.[s.id]||[]).some(p=>{ if(!p?.start||!p?.end) return false; const t=parseYMD(dateStr).getTime(); const st=parseYMD(p.start).getTime(); const en=parseYMD(p.end).getTime(); return t>=st && t<=en; });
                const dayOff = appState.availabilityData?.[`staff:${s.id}`]?.[dateStr] === 'off';
                if (!(vac||ill||dayOff) && (okAvail || isPerm) && !mapById.has(s.id)){
                    mapById.set(s.id, { staff: s, score: 0 });
                }
            });
            const list = Array.from(mapById.values());
            return list.sort((a,b)=>b.score-a.score);
        };
        const staffSel = document.getElementById('swapStaffSelect');
        // Lightweight consent updater (prevents full candidate re-render on selection changes)
        const updateConsentForSelected = () => {
            try {
                const selectedId = parseInt(staffSel.value || 0);
                const staff = (window.appState?.staffData||[]).find(s=>s.id==selectedId);
                const isWeekendDate = [0,6].includes(parseYMD(dateStr).getDay());
                const showConsent = !!(staff && staff.role==='permanent' && isWeekendDate && !staff.weekendPreference);
                const consentRow = document.getElementById('consentRow');
                const consentCb = document.getElementById('consentCheckbox');
                const consentHint = document.getElementById('consentHint');
                if (consentRow) consentRow.classList.toggle('hidden', !showConsent);
                if (consentHint) consentHint.classList.toggle('hidden', !showConsent);
                if (showConsent){
                    const year = String(parseYMD(dateStr).getFullYear());
                    const hasConsent = !!(window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr]);
                    if (consentCb) consentCb.checked = !!hasConsent;
                } else if (consentCb){
                    consentCb.checked = false;
                }
            } catch(e){ /* noop */ }
        };
        const renderCandidates = () => {
            const includeManager = document.getElementById('includeManagerCheckbox')?.checked || false;
            let cands = this._getBaseCandidatesForShift(dateStr, shiftSel.value, includeManager);
            // Apply manual filters without rebuilding base pool
            const q = (document.getElementById('searchFilterInput')?.value || '').toLowerCase();
            if (q) {
                cands = cands.filter(c => {
                    const s = c.staff;
                    return String(s.name).toLowerCase().includes(q) || String(s.role || '').toLowerCase().includes(q);
                });
            }
            const sh = shiftSel.value;
            // Use cached validator
            if (!this._validators[month]) {
                this._validators[month] = new ScheduleValidator(month);
            }
            const validator = this._validators[month];
            const simBase = window.appState?.scheduleData?.[month] || {};
            // Calculate isWeekend for this dateStr
            const isWeekendDay = [0,6].includes(parseYMD(dateStr).getDay());
            // In swap mode, exclude the currently assigned employee from the dropdown
            if (isSwapMode) {
                const currentId = parseInt(modal.dataset.currentStaff);
                cands = cands.filter(c => c.staff.id !== currentId);
            }
            // Build select options with blocker annotations (don't filter out)
            const options = cands.map(c => {
                const s = c.staff;
                // Use _withScheduleMutation for performance - only for annotation
                const blocker = this._withScheduleMutation(simBase, dateStr, sh, s.id, () => {
                    const validated = validator.validateSchedule(simBase);
                    return s.id === 'manager' ? '' : (validated?.[dateStr]?.blockers?.[sh] || '');
                });
                // Build tooltip with fairness/context
                const state = window.appState;
                const engine = new SchedulingEngine(month);
                const weekNumLocal = engine.getWeekNumber(parseYMD(dateStr));
                const weekendCount = (engine.weekendAssignmentsCount?.[s.id]) ?? 0;
                const daytimeWeek = (engine.studentDaytimePerWeek?.[s.id]?.[weekNumLocal]) ?? 0;
                const parts = [`Score: ${Math.round(c.score)}`];
                if (isWeekendDay) parts.push(`WE bisher: ${weekendCount}`);
                if (!isWeekendDay && (sh==='early'||sh==='midday') && s.role==='student') parts.push(`Tag (KW${weekNumLocal}): ${daytimeWeek}`);
                if (blocker) parts.push(`Blocker: ${blocker}`);
                const tooltip = parts.join(' | ');
                const alreadyAssigned = Object.values(cur||{}).includes(s.id);
                const assignedNote = alreadyAssigned ? ' – bereits zugewiesen' : '';
                const label = `${s.name} (Score: ${Math.round(c.score)})${assignedNote}${blocker ? ' ⚠' : ''}`;
                const title = ` title="${tooltip}"`;
                return `<option value="${s.id}"${title}>${label}</option>`;
            }).join('');
            staffSel.innerHTML = options;
            // Ensure consent row reflects the default selected option
            updateConsentForSelected();
            // Build hint lines (include quick context and blocker reasons)
            const hints = cands.slice(0,8).map(c => {
                const s = c.staff;
                const parts = [];
                const yearStr = String(y);
                const isWE = isWeekend;
                const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
                const dayOff = appState.availabilityData?.[`staff:${s.id}`]?.[dateStr] === 'off';
                if (dayOff) parts.push('Freiwunsch');
                if (avail === 'prefer') parts.push('bevorzugt');
                else if (avail === 'yes') parts.push('verfügbar');
                if (holName) parts.push('Feiertag');
                else if (isWE) parts.push('Wochenende');
                if (s.role === 'student' && (sh === 'evening' || sh === 'closing')) parts.push('Student+Abendbonus');
                if (s.role === 'permanent' && (sh==='evening'||sh==='closing')){
                    const volKey = `${s.id}::${dateStr}::${sh}`;
                    const legacyKey = `${s.id}::${dateStr}`;
                    if (appState.voluntaryEveningAvailability?.[volKey] || appState.voluntaryEveningAvailability?.[legacyKey]){
                        parts.push(sh==='evening' ? 'Permanent+freiwillig Abend' : 'Permanent+freiwillig Spät');
                    }
                }
                if (s.weekendPreference && isWE) parts.push('WE-Präferenz');
                // Add blocker reason preview
                const blocker = this._withScheduleMutation(simBase, dateStr, sh, s.id, () => {
                    const validated = validator.validateSchedule(simBase);
                    return s.id === 'manager' ? null : validated?.[dateStr]?.blockers?.[sh];
                });
                if (blocker) parts.push(`Blockiert: ${blocker}`);
                return `${s.name}: ${parts.length?parts.join(', '):'—'}`;
            }).join('<br/>');
            const notes = document.getElementById('candidateNotes');
            notes.innerHTML = `Hinweise:<br/>${hints}`;

            // Consent UI: only relevant for permanent, weekend, no weekendPreference
            const consentRow = document.getElementById('consentRow');
            const consentCb = document.getElementById('consentCheckbox');
            const consentHint = document.getElementById('consentHint');
            const selectedId = parseInt(staffSel.value || 0);
            const staff = (window.appState?.staffData||[]).find(s=>s.id==selectedId);
            const isWeekendDate = [0,6].includes(parseYMD(dateStr).getDay());
            const showConsent = !!(staff && staff.role==='permanent' && isWeekendDate && !staff.weekendPreference);
            consentRow.classList.toggle('hidden', !showConsent);
            consentHint.classList.toggle('hidden', !showConsent);
            if (showConsent){
                const year = String(parseYMD(dateStr).getFullYear());
                const hasConsent = !!(window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr]);
                consentCb.checked = !!hasConsent;
            } else {
                consentCb.checked = false;
            }

            // Show/hide execute swap button
            const executeBtn = document.getElementById('executeSwapBtn');
            if (executeBtn) executeBtn.style.display = isSwapMode ? 'block' : 'none';
        };
    // Include-permanents toggle only shown for weekend days
    const includeRow = document.getElementById('includePermanentsRow');
    const includeCb = document.getElementById('includePermanentsCheckbox');
    const weekend = [0,6].includes(parseYMD(dateStr).getDay());
    includeRow.classList.toggle('hidden', !weekend);
    includeCb.checked = false;
    includeCb.onchange = () => renderCandidates();
    // Manager wildcard toggle - always available
    const managerRow = document.getElementById('includeManagerRow');
    const managerCb = document.getElementById('includeManagerCheckbox');
    if (managerRow) managerRow.classList.remove('hidden'); // always show
    if (managerCb) {
        managerCb.checked = false;
        managerCb.onchange = () => renderCandidates();
    }
    renderCandidates();
        const notes = document.getElementById('candidateNotes');
        // Notes content set in renderCandidates

        // Add explicit 'Leave blank' option (unassign)
        const leaveBtn = document.getElementById('leaveBlankBtn');
        if (leaveBtn){
            leaveBtn.onclick = ()=>{
                const sh = shiftSel.value;
                const month = dateStr.substring(0,7);
                if (!window.appState.scheduleData[month]) window.appState.scheduleData[month] = {};
                const schedule = window.appState.scheduleData[month];
                if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
                delete schedule[dateStr].assignments[sh];
                appState.save?.();
                this.updateDay(dateStr);
                if (window.modalManager) window.modalManager.close('swapModal'); else window.closeModal?.('swapModal');
            };
        }
        // Stash selection into modal dataset for handler
        modal.dataset.date = dateStr;
        modal.dataset.shift = shiftSel.value;
        const syncShift = () => { modal.dataset.shift = shiftSel.value; renderCandidates(); updateCurrent(); };
        shiftSel.addEventListener('change', syncShift);
        // React to staff selection changes to update consent row state
                document.getElementById('swapStaffSelect').addEventListener('change', () => {
                        // Keep current selection; just refresh consent & current assignment view
                        updateConsentForSelected();
                        const s = document.getElementById('swapShiftSelect').value;
                        const sid = parseInt(document.getElementById('swapStaffSelect').value || 0);
                        const currentAssignment = document.getElementById('currentAssignment');
                        const staff = (window.appState?.staffData||[]).find(x=>x.id==sid);
                        if (currentAssignment) {
                            currentAssignment.textContent = sid ? `Aktuell: ${staff?.name||sid}` : 'Aktuell: —';
                        }
                });

        // Persist consent when user toggles it
        const consentCb = document.getElementById('consentCheckbox');
        consentCb?.addEventListener('change', (e)=>{
            const selectedId = parseInt(document.getElementById('swapStaffSelect').value || 0);
            const isWeekendShift = [0,6].includes(parseYMD(dateStr).getDay());
            if (!selectedId || !isWeekendShift) return;
            const year = String(parseYMD(dateStr).getFullYear());
            const state = window.appState;
            if (!state.permanentOvertimeConsent) state.permanentOvertimeConsent = {};
            if (!state.permanentOvertimeConsent[selectedId]) state.permanentOvertimeConsent[selectedId] = {};
            if (!state.permanentOvertimeConsent[selectedId][year]) state.permanentOvertimeConsent[selectedId][year] = {};
            if (e.target.checked){
                state.permanentOvertimeConsent[selectedId][year][dateStr] = true;
            } else {
                delete state.permanentOvertimeConsent[selectedId][year][dateStr];
            }
            // Also persist via appState if available
            try{
                const { appState } = window;
                if (appState){
                    appState.permanentOvertimeConsent = state.permanentOvertimeConsent;
                    appState.save?.();
                }
            }catch{}
            // Re-render to refresh blockers and scores
            renderCandidates();
        });

        // Set up execute swap handler
        if (!window.handlers) window.handlers = {};
        window.handlers.executeSwap = () => {
            if (!isSwapMode) return;
            const sh = shiftSel.value;
            const currentStaffId = cur[sh];
            const newStaffId = parseInt(staffSel.value);
            if (!currentStaffId || !newStaffId || currentStaffId === newStaffId) return;
            const month = dateStr.substring(0,7);
            if (!window.appState.scheduleData[month]) window.appState.scheduleData[month] = {};
            const schedule = window.appState.scheduleData[month];
            if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
            schedule[dateStr].assignments[sh] = newStaffId;
            appState.save?.();
            this.updateDay(dateStr);
            if (window.modalManager) window.modalManager.close('swapModal'); else window.closeModal?.('swapModal');
        };

    // Show modal
    (window.modalManager||window).open ? window.modalManager.open('swapModal') : window.showModal?.('swapModal');
    }

    // New: Search & Assign dialog separate from availability tab
    openSearchAssignModal(dateStr){
        const modal = document.getElementById('searchModal');
        if (!modal) return;
        const [y,m,d] = dateStr.split('-').map(Number);
        const date = new Date(y, m-1, d);
        const isWeekendSearch = [0,6].includes(date.getDay());
        const holName = this.getHolidayName(dateStr);
        const allShifts = this.getApplicableShifts(dateStr);
        document.getElementById('searchTitle').textContent = `Suchen & Zuweisen – ${dateStr}`;
        document.getElementById('searchDetail').textContent = holName ? `Feiertag: ${holName}` : isWeekendSearch ? 'Wochenende' : 'Wochentag';
        // Populate shifts
        const shiftSel = document.getElementById('searchShiftSelect');
        shiftSel.innerHTML = allShifts.map(s=>`<option value="${s}">${s}</option>`).join('');
        const month = dateStr.substring(0,7);
        const cur = window.appState?.scheduleData?.[month]?.[dateStr]?.assignments || {};
        const engine = new SchedulingEngine(month);
        const weekNum = engine.getWeekNumber(date);
        const staffSel = document.getElementById('searchStaffSelect');
        const filterInput = document.getElementById('searchFilterInput');
        const consentRow = document.getElementById('searchConsentRow');
        const consentCb = document.getElementById('searchConsentCheckbox');
        const consentHint = document.getElementById('searchConsentHint');
        const includeRow = document.getElementById('searchIncludePermanentsRow');
        const includeCb = document.getElementById('searchIncludePermanentsCheckbox');
        // Lightweight consent updater for search modal (avoid full candidate rebuild on selection change)
        const updateSearchConsentForSelected = () => {
            try {
                const selectedId = parseInt(staffSel.value || 0);
                const staff = (window.appState?.staffData||[]).find(s=>s.id==selectedId);
                const isWeekendSearchLocal = [0,6].includes(date.getDay());
                const showConsent = !!(staff && staff.role==='permanent' && isWeekendSearchLocal && !staff.weekendPreference);
                consentRow.classList.toggle('hidden', !showConsent);
                consentHint.classList.toggle('hidden', !showConsent);
                if (showConsent){
                    const year = String(y);
                    const hasConsent = !!(window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr]);
                    consentCb.checked = !!hasConsent;
                } else {
                    consentCb.checked = false;
                }
            } catch(e){ /* noop */ }
        };
    includeRow.classList.toggle('hidden', !isWeekendSearch);
        includeCb.checked = false;
        const renderCandidates = () => {
            const sh = shiftSel.value;
            // Use cached validator
            if (!this._validators[month]) {
                this._validators[month] = new ScheduleValidator(month);
            }
            const validator = this._validators[month];
            const simBase = window.appState?.scheduleData?.[month] || {};
            let cands = this._getBaseCandidatesForShift(dateStr, sh, false); // includeManager false for search modal
            // Filter
            const q = (filterInput.value||'').toLowerCase();
            if (q){
                cands = cands.filter(c => {
                    const s = c.staff;
                    return String(s.name).toLowerCase().includes(q) || String(s.role||'').toLowerCase().includes(q);
                });
            }
            const options = cands.map(c => {
                const s = c.staff;
                // Use _withScheduleMutation for performance - only for annotation
                const blocker = this._withScheduleMutation(simBase, dateStr, sh, s.id, () => {
                    const validated = validator.validateSchedule(simBase);
                    return s.id === 'manager' ? '' : (validated?.[dateStr]?.blockers?.[sh] || '');
                });
                // Build tooltip with fairness/context
                const state = window.appState;
                const engine = new SchedulingEngine(month);
                const weekNumLocal = engine.getWeekNumber(parseYMD(dateStr));
                const weekendCount = (engine.weekendAssignmentsCount?.[s.id]) ?? 0;
                const daytimeWeek = (engine.studentDaytimePerWeek?.[s.id]?.[weekNumLocal]) ?? 0;
                const parts = [`Score: ${Math.round(c.score)}`];
                if (isWeekendSearch) parts.push(`WE bisher: ${weekendCount}`);
                if (!isWeekendSearch && (sh==='early'||sh==='midday') && s.role==='student') parts.push(`Tag (KW${weekNumLocal}): ${daytimeWeek}`);
                if (blocker) parts.push(`Blocker: ${blocker}`);
                const tooltip = parts.join(' | ');
                const alreadyAssigned = Object.values(cur||{}).includes(s.id);
                const assignedNote = alreadyAssigned ? ' – bereits zugewiesen' : '';
                const label = `${s.name} (Score: ${Math.round(c.score)})${assignedNote}${blocker ? ' ⚠' : ''}`;
                const title = ` title="${tooltip}"`;
                return `<option value="${s.id}"${title}>${label}</option>`;
            }).join('');
            staffSel.innerHTML = options;
            // Update consent UI for default selected option
            updateSearchConsentForSelected();
        };
        // Initial render
        renderCandidates();
        // Add explicit 'Leave blank' action
        const searchLeaveBtn = document.getElementById('searchLeaveBlankBtn');
        if (searchLeaveBtn){
            searchLeaveBtn.onclick = ()=>{
                const sh = shiftSel.value; const month = dateStr.substring(0,7);
                if (!window.appState.scheduleData[month]) window.appState.scheduleData[month] = {};
                const schedule = window.appState.scheduleData[month];
                if (!schedule[dateStr]) schedule[dateStr] = { assignments:{} };
                delete schedule[dateStr].assignments[sh];
                appState.save?.();
                this.updateDay(dateStr);
                if (window.modalManager) window.modalManager.close('searchModal'); else window.closeModal?.('searchModal');
            };
        }
        // Stash context
        modal.dataset.date = dateStr;
    (window.modalManager||window).open ? window.modalManager.open('searchModal') : window.showModal?.('searchModal');
        // Bind assign button
        const execBtn = document.getElementById('executeSearchAssignBtn');
    execBtn.onclick = async () => {
            const sh = shiftSel.value; const sid = parseInt(staffSel.value||0);
            if (!sid){ alert('Bitte Mitarbeiter wählen'); return; }
            const month = dateStr.substring(0,7);
            // Weekend permanent consent/request check like swap modal
            try{
                const isWE = [0,6].includes(date.getDay());
                const staff = (window.appState?.staffData||[]).find(s=>s.id==sid);
                if (isWE && staff?.role==='permanent' && !staff?.weekendPreference){
                    // Check if non-permanent candidates could fill instead
                    const scheduledToday = new Set(Object.values(cur||{}));
                    const cands = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum)
                        .filter(c => c.staff.role !== 'permanent');
                    const canBeFilledByRegular = cands.some(c => c.score > -999);
                    if (!canBeFilledByRegular){
                                                try { if (!window.__services) { import('../src/services/index.js').then(m=> { window.__services = m.createServices({}); }); } } catch {}
                                                const overtimeSvc = window.__services?.overtime;
                                                const exists = overtimeSvc.listByDate(month,dateStr).some(r=> r.staffId===sid && r.shiftKey===sh && r.status==='requested');
                                                if(!exists){
                                                    overtimeSvc.create(month, dateStr, { staffId: sid, shiftKey: sh, reason: 'Unbesetzbare Schicht' });
                                                    alert('Überstunden-Anfrage erstellt. Bitte im Anfragen-Panel bestätigen.');
                                                }
                        return; // do not assign until consent
                    }
                }
            }catch(e){ console.warn('Auto-request check failed', e); }
            // Use schedule service adapter path (single migrated write path)
            try { if (!window.__services) window.__services = (await import('../src/services/index.js')).createServices({}); } catch {}
            const scheduleSvc = window.__services.schedule;
            // Assign optimistically via adapter
            scheduleSvc.assign(dateStr, sh, sid);
            // Re-run validation on updated month
            const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
            if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} }; // ensure shape
            const validator = new ScheduleValidator(month);
            const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
            const hasBlocker = consolidated[dateStr]?.blockers?.[sh];
            if (hasBlocker){
                // Rollback assignment
                delete schedule[dateStr].assignments[sh]; appState.save();
                alert(`Zuweisung nicht möglich: ${hasBlocker}`);
                return;
            }
            appState.scheduleData[month] = consolidated; appState.save();
            try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
            // Incremental update instead of full calendar rebuild
            this.updateDay(dateStr);
            // Weekend report can change fairness stats; refresh only if weekend or holiday
            const dow = date.getDay();
            if (dow===0 || dow===6){ this.renderWeekendReport(month); }
            if (window.modalManager) window.modalManager.close('searchModal'); else window.closeModal?.('searchModal');
        };
    }

    // Validate current schedule for violations
    validateCurrentSchedule() {
        const month = this.currentCalendarMonth;
        if (!month) return { valid: true, violations: [] };
        try {
            // Use cached validator or create new one
            if (!this._validators[month]) {
                this._validators[month] = new ScheduleValidator(month);
            }
            const validator = this._validators[month];
            const schedule = window.appState?.scheduleData?.[month] || {};
            const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);

            // Check for critical shift coverage
            const violations = [];

            // Collect blockers from consolidated schedule
            Object.entries(consolidated).forEach(([dateStr, dayData]) => {
                const blockers = dayData?.blockers || {};
                Object.entries(blockers).forEach(([shift, blocker]) => {
                    if (blocker && blocker !== 'manager') { // Skip manager wildcard
                        violations.push({ dateStr, shift, blocker });
                    }
                });
            });

            // Add critical shift coverage issue if needed
            const unfilledCriticalShifts = this.countUnfilledCriticalShifts(schedule, month);
            if (unfilledCriticalShifts > 4) {
                violations.push({
                    dateStr: 'month',
                    shift: 'coverage',
                    blocker: `UNFILLED_CRITICAL_SHIFTS: ${unfilledCriticalShifts} critical shifts unfilled (max 4 allowed)`
                });
            }

            // Store violations for accessibility
            this._validationSummary = violations;

            return { valid: violations.length === 0, violations };
        } catch (error) {
            console.error('Validation error:', error);
            // In case of validation failure, allow finalization but log the error
            return { valid: true, violations: [] };
        }
    }

    // Count unfilled critical shifts across the month
    countUnfilledCriticalShifts(schedule, month) {
        let unfilled = 0;
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(monthNum).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayData = schedule[dateStr];
            if (!dayData?.assignments) continue;

            const applicableShifts = this.getApplicableShifts(dateStr);
            applicableShifts.forEach(shift => {
                if (!dayData.assignments[shift]) {
                    // Check if this is a critical shift (not evening on optional days)
                    const isCritical = isCriticalShift(shift, dateStr);
                    if (isCritical) unfilled++;
                }
            });
        }
        return unfilled;
    }

    // Highlight violations in the calendar
    highlightViolations(violations) {
        // Clear previous highlights
        document.querySelectorAll('.staff-assignment.invalid-assignment').forEach(el => el.classList.remove('invalid-assignment'));
        violations.forEach(v => {
            const pill = document.querySelector(`.staff-assignment[data-date="${v.dateStr}"][data-shift="${v.shift}"]`);
            if (pill) pill.classList.add('invalid-assignment');
        });

        // Update accessibility summary
        this._updateValidationSummary(violations);
    }

    // Update the validation summary for screen readers
    _updateValidationSummary(violations) {
        let summaryEl = document.getElementById('scheduleChecklistRoot');
        if (!summaryEl) {
            summaryEl = document.createElement('div');
            summaryEl.id = 'scheduleChecklistRoot';
            summaryEl.setAttribute('aria-live', 'polite');
            summaryEl.setAttribute('aria-label', 'Schedule validation summary');
            summaryEl.className = 'sr-only validation-summary';
            this.container.appendChild(summaryEl);
        }

        if (violations.length === 0) {
            summaryEl.innerHTML = '<p>Schedule is valid with no violations.</p>';
        } else {
            const items = violations.map(v => `<li>${v.dateStr} ${v.shift}: ${v.blocker}</li>`).join('');
            summaryEl.innerHTML = `<p>Schedule has ${violations.length} violation(s):</p><ul>${items}</ul>`;
        }
    }

    // Clear all violation highlights
    clearViolations() {
        document.querySelectorAll('.staff-assignment.invalid-assignment').forEach(el => el.classList.remove('invalid-assignment'));
        // Clear validation summary
        this._updateValidationSummary([]);
    }
}

// Recovery helper methods appended (if class export above already closed, attach via prototype as fallback)
if (typeof ScheduleUI !== 'undefined'){ Object.assign(ScheduleUI.prototype, {
    runA11yAudit(){
        const issues = [];
        const modals = document.querySelectorAll('.modal');
        modals.forEach(m => {
            const id = m.id || '(no-id)';
            if (!m.hasAttribute('role')) issues.push({ id, type: 'missing-role' });
            if (!m.hasAttribute('aria-labelledby')) issues.push({ id, type: 'missing-aria-labelledby' });
            const labelled = m.getAttribute('aria-labelledby');
            if (labelled && !document.getElementById(labelled)) issues.push({ id, type: 'aria-labelledby-target-missing', target: labelled });
            const focusables = m.querySelectorAll('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
            if (!focusables.length) issues.push({ id, type: 'no-focusable-content' });
        });
        // Buttons without accessible name
        document.querySelectorAll('button').forEach(b => {
            const txt = (b.textContent||'').trim();
            const hasLabel = !!(txt || b.getAttribute('aria-label'));
            if (!hasLabel) issues.push({ id: b.id||'(button)', type: 'button-missing-label' });
        });
    if (!issues.length) console.info('[a11y] audit passed (no issues)'); else console.info('[a11y] issues', issues);
        return issues;
    }
}); }



