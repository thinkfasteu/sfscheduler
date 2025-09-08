#!/usr/bin/env node
/**
 * Simple bundle size regression guard.
 * Compares current dist/*.js sizes against a committed baseline in tools/bundle_baseline.json.
 * Fails (exit 3) if app.*.js or total JS bytes exceed allowed growth percentages.
 * Environment overrides:
 *   SIZE_APP_GROWTH_PCT   (default 10)
 *   SIZE_TOTAL_GROWTH_PCT (default 15)
 *   SIZE_VERBOSE (=1) for detailed listing
 */
import { readFileSync, readdirSync, statSync, rmSync } from 'fs';
import path from 'path';

function loadBaseline(){
  const p = path.resolve('tools/bundle_baseline.json');
  try { return JSON.parse(readFileSync(p,'utf8')); } catch(e){
    console.error('[sizeGuard] Missing or unreadable baseline at tools/bundle_baseline.json');
    process.exit(2);
  }
}

function loadManifest(){
  try {
    const raw = readFileSync('dist/manifest.json','utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

function scanDist(){
  const distDir = path.resolve('dist');
  let files=[];
  try { files = readdirSync(distDir); } catch(e){
    console.error('[sizeGuard] dist directory missing. Run build first.');
    process.exit(2);
  }
  const jsFiles = files.filter(f=> f.endsWith('.js'));
  const records = jsFiles.map(name=> ({ name, bytes: statSync(path.join(distDir,name)).size }));
  const manifest = loadManifest();
  let considered = records;
  if (manifest && manifest.app && Array.isArray(manifest.chunks)){
    const allow = new Set([manifest.app, ...manifest.chunks]);
    considered = records.filter(r=> allow.has(r.name));
    // Optional prune: remove any hashed .js not in manifest if SIZE_PRUNE=1
    if (process.env.SIZE_PRUNE === '1'){
      records.filter(r=> !allow.has(r.name)).forEach(r=>{ try { rmSync(path.join('dist', r.name)); } catch {} });
    }
  }
  const appFiles = considered.filter(r=> /^app\.[a-f0-9]{10}\.js$/.test(r.name));
  const largestApp = appFiles.sort((a,b)=> b.bytes - a.bytes)[0];
  const totalJsBytes = considered.reduce((a,b)=> a + b.bytes, 0);
  return { largestApp, totalJsBytes, records: considered, manifestFiltered: !!manifest };
}

function main(){
  const baseline = loadBaseline();
  const current = scanDist();
  const appGrowthPctAllowed = Number(process.env.SIZE_APP_GROWTH_PCT)||10;
  const totalGrowthPctAllowed = Number(process.env.SIZE_TOTAL_GROWTH_PCT)||15;
  const verbose = process.env.SIZE_VERBOSE==='1';

  if (!current.largestApp){
    console.error('[sizeGuard] No app.*.js bundle found.');
    process.exit(2);
  }

  const fudge = 1024; // 1KB noise tolerance
  const appLimit = baseline.appMaxBytes * (1 + appGrowthPctAllowed/100) + fudge;
  const totalLimit = baseline.totalJsBytes * (1 + totalGrowthPctAllowed/100) + fudge;

  const appOk = current.largestApp.bytes <= appLimit;
  const totalOk = current.totalJsBytes <= totalLimit;

  if (verbose){
    console.log('[sizeGuard] Baseline appMaxBytes =', baseline.appMaxBytes, 'current =', current.largestApp.bytes, 'limit =', Math.round(appLimit));
    console.log('[sizeGuard] Baseline totalJsBytes =', baseline.totalJsBytes, 'current =', current.totalJsBytes, 'limit =', Math.round(totalLimit));
    console.log('[sizeGuard] Manifest filtering', current.manifestFiltered ? 'ENABLED' : 'DISABLED (no manifest)');
    current.records.sort((a,b)=> b.bytes - a.bytes).slice(0,15).forEach(r=> console.log('  -', r.name.padEnd(40), (r.bytes/1024).toFixed(2)+' KB'));
  }

  if (!appOk || !totalOk){
    console.error('[sizeGuard] Bundle size regression detected.');
    if (!appOk) console.error(`  app bundle: ${current.largestApp.bytes} > limit ${Math.round(appLimit)}`);
    if (!totalOk) console.error(`  total js:   ${current.totalJsBytes} > limit ${Math.round(totalLimit)}`);
    console.error('If intentional, update tools/bundle_baseline.json after review.');
    process.exit(3);
  }
  console.log('[sizeGuard] OK (app '+current.largestApp.bytes+' bytes, total '+current.totalJsBytes+' bytes)');
}

main();
