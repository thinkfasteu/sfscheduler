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

        document.getElementById('executeSwapBtn')?.addEventListener('click', () => {
            this.executeSwap();
        });
        document.getElementById('executeAssignBtn')?.addEventListener('click', () => {
            this.executeAssign();
        });

        // Schedule generation handlers
        const generateBtn = document.getElementById('generateScheduleBtn');
        console.log('[EventHandler] generateScheduleBtn found:', !!generateBtn, generateBtn);
        generateBtn?.addEventListener('click', () => {
            console.log('[EventHandler] Generate Schedule button clicked');
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
        console.info('Schedule generation started');
        const month = document.getElementById('scheduleMonth').value;
        
        if (!month) {
            alert('Bitte wählen Sie einen Monat aus.');
            return;
        }
        if (!month) {
            alert('Bitte Monat auswählen');
            return;
        }
        // UI: disable controls and show status
        try { window.ui?.setStatus?.('Erstelle Dienstplan…', true); window.ui?.disableScheduleControls?.(true); } catch {}
        // Ensure availability is hydrated from backend before generation (if using remote store)
        const ensureAvailabilityHydrated = async () => {
            try {
                if (!window.__services) {
                    const m = await import('../src/services/index.js');
                    window.__services = m.createServices({});
                }
                await window.__services.ready;
                const usingRemote = !!(window.__services?.store && (window.__services.store.remote || window.__services.store instanceof (await import('../src/storage/SupabaseAdapter.js')).SupabaseAdapter));
                if (!usingRemote) return; // local mode: nothing to hydrate
                const staffList = window.__services.staff?.list() || [];
                const [y,m] = month.split('-').map(Number);
                const fromDate = `${y}-${String(m).padStart(2,'0')}-01`;
                const toDate = `${y}-${String(m).padStart(2,'0')}-${String(new Date(y, m, 0).getDate()).padStart(2,'0')}`;
                const avail = window.__services.availability;
                if (!avail || !staffList.length) return;
                // Kick off hydration sequentially to avoid overwhelming backend; ignore results (HydratingStore merges into appState)
                for (const s of staffList) {
                    try { await avail.listRange(s.id, fromDate, toDate); } catch {}
                }
            } catch(e){ console.warn('Availability hydration skipped', e); }
        };
        // Checklist start (driven by real events)
        try {
            if (window.__services?.uiChecklist && document.getElementById('showChecklistToggle')?.checked){
                window.__services.uiChecklist.start({ month, mode:'generate' });
            }
            window.__services?.events?.emit('schedule:validate:start',{ month });
        } catch {}
        try {
            // Await availability hydration first
            const t0 = performance.now?.()||0;
            await ensureAvailabilityHydrated();
            const t1 = performance.now?.()||0; if ((t1-t0)>5) console.info(`[gen] availability hydrated in ${Math.round(t1-t0)}ms`);
            
            // Start monitoring schedule generation
            const genStartTime = performance.now();
            let generationSuccessful = false;
            let unfilledShifts = 0;
            let constraintViolations = 0;
            
            const engine = new SchedulingEngine(month);
            const schedule = engine.generateSchedule();
            
            // Count unfilled shifts for monitoring
            Object.values(schedule.data).forEach(day => {
                const shifts = day.shifts || ['early', 'midday', 'evening', 'closing'];
                const assignments = day.assignments || {};
                shifts.forEach(shift => {
                    if (!assignments[shift]) {
                        unfilledShifts++;
                    }
                });
            });
            
            // Fairness + overtime validations (reuse validator for flag extraction)
            let flags=[]; try {
                const validator = new (window.ScheduleValidator||window.ScheduleValidatorImported||require('../validation.js').ScheduleValidator)(month); // fallback dynamic
                const { issues } = validator.validateScheduleWithIssues(schedule.data);
                const sample = [];
                Object.values(issues).forEach(arr=>{ (arr||[]).forEach(it=> sample.push(it)); });
                flags = sample.slice(0,12).map(i=> i.message || `${i.type}`);
                constraintViolations = sample.length;
                
                // Record validation issues for monitoring
                if (window.__services?.monitoring) {
                    window.__services.monitoring.recordValidationIssues(issues);
                }
                
                window.__services?.uiChecklist?.addFlags(flags);
            } catch {}
            
            generationSuccessful = true;
            
            // Record performance metrics
            const genEndTime = performance.now();
            const generationDuration = genEndTime - genStartTime;
            if (window.__services?.monitoring) {
                window.__services.monitoring.recordPerformance('schedule_generation', generationDuration, {
                    success: generationSuccessful,
                    unfilledShifts,
                    constraintViolations,
                    month
                });
            }
            
            window.__services?.events?.emit('schedule:validate:done',{ month, flags });
            window.__services?.uiChecklist?.updateStep('validate','ok');
            window.__services?.events?.emit('schedule:fairness:start',{ month });
            window.__services?.uiChecklist?.updateStep('fairness','ok');
            window.__services?.events?.emit('schedule:overtime:start',{ month });
            window.__services?.uiChecklist?.updateStep('overtime','ok');
            // Persist without calling schedule.save() (which references saveData)
            appState.scheduleData[month] = schedule.data;
            appState.save();
            window.__services?.events?.emit('schedule:save:done',{ month });
            window.__services?.uiChecklist?.updateStep('save','ok');
            try { window.appUI?.recomputeOvertimeCredits?.(month); } catch {}
            window.__services?.events?.emit('schedule:reindex:start',{ month });
            window.__services?.uiChecklist?.updateStep('reindex','ok');
            window.__services?.uiChecklist?.complete({ message:'Plan erstellt', month, flagsCount: (flags||[]).length });
            window.__services?.events?.emit('schedule:complete',{ month, flagsCount:(flags||[]).length });
            // Re-render calendar and assignments
            if (typeof this.ui.updateCalendarFromSelect === 'function') {
                this.ui.updateCalendarFromSelect();
            } else {
                this.ui.refreshDisplay();
            }
            window.__toast && window.__toast('Dienstplan erstellt', { small:true });
        } catch (e) {
            console.error('Schedule generation failed', e);
            alert('Fehler beim Erstellen des Dienstplans. Details in der Konsole.');
            try { window.__services?.uiChecklist?.updateStep('validate','error'); window.__services?.uiChecklist?.complete({ message:'Fehler bei Erstellung' }); } catch {}
            window.__toast && window.__toast('Fehler bei der Erstellung', { variant:'error', small:true });
        }
        finally { try { window.ui?.clearStatus?.(); window.ui?.disableScheduleControls?.(false); } catch {} }
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