import { auditMsg } from './auditMessages.js';

export function createOvertimeService(store){
  return {
    // Listing helpers
    listAll(){ return store.listOvertimeRequests(); },
    listByMonth(month){ return store.listOvertimeByMonth(month); },
    listByDate(month,dateStr){ return store.listOvertimeByDate(month,dateStr); },
    // CRUD
    create(month, dateStr, req){
      const rec = store.createOvertimeRequest(month, dateStr, req);
      try { store.auditLog?.(auditMsg('overtime.request.create',{ staffId: rec.staffId, date: dateStr, shift: rec.shiftKey })); } catch {}
      return rec;
    },
    update(month, dateStr, predicate, patch){ return store.updateOvertimeRequest(month, dateStr, predicate, patch); },
    // Status transitions by id (or legacy composite id) with audit logging.
    setStatus(id, status, extra={}){ const r = store.transitionOvertimeRequest(id, status, extra); if(r){ try { store.auditLog?.(auditMsg('overtime.request.status',{ id:r.id, status, staffId:r.staffId, date:r.dateStr, shift:r.shiftKey })); } catch {} } return r; },
    consent(id){ return this.setStatus(id, 'consented'); },
    decline(id){ return this.setStatus(id, 'declined'); },
    complete(id){ return this.setStatus(id, 'completed'); },
    // Consent flags (permanent for given date)
    setConsent(staffId, dateStr, value=true){ const ok = store.setOvertimeConsent(staffId, dateStr, value); if (ok){ try { store.auditLog?.(auditMsg(value? 'overtime.consent.set':'overtime.consent.remove',{ staffId, date: dateStr })); } catch {} } return ok; },
    hasConsent(staffId, dateStr){ return store.hasOvertimeConsent(staffId, dateStr); }
  };
}
