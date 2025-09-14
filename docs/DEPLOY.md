## Deployment Runbook

### 1. Build
```powershell
npm ci
npm run build -- --env-file=.env.production
```
Artifacts: `dist/app.<hash>.js`, `dist/manifest.json`, `dist/meta.json`.

### 2. Integrity
External CDN scripts have SRI. If self-hosting, download and serve from `dist/vendor/` and remove SRI tags.

### 3. Upload
Sync project root (minus dev files) to hosting:
Include: `index.html`, `dist/`, `ui/styles.css`, static assets, `docs/` (optional internal only).

### 4. HTTP Headers
Recommended:
- `Content-Security-Policy` (match meta; consider moving to header authoritative)
- `Cache-Control: public, max-age=31536000, immutable` for `dist/app.<hash>.js`
- `Cache-Control: no-cache` for `manifest.json` & `index.html`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### 5. Post-Deploy Verification
Open console: confirm version banner & `window.health()` output.
Run `npm run analyze` locally and compare size regressions (< target budget threshold).

### 6. Rollback
Keep previous `dist/` + `index.html` copy.
Rollback = restore prior manifest + bundle.

### 7. Backups
Clarify RPO: user exports manual; server-side periodic export (future). Encourage first manual export after deploy.

### 8. Monitoring (Future Hook)
Errors buffered in `window.health()`; remote ingestion can poll or receive beacon later.

## Source maps in production

What they are:
- Source maps map the minified/transformed JavaScript that runs in the browser back to your original source files. Browsers use them to show helpful stack traces and let you debug the original code.

Are they required in production?
- No. They are only for debugging. Shipping them publicly slightly increases bundle weight and can expose readable source to end users.

Default behavior in this project:
- Production builds do not emit source maps by default to keep deploys lean and avoid 404 noise when maps aren’t uploaded.
- Dev/watch builds use inline source maps for a smooth local debugging experience.

Opt-in production maps (when needed):
- Set the environment variable `SCHED_SOURCEMAPS=true` for the build. The build will emit external `.map` files for the hashed entry bundle and all chunks, and will point `//# sourceMappingURL` directives to the right filenames.

Examples (Netlify):
- To enable source maps for a specific deploy, add an environment variable in your Netlify site settings → Build & deploy → Environment → `SCHED_SOURCEMAPS` = `true`.
- To disable (default), remove that variable or set it to `false`.

Notes:
- If you enable source maps, they will be uploaded alongside the JS bundles under `/dist` and browsers will stop logging 404s for missing `.map` files.
- If you prefer private error analysis without exposing maps publicly, keep them disabled and use error logging with minified stacks, or upload maps only to an error monitoring service that supports private sourcemap ingestion.
