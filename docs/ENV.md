## Environment Configuration

Required (when BACKEND=supabase):
- SUPABASE_URL
- SUPABASE_ANON_KEY

Optional:
- BACKEND (default: supabase)
- APP_FEATURE_FLAGS (comma list)
- SCHED_ENV (environment label)
- APP_VERSION (overrides build stamped version)

Resolution Order:
1. .env (or file provided via --env-file)
2. Process environment

Injected Keys (define pattern): SUPABASE_*, APP_*, SCHED_*, BACKEND*, ENV_*, VITE_*
Accessible via `import.meta.env.KEY` or `process.env.KEY`.

Validation:
Build fails (exit code 2) if BACKEND=supabase and required keys missing.

Secrets:
Do NOT commit real keys. Use `.env.example` as template.

Feature Flags Example:
```
APP_FEATURE_FLAGS=reports,metrics
```

At runtime, parse: `(import.meta.env.APP_FEATURE_FLAGS||'').split(',')`.

Version:
`APP_VERSION` if set becomes `__APP_VERSION__` injection; else timestamp fallback.
