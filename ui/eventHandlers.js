import { appState } from '../modules/state.js';
import { ModalManager } from './modalManager.js';
import { ScheduleValidator } from '../validation.js';
import { SchedulingEngine } from '../scheduler.js';

export class EventHandler {
    constructor(ui) {
        this.ui = ui;
        this.modalManager = new ModalManager();
        this.setupHandlers();
    }

    setupHandlers() {
        // Swap modal handlers
        document.getElementById('swapModal')?.addEventListener('click', e => {
            if (e.target.classList.contains('modal')) {
                this.closeModal('swapModal');
            }
        });

        document.getElementById('executeSwapBtn')?.addEventListener('click', () => {
            this.executeSwap();
        });
        document.getElementById('executeAssignBtn')?.addEventListener('click', () => {
            this.executeAssign();
        });

        // Schedule generation handlers
        document.getElementById('generateScheduleBtn')?.addEventListener('click', () => {
            this.generateSchedule();
        });

        document.getElementById('clearScheduleBtn')?.addEventListener('click', () => {
            this.clearSchedule();
        });
    }

    executeSwap() {
        const modal = document.getElementById('swapModal');
        const dateStr = modal.dataset.date;
        const shiftKey = modal.dataset.shift;
        const currentStaffId = parseInt(modal.dataset.currentStaff);
        const newStaffId = parseInt(document.getElementById('swapStaffSelect').value);

        if (!dateStr || !shiftKey || !currentStaffId || !newStaffId) {
            alert('Invalid swap parameters');
            return;
        }

        const month = dateStr.substring(0, 7);
        const schedule = appState.scheduleData[month];
        
        if (!schedule?.[dateStr]?.assignments) {
            alert('Invalid schedule data');
            return;
        }

        // Perform the swap
        const validator = new ScheduleValidator(month);
        const originalAssignments = { ...schedule[dateStr].assignments };
        
        schedule[dateStr].assignments[shiftKey] = newStaffId;
        
        // Validate the change
        const validated = validator.validateSchedule(schedule);
        const hasBlocker = validated[dateStr]?.blockers?.[shiftKey];

        if (hasBlocker) {
            schedule[dateStr].assignments = originalAssignments;
            alert(`Tausch nicht möglich: ${hasBlocker}`);
            return;
        }

        // Apply validated schedule
        appState.scheduleData[month] = validated;
        appState.save();
    try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
        
        this.ui.refreshDisplay();
        this.closeModal('swapModal');
    }

    generateSchedule() {
        const month = document.getElementById('scheduleMonth').value;
        if (!month) {
            alert('Bitte Monat auswählen');
            return;
        }
        try {
            const engine = new SchedulingEngine(month);
            const schedule = engine.generateSchedule();
            // Persist without calling schedule.save() (which references saveData)
            appState.scheduleData[month] = schedule.data;
            appState.save();
            try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
            // Re-render calendar and assignments
            if (typeof this.ui.updateCalendarFromSelect === 'function') {
                this.ui.updateCalendarFromSelect();
            } else {
                this.ui.refreshDisplay();
            }
        } catch (e) {
            console.error('Schedule generation failed', e);
            alert('Fehler beim Erstellen des Dienstplans. Details in der Konsole.');
        }
    }

    clearSchedule() {
        const month = document.getElementById('scheduleMonth').value;
        if (!month || !appState.scheduleData[month]) return;
        if (confirm(`Soll der Dienstplan für ${month} wirklich gelöscht werden?`)) {
            delete appState.scheduleData[month];
            appState.save();
            if (typeof this.ui.updateCalendarFromSelect === 'function') {
                this.ui.updateCalendarFromSelect();
            } else {
                this.ui.refreshDisplay();
            }
        }
    }

    executeAssign(){
        const modal = document.getElementById('swapModal');
        if (!modal) return;
        const dateStr = modal.dataset.date;
        const shiftKey = modal.dataset.shift;
        const newStaffId = parseInt(document.getElementById('swapStaffSelect').value);
        if (!dateStr || !shiftKey || !newStaffId){ alert('Ungültige Auswahl'); return; }
        // If weekend + permanent without preference and no regular candidates can fill, auto-create overtime request
        try{
            const date = new Date(dateStr);
            const isWeekend = [0,6].includes(date.getDay());
            const staff = (window.DEBUG?.state?.staffData||[]).find(s=>s.id==newStaffId);
            if (isWeekend && staff?.role==='permanent' && !staff?.weekendPreference){
                const month = dateStr.substring(0,7);
                // Recompute candidates without including permanents to check fillability
                const engine = new SchedulingEngine(month);
                const weekNum = engine.getWeekNumber(date);
                const scheduledToday = new Set(Object.values(window.DEBUG?.state?.scheduleData?.[month]?.[dateStr]?.assignments||{}));
                const cands = engine.findCandidatesForShift(dateStr, shiftKey, scheduledToday, weekNum)
                    .filter(c => c.staff.role !== 'permanent');
                const canBeFilledByRegular = cands.some(c => c.score > -999); // heuristic: any candidate
                if (!canBeFilledByRegular){
                                        try { if (!window.__services) { import('../src/services/index.js').then(m=> { window.__services = m.createServices({}); }); } } catch {}
                                        const overtimeSvc = window.__services?.overtime;
                                        const exists = overtimeSvc.listByDate(month,dateStr).some(r=> r.staffId===newStaffId && r.shiftKey===shiftKey && r.status==='requested');
                                        if(!exists){
                                            overtimeSvc.create(month, dateStr, { staffId: newStaffId, shiftKey, reason: 'Unbesetzbare Schicht' });
                                            alert('Überstunden-Anfrage erstellt. Bitte im Anfragen-Panel bestätigen.');
                                        }
                    return; // Do not assign until consent
                }
            }
        }catch(e){ console.warn('Auto-request check failed', e); }
        const month = dateStr.substring(0,7);
        const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
        if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
        const original = { ...schedule[dateStr].assignments };
        schedule[dateStr].assignments[shiftKey] = newStaffId;

        // Validate (warnings allowed, only error-level blockers will prevent assignment)
        const validator = new ScheduleValidator(month);
        const { schedule: consolidated } = validator.validateScheduleWithIssues(schedule);
        const hasBlocker = consolidated[dateStr]?.blockers?.[shiftKey];
        if (hasBlocker){
            schedule[dateStr].assignments = original;
            alert(`Zuweisung nicht möglich: ${hasBlocker}`);
            return;
        }
        appState.scheduleData[month] = consolidated;
        appState.save();
    try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
        this.ui.updateCalendarFromSelect?.();
        modal.style.display = 'none';
    }

    closeModal(id) {
        this.modalManager.closeModal(id);
    }
}