export class ModalManager {
    constructor() {
        // no-op; acts as facade over global helpers installed by scheduleUI
    }

    ensureHelpersReady(cb){
        if (window.showModal && window.closeModal){ cb(); return; }
        // Retry a few frames if scheduleUI not yet initialized
        let attempts = 0;
        const tick = () => {
            if (window.showModal && window.closeModal){ cb(); return; }
            if (attempts++ < 10) requestAnimationFrame(tick);
            else console.warn('[ModalManager] helpers not ready after retries');
        };
        tick();
    }

    open(id, opts) {
        this.ensureHelpersReady(()=>{
            try { window.showModal?.(id, opts); }
            catch(e){ console.warn('[ModalManager] open failed', e); }
        });
    }

    close(id, opts) {
        try { (window.__closeModal||window.closeModal)?.(id, opts); }
        catch(e){ console.warn('[ModalManager] close failed', e); }
    }

    toggle(id, opts){
        const el = document.getElementById(id);
        if (!el){ console.warn('[ModalManager] toggle missing modal', id); return; }
        if (el.classList.contains('open')) this.close(id, opts); else this.open(id, opts);
    }

    isOpen(id){
        const el = document.getElementById(id);
        return !!(el && el.classList.contains('open'));
    }

    stack(){
        return Array.isArray(window.__modalFocusStack) ? [...window.__modalFocusStack] : [];
    }
}

// Export singleton for convenience
export const modalManager = new ModalManager();
if (!window.modalManager) window.modalManager = modalManager;
