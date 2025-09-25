// Unified application entry for bundling.
// Imports existing modular script tags previously loaded individually.
import './config/bootstrap.js';
import './ui/eventBindings.js';
import '../main.js';
import { installGlobalErrorHandlers, getHealthSnapshot } from './utils/errors.js';
import { holidayService } from '../packages/shared/src/services/holidayService';

installGlobalErrorHandlers();
// Expose health snapshot helper for diagnostics
if (typeof window !== 'undefined') {
    window.health = () => getHealthSnapshot();
    // Expose TS holiday service as window.holidayService
    window.holidayService = holidayService;
}
// Self-check: compare manifest version if available
if (typeof window !== 'undefined'){
	const baseUrl = (window.CONFIG?.BASE_URL || './dist').replace(/\/$/, '') || './dist';
	fetch(baseUrl + '/manifest.json', { cache:'no-store' }).then(r=> r.json()).then(m =>{
		if (m?.version && window.__APP_VERSION__ && m.version !== window.__APP_VERSION__){
			console.warn('[version-mismatch] manifest', m.version, 'runtime', window.__APP_VERSION__);
		}
	}).catch(()=>{});
}

// Expose any globals expected by legacy code (already attached inside modules).
// Placeholder for future explicit export surface.
