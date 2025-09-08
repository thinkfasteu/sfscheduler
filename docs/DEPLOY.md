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
