import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_KEY

// Demo mode runs entirely on this device with sample data — used when the app
// isn't connected to Supabase yet, or when opened with ?demo.
export const DEMO = !url || !key || new URLSearchParams(location.search).has('demo')

export const supabase = DEMO
  ? null
  : createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
