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
