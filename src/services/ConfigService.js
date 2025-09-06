import { APP_CONFIG, SHIFTS } from '../../modules/config.js';

export function createConfigService(){
  return {
    getConfig(){ return APP_CONFIG; },
    getShift(key){ return SHIFTS?.[key]; },
    listShifts(){ return Object.keys(SHIFTS||{}).map(k=>({ key: k, ...SHIFTS[k] })); }
  };
}
