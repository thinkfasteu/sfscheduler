#!/usr/bin/env node
import { build, context } from 'esbuild';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, cpSync } from 'fs';
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
  // Also merge process.env (process.env wins for deployment overrides)
  for (const [k,v] of Object.entries(process.env)) if (v !== undefined) out[k]=v;
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
// Write a small runtime config JS file consumed before boot.js (no inline scripts allowed under CSP)
function writeRuntimeConfig(){
  try {
    const out = {};
    // Whitelist of keys exposed to client
  const exposeKeys = ['BACKEND','SUPABASE_URL','SUPABASE_ANON_KEY','APP_ENV','ENV','APP_VERSION','BASE_URL'];
    exposeKeys.forEach(k=>{ if (envVars[k]) out[k]=envVars[k]; });
    if (!out.BACKEND) out.BACKEND = (envVars.BACKEND||'local');
    // If BACKEND is supabase but keys missing, keep placeholders to trigger fallback banner
    if (out.BACKEND.toLowerCase()==='supabase'){
      if (!out.SUPABASE_URL) out.SUPABASE_URL='';
      if (!out.SUPABASE_ANON_KEY) out.SUPABASE_ANON_KEY='';
    }
    // Set base URL for asset paths - defaults to './' for local development
    if (!out.BASE_URL) out.BASE_URL = './';
  // Mark that we do not expect a local config file in production deploys
  out.EXPECT_LOCAL_CONFIG = false;
  const content = `// Auto-generated at build time.\n`+
      `window.CONFIG = Object.assign(window.CONFIG||{}, ${JSON.stringify(out, null, 2)});\n`+
      `if (!window.__CONFIG__) window.__CONFIG__ = { ...window.CONFIG };\n`+
      `console.info('[runtime-config] BACKEND=' + window.CONFIG.BACKEND);\n`;
    writeFileSync('dist/runtime-config.js', content);
  } catch(e){ console.warn('[build] failed to write runtime-config.js', e); }
}
// Prepare defines for both import.meta.env.* and process.env.* access
const envDefine = Object.fromEntries(Object.entries(envVars)
  .filter(([k])=> /^(SUPABASE_|VITE_|APP_|BACKEND|ENV_|SCHED_)/.test(k))
  .flatMap(([k,v])=> [
    [`import.meta.env.${k}`, JSON.stringify(v)],
    [`process.env.${k}`, JSON.stringify(v)]
  ]));

