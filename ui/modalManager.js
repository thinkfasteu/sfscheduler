export class ModalManager {
    constructor() {
        // Basic modal implementation
    }

    closeModal(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.style.display = 'none';
        }
    }
}
