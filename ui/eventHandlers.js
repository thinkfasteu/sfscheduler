import { appState } from '@state';
import { ModalManager } from './modalManager.js';
import { ScheduleValidator } from '../validation.js';
import { SchedulingEngine } from '../scheduler.js';

export class EventHandler {
    constructor(ui) {
        console.log('[EventHandler] Constructor called with ui:', ui);
        this.ui = ui;
        this.modalManager = new ModalManager();
        console.log('[EventHandler] About to call setupHandlers');
        this.setupHandlers();
        console.log('[EventHandler] setupHandlers completed');
    }

    setupHandlers() {        
        // Swap modal handlers
        document.getElementById('swapModal')?.addEventListener('click', e => {
            if (e.target.classList.contains('modal')) {
                this.closeModal('swapModal');
            }
        });

        // Modal action buttons are wired centrally via src/ui/eventBindings.js

        // Schedule button bindings are handled centrally via src/ui/eventBindings.js
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
        const hasWarning = validated[dateStr]?.warnings?.[shiftKey];

        if (hasBlocker) {
            schedule[dateStr].assignments = originalAssignments;
            alert(`Tausch nicht möglich: ${hasBlocker}`);
            return;
        }

        // Check for Minijob earnings warnings and allow manager override
        if (hasWarning && hasWarning.includes('Minijob earnings risk')) {
            const newStaff = (appState.staffData || []).find(s => s.id === newStaffId);
            const staffName = newStaff?.name || `Staff ${newStaffId}`;
            const confirmed = window.confirm(
                `⚠️ Warnung: ${hasWarning}\n\n` +
                `Dieser Tausch könnte dazu führen, dass ${staffName} die Minijob-Verdienstgrenze überschreitet.\n\n` +
                `Trotzdem fortfahren?`
            );
            
            if (!confirmed) {
                schedule[dateStr].assignments = originalAssignments;
                return;
            }
            
            // Record monitoring data for manager override of minijob warning
            if (window.__services?.monitoring) {
                window.__services.monitoring.recordAssignmentOperation('swap', {
                    violationOverridden: false,
                    minijobWarningIgnored: true
                });
            }
        } else {
            // Record regular swap operation
            if (window.__services?.monitoring) {
                window.__services.monitoring.recordAssignmentOperation('swap', {
                    violationOverridden: false,
                    minijobWarningIgnored: false
                });
            }
        }

        // Apply validated schedule
        appState.scheduleData[month] = validated;
        appState.save();
        try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
        
        this.ui.refreshDisplay();
        try { window.modalManager ? window.modalManager.close('swapModal') : window.closeModal?.('swapModal'); } catch(e){ console.warn('[EventHandler] close swapModal failed', e); }
    }

    async generateSchedule() { return window.ui?.generateScheduleForCurrentMonth?.(); }

    clearSchedule() {
        console.log('[clearSchedule] called');
        const monthEl = document.getElementById('scheduleMonth');
        const month = monthEl?.value || this.ui?.currentCalendarMonth;
        console.log('[clearSchedule] monthEl=', monthEl, 'month=', month, 'currentCalendarMonth=', this.ui?.currentCalendarMonth);
        console.log('[clearSchedule] scheduleData for month=', appState.scheduleData?.[month]);
        
        if (!month) {
            console.log('[clearSchedule] no month selected');
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }
        
        const hasScheduleData = appState.scheduleData?.[month] && Object.keys(appState.scheduleData[month]).length > 0;
        
        if (!hasScheduleData) {
            console.log('[clearSchedule] no schedule data found');
            alert('Kein Dienstplan zum Löschen verfügbar');
            return;
        }
        
        if (confirm(`Soll der Dienstplan für ${month} wirklich gelöscht werden?`)) {
            console.log('[clearSchedule] confirmed, deleting schedule');
            
            // Clear local schedule data
            delete appState.scheduleData[month];
            
            // Clear backend/service data if available
            try {
                if (window.__services?.schedule?.clearMonth) {
                    console.log('[clearSchedule] clearing backend schedule data');
                    window.__services.schedule.clearMonth(month);
                }
            } catch (e) {
                console.warn('[clearSchedule] could not clear backend data:', e);
            }
            
            // Save the cleared state
            appState.save();
            
            // Refresh the UI
            if (typeof this.ui.updateCalendarFromSelect === 'function') {
                this.ui.updateCalendarFromSelect();
            } else {
                this.ui.refreshDisplay();
            }
            
            console.log('[clearSchedule] schedule cleared and UI refreshed');
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
    try { this.modalManager.closeModal('swapModal'); } catch {}
    }

    closeModal(id) {
        this.modalManager.closeModal(id);
    }

    exportSchedule() {
        // Simple CSV export placeholder - would need to be implemented
        const month = document.getElementById('scheduleMonth').value;
        if (!month || !appState.scheduleData[month]) {
            alert('Kein Dienstplan für Export verfügbar');
            return;
        }
        alert('CSV Export wird noch nicht unterstützt');
        // TODO: Implement CSV export functionality
    }

    exportPdf() {
        // PDF export placeholder - would need to be implemented  
        const month = document.getElementById('scheduleMonth').value;
        if (!month || !appState.scheduleData[month]) {
            alert('Kein Dienstplan für Export verfügbar');
            return;
        }
        alert('PDF Export wird noch nicht unterstützt');
        // TODO: Implement PDF export functionality
    }

    generateNewSchedule() {
        console.log('[generateNewSchedule] called');
        const monthEl = document.getElementById('scheduleMonth');
        const month = monthEl?.value || this.ui?.currentCalendarMonth;
        
        if (!month) {
            console.log('[generateNewSchedule] no month selected');
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }

        console.log('[generateNewSchedule] generating for month:', month);
        
        // Clear any existing schedule data for this month
        if (appState.scheduleData && appState.scheduleData[month]) {
            console.log('[generateNewSchedule] clearing existing schedule data');
            delete appState.scheduleData[month];
        }
        
        // Clear any backend/service data if available
        try {
            if (window.__services?.schedule?.clearMonth) {
                console.log('[generateNewSchedule] clearing backend schedule data');
                window.__services.schedule.clearMonth(month);
            }
        } catch (e) {
            console.warn('[generateNewSchedule] could not clear backend data:', e);
        }

        // Save the cleared state
        appState.save();
        
        // Check if we have availability data for this month
        const hasAvailability = appState.availabilityData && 
                               appState.availabilityData[month] && 
                               Object.keys(appState.availabilityData[month]).length > 0;
        
        if (!hasAvailability) {
            console.log('[generateNewSchedule] no availability data found');
            alert(`Keine Verfügbarkeitsdaten für ${month} gefunden. Bitte zuerst Verfügbarkeiten eintragen.`);
            return;
        }

        console.log('[generateNewSchedule] availability data found, starting generation');
        
        // Generate fresh schedule - manual generation only
        if (this.ui && typeof this.ui.generateScheduleForCurrentMonth === 'function') {
            try {
                // Reset generation lock if stuck
                this.ui._generating = false; 
                this.ui.generateScheduleForCurrentMonth();
                console.log('[generateNewSchedule] manual schedule generation initiated');
            } catch (e) {
                console.error('[generateNewSchedule] generation failed:', e);
                alert('Fehler beim Erstellen des Plans: ' + e.message);
            }
        } else {
            console.error('[generateNewSchedule] generateScheduleForCurrentMonth not available');
            alert('Plan-Generator nicht verfügbar');
        }
    }
}