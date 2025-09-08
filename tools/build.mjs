#!/usr/bin/env node
import { build } from 'esbuild';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { createHash } from 'crypto';
import path from 'path';

const args = process.argv.slice(2);
const watch = args.includes('--watch');
const analyze = args.includes('--analyze');
// --env-file=.custom.env
const envFileArg = args.find(a=> a.startsWith('--env-file='));
const envFile = envFileArg ? envFileArg.split('=')[1] : '.env';
if (!existsSync('dist')) mkdirSync('dist');

function loadEnv(){
  const out = {};
  if (existsSync(envFile)){
    try {
      const raw = readFileSync(envFile,'utf8');
      raw.split(/\r?\n/).forEach(line=>{
        if (!line || line.startsWith('#')) return;
        const idx = line.indexOf('='); if (idx===-1) return;
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx+1).trim();
        if (k) out[k] = v;
      });
    } catch(e){ console.warn('[build] env parse failed', e); }
  }
  // Also merge process.env (env file wins)
  for (const [k,v] of Object.entries(process.env)) if (out[k]===undefined) out[k]=v;
  return out;
}

const envVars = loadEnv();
// Mandatory keys for production build when BACKEND=supabase
function validateEnv(){
  if (process.argv.includes('--skip-env-check')) return;
  if ((envVars.BACKEND||'').toLowerCase()==='supabase'){
    const required = ['SUPABASE_URL','SUPABASE_ANON_KEY'];
    const missing = required.filter(k=> !envVars[k]);
    if (missing.length){
      console.error('[build] Missing required env vars for supabase backend:', missing.join(', '));
      process.exit(2);
    }
  }
}
validateEnv();
// Prepare defines for both import.meta.env.* and process.env.* access
const envDefine = Object.fromEntries(Object.entries(envVars)
  .filter(([k])=> /^(SUPABASE_|VITE_|APP_|BACKEND|ENV_|SCHED_)/.test(k))
  .flatMap(([k,v])=> [
    [`import.meta.env.${k}`, JSON.stringify(v)],
    [`process.env.${k}`, JSON.stringify(v)]
  ]));

async function bundle({watchMode=false}){
  const result = await build({
    entryPoints: ['src/entry.js'],
    bundle: true,
    splitting: true,
    chunkNames: 'chunks/[name]-[hash]',
    format: 'esm',
    metafile: analyze,
    outdir: 'dist/tmp',
    write: false,
    target: ['es2020'],
    sourcemap: watchMode ? 'inline' : true,
    minify: !watchMode,
    define: {
      ...envDefine,
      __BUILD_MODE__: JSON.stringify(watchMode ? 'watch' : 'build'),
      __BUILD_ANALYZE__: JSON.stringify(!!analyze),
      __APP_VERSION__: JSON.stringify(process.env.APP_VERSION || `0.1.0+${Date.now()}`)
    },
    logLevel: 'silent'
  });
  // Aggregate output files; main entry assumed to end with entry.js
  const jsFiles = result.outputFiles.filter(f=> f.path.endsWith('.js'));
  // Concatenate? Instead we write each with content hash for caching.
  const written = [];
  for (const file of jsFiles){
    const rel = path.basename(file.path);
    const hash = createHash('sha256').update(file.text).digest('hex').substring(0,10);
    // Derive role: entry vs chunk
    const isEntry = /entry\.js$/.test(file.path);
    const baseName = isEntry ? `app.${hash}.js` : rel.replace(/\.js$/, `.${hash}.js`);
    writeFileSync(`dist/${baseName}`, file.text);
    written.push(baseName);
  }
  const appFile = written.find(f=> f.startsWith('app.'));
  const chunks = written.filter(f=> f!==appFile);
  // Clean previous hashed bundles (keep last 3 just in case)
  try {
    const keep = 3;
    const existing = [];
    try { existing.push(...(await import('fs/promises')).readdir('dist')); } catch {}
    const appFiles = existing.filter(f=> /^app\.[a-f0-9]{10}\.js$/.test(f)).sort();
    if (appFiles.length > keep){
      appFiles.slice(0, appFiles.length-keep).forEach(f=>{ try { rmSync(`dist/${f}`); } catch{} });
    }
  } catch {}
  const manifest = { app: appFile, chunks, built: new Date().toISOString(), version: process.env.APP_VERSION || '0.1.0' };
  writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
  if (!watchMode){
    writeFileSync('dist/meta.json', JSON.stringify({ built: manifest.built, chunks }, null, 2));
  }
  // Prune stale hashed JS bundles (keep only current manifest referenced files) for non-watch builds
  if (!watchMode){
    try {
      const allowed = new Set([manifest.app, ...manifest.chunks, 'manifest.json', 'meta.json']);
      const all = (await import('fs/promises')).readdir('dist').then(r=>r).catch(()=>[]);
      for (const f of await all) {
        if (f.endsWith('.js') && !allowed.has(f)) {
          try { rmSync(`dist/${f}`); } catch {}
        }
      }
    } catch {}
  }
  if (analyze && result.metafile){
    try {
      const meta = result.metafile;
      writeFileSync('dist/metafile.json', JSON.stringify(meta, null, 2));
      // Simple size summary
      const inputs = Object.entries(meta.inputs).map(([file, info])=> ({ file, bytes: info.bytes || 0 }));
      inputs.sort((a,b)=> b.bytes - a.bytes);
      const top = inputs.slice(0, 15);
      const summary = top.map(i=> ({ file: path.relative(process.cwd(), i.file), kb: +(i.bytes/1024).toFixed(2) }));
      writeFileSync('dist/analysis.json', JSON.stringify({ top: summary, totalKB: +(inputs.reduce((a,b)=>a+b.bytes,0)/1024).toFixed(2) }, null, 2));
      console.log('[analyze] top modules by size (KB):');
      summary.forEach(r=> console.log('  ', r.kb.toString().padStart(8), r.file));
    } catch(e){ console.warn('[analyze] failed to write analysis', e); }
  }
  console.log(`[build] wrote entry ${appFile} (+${chunks.length} chunks)`);
  return { fileName: appFile, chunks };
}

async function run(){ await bundle({ watchMode:false }); }

if (watch){
  console.log('[build] watching (hashed outputs)...');
  await bundle({ watchMode:true });
  const ctx = await build({
    entryPoints: ['src/entry.js'],
    bundle: true,
    format: 'esm',
    sourcemap: 'inline',
    target: ['es2020'],
    write: false,
    watch: {
      onRebuild(err, res){
        if (err) { console.error('[build] error', err); return; }
        if (res){
          try { bundle({ watchMode:true }); } catch(e){ console.error('[build] post-rebuild bundle error', e); }
        }
      }
    }
  });
  void ctx; // context retained implicitly by esbuild
} else {
  run().catch(e=>{ console.error(e); process.exit(1); });
}
