import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.ts';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseConfigured = Boolean(url && anon);

// The browser only ever holds the publishable (anon) key. RLS does the rest.
export const supabase = createClient<Database>(url ?? 'http://localhost:54321', anon ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export type FunctionName = 'plan-targets' | 'ingest-tick' | 'compute-conditions' | 'generate-briefing';

/** Invoke an edge function as the signed-in user. Returns parsed JSON or throws with the server's message. */
export async function invokeFunction<T = unknown>(name: FunctionName, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let detail = error.message;
    try {
      const ctx = (error as { context?: Response }).context;
      if (ctx && typeof ctx.json === 'function') { const j = await ctx.json(); if (j?.error) detail = j.error; }
    } catch { /* keep message */ }
    throw new Error(detail);
  }
  return data as T;
}
