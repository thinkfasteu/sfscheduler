import { clientErrorLogger } from '../src/config/env.js';

(async function(){
  if (!clientErrorLogger) throw new Error('clientErrorLogger missing');
  clientErrorLogger.push({ type:'error', msg:'ce-test' });
  if (typeof clientErrorLogger.forceFlush === 'function'){
    await clientErrorLogger.forceFlush();
  }
  console.log('clientErrorLogger.test passed');
})();