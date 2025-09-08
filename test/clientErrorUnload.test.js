import { clientErrorLogger } from '../src/config/env.js';

(async function(){
  if (!clientErrorLogger) throw new Error('clientErrorLogger missing');
  // Simulate some buffered errors
  clientErrorLogger.push({ type:'error', msg:'unload-a' });
  clientErrorLogger.push({ type:'error', msg:'unload-b' });
  // Force immediate flush (simulating beforeunload) without network (adapter likely disabled in test env) — ensure no throw
  await clientErrorLogger.forceFlush();
  console.log('clientErrorUnload.test passed');
})();