async function bundle({watchMode=false}){
  const enableProdSourcemaps = /^(1|true|yes)$/i.test(process.env.SCHED_SOURCEMAPS || '');
  const sourcemapOpt = watchMode ? 'inline' : (enableProdSourcemaps ? true : false);
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
    sourcemap: sourcemapOpt,
    minify: false, // Temporarily disable minification to fix variable hoisting issue
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
  const mapFiles = new Map(result.outputFiles
    .filter(f=> f.path.endsWith('.map'))
    .map(f=> [path.relative('dist/tmp', f.path).replace(/\\/g,'/'), f])
  );
  const written = [];
  for (const file of jsFiles){
    const relOut = path.relative('dist/tmp', file.path).replace(/\\/g,'/'); // e.g. chunks/chunk-ABC.js or entry.js
    const isEntry = /entry\.js$/.test(relOut);
    if (isEntry){
      const hash = createHash('sha256').update(file.text).digest('hex').substring(0,10);
      const appName = `app.${hash}.js`;
      let outText = file.text;
      // If producing external sourcemaps in prod, rewrite sourceMappingURL to the hashed filename
      if (!watchMode && enableProdSourcemaps){
        outText = outText.replace(/\/\/#!? sourceMappingURL=.*/g, `//# sourceMappingURL=${appName}.map`);
        const entryMapRel = 'entry.js.map';
        const map = mapFiles.get(entryMapRel);
        if (map){
          let mapText = map.text;
          try {
            const parsed = JSON.parse(mapText);
            parsed.file = appName;
            mapText = JSON.stringify(parsed);
          } catch {}
          writeFileSync(`dist/${appName}.map`, mapText);
        }
      }
      writeFileSync(`dist/${appName}`, outText);
      written.push(appName);
    } else {
      // Preserve original relative path so dynamic import paths (generated by esbuild) remain valid
      const outPath = `dist/${relOut}`;
      const dir = path.dirname(outPath);
      if (!existsSync(dir)) mkdirSync(dir, { recursive:true });
      writeFileSync(outPath, file.text);
      // Emit matching sourcemap for chunks if enabled
      if (!watchMode && enableProdSourcemaps){
        const map = mapFiles.get(`${relOut}.map`);
        if (map){
          writeFileSync(`${outPath}.map`, map.text);
        }
      }
      written.push(relOut); // store with relative subdir
    }
  }
  const appFile = written.find(f=> /^app\./.test(f));
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
  let manifest = { app: appFile, chunks, built: new Date().toISOString(), version: process.env.APP_VERSION || '0.1.0' };
  // Compute SRI (sha256) for app + chunks
  try {
    const integrities = {};
    const toHash = [manifest.app, ...manifest.chunks];
    toHash.forEach(f => {
      const p = `dist/${f}`;
      if (existsSync(p)){
        const data = readFileSync(p);
        const digest = createHash('sha256').update(data).digest('base64');
        integrities[f] = `sha256-${digest}`;
      }
    });
    manifest.integrities = integrities;
  } catch(e){ console.warn('[build] SRI generation failed', e); }
  writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
  // Always (re)write runtime config after manifest so latest env reaches deployment
  writeRuntimeConfig();
  
  // Copy static assets to dist/ for deployment
  // Copy individual files referenced in HTML
  const staticFiles = ['boot.js', 'logo-sportfabrik.jpg'];
  staticFiles.forEach(file => {
    if (existsSync(file)) {
      try {
        cpSync(file, `dist/${file}`);
      } catch(e) {
        console.warn(`[build] failed to copy static file ${file}:`, e);
      }
    }
  });

  // Copy static directories referenced in HTML
  const staticDirs = ['ui'];
  staticDirs.forEach(dir => {
    if (existsSync(dir)) {
      try {
        cpSync(dir, `dist/${dir}`, { recursive: true });
      } catch(e) {
        console.warn(`[build] failed to copy static directory ${dir}:`, e);
      }
    }
  });
  // Inject preload + integrity into index.html (idempotent markers)
  try {
    const srcIndex = existsSync('index.html') ? 'index.html' : null;
    if (srcIndex){
      let html = readFileSync(srcIndex,'utf8');
      // Public base used in URLs (what the browser sees).
      // Local static-serve of dist/: '/' works well; on GH Pages use '/sfscheduler/'
      const baseUrl = (envVars.BASE_URL || '/');
      const pubBase = baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'; // e.g. '/' or '/sfscheduler/'
      const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
      const startMarker = '<!-- AUTOGENERATED PRELOAD START -->';
      const endMarker = '<!-- AUTOGENERATED PRELOAD END -->';
      const block = [startMarker];
      // Preload app first then chunks
      const sriApp = manifest.integrities?.[manifest.app];
      if (sriApp) block.push(`<link rel="modulepreload" href="${pubBase}${manifest.app}" integrity="${sriApp}" crossorigin>`);
      (manifest.chunks||[]).forEach(c=>{
        const sri = manifest.integrities?.[c];
        if (sri) block.push(`<link rel="modulepreload" href="${pubBase}${c}" integrity="${sri}" crossorigin>`);
      });
      block.push(endMarker);
      const newBlock = block.join('\n');
      if (html.includes(startMarker) && html.includes(endMarker)){
        html = html.replace(new RegExp(startMarker + '[\s\S]*?' + endMarker), newBlock);
      } else {
        // Insert before closing head
        html = html.replace(/<\/head>/i, newBlock + '\n</head>');
      }
      // Ensure runtime-config.js script tag exists BEFORE boot.js (non-module) so window.CONFIG is ready early.
      // First, remove any existing runtime-config.js script tags (from previous builds with different base paths)
      html = html.replace(/<script[^>]*src="[^"]*runtime-config\.js"[^>]*><\/script>\s*/g, '');
      // Then add the correct one for current base path (no /dist/ since we're serving contents of dist/)
      html = html.replace(/(\s*)<script type="module" src="\.\/boot\.js"><\/script>/, `$1<script src="${pubBase}runtime-config.js" data-generated="true"></script>\n$1<script type="module" src="${pubBase}boot.js"></script>`);
      // Deliberately NOT applying SRI to boot.js to avoid dev churn (boot changes often & isn't hashed).
      // Also remove any stale preload line referencing old app.*.js not equal to current manifest.app
      const escapedPubBase = escapeRegex(pubBase);
      html = html.replace(new RegExp(`<link rel="modulepreload" href="${escapedPubBase}app\\.(?!${manifest.app.split('.')[1]})[a-f0-9]{10}\\.js[^>]*>\\n?`, 'g'),'');

      // --- Strip stale internal preloads and SRI on self-hosted dist assets ---
      // Note: Don't remove our newly generated preloads, only stale ones outside the AUTOGENERATED block
      html = html
        // remove any modulepreload lines to OLD ./dist/* paths (legacy pattern)
        .replace(/<link[^>]+rel="modulepreload"[^>]+href="\.\/dist\/[^"]+"[^>]*>\s*/g, '')
        // remove any stale modulepreload that might have old base paths (but preserve current ones)
        .replace(new RegExp(`<link[^>]+rel="modulepreload"[^>]+href="(?!${escapedPubBase})[^"]+"[^>]*>\\s*`, 'g'), '');
      // Note: Don't strip integrity/crossorigin globally as it breaks our autogenerated preloads
      // -----------------------------------------------------------------------

      // Ensure dist/ exists (already at top), then write the final page into dist/
      writeFileSync('dist/index.html', html);
      // Create 404.html as identical copy for SPA fallback routing on GitHub Pages
      writeFileSync('dist/404.html', html);
    }
  } catch(e){ console.warn('[build] preload injection failed', e); }
  if (!watchMode){
    writeFileSync('dist/meta.json', JSON.stringify({ built: manifest.built, chunks }, null, 2));
  }
  // Prune stale hashed JS bundles (keep only current manifest referenced files) for non-watch builds
  if (!watchMode){
    try {
  const allowed = new Set([manifest.app, ...manifest.chunks, 'manifest.json', 'meta.json', 'runtime-config.js', 'boot.js']);
      const all = (await import('fs/promises')).readdir('dist').then(r=>r).catch(()=>[]);
      for (const f of await all) {
        // Skip chunks directory here (handled separately)
        if (f === 'chunks') continue;
        if (f.endsWith('.js') && !allowed.has(f)) { try { rmSync(`dist/${f}`); } catch {} }
      }
      // Clean orphaned chunk files inside chunks/ not referenced anymore
      try {
        const chunkDir = 'dist/chunks';
        if (existsSync(chunkDir)){
          const listed = (await import('fs/promises')).readdir(chunkDir).then(r=>r).catch(()=>[]);
          for (const cf of await listed){
            const rel = `chunks/${cf}`;
            if (!allowed.has(rel)) { try { rmSync(path.join(chunkDir, cf)); } catch {} }
          }
        }
      } catch {}
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
  // Initial build & write to dist/
  await bundle({ watchMode:true });

  // Use esbuild's context API (v0.21+) to watch source files and trigger our bundling pipeline
  const rebundlePlugin = {
    name: 'rebundle-on-end',
    setup(build){
      build.onEnd((result)=>{
        if (result && result.errors && result.errors.length){
          console.error('[build] watch error(s):', result.errors);
          return;
        }
        try { bundle({ watchMode:true }); }
        catch(e){ console.error('[build] post-rebuild bundle error', e); }
      });
    }
  };
  const ctx = await context({
    entryPoints: ['src/entry.js'],
    bundle: true,
    format: 'esm',
    sourcemap: 'inline',
    target: ['es2020'],
    write: false,
    logLevel: 'silent',
    plugins: [rebundlePlugin]
  });
  await ctx.watch();
} else {
  run().catch(e=>{ console.error(e); process.exit(1); });
}
