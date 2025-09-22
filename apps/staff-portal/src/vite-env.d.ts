/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __CONFIG__?: {
      SUPABASE_URL?: string
      SUPABASE_ANON_KEY?: string
    }
  }
}

export {}