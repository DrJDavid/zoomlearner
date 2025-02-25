/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
  readonly SUPABASE_URL?: string
  readonly SUPABASE_ANON_KEY?: string
  readonly [key: string]: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

// Add support for window.__ENV
interface Window {
  __ENV?: {
    VITE_SUPABASE_URL?: string
    VITE_SUPABASE_ANON_KEY?: string
    SUPABASE_URL?: string
    SUPABASE_ANON_KEY?: string
    [key: string]: string | undefined
  }
} 