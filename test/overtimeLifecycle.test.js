import { createServices } from '../src/services/index.js';
import { appState } from '../modules/state.js';

function reset(){
  Object.assign(appState, {
    staffData: [ { id:1, name:'Alice', role:'permanent' } ],
    scheduleData: {},
    overtimeRequests: {},
    permanentOvertimeConsent: {},
    auditLog: [],
    save(){}
  });
}

(async function(){
  reset();
  const services = createServices();
  const month = '2025-09';
  const dateStr = '2025-09-06';
  // Create request
  const rec = services.overtime.create(month, dateStr, { staffId:1, shiftKey:'early' });
  if (!rec || rec.status!=='requested') throw new Error('Create request failed');
  // Consent
  services.overtime.consent(rec.id);
  const afterConsent = services.overtime.listAll().find(r=>r.id===rec.id);
  if (afterConsent.status!=='consented') throw new Error('Consent transition failed');
  // Mark completed
  services.overtime.complete(rec.id);
  const final = services.overtime.listAll().find(r=>r.id===rec.id);
  if (final.status!=='completed') throw new Error('Completion transition failed');
  // Set permanent consent flag
  services.overtime.setConsent(1, dateStr, true);
  if (!services.overtime.hasConsent(1, dateStr)) throw new Error('Consent flag not set');
  console.log('overtimeLifecycle.test passed');
})();
