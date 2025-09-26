import { APP_CONFIG, SHIFTS } from '../modules/config.js';
import { appState } from '@state';
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
    if (!window.__perf) window.__perf = {}; // lightweight counters
    window.__perf.calendarFullRenders = window.__perf.calendarFullRenders || 0;
    window.__perf.calendarDiffUpdates = window.__perf.calendarDiffUpdates || 0;
        this.setupTabs();
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
        targetButton.classList.add('active');
    }

    addVacationPeriod() {
        // Implementation will be added
        console.log('Add vacation period clicked');
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
                        console.log(`Calling updateHolidayBadges for ${year}...`);
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
        return window.holidayService
            ? window.holidayService.getHolidayName(dateStr)
            : (window.appState?.holidays?.[dateStr.split('-')[0]]?.[dateStr] || null);
    }

    updateHolidayBadges(year) {
        // Update existing calendar cells to show holiday badges
        const yearStr = String(year);
        // Get holidays from TS singleton or fallback to appState
        const holidays = window.holidayService
            ? window.holidayService.getHolidaysForYear(year)
            : (window.appState?.holidays?.[yearStr] || {});
        
        console.log(`[updateHolidayBadges] Processing ${Object.keys(holidays).length} holidays for ${yearStr}`);
        
        Object.entries(holidays).forEach(([dateStr, holidayName]) => {
            console.log(`[updateHolidayBadges] Processing ${dateStr}: ${holidayName}`);
            // Find the calendar cell for this date
            const calBody = document.querySelector(`[data-date="${dateStr}"]`);
            if (calBody) {
                console.log(`[updateHolidayBadges] Found DOM element for ${dateStr}`);
                const calCell = calBody.parentElement;
                const calDate = calCell.querySelector('.cal-date');
                if (calDate && !calDate.querySelector('.badge')) {
                    // Extract the day number and add the holiday badge
                    const dayText = calDate.textContent.trim();
                    calDate.innerHTML = `${dayText} <span class="badge">${holidayName}</span>`;
                    console.log(`[updateHolidayBadges] ✅ Added badge for ${dateStr}: ${holidayName}`);
                } else if (calDate && calDate.querySelector('.badge')) {
                    console.log(`[updateHolidayBadges] Badge already exists for ${dateStr}`);
                } else {
                    console.log(`[updateHolidayBadges] ❌ No .cal-date found for ${dateStr}`);
                }
            } else {
                console.log(`[updateHolidayBadges] ❌ No DOM element found with [data-date="${dateStr}"]`);
            }
        });
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
        
        // Auto-fetch holidays if not loaded for this year
        this.ensureHolidaysLoaded(y);
        
        const first = new Date(y, m - 1, 1);
        const startDay = (first.getDay() + 6) % 7; // Monday=0
        const daysInMonth = new Date(y, m, 0).getDate();

        let html = '<div id="scheduleStatus" class="status-line hidden"><span class="spinner"></span><span id="scheduleStatusText">Synchronisiere Verfügbarkeiten…</span></div>'
            + '<div class="flex flex-wrap jc-end gap-8 mb-8">'
            + '<button class="btn btn-secondary" id="showHolidaysBtn">Feiertage</button>'
            + '<button class="btn btn-secondary" id="openSearchAssignBtn">Suchen & Zuweisen (Datum wählen)</button>'
            + '<button class="btn btn-secondary" id="recoveryPreviewBtn" title="Offene kritische Schichten anzeigen">Lücken prüfen</button>'
            + '<button class="btn btn-secondary hidden" id="recoveryApplyBtn" title="Versuchen kritische Lücken zu füllen (mit gelockerten Fairness-Penalties)">Lücken füllen</button>'
            + '</div>'
            + '<div id="recoveryReport" class="full-width text-small mt-neg-4"></div>';
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
                    const holName = window.holidayService
                        ? window.holidayService.getHolidayName(dateStr)
                        : (window.appState?.holidays?.[String(y)]?.[dateStr] || null);
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
    this.currentCalendarMonth = month;
    window.__perf.calendarFullRenders++;
        // Track a selected date for the search modal
        let selectedDateForSearch = null;
        const setSelectedDate = (dateStr) => { selectedDateForSearch = dateStr; };
        // Open search modal button
        document.getElementById('openSearchAssignBtn')?.addEventListener('click', ()=>{
            const dateStr = selectedDateForSearch || document.querySelector('.cal-body[data-date]')?.getAttribute('data-date');
            if (!dateStr){ alert('Bitte ein Datum im Kalender wählen.'); return; }
            this.openSearchAssignModal(dateStr);
        });
        // Recovery preview button
        const recoveryPreviewBtn = document.getElementById('recoveryPreviewBtn');
        const recoveryApplyBtn = document.getElementById('recoveryApplyBtn');
        const recoveryReport = document.getElementById('recoveryReport');
        const monthKey = month;
        const collectCriticalGaps = () => {
            const sched = appState.scheduleData?.[monthKey] || {};
            const gaps = [];
            Object.entries(sched).forEach(([dateStr, day])=>{
                const assignments = day?.assignments || {};
                // Determine critical shifts for date (mirrors engine logic)
                const allShifts = Object.entries(SHIFTS).filter(([k,v])=>{
                    const d = parseYMD(dateStr).getDay();
                    if (v.type==='weekday'){
                        if (k==='evening' && (APP_CONFIG?.EVENING_OPTIONAL_DAYS||[]).includes(d)) return true; // still list it; critical decided below
                        return true;
                    }
                    return v.type==='weekend' || v.type==='holiday';
                }).map(([k])=>k);
                allShifts.forEach(sh => {
                    const d = parseYMD(dateStr).getDay();
                    const isCritical = !(sh==='evening' && (APP_CONFIG?.EVENING_OPTIONAL_DAYS||[]).includes(d));
                    if (!isCritical) return; // only critical gaps
                    if (!assignments[sh]) gaps.push({ dateStr, shiftKey: sh });
                });
            });
            return gaps.sort((a,b)=> a.dateStr.localeCompare(b.dateStr));
        };
        const dryRunRecovery = () => {
            const gaps = collectCriticalGaps();
            if (!gaps.length){ recoveryReport.innerHTML = '<em>Keine offenen kritischen Schichten.</em>'; recoveryApplyBtn.classList.add('hidden'); return; }
            const engine = new SchedulingEngine(monthKey);
            const preview = [];
            gaps.forEach(g => {
                const weekNum = engine.getWeekNumber(parseYMD(g.dateStr));
                const scheduledToday = new Set(Object.values(appState.scheduleData?.[monthKey]?.[g.dateStr]?.assignments||{}));
                let cands = engine.findCandidatesForShift(g.dateStr, g.shiftKey, scheduledToday, weekNum);
                // Relax fairness: neutralize weekend & typical day penalties by boosting negatives upward minimally
                cands = cands.map(c => ({ ...c, adjScore: c.score < 0 ? Math.max(c.score, (APP_CONFIG?.RECOVERY_MIN_SCORE_FLOOR||-800)) : c.score }));
                cands.sort((a,b)=> b.adjScore - a.adjScore);
                const best = cands[0];
                if (best && best.adjScore >= (APP_CONFIG?.RECOVERY_MIN_SCORE_FLOOR||-800)){
                    preview.push({ ...g, staffId: best.staff.id, name: best.staff.name, score: best.score, adjScore: best.adjScore });
                }
            });
            if (!preview.length){ recoveryReport.innerHTML = '<em>Keine geeigneten Kandidaten für offene kritische Schichten.</em>'; recoveryApplyBtn.classList.add('hidden'); return; }
            recoveryReport.innerHTML = '<strong>Vorschau Füllung:</strong><br/>' + preview.map(p=> `${p.dateStr} – ${p.shiftKey} → ${p.name} (Score ${Math.round(p.score)} / adj ${Math.round(p.adjScore)})`).join('<br/>');
            recoveryApplyBtn.classList.remove('hidden');
            recoveryApplyBtn.dataset.preview = JSON.stringify(preview);
        };
        recoveryPreviewBtn?.addEventListener('click', dryRunRecovery);
        recoveryApplyBtn?.addEventListener('click', ()=>{
            const raw = recoveryApplyBtn.dataset.preview;
            if (!raw) return;
            let preview; try{ preview = JSON.parse(raw);}catch{ return; }
            const sched = appState.scheduleData?.[monthKey] || (appState.scheduleData[monthKey] = {});
            let applied=0;
            preview.forEach(p => {
                // Skip if already filled since preview
                const day = sched[p.dateStr] || (sched[p.dateStr] = { assignments:{} });
                if (day.assignments[p.shiftKey]) return;
                // Business rule validation via validator (simulate assignment & check for blockers)
                day.assignments[p.shiftKey] = p.staffId;
                const validator = new ScheduleValidator(monthKey);
                const { schedule: consolidated } = validator.validateScheduleWithIssues(sched);
                const blocker = consolidated[p.dateStr]?.blockers?.[p.shiftKey];
                if (blocker){
                    // revert
                    delete day.assignments[p.shiftKey];
                } else {
                    applied++; appState.scheduleData[monthKey] = consolidated;
                }
            });
            appState.save?.();
            recoveryReport.innerHTML += `<div class="mt-4"><strong>Angewendet:</strong> ${applied} Schichten gefüllt.</div>`;
            recoveryApplyBtn.classList.add('hidden');
            this.updateCalendarFromSelect();
        });
        // Click handlers
    grid.querySelectorAll('.cal-body').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.getAttribute('data-date');
        setSelectedDate(dateStr);
                this.openAssignModal(dateStr);
            });
            cell.addEventListener('dblclick', () => {
                const dateStr = cell.getAttribute('data-date');
        setSelectedDate(dateStr);
                // Prefer first unassigned shift for that date
                const [yy,mm,dd] = dateStr.split('-').map(Number);
                const date = new Date(yy, mm-1, dd);
                const isWeekend = [0,6].includes(date.getDay());
                const holName = this.getHolidayName(dateStr);
                const allShifts = Object.entries(SHIFTS).filter(([k,v]) => {
                    if (holName) return v.type === 'holiday';
                    if (isWeekend) return v.type === 'weekend';
                    return v.type === 'weekday';
                }).map(([k])=>k);
                const monthKey = dateStr.substring(0,7);
                const cur = window.appState?.scheduleData?.[monthKey]?.[dateStr]?.assignments || {};
                const firstUnassigned = allShifts.find(s => !cur[s]);
                this.openAssignModal(dateStr, firstUnassigned);
            });
        });

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
      }
                // brief confirmation
                this.setStatus('Synchronisiert ✓', true, false);
                setTimeout(()=>{ this.clearStatus(); }, 900);
        }).catch((e)=>{ console.warn(e); this.clearStatus(); });
    }

    async prehydrateAvailability(month){
        try {
            if (!month || this._hydratedMonths.has(month)) return;
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
        const ids = ['openSearchAssignBtn','recoveryPreviewBtn','recoveryApplyBtn','generateScheduleBtn','clearScheduleBtn','exportScheduleBtn','exportPdfBtn','printScheduleBtn'];
        if (!snapshot){ snapshot = {}; }
        ids.forEach(id=>{ const el = document.getElementById(id); if (!el) return; if (disabled){ snapshot[id] = el.disabled; el.disabled = true; } else if (snapshot && id in snapshot){ el.disabled = snapshot[id]; } else { el.disabled = false; } });
        return snapshot;
    }
    

    renderAssignments(month) {
        const data = window.appState?.scheduleData?.[month] || {};
        // For each day cell, show all shifts for its type and fill assignments if present, placeholders otherwise
        document.querySelectorAll('.cal-body[data-date]').forEach(cell => {
            const dateStr = cell.getAttribute('data-date');
            const type = cell.getAttribute('data-type');
            // Find which shifts apply
            const shifts = Object.entries(SHIFTS)
                .filter(([_, v]) => v.type === type)
                .map(([k]) => k);
            const assignments = data[dateStr]?.assignments || {};
            const html = shifts.map(shift => {
                const staffId = assignments[shift];
                const shiftMeta = (window.SHIFTS||{})[shift] || {};
                if (staffId) {
                    const staff = (window.appState?.staffData||[]).find(s=>s.id==staffId);
                    const name = staff?.name || staffId;
                    const title = `${shiftMeta.name||shift} ${shiftMeta.time?`(${shiftMeta.time})`:''} - ${name}`;
                    return `<div class="staff-assignment" title="${title}" data-date="${dateStr}" data-shift="${shift}">
                        <span class="badge">${shift}</span>
                        <span class="assignee-name">${name}</span>
                        <button class="btn btn-secondary btn-sm swap-btn ml-6" data-date="${dateStr}" data-shift="${shift}">Wechseln</button>
                    </div>`;
                }
                // Unassigned placeholder keeps the slot visible and clickable
                const title = `${shiftMeta.name||shift} ${shiftMeta.time?`(${shiftMeta.time})`:''} - nicht zugewiesen`;
                return `<div class="staff-assignment unassigned" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> —</div>`;
            }).join('');
            cell.innerHTML = html;
        });
        // Enable pill-click to open modal with preselected shift (assigned or unassigned)
        document.querySelectorAll('.staff-assignment[data-date]').forEach(pill => {
            pill.addEventListener('click', (e)=>{
                e.stopPropagation();
                const dateStr = pill.getAttribute('data-date');
                const shiftKey = pill.getAttribute('data-shift');
                this.openAssignModal(dateStr, shiftKey);
            });
        });
        // Bind direct 'Wechseln' buttons
        document.querySelectorAll('.swap-btn[data-date]').forEach(btn => {
            btn.addEventListener('click', (e)=>{
                e.stopPropagation();
                const dateStr = btn.getAttribute('data-date');
                const shiftKey = btn.getAttribute('data-shift');
                this.openAssignModal(dateStr, shiftKey);
            });
        });
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
        const html = shifts.map(shift => {
            const staffId = assignments[shift];
            const shiftMeta = (window.SHIFTS||{})[shift] || {};
            if (staffId){
                const staff = (window.appState?.staffData||[]).find(s=>s.id==staffId);
                const name = staff?.name || staffId;
                const title = `${shiftMeta.name||shift} ${shiftMeta.time?`(${shiftMeta.time})`:''} - ${name}`;
                return `<div class="staff-assignment" title="${title}" data-date="${dateStr}" data-shift="${shift}">
                        <span class="badge">${shift}</span>
                        <span class="assignee-name">${name}</span>
                        <button class="btn btn-secondary btn-sm swap-btn ml-6" data-date="${dateStr}" data-shift="${shift}">Wechseln</button>
                    </div>`;
            }
            const title = `${shiftMeta.name||shift} ${shiftMeta.time?`(${shiftMeta.time})`:''} - nicht zugewiesen`;
            return `<div class="staff-assignment unassigned" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> —</div>`;
        }).join('');
        cellEl.innerHTML = html;
        // Re-bind events for this cell only
        cellEl.querySelectorAll('.staff-assignment[data-date]').forEach(pill => {
            pill.addEventListener('click', (e)=>{
                e.stopPropagation();
                const shiftKey = pill.getAttribute('data-shift');
                this.openAssignModal(dateStr, shiftKey);
            });
        });
        cellEl.querySelectorAll('.swap-btn[data-date]').forEach(btn => {
            btn.addEventListener('click', (e)=>{
                e.stopPropagation();
                const shiftKey = btn.getAttribute('data-shift');
                this.openAssignModal(dateStr, shiftKey);
            });
        });
    }

    openAssignModal(dateStr, presetShift){
        const modal = document.getElementById('swapModal');
        if (!modal) return;
        // Build shift list for that date based on SHIFTS and holiday/weekend detection
        const [y,m,d] = dateStr.split('-').map(Number);
    const date = new Date(y, m-1, d);
        const isWeekend = [0,6].includes(date.getDay());
        const holName = window.appState?.holidays?.[String(y)]?.[dateStr] || null;
        const allShifts = Object.entries(SHIFTS).filter(([k,v]) => {
            if (holName) return v.type === 'holiday';
            if (isWeekend) return v.type === 'weekend';
            return v.type === 'weekday';
        }).map(([k])=>k);

        const shiftSel = document.getElementById('swapShiftSelect');
        shiftSel.innerHTML = allShifts.map(s=>`<option value="${s}">${s}</option>`).join('');
        // Default to preset, otherwise pick first unassigned if possible
        const month = dateStr.substring(0,7);
        const cur = window.appState?.scheduleData?.[month]?.[dateStr]?.assignments || {};
        if (presetShift && allShifts.includes(presetShift)) {
            shiftSel.value = presetShift;
        } else {
            const firstUnassigned = allShifts.find(s => !cur[s]);
            if (firstUnassigned) shiftSel.value = firstUnassigned;
        }

        const title = document.getElementById('swapTitle');
        const detail = document.getElementById('swapDetail');
        title.textContent = `Zuweisung ${dateStr}`;
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
            const base = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
            const mapById = new Map(base.map(c => [c.staff.id, c]));
            // Always include currently assigned today to enable switching
            const assignedIds = new Set(Object.values(cur||{}));
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
        const renderCandidates = () => {
            const includePermanents = document.getElementById('includePermanentsCheckbox')?.checked || false;
            const cands = getCandidates(includePermanents);
            const sh = shiftSel.value;
            const validator = new ScheduleValidator(month);
            const simBase = JSON.parse(JSON.stringify(window.appState?.scheduleData?.[month] || {}));
            // Calculate isWeekend for this dateStr
            const isWeekendDay = [0,6].includes(parseYMD(dateStr).getDay());
            // Ensure already-assigned staff for the date are also listed to allow switching
            const assignedIds = new Set(Object.values(cur||{}));
            assignedIds.forEach(id => {
                if (!cands.some(c => c.staff.id === id)){
                    const staff = (window.appState?.staffData||[]).find(s=>s.id==id);
                    if (staff){ cands.push({ staff, score: 0 }); }
                }
            });
            // Build select options with blocker detection
            const options = cands.map(c => {
                const s = c.staff;
                const sim = JSON.parse(JSON.stringify(simBase));
                if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
                if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
                sim[dateStr].assignments[sh] = s.id;
                const validated = validator.validateSchedule(sim);
                const blocker = validated?.[dateStr]?.blockers?.[sh] || '';
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
                const alreadyAssigned = assignedIds.has(s.id);
                const assignedNote = alreadyAssigned ? ' – bereits zugewiesen' : '';
                const label = `${s.name} (Score: ${Math.round(c.score)})${assignedNote}${blocker ? ' ⚠' : ''}`;
                const disabled = '';
                const title = ` title="${tooltip}"`;
                return `<option value="${s.id}"${disabled}${title}>${label}</option>`;
            }).join('');
            staffSel.innerHTML = options;
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
                const sim = JSON.parse(JSON.stringify(simBase));
                if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
                if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
                sim[dateStr].assignments[sh] = s.id;
                const validated = validator.validateSchedule(sim);
                const blocker = validated?.[dateStr]?.blockers?.[sh];
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
        };
    // Include-permanents toggle only shown for weekend days
    const includeRow = document.getElementById('includePermanentsRow');
    const includeCb = document.getElementById('includePermanentsCheckbox');
    const weekend = [0,6].includes(parseYMD(dateStr).getDay());
    includeRow.classList.toggle('hidden', !weekend);
    includeCb.checked = false;
    includeCb.onchange = () => renderCandidates();
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
                if (window.__closeModal) window.__closeModal('swapModal'); else { modal.classList.remove('open'); document.body.classList.remove('no-scroll'); }
            };
        }
        // Stash selection into modal dataset for handler
        modal.dataset.date = dateStr;
        modal.dataset.shift = shiftSel.value;
        const syncShift = () => { modal.dataset.shift = shiftSel.value; renderCandidates(); updateCurrent(); };
        shiftSel.addEventListener('change', syncShift);
        // React to staff selection changes to update consent row state
        document.getElementById('swapStaffSelect').addEventListener('change', () => {
            renderCandidates();
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

    // Show modal
    if (window.__openModal) window.__openModal('swapModal'); else { modal.classList.add('open'); document.body.classList.add('no-scroll'); }
    }

    // New: Search & Assign dialog separate from availability tab
    openSearchAssignModal(dateStr){
        const modal = document.getElementById('searchModal');
        if (!modal) return;
        const [y,m,d] = dateStr.split('-').map(Number);
        const date = new Date(y, m-1, d);
        const isWeekendSearch = [0,6].includes(date.getDay());
        const holName = window.appState?.holidays?.[String(y)]?.[dateStr] || null;
        const allShifts = Object.entries(SHIFTS).filter(([k,v]) => {
            if (holName) return v.type === 'holiday';
            if (isWeekendSearch) return v.type === 'weekend';
            return v.type === 'weekday';
        }).map(([k])=>k);
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
    includeRow.classList.toggle('hidden', !isWeekendSearch);
        includeCb.checked = false;
        const buildBaseCandidates = () => {
            const sh = shiftSel.value;
            const scheduledToday = new Set(Object.values(cur||{}));
            const base = engine.findCandidatesForShift(dateStr, sh, scheduledToday, weekNum);
            const mapById = new Map(base.map(c => [c.staff.id, c]));
            // Always include already assigned (to allow replacement/switching)
            const assignedIds = new Set(Object.values(cur||{}));
            assignedIds.forEach(id => {
                if (!mapById.has(Number(id))){
                    const st = (window.appState?.staffData||[]).find(s=>s.id==id);
                    if (st) mapById.set(st.id, { staff: st, score: 0 });
                }
            });
            // Permissive: include anyone with availability or permanents
            (window.appState?.staffData||[]).forEach(s => {
                const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
                const okAvail = (avail==='yes' || avail==='prefer');
                const isPerm = s.role==='permanent';
                const allowPerm = !isWeekendSearch || includeCb.checked; // on weekends, gate permanents by toggle
                const vac = (appState.vacationsByStaff?.[s.id]||[]).some(p=>{ if(!p?.start||!p?.end) return false; const t=parseYMD(dateStr).getTime(); const st=parseYMD(p.start).getTime(); const en=parseYMD(p.end).getTime(); return t>=st && t<=en; });
                const ill = (appState.illnessByStaff?.[s.id]||[]).some(p=>{ if(!p?.start||!p?.end) return false; const t=parseYMD(dateStr).getTime(); const st=parseYMD(p.start).getTime(); const en=parseYMD(p.end).getTime(); return t>=st && t<=en; });
                const dayOff = appState.availabilityData?.[`staff:${s.id}`]?.[dateStr] === 'off';
                if (!(vac||ill||dayOff) && (okAvail || (isPerm && allowPerm)) && !mapById.has(s.id)){
                    mapById.set(s.id, { staff: s, score: 0 });
                }
            });
            return Array.from(mapById.values()).sort((a,b)=>b.score-a.score);
        };
        const renderCandidates = () => {
            const sh = shiftSel.value;
            const validator = new ScheduleValidator(month);
            const simBase = JSON.parse(JSON.stringify(window.appState?.scheduleData?.[month] || {}));
            let cands = buildBaseCandidates();
            // Filter
            const q = (filterInput.value||'').toLowerCase();
            if (q){
                cands = cands.filter(c => {
                    const s = c.staff;
                    return String(s.name).toLowerCase().includes(q) || String(s.role||'').toLowerCase().includes(q);
                });
            }
            const options = cands.map(c => {
                const s = c.staff; const sim = JSON.parse(JSON.stringify(simBase));
                if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
                if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
                sim[dateStr].assignments[sh] = s.id;
                const validated = validator.validateSchedule(sim);
                const blocker = validated?.[dateStr]?.blockers?.[sh] || '';
                const label = `${s.name} (${s.role||''})${blocker?' ⚠':''}`;
                const title = blocker ? ` title="Blocker: ${blocker}"` : '';
                return `<option value="${s.id}"${title}>${label}</option>`;
            }).join('');
            staffSel.innerHTML = options;
            // Consent UI
            const selectedId = parseInt(staffSel.value||0);
            const staff = (window.appState?.staffData||[]).find(s=>s.id==selectedId);
            const showConsent = !!(staff && staff.role==='permanent' && isWeekendSearch && !staff.weekendPreference);
            consentRow.classList.toggle('hidden', !showConsent);
            consentHint.classList.toggle('hidden', !showConsent);
            if (showConsent){
                const year = String(y);
                const hasConsent = !!(window.appState?.permanentOvertimeConsent?.[selectedId]?.[year]?.[dateStr]);
                consentCb.checked = !!hasConsent;
            } else {
                consentCb.checked = false;
            }
            // Notes
            const notes = document.getElementById('searchCandidateNotes');
            notes.innerHTML = cands.slice(0,8).map(c=>{
                const s=c.staff; const avail = appState.availabilityData?.[s.id]?.[dateStr]?.[sh];
                const parts=[];
                if (avail==='prefer') parts.push('bevorzugt'); else if (avail==='yes') parts.push('verfügbar');
                if (isWeekendSearch) parts.push('Wochenende'); if (holName) parts.push('Feiertag');
                return `${s.name}: ${parts.join(', ')||'—'}`;
            }).join('<br/>');
        };
        // Bindings
        shiftSel.onchange = renderCandidates;
        filterInput.oninput = renderCandidates;
        includeCb.onchange = renderCandidates;
        staffSel.onchange = renderCandidates;
        // Persist consent toggle
        consentCb?.addEventListener('change', (e)=>{
            const selectedId = parseInt(document.getElementById('searchStaffSelect').value||0);
            if (!selectedId) return;
            const year = String(y);
            if (!window.appState.permanentOvertimeConsent) window.appState.permanentOvertimeConsent = {};
            window.appState.permanentOvertimeConsent[selectedId] = window.appState.permanentOvertimeConsent[selectedId]||{};
            window.appState.permanentOvertimeConsent[selectedId][year] = window.appState.permanentOvertimeConsent[selectedId][year]||{};
            if (e.target.checked){
                window.appState.permanentOvertimeConsent[selectedId][year][dateStr] = true;
            } else {
                delete window.appState.permanentOvertimeConsent[selectedId][year][dateStr];
            }
            try{ appState.save?.(); }catch{}
        });
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
                if (window.__closeModal) window.__closeModal('searchModal'); else { modal.classList.remove('open'); document.body.classList.remove('no-scroll'); }
            };
        }
        // Stash context
        modal.dataset.date = dateStr;
    if (window.__openModal) window.__openModal('searchModal'); else { modal.classList.add('open'); document.body.classList.add('no-scroll'); }
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
            if (window.__closeModal) window.__closeModal('searchModal'); else { modal.classList.remove('open'); document.body.classList.remove('no-scroll'); }
        };
    }
}



