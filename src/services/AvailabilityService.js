import { appState } from '../../modules/state.js';

export function createAvailabilityService(store){
  return {
    getForStaff(staffId){ return appState.availabilityData?.[staffId] || {}; },
    getDay(staffId, dateStr){ return (appState.availabilityData?.[staffId]||{})[dateStr] || {}; },
    setShift(staffId,dateStr,shiftKey,status){ return store.availabilityUpsert(staffId,dateStr,shiftKey,status); },
  listRange(staffId, fromDate, toDate){ return store.availabilityListForRange(staffId, fromDate, toDate); },
  setDayOff(staffId, dateStr, isOff){ return store.availabilitySetDayOff(staffId, dateStr, isOff); },
  isDayOff(staffId, dateStr){ return store.availabilityIsDayOff(staffId, dateStr); },
  setVoluntary(staffId, dateStr, kind, checked){ return store.availabilitySetVoluntary(staffId, dateStr, kind, checked); },
  isVoluntary(staffId, dateStr, kind){ return store.availabilityIsVoluntary(staffId, dateStr, kind); }
  };
}
