// Bootstrap default config (development placeholder). Real values supplied via config.local.js or environment injection.
if (typeof window !== 'undefined') {
  window.CONFIG = window.CONFIG || { BACKEND:'supabase', SUPABASE_URL: window.CONFIG?.SUPABASE_URL || '', SUPABASE_ANON_KEY: window.CONFIG?.SUPABASE_ANON_KEY || '' };
  if (!window.__CONFIG__) window.__CONFIG__ = { ...window.CONFIG };
}
