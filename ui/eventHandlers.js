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
        const month = dateStr.substring(0,7);
        const schedule = appState.scheduleData[month] || (appState.scheduleData[month] = {});
        if (!schedule[dateStr]) schedule[dateStr] = { assignments: {} };
        const original = { ...schedule[dateStr].assignments };
        schedule[dateStr].assignments[shiftKey] = newStaffId;

        // Validate
        const validator = new ScheduleValidator(month);
        const validated = validator.validateSchedule(schedule);
        const hasBlocker = validated[dateStr]?.blockers?.[shiftKey];
        if (hasBlocker){
            schedule[dateStr].assignments = original;
            alert(`Zuweisung nicht möglich: ${hasBlocker}`);
            return;
        }
        appState.scheduleData[month] = validated;
        appState.save();
        this.ui.updateCalendarFromSelect?.();
        modal.style.display = 'none';
    }

    closeModal(id) {
        this.modalManager.closeModal(id);
    }
}