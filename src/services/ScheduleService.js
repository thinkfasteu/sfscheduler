// Schedule service delegates to adapter; adapter internally touches state/cache.
export function createScheduleService(store){
  return {
    getMonth(monthKey){ return store.getMonthSchedule(monthKey); },
    setMonth(monthKey, data){ return store.setMonthSchedule(monthKey, data); },
    assign(dateStr, shiftKey, staffId){ return store.assign(dateStr, shiftKey, staffId); },
    unassign(dateStr, shiftKey){ return store.unassign(dateStr, shiftKey); },
    clearMonth(monthKey){ return store.clearMonthSchedule(monthKey); }
  };
}
