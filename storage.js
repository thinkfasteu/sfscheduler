import { state } from './state.js';

const STORAGE_KEY = 'ftg_scheduler_state';
let saveTimeout = null;

export function saveData(immediate = false) {
    const save = () => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch (e) {
            console.error('Save failed:', e);
            return false;
        }
    };

    if (immediate) {
        return save();
    }

    if (saveTimeout) {
        clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(save, 300);
}

export function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (!stored) return false;

        const data = JSON.parse(stored);
        Object.assign(state, data);
        return true;
    } catch (e) {
        console.error('Load failed:', e);
        return false;
    }
}
