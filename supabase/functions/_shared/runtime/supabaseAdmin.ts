// Service-role client for edge functions ONLY. The browser never sees this key.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export type Admin = SupabaseClient;

export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A client that acts as the caller, so RLS decides what they may see. */
export function userClient(req: Request): SupabaseClient | null {
  const url = Deno.env.get('SUPABASE_URL');
  const anon = Deno.env.get('SUPABASE_ANON_KEY');
  const auth = req.headers.get('Authorization');
  if (!url || !anon || !auth) return null;
  return createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: auth } } });
}

/** Resolve the caller's user id from the bearer token, or null. */
export async function callerUserId(req: Request): Promise<string | null> {
  const c = userClient(req);
  if (!c) return null;
  const { data, error } = await c.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}

/** True when the caller owns the passage (checked through RLS as the caller). */
export async function callerOwnsPassage(req: Request, passageId: string): Promise<boolean> {
  const c = userClient(req);
  if (!c) return false;
  const { data } = await c.from('passages').select('id').eq('id', passageId).maybeSingle();
  return !!data;
}
