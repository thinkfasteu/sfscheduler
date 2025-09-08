#!/usr/bin/env node
// Quick verification script: build (no watch), then basic manifest sanity.
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

try {
  execSync('node tools/build.mjs', { stdio:'inherit' });
  const manifest = JSON.parse(readFileSync('dist/manifest.json','utf8'));
  if (!manifest.app) throw new Error('manifest.app missing');
  console.log('[verify] manifest OK:', manifest.app);
  process.exit(0);
} catch(e){
  console.error('[verify] failed', e);
  process.exit(1);
}