// ingest-tick: PRD §11.2. POST { layer, force?, sync? }.
// Auth: x-cron-secret === CRON_SECRET (pg_cron), or a signed-in user's JWT (manual "fetch now").
// Responds 202 at once; the batch runs in EdgeRuntime.waitUntil().
import { adminClient, callerUserId, type Admin } from '../_shared/runtime/supabaseAdmin.ts';
import { adapterEnv, background, json, preflight, readJson } from '../_shared/runtime/http.ts';
import { loadSettings, type Settings } from '../_shared/runtime/settings.ts';
import type { AdapterResult, AtmosphericRow, IngestTarget, Layer, MarineRow, TidalRow } from '../_shared/contracts.ts';
import { makeEnsembleAdapter } from '../_shared/adapters/openMeteoEnsemble.ts';
import { fetchGfs } from '../_shared/adapters/openMeteoGfs.ts';
import { fetchMarine } from '../_shared/adapters/openMeteoMarine.ts';
import { fetchTidesAtlas } from '../_shared/adapters/tidesAtlas.ts';
import { fetchWorldTides } from '../_shared/adapters/worldTides.ts';
import { MODEL_CYCLE_HOURS } from '../_shared/adapters/openMeteoInit.ts';

const LAYERS: Layer[] = ['atmospheric', 'comparison', 'marine', 'tidal'];
const BATCH = 20;
const HOUR = 3_600_000;

// TidesAtlas key: env first, else the Vault secret via public.tidesatlas_api_key()
// (migration 0006), mirroring the cron-secret fallback. Cached for the warm isolate.
let vaultTidalKey: string | null | undefined;
async function tidalApiKey(admin: Admin): Promise<string | null> {
  const envKey = Deno.env.get('TIDESATLAS_API_KEY');
  if (envKey) return envKey;
  if (vaultTidalKey === undefined) {
    try { const { data } = await admin.rpc('tidesatlas_api_key'); vaultTidalKey = typeof data === 'string' && data.length ? data : null; }
    catch { vaultTidalKey = null; }
  }
  return vaultTidalKey;
}

type Body = { layer?: Layer | 'all'; force?: boolean; sync?: boolean; trigger?: string };

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<Body>(req);

  // --- auth -----------------------------------------------------------------
  const given = req.headers.get('x-cron-secret');
  let authed: 'cron' | 'user' | null = null;
  if (given) {
    // Env CRON_SECRET wins; otherwise the Vault value via cron_secret() (service role only, migration 0004).
    let cronSecret = Deno.env.get('CRON_SECRET') ?? null;
    if (!cronSecret) {
      const { data } = await adminClient().rpc('cron_secret');
      cronSecret = typeof data === 'string' && data.length ? data : null;
    }
    if (!cronSecret) return json({ error: 'no cron secret available (CRON_SECRET env unset and Vault cron_secret missing); refusing cron requests' }, 503);
    if (given === cronSecret) authed = 'cron';
  }
  if (!authed && (await callerUserId(req))) authed = 'user';
  if (!authed) return json({ error: 'unauthorised' }, 401);

  const layers: Layer[] = body.layer === 'all' || !body.layer ? LAYERS : LAYERS.includes(body.layer) ? [body.layer] : [];
  if (layers.length === 0) return json({ error: `layer must be one of ${LAYERS.join(', ')} or all` }, 400);

  const work = runBatch(layers, !!body.force).catch((e) => console.error('ingest-tick batch failed', e));
  if (body.sync) {
    const summary = await work;
    return json({ ok: true, mode: 'sync', authed, summary });
  }
  background(work);
  return json({ ok: true, accepted: true, authed, layers, trigger: body.trigger ?? 'manual' }, 202);
});

async function runBatch(layers: Layer[], force: boolean) {
  const admin = adminClient();
  const settings = await loadSettings(admin);
  const summary: Record<string, unknown> = {};
  for (const layer of layers) {
    let q = admin.from('ingest_targets').select('*').eq('layer', layer).eq('active', true).order('next_fetch_at').limit(BATCH);
    if (!force) q = q.lt('next_fetch_at', new Date().toISOString());
    const { data: targets, error } = await q;
    if (error) { summary[layer] = { error: error.message }; continue; }
    const results: unknown[] = [];
    for (const t of (targets ?? []) as IngestTarget[]) results.push(await processTarget(admin, settings, layer, t));
    summary[layer] = { due: targets?.length ?? 0, results };
  }
  console.log('ingest-tick summary', JSON.stringify(summary));
  return summary;
}

function nextCycleFetch(source: string, initTime: string | null): string {
  const cycle = (MODEL_CYCLE_HOURS[source] ?? 6) * HOUR;
  const base = initTime ? Date.parse(initTime) + cycle + 90 * 60_000 : Date.now() + HOUR;
  return new Date(Math.max(base, Date.now() + 30 * 60_000)).toISOString();
}

async function processTarget(admin: Admin, settings: Settings, layer: Layer, t: IngestTarget) {
  const env = adapterEnv();
  const now = Date.now();
  const range = { start: new Date(now - HOUR).toISOString(), end: t.horizon_end ?? new Date(now + settings.ingest_grid.horizon_hours * HOUR).toISOString() };
  const target = { ...t, grid_lat: Number(t.grid_lat), grid_lon: Number(t.grid_lon) };
  const outcome: Record<string, unknown> = { target_id: t.id, layer };
  try {
    let next: string;
    let lastInit: string | null = t.last_init_time;
    const errors: string[] = [];
    if (layer === 'atmospheric') {
      const sources = [settings.sources.atmospheric_primary, settings.sources.atmospheric_secondary].filter(Boolean);
      for (const src of sources) {
        const r = await makeEnsembleAdapter(src)(target, range, env);
        const n = await upsertAtmospheric(admin, r, outcome, src);
        if (r.ok) { lastInit = src === sources[0] ? r.init_time : lastInit; outcome[`${src}_rows`] = n; } else errors.push(r.error);
      }
      next = nextCycleFetch(sources[0], lastInit);
    } else if (layer === 'comparison') {
      const r = await fetchGfs(target, range, env);
      // GFS rows are keyed on the co-located ATMOSPHERIC target so forecast_comparison (joined on target_id) lines up.
      const atmosId = await colocatedAtmosphericTarget(admin, target);
      const rows = r.ok ? r.rows.map((row) => ({ ...row, target_id: atmosId ?? row.target_id })) : [];
      const n = await upsertAtmospheric(admin, r.ok ? { ...r, rows } : r, outcome, settings.sources.comparison);
      if (r.ok) { lastInit = r.init_time; outcome.rows = n; outcome.keyed_on_target = atmosId ?? t.id; } else errors.push(r.error);
      next = nextCycleFetch(settings.sources.comparison, lastInit);
    } else if (layer === 'marine') {
      const r = await fetchMarine(target, range, env);
      if (r.ok) {
        const { error } = await admin.from('forecast_marine').upsert(r.rows as MarineRow[], { onConflict: 'target_id,source,init_time,forecast_time' });
        if (error) throw new Error(error.message);
        lastInit = r.init_time; outcome.rows = r.rows.length; outcome.notes = r.notes;
      } else errors.push(r.error);
      next = new Date(now + 6 * HOUR).toISOString();
    } else {
      const useKey = await tidalApiKey(admin);
      const tenv = useKey ? { fetch: env.fetch, now: env.now, env: (nm: string) => (nm === 'TIDESATLAS_API_KEY' ? useKey : Deno.env.get(nm)) } : env;
      const r: AdapterResult<TidalRow> = settings.sources.tidal === 'worldtides' ? await fetchWorldTides(target, range, env) : await fetchTidesAtlas(target, range, tenv);
      if (r.ok) {
        const { error } = await admin.from('forecast_tidal').upsert(r.rows, { onConflict: 'target_id,source,station_id,forecast_time' });
        if (error) throw new Error(error.message);
        outcome.rows = r.rows.length; outcome.notes = r.notes; outcome.station_id = r.station_id;
        await admin.from('ingest_targets').update({ station_id: r.station_id ?? null }).eq('id', t.id);
        next = new Date(now + 24 * HOUR).toISOString();
      } else if (r.notConfigured) {
        // Honest degraded state: keep the target, record why, back off 6 h so the key can be added without a redeploy.
        await admin.from('ingest_targets').update({ last_error: `not configured: ${r.error}`, next_fetch_at: new Date(now + 6 * HOUR).toISOString(), last_fetched_at: new Date(now).toISOString() }).eq('id', t.id);
        return { ...outcome, not_configured: r.error };
      } else errors.push(r.error);
      next = errors.length ? new Date(now + 30 * 60_000).toISOString() : new Date(now + 24 * HOUR).toISOString();
    }
    if (errors.length) {
      await admin.from('ingest_targets').update({ last_error: errors.join(' | '), next_fetch_at: new Date(now + 30 * 60_000).toISOString(), last_fetched_at: new Date(now).toISOString() }).eq('id', t.id);
      return { ...outcome, errors };
    }
    await admin.from('ingest_targets').update({ last_error: null, last_fetched_at: new Date(now).toISOString(), last_init_time: lastInit, next_fetch_at: next }).eq('id', t.id);
    return { ...outcome, next_fetch_at: next };
  } catch (e) {
    const msg = (e as Error).message;
    await admin.from('ingest_targets').update({ last_error: msg, next_fetch_at: new Date(now + 30 * 60_000).toISOString(), last_fetched_at: new Date(now).toISOString() }).eq('id', t.id);
    return { ...outcome, errors: [msg] };
  }
}

async function upsertAtmospheric(admin: Admin, r: AdapterResult<AtmosphericRow>, outcome: Record<string, unknown>, src: string): Promise<number> {
  if (!r.ok) return 0;
  if (r.notes?.length) outcome[`${src}_notes`] = r.notes;
  if (r.rows.length === 0) return 0;
  // Drop raw members from older inits of this target/source before writing the new one (retention rule).
  const { error } = await admin.from('forecast_atmospheric').upsert(r.rows, { onConflict: 'target_id,source,init_time,forecast_time' });
  if (error) throw new Error(`forecast_atmospheric upsert (${src}): ${error.message}`);
  await admin.from('forecast_atmospheric').update({ wind_members_kn: null, wind_dir_members_deg: null })
    .eq('target_id', r.rows[0].target_id).eq('source', src).lt('init_time', r.rows[0].init_time).not('wind_members_kn', 'is', null);
  return r.rows.length;
}

async function colocatedAtmosphericTarget(admin: Admin, t: IngestTarget): Promise<number | null> {
  const { data } = await admin.from('ingest_targets').select('id').eq('layer', 'atmospheric').eq('grid_lat', t.grid_lat).eq('grid_lon', t.grid_lon).maybeSingle();
  return data?.id ?? null;
}
