export class ModalManager {
    constructor() {
        // Basic modal implementation
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
                            modal.classList.remove('open');
                            document.body.classList.remove('no-scroll');
        }
    }
}
