import { appState } from '@state';
import { SchedulingEngine } from '../scheduler.js';
// This file in modules is unused by the app; keep paths correct to avoid runtime import failures if referenced
import { ModalManager } from '../ui/modalManager.js';
import { ScheduleValidator } from '../validation.js';

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

        // Schedule generation handlers
        const genBtn = document.getElementById('generateScheduleBtn');
        if (genBtn) {
            genBtn.addEventListener('click', () => {
                try { window.ui?.generateScheduleForCurrentMonth?.(); } catch(e){ console.warn('[modules/EventHandler] generation fallback failed', e); }
            });
        }

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

    generateSchedule() { return window.ui?.generateScheduleForCurrentMonth?.(); }

    clearSchedule() {
        const month = document.getElementById('scheduleMonth').value;
        if (!month || !appState.scheduleData[month]) return;

        if (confirm(`Soll der Dienstplan für ${month} wirklich gelöscht werden?`)) {
            delete appState.scheduleData[month];
            appState.save();
            this.ui.refreshDisplay();
        }
    }

    closeModal(id) {
        this.modalManager.closeModal(id);
    }
}
 
