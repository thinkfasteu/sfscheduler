import { APP_CONFIG, SHIFTS } from '../modules/config.js';
import { appState } from '../modules/state.js';
import { SchedulingEngine } from '../scheduler.js';
import { ScheduleValidator } from '../validation.js';

export class ScheduleUI {
    constructor(containerId) {
        this.container = document.querySelector(containerId);
        if (!this.container) {
            console.error('ScheduleUI: container not found', containerId);
            return;
        }
        this.setupTabs();
    }

    setupTabs() {
        // Make UI instance available globally
        window.ui = this;
        // If prototype-style tabs exist, let prototypeCompat handle tab switching
        const hasPrototypeTabs = document.querySelector('.tabs');
        if (hasPrototypeTabs && typeof window.showTab === 'function') {
            return; // Do not bind modular tab buttons or force-switch
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
        el.addEventListener('change', () => this.updateCalendarFromSelect());
    }

    updateCalendarFromSelect() {
        const el = document.getElementById('scheduleMonth');
        const month = el?.value;
        if (!month) return;
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

        let html = '<div class="cal"><div class="cal-row cal-head">';
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
                    const holName = window.DEBUG?.state?.holidays?.[String(y)]?.[dateStr] || null;
                    html += `<div class="cal-cell ${isWeekend ? 'cal-weekend' : ''}">
                        <div class="cal-date">${day}${holName ? ` <span class=\"badge\">${holName}</span>` : ''}</div>
                        <div class="cal-body" data-date="${dateStr}"></div>
                    </div>`;
                    day++;
                }
            }
            html += '</div>';
        }
        html += '</div>';
        grid.innerHTML = html;
        // Click handlers
        grid.querySelectorAll('.cal-body').forEach(cell => {
            cell.addEventListener('click', () => {
                const dateStr = cell.getAttribute('data-date');
                this.openAssignModal(dateStr);
            });
            cell.addEventListener('dblclick', () => {
                const dateStr = cell.getAttribute('data-date');
                // Prefer first unassigned shift for that date
                const [yy,mm,dd] = dateStr.split('-').map(Number);
                const date = new Date(yy, mm-1, dd);
                const isWeekend = [0,6].includes(date.getDay());
                const holName = window.DEBUG?.state?.holidays?.[String(yy)]?.[dateStr] || null;
                const allShifts = Object.entries(SHIFTS).filter(([k,v]) => {
                    if (holName) return v.type === 'holiday';
                    if (isWeekend) return v.type === 'weekend';
                    return v.type === 'weekday';
                }).map(([k])=>k);
                const monthKey = dateStr.substring(0,7);
                const cur = window.DEBUG?.state?.scheduleData?.[monthKey]?.[dateStr]?.assignments || {};
                const firstUnassigned = allShifts.find(s => !cur[s]);
                this.openAssignModal(dateStr, firstUnassigned);
            });
        });

        // After drawing the grid, render current assignments if any
        this.renderAssignments(month);
    }
    

    renderAssignments(month) {
        const data = window.DEBUG?.state?.scheduleData?.[month] || {};
        Object.entries(data).forEach(([dateStr, day]) => {
            const cell = document.querySelector(`.cal-body[data-date="${dateStr}"]`);
            if (!cell) return;
            const assignments = day.assignments || {};
            cell.innerHTML = Object.entries(assignments).map(([shift, staffId]) => {
                const shiftMeta = (window.SHIFTS||{})[shift] || {};
                const staff = (window.DEBUG?.state?.staffData||[]).find(s=>s.id==staffId);
                const title = `${shiftMeta.name||shift} ${shiftMeta.time?`(${shiftMeta.time})`:''} - ${staff?.name||staffId}`;
                return `<div class="staff-assignment" title="${title}" data-date="${dateStr}" data-shift="${shift}"><span class="badge">${shift}</span> ${staffId}</div>`;
            }).join('');
        });
        // Enable pill-click to open modal with preselected shift
        document.querySelectorAll('.staff-assignment[data-date]').forEach(pill => {
            pill.addEventListener('click', (e)=>{
                e.stopPropagation();
                const dateStr = pill.getAttribute('data-date');
                const shiftKey = pill.getAttribute('data-shift');
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
        const holName = window.DEBUG?.state?.holidays?.[String(y)]?.[dateStr] || null;
        const allShifts = Object.entries(SHIFTS).filter(([k,v]) => {
            if (holName) return v.type === 'holiday';
            if (isWeekend) return v.type === 'weekend';
            return v.type === 'weekday';
        }).map(([k])=>k);

        const shiftSel = document.getElementById('swapShiftSelect');
        shiftSel.innerHTML = allShifts.map(s=>`<option value="${s}">${s}</option>`).join('');
        // Default to preset, otherwise pick first unassigned if possible
        const month = dateStr.substring(0,7);
        const cur = window.DEBUG?.state?.scheduleData?.[month]?.[dateStr]?.assignments || {};
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
            currentAssignment.textContent = sid ? `Aktuell: ${sid}` : 'Aktuell: —';
        };
        shiftSel.onchange = updateCurrent; updateCurrent();

        // Build candidate list with scoring from engine
        const engine = new SchedulingEngine(month);
        const weekNum = engine.getWeekNumber(date);
        const getCandidates = () => {
            const scheduledToday = new Set(Object.values(cur||{}));
            return engine.findCandidatesForShift(dateStr, shiftSel.value, scheduledToday, weekNum);
        };
        const staffSel = document.getElementById('swapStaffSelect');
        const renderCandidates = () => {
            const cands = getCandidates();
            const sh = shiftSel.value;
            const validator = new ScheduleValidator(month);
            const simBase = JSON.parse(JSON.stringify(window.DEBUG?.state?.scheduleData?.[month] || {}));
            // Build select options with blocker detection
            const options = cands.map(c => {
                const s = c.staff;
                const sim = JSON.parse(JSON.stringify(simBase));
                if (!sim[dateStr]) sim[dateStr] = { assignments: {} };
                if (!sim[dateStr].assignments) sim[dateStr].assignments = {};
                sim[dateStr].assignments[sh] = s.id;
                const validated = validator.validateSchedule(sim);
                const blocker = validated?.[dateStr]?.blockers?.[sh] || '';
                const label = `${s.name} (Score: ${Math.round(c.score)})${blocker ? ' ❌' : ''}`;
                const disabled = blocker ? ' disabled' : '';
                const title = blocker ? ` title="${blocker}"` : '';
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
        };
        renderCandidates();
        const notes = document.getElementById('candidateNotes');
        // Notes content set in renderCandidates

        // Stash selection into modal dataset for handler
        modal.dataset.date = dateStr;
        modal.dataset.shift = shiftSel.value;
        const syncShift = () => { modal.dataset.shift = shiftSel.value; renderCandidates(); updateCurrent(); };
        shiftSel.addEventListener('change', syncShift);

    // Show modal
    if (window.__openModal) window.__openModal('swapModal'); else modal.style.display = 'block';
    }
}



