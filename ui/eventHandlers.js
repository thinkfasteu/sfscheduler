import { appState } from '../modules/state.js';
import { ModalManager } from './modalManager.js';
import { ScheduleValidator } from '../validation.js';
import { SchedulingEngine } from '../scheduler.js';
import { exportSchedulePdf } from './pdfExporter.js';

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

        // Modal action buttons are wired centrally via src/ui/eventBindings.js

        // Schedule button bindings are handled centrally via src/ui/eventBindings.js
    }

    executeSwap() {
        const modal = document.getElementById('swapModal');
        const dateStr = modal?.dataset.date;
        const shiftKey = modal?.dataset.shift;
        const currentStaffId = this.parseStaffId(modal?.dataset.currentStaff);
        const selectEl = document.getElementById('swapStaffSelect');
        const newStaffId = this.parseStaffId(selectEl?.value);

        if (!dateStr || !shiftKey || currentStaffId === null || newStaffId === null) {
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

    async generateSchedule() {
        const monthEl = document.getElementById('scheduleMonth');
        const month = monthEl?.value;
        if (!month) {
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }
        try {
            const engine = new SchedulingEngine(month);
            const schedule = engine.generateSchedule();
            appState.scheduleData[month] = schedule.data;
            appState.save();
            
            this.ui.refreshDisplay();
            
            // Show notification about finalization
            if (window.__toast) {
                window.__toast('Plan erstellt! Verwenden Sie "Plan finalisieren" um ihn zu speichern.', { variant: 'info' });
            }
        } catch (error) {
            console.error('[generateSchedule] Error:', error);
            alert('Fehler bei der Planerstellung: ' + error.message);
        }
    }

    clearSchedule() {
        const monthEl = document.getElementById('scheduleMonth');
        const month = monthEl?.value || this.ui?.currentCalendarMonth;
        
        if (!month) {
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }
        
        const hasScheduleData = appState.scheduleData?.[month] && Object.keys(appState.scheduleData[month]).length > 0;
        
        if (!hasScheduleData) {
            alert('Kein Dienstplan zum Löschen verfügbar');
            return;
        }
        
        if (confirm(`Soll der Dienstplan für ${month} wirklich gelöscht werden?`)) {
            
            // Clear local schedule data
            delete appState.scheduleData[month];
            
            // Clear backend/service data if available
            (async () => {
                try {
                    if (window.__services?.schedule?.clearMonth) {
                        await window.__services.schedule.clearMonth(month);
                    }
                } catch (e) {
                    console.warn('[clearSchedule] could not clear backend data:', e);
                }
            })();
            
            // Save the cleared state
            appState.save();
            
            // Refresh the UI
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
        const selectEl = document.getElementById('swapStaffSelect');
        const newStaffId = this.parseStaffId(selectEl?.value);
        if (!dateStr || !shiftKey || newStaffId === null){ alert('Ungültige Auswahl'); return; }
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

    parseStaffId(raw){
        if (raw === undefined) return null;
        if (raw === 'manager') return 'manager';
        const parsed = parseInt(raw, 10);
        return Number.isNaN(parsed) ? null : parsed;
    }

    async finalizeSchedule() {
        const monthEl = document.getElementById('scheduleMonth');
        const month = monthEl?.value;
        
        if (!month) {
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }
        
        const scheduleData = appState.scheduleData?.[month];
        if (!scheduleData || Object.keys(scheduleData).length === 0) {
            alert('Kein Dienstplan zum Finalisieren verfügbar. Erstellen Sie zuerst einen Plan.');
            return;
        }

        // Validate the schedule before finalization
        const validator = new ScheduleValidator(month);
        const { schedule: consolidated } = validator.validateScheduleWithIssues(scheduleData);
        
        // Check for blockers
        const violations = [];
        Object.entries(consolidated).forEach(([dateStr, day]) => {
            if (day.blockers) {
                Object.entries(day.blockers).forEach(([shiftKey, blocker]) => {
                    if (blocker && blocker !== 'manager') { // Skip manager wildcard
                        violations.push({ dateStr, shift: shiftKey, blocker });
                    }
                });
            }
        });

        // Check critical shift coverage (>4 unfilled critical shifts blocks finalization)
        const criticalUnfilled = this.countUnfilledCriticalShifts(month, scheduleData);
        if (criticalUnfilled > 4) {
            violations.push({ 
                dateStr: 'MONTH', 
                shift: 'CRITICAL_COVERAGE', 
                blocker: `UNFILLED_CRITICAL_SHIFTS: ${criticalUnfilled} critical shifts unfilled (max 4 allowed)` 
            });
        }

        if (violations.length > 0) {
            // Highlight violations in UI
            if (window.ui?.highlightViolations) {
                window.ui.highlightViolations(violations);
            }
            const msg = violations.map(v => `${v.dateStr} ${v.shift}: ${v.blocker}`).join('\n');
            alert(`Schedule has violations and cannot be finalized:\n\n${msg}\n\nPlease fix the issues before finalizing.`);
            return;
        }

        // Clear any previous violation highlights
        if (window.ui?.clearViolations) {
            window.ui.clearViolations();
        }
        
        if (!confirm(`Soll der Dienstplan für ${month} finalisiert werden?\n\nDies speichert den Plan dauerhaft in der Datenbank und ersetzt alle vorhandenen Daten für diesen Monat.`)) {
            return;
        }
        
        try {
            
            if (window.__services?.schedule?.setMonth) {
                await window.__services.schedule.setMonth(month, scheduleData);
                
                if (window.__toast) {
                    window.__toast('Plan erfolgreich finalisiert und gespeichert!', { variant: 'success' });
                }
                
                alert('Plan erfolgreich finalisiert! Der Dienstplan wurde dauerhaft gespeichert.');
            } else {
                throw new Error('Backend services not available');
            }
            
        } catch (error) {
            console.error('[finalizeSchedule] Backend save failed:', error);
            alert('Fehler beim Finalisieren: ' + error.message + '\n\nDer Plan wurde lokal gespeichert, aber nicht in der Datenbank.');
        }
    }

    countUnfilledCriticalShifts(month, scheduleData) {
        const [year, monthNum] = month.split('-').map(Number);
        const daysInMonth = new Date(year, monthNum, 0).getDate();
        let unfilledCount = 0;

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(monthNum).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
            const dayData = scheduleData[dateStr];
            if (!dayData?.assignments) continue;

            // Get applicable shifts for this date
            const applicableShifts = this.getApplicableShiftsForDate(dateStr);
            
            applicableShifts.forEach(shiftKey => {
                // Check if this shift is critical
                if (this.isCriticalShift(shiftKey, dateStr) && !dayData.assignments[shiftKey]) {
                    unfilledCount++;
                }
            });
        }

        return unfilledCount;
    }

    getApplicableShiftsForDate(dateStr) {
        // Import SHIFTS logic - simplified version
        const { SHIFTS } = window; // Assume SHIFTS is available globally
        if (!SHIFTS) return [];

        const date = new Date(dateStr);
        const isWeekend = [0,6].includes(date.getDay());
        const holName = window.appState?.holidays?.[dateStr.split('-')[0]]?.[dateStr];
        const type = holName ? 'holiday' : (isWeekend ? 'weekend' : 'weekday');
        
        return Object.entries(SHIFTS).filter(([_, v]) => v.type === type).map(([k]) => k);
    }

    isCriticalShift(shiftKey, dateStr) {
        // All shifts are critical except 'evening' on optional days (Tuesday, Thursday)
        if (shiftKey !== 'evening') return true;
        
        const date = new Date(dateStr);
        const dayOfWeek = date.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        const optionalDays = [2, 4]; // Tuesday=2, Thursday=4 (0-based)
        
        return !optionalDays.includes(dayOfWeek);
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
        const monthEl = document.getElementById('scheduleMonth');
        const month = monthEl?.value || this.ui?.currentCalendarMonth;
        if (!month) {
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }

        const schedule = appState.scheduleData?.[month];
        if (!schedule || Object.keys(schedule).length === 0) {
            alert('Kein Dienstplan für Export verfügbar');
            return;
        }

        // Run validation gate identical to finalization blockers
        const validator = new ScheduleValidator(month);
        const clonedSchedule = JSON.parse(JSON.stringify(schedule));
        const { schedule: consolidated } = validator.validateScheduleWithIssues(clonedSchedule);

        const violations = [];
        Object.entries(consolidated).forEach(([dateStr, day]) => {
            if (!day?.blockers) return;
            Object.entries(day.blockers).forEach(([shiftKey, blocker]) => {
                if (blocker && blocker !== 'manager') {
                    violations.push({ dateStr, shift: shiftKey, blocker });
                }
            });
        });

        const criticalUnfilled = this.countUnfilledCriticalShifts(month, schedule);
        if (criticalUnfilled > 4) {
            violations.push({
                dateStr: 'MONTH',
                shift: 'CRITICAL_COVERAGE',
                blocker: `UNFILLED_CRITICAL_SHIFTS: ${criticalUnfilled} kritische Schichten unbesetzt (max. 4 erlaubt)`
            });
        }

        if (violations.length > 0) {
            const msg = violations.map(v => `${v.dateStr} ${v.shift}: ${v.blocker}`).join('\n');
            const confirmed = confirm(`Der Plan enthält noch Fehler und wurde nicht finalisiert.\n\n${msg}\n\nTrotzdem PDF exportieren?`);
            if (!confirmed) return;
        }

        try {
            this.ui?.setStatus?.('Erzeuge PDF…', true);
            exportSchedulePdf({ month, schedule });
            this.ui?.setStatus?.('PDF gespeichert ✓', true, false);
            window.__toast?.('Dienstplan als PDF gespeichert', { variant: 'success' });
        } catch (error) {
            console.error('[exportPdf] failed', error);
            alert(`Fehler beim PDF-Export: ${error.message}`);
        } finally {
            setTimeout(() => this.ui?.clearStatus?.(), 1200);
        }
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
        (async () => {
            try {
                if (window.__services?.schedule?.clearMonth) {
                    console.log('[generateNewSchedule] clearing backend schedule data');
                    await window.__services.schedule.clearMonth(month);
                    console.log('[generateNewSchedule] backend clear completed');
                }
            } catch (e) {
                console.warn('[generateNewSchedule] could not clear backend data:', e);
            }
        })();

        // Save the cleared state
        appState.save();
        
        // Check if we have availability data for this month
        const hasAvailability = appState.availabilityData && 
                               appState.availabilityData[month] && 
                               Object.keys(appState.availabilityData[month]).length > 0;
        
        if (!hasAvailability) {
            alert(`Keine Verfügbarkeitsdaten für ${month} gefunden. Bitte zuerst Verfügbarkeiten eintragen.`);
            return;
        }

        
        // Generate fresh schedule - manual generation only
        if (this.ui && typeof this.ui.generateScheduleForCurrentMonth === 'function') {
            try {
                // Reset generation lock if stuck
                this.ui._generating = false; 
                this.ui.generateScheduleForCurrentMonth();
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