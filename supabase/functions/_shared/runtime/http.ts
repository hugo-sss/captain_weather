export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra } });
}

export function preflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : null;
}

export async function readJson<T>(req: Request): Promise<T> {
  try { return (await req.json()) as T; } catch { return {} as T; }
}

export const adapterEnv = () => ({ fetch: globalThis.fetch.bind(globalThis), now: () => new Date(), env: (n: string) => Deno.env.get(n) });

/** EdgeRuntime.waitUntil when available (Supabase), else run inline. */
export function background(p: Promise<unknown>): void {
  const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void } }).EdgeRuntime;
  if (rt?.waitUntil) rt.waitUntil(p); else void p;
}
