import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// One client for the whole app (Book 08 §6). Only the URL and the publishable/anon key reach
// the browser; RLS protects every table. The service_role key never appears here (§7).
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (see .env.example)');
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type { Database, Json } from './database.types';
