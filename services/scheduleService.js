import { appState } from '../modules/state.js';

// Placeholder schedule service for future Supabase adapter integration.
export const scheduleService = {
  getMonth(key){
    return appState.scheduleData[key];
  }
  // TODO: add assign, bulkAssign with version control
};
