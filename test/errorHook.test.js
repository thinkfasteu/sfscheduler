import { onError, installGlobalErrorHandlers, pushError } from '../src/utils/errors.js';

// Basic runtime test for error hook
(function(){
  const fired = [];
  onError(e=> fired.push(e));
  if (typeof window !== 'undefined') installGlobalErrorHandlers();
  // Synthesize an error (deterministic in Node)
  const simulated = { type:'error', message:'hook-test', filename:'test.js', lineno:1, colno:1, time:Date.now() };
  pushError(simulated);
  if (!fired.some(e=> e.message==='hook-test')) throw new Error('error hook did not capture test error');
  console.log('errorHook.test passed');
})();