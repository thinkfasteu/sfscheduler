// Minimal test harness for boot.js behavior flags.
// Note: This is a lightweight sanity script (not using a full test runner) invoked like: node test/bootLoader.test.js
// It simulates a browser-like global by mocking minimal APIs used in boot.js.

(async function(){
  const results = [];
  function record(name, pass, info){ results.push({ name, pass, info }); }

  // Mock minimal DOM / fetch / console
  global.window = global;
  global.document = {
    head: { appendChild: ()=>{} },
    createElement: ()=>({ set src(v){ this._src=v; }, get src(){return this._src;}, onload: null, onerror: null })
  };
  const fetchCalls = [];
  global.fetch = async function(url, opts={}){ fetchCalls.push({ url, opts }); return { ok:false, json: async()=>({}), text: async()=>'' }; };

  const logs = []; const warns=[];
  const origInfo = console.info; const origWarn = console.warn;
  console.info = (...a)=>{ logs.push(a.join(' ')); };
  console.warn = (...a)=>{ warns.push(a.join(' ')); };

  // Configure test-only early exit
  window.CONFIG = { __BOOT_TEST_ONLY:true, EXPECT_LOCAL_CONFIG:false };

  await import('../boot.js');

  // Assertions
  record('early-exit-flag', logs.some(l=>l.includes('test-only early exit')), logs);
  record('no-mode-log', !logs.some(l=>/mode=/.test(l)), logs);
  record('no-fetches', fetchCalls.length===0, fetchCalls);

  // Restore consoles
  console.info = origInfo; console.warn = origWarn;

  const failed = results.filter(r=>!r.pass);
  if (failed.length){
    console.error('[bootLoader.test] FAIL', failed);
    process.exitCode = 1;
  } else {
    console.log('[bootLoader.test] PASS', results);
  }
})();
