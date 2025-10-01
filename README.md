## Scheduler App Build & Development

### Install
```powershell
pnpm install # or: npm install / yarn install
```

### Development (watch mode)
```powershell
npm run dev
```
Serves updated bundle at `dist/app.js`; HTML auto-loads it.

### Production Build (hashed bundle)
```powershell
npm run build
```
Outputs:
- `dist/app.<hash>.js` (ESM bundle, content-hash for cache busting)
- `dist/manifest.json` (points to current hashed bundle)
- `dist/meta.json` (timestamp + hash metadata, non-watch builds)

`index.html` fetches `dist/manifest.json` to import the hashed file. If manifest or bundle are missing it falls back to raw module imports.

### Environment Variable Injection
At build time, variables from `.env` (or a file passed via `--env-file=custom.env`) and the current shell are injected for keys matching:
`SUPABASE_*`, `APP_*`, `SCHED_*`, `BACKEND*`, `ENV_*`, `VITE_*`.

Accessible via both:
- `import.meta.env.MY_KEY`
- `process.env.MY_KEY`

Example `.env`:
```
SUPABASE_URL=https://example.supabase.co
SUPABASE_ANON_KEY=public-anon-key
BACKEND=supabase
APP_FEATURE_FLAGS=reports,metrics
```

### Bundle Analysis
### Verify (CI Helper)
### Tests
Run minimal critical tests:
```powershell
npm test
```
CI pipeline suggestion:
```powershell
npm run ci
```

### External Libraries SRI
Replace the placeholder `integrity` values in `index.html` with real hashes (e.g. using `openssl dgst -sha256 -binary | openssl base64 -A`). Until replaced, browsers will ignore invalid SRI.
Runs a full build and checks manifest integrity:
```powershell
npm run verify
```
Fails (exit code 1/2) if required env vars are missing or build fails.

Generate size report:
```powershell
npm run analyze
```
Outputs:
- `dist/metafile.json` (raw esbuild metafile)
- `dist/analysis.json` (top modules + total KB)
Console prints top contributors.


### Notes
- CSP already allows only `style-src 'self'`; no inline script usage.
- Future improvements: hash-based filename for long-term caching; environment injection via small pre-build step.

### Version Badge & Lock Removal (v1.2.4)
As of version 1.2.4 the legacy multi‑tab cooperative locking (BroadcastChannel + storage events) was fully removed. The app now always operates in edit mode. A small floating badge (bottom-right) shows the active application version (derived from `manifest.json` when in dist mode, or falling back to the static version string). This replaces the previous lock status indicator.

Re‑introducing locking later would involve:
1. Initializing a `BroadcastChannel('scheduler')`.
2. Generating a per‑tab ID and broadcasting `lock-acquire` / `lock-granted` messages.
3. Gating mutating actions behind a `window.__TAB_CAN_EDIT` flag.
4. (Optional) Using localStorage events only for cross‑tab state refresh, not locking.

Until such a reintroduction is required, the simplified model reduces bundle size and startup logic while keeping the UI responsive.
