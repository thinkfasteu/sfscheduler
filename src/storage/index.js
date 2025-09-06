import { LocalStorageAdapter } from './LocalStorageAdapter.js';

export function createStore({ backend='local' } = {}){
  switch(backend){
    case 'local':
    default:
      return new LocalStorageAdapter();
  }
}
