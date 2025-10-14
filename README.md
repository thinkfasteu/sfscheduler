# FTG Sportfabrik Scheduler

The FTG Sportfabrik Scheduler is a browser-based operations console for planning and maintaining monthly duty rosters. It blends automated generation with guided manual workflows, strong validation, and Supabase-backed persistence so planners can ship compliant schedules without losing flexibility.

## Prerequisites & Setup

| Requirement | Notes |
|-------------|-------|
| Node.js 18+ | Modern ESM build with top-level await |
| npm 9+ (or pnpm/yarn) | Project scripts assume npm; alternative clients work with equivalent commands |
| Optional: Supabase project | Enables remote persistence; app falls back to local storage when unset |

1. Install dependencies:
	```bash
	npm install
	```
2. Configure environment variables (`.env` or `--env-file`). Typical keys:
	```env
	SUPABASE_URL=https://<project>.supabase.co
	SUPABASE_ANON_KEY=<public-anon-key>
	BACKEND=supabase
	```
3. Start the development server:
	```bash
	npm run dev
	```
	The watcher serves `dist/app.js` and rebuilds on change.

## Build, Test & Quality

| Task | Command | Output |
|------|---------|--------|
| Development bundle | `npm run dev` | Incremental build served to the browser |
| Production bundle | `npm run build` | Hashed bundle in `dist/app.<hash>.js`, `manifest.json`, `meta.json` |
| Manifest verification | `npm run verify` | Checks manifest integrity and required env vars |
| Bundle analysis | `npm run analyze` | Emits `dist/metafile.json` & `dist/analysis.json` |
| Smoke & rule tests | `npm run test` | Business rule regression suite |

Environment variables matching `SUPABASE_*`, `APP_*`, `SCHED_*`, `BACKEND*`, `ENV_*`, `VITE_*` are injected at build time and are available via both `import.meta.env.KEY` and `process.env.KEY`.

## Core Workflows

### 1. Generating a Monthly Schedule
1. Open the *Dienstplan* tab and pick the month via the selector.
2. Press **Plan erstellen** (`generateScheduleBtn`). The `SchedulingEngine` creates assignments for all applicable shifts.
3. Re-run the button any time to regenerate the month. Months are isolated—other months remain untouched until explicitly regenerated.

### 2. Manual Adjustments

| Tool | When to use | Highlights |
|------|--------------|------------|
| Assign/Swap modal | Click a day cell or existing assignment pill | Uses `_getBaseCandidatesForShift` to present a stable list of staff (availability, permanents, existing assignees) and optional manager wildcard. Blockers are shown with a ⚠ glyph and tooltip instead of removing the candidate. |
| Suchen & Zuweisen modal | Cross-date assignment work | Shares the same base candidate logic, supports search filtering, and enforces weekend consent for permanents lacking preferences. |
| Consent tracking | Weekend assignments for permanents without preference | Surfaces a consent checkbox tied to `appState.permanentOvertimeConsent`; if no alternative exists the UI raises an overtime request via `__services.overtime`. |

Candidate tooltips summarise fairness metrics (weekend counts, daytime allocation) alongside blocker reasons. The dropdown keeps its size even when blockers exist, enabling informed overrides.

### 3. Validation & Finalization

1. Click **Plan finalisieren** (`finalizeScheduleBtn`).
2. Cached `ScheduleValidator` instances (`ScheduleUI._validators`) validate the active month, highlighting blockers inline and adding an accessibility summary to `#scheduleChecklistRoot`.
3. The finalization modal lists remaining issues (rest periods, max consecutive days, minijob earnings, critical shifts). Finalization is blocked until blockers are resolved.
4. On success the schedule is persisted (Supabase if configured, otherwise local state) and the calendar refreshes with highlighted compliance state cleared.

### 4. Supabase Persistence & Offline Fallback

- When `BACKEND=supabase`, services in `src/services/index.js` handle writes for schedules, availability, vacations, and overtime credits. Manual assignments, swaps, and consent changes travel through these adapters.
- Without Supabase credentials the scheduler automatically falls back to local `appState` storage. All validation and generation logic continue to operate for demos or offline use.

## Accessibility & UX Enhancements

- **Validator caching:** Reuses one `ScheduleValidator` per month to avoid heavy recomputation during candidate rendering.
- **Inline warnings:** Candidate lists display blocker reasons in tooltips instead of hiding staff, keeping planners aware of constraints.
- **Weekend distribution report:** `renderWeekendReport()` summarises weekend load, including overlapping vacations.
- **Managed modals:** Focus trapping, escape handling, and restoration ensure keyboard accessibility across swap/search dialogs.

## Troubleshooting

| Symptom | Resolution |
|---------|------------|
| Buttons appear inert | Confirm `src/ui/eventBindings.js` runs and `window.handlers` is initialised via `ui/eventHandlers.js`. |
| Empty candidate dropdown | Ensure availability hydration (`prehydrateAvailability`) succeeded; toggling "Festangestellte" or manager wildcard expands the pool. |
| Unexpected finalization blockers | Hover blocker ⚠ tooltips or open the finalize modal to see exact rules (rest periods, day limits, minijob earnings, critical shift coverage). |
| Supabase saves failing | Verify `.env` keys and network requests. The UI logs failures and continues using local state. |

## Additional Documentation

- `CHANGELOG.md` – release history
- `docs/DEPLOY.md` – deployment runbook
- `docs/SUPABASE_SETUP.md` – backend provisioning guide
- `docs/TEST_PROTOCOL.md` – regression checklist
- `docs/gdpr/*` – GDPR compliance suite
- `docs/QUICK_REFERENCE_GUIDE.md` – frontline quickstart (kept in sync with this README)

For deeper technical details see `ui/scheduleUI.js`, `scheduler.js`, and `validation.js`, which cover rendering, scoring, and blocker detection.
