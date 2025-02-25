/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Add support for window.__ENV
interface Window {
  __ENV?: {
    VITE_SUPABASE_URL?: string
    VITE_SUPABASE_ANON_KEY?: string
  }
} 