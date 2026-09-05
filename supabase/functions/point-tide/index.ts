// point-tide: Phase 5 "tide anywhere". POST { lat, lon, days? } → the tide curve for the
// nearest station. Cache-first from forecast_tidal (stations already ingested for passages
// within 25 km), otherwise one live TidesAtlas call (credit-metered, so the UI only calls
// this on an explicit click). Never uses Open-Meteo sea level: tide is station data only.
import { adminClient, callerUserId, cronAuthorized, type Admin } from '../_shared/runtime/supabaseAdmin.ts';
import { adapterEnv, json, preflight, readJson } from '../_shared/runtime/http.ts';
import { fetchTidesAtlas } from '../_shared/adapters/tidesAtlas.ts';
import { haversineNm } from '../_shared/engine.ts';
import type { IngestTarget } from '../_shared/contracts.ts';

type Body = { lat?: number; lon?: number; days?: number };
type Row = Record<string, unknown>;
const HOUR = 3_600_000;
const KM_PER_NM = 1.852;
const CACHE_RADIUS_KM = 25;

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<Body>(req);
  const lat = Number(body.lat), lon = Number(body.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return json({ ok: false, error: 'lat/lon required' }, 400);
  if (!(await cronAuthorized(req)) && !(await callerUserId(req))) return json({ ok: false, error: 'unauthorised' }, 401);
  const days = Math.min(7, Math.max(1, Math.round(Number(body.days) || 3)));
  const admin = adminClient();
  const now = Date.now();
  const range = { start: new Date(now - HOUR).toISOString(), end: new Date(now + days * 24 * HOUR).toISOString() };
  try {
    const cached = await fromCache(admin, lat, lon, range, days);
    if (cached) return json({ ok: true, ...cached, cached: true });
    const live = await fromTidesAtlas(admin, lat, lon, range);
    if (!live.ok) return json({ ok: false, error: live.error }, 502);
    return json({ ok: true, ...live.data, cached: false });
  } catch (e) {
    console.error('point-tide failed', e);
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});

type TideOut = { station: { id: string; name: string | null; distance_km: number | null }; datum: string; series: { time: string; height_m: number; state: string | null }[]; extremes: { time: string; height_m: number; type: 'high' | 'low' }[]; source: string };

function shape(rows: Row[], distanceKm: number | null): TideOut | null {
  const sorted = [...rows].sort((a, b) => Date.parse(a.forecast_time as string) - Date.parse(b.forecast_time as string));
  if (sorted.length === 0) return null;
  const first = sorted[0];
  const series = sorted.map((r) => ({ time: r.forecast_time as string, height_m: Number(r.tide_height_m), state: (r.tide_state as string | null) ?? null })).filter((p) => Number.isFinite(p.height_m));
  const extremes = series.filter((p) => p.state === 'high' || p.state === 'low').map((p) => ({ time: p.time, height_m: p.height_m, type: p.state as 'high' | 'low' }));
  return {
    station: { id: String(first.station_id), name: (first.station_name as string | null) ?? null, distance_km: distanceKm ?? (first.station_distance_km === null || first.station_distance_km === undefined ? null : Number(first.station_distance_km)) },
    datum: String(first.datum ?? 'unknown'),
    series, extremes, source: String(first.source ?? 'tidesatlas'),
  };
}

/** Serve from a station already ingested for a passage when it is close and covers most of the window. */
async function fromCache(admin: Admin, lat: number, lon: number, range: { start: string; end: string }, days: number): Promise<TideOut | null> {
  const { data: targets } = await admin.from('ingest_targets').select('id, grid_lat, grid_lon, station_id').eq('layer', 'tidal').not('station_id', 'is', null);
  let best: { id: number; km: number } | null = null;
  for (const t of (targets ?? []) as Row[]) {
    const km = haversineNm(lat, lon, Number(t.grid_lat), Number(t.grid_lon)) * KM_PER_NM;
    if (km <= CACHE_RADIUS_KM && (!best || km < best.km)) best = { id: Number(t.id), km };
  }
  if (!best) return null;
  const { data: rows } = await admin.from('forecast_tidal').select('*').eq('target_id', best.id).gte('forecast_time', range.start).lte('forecast_time', range.end).order('forecast_time');
  const covered = (rows ?? []).length >= 0.8 * days * 24;
  if (!covered) return null;
  const out = shape((rows ?? []) as Row[], Math.round(best.km * 10) / 10);
  return out;
}

async function fromTidesAtlas(admin: Admin, lat: number, lon: number, range: { start: string; end: string }): Promise<{ ok: true; data: TideOut } | { ok: false; error: string }> {
  let key = Deno.env.get('TIDESATLAS_API_KEY') ?? null;
  if (!key) {
    try { const { data } = await admin.rpc('tidesatlas_api_key'); key = typeof data === 'string' && data.length ? data : null; } catch { key = null; }
  }
  if (!key) return { ok: false, error: 'tide service not configured' };
  const env = adapterEnv();
  const tenv = { fetch: env.fetch, now: env.now, env: (nm: string) => (nm === 'TIDESATLAS_API_KEY' ? key : Deno.env.get(nm)) };
  const target = { id: 0, layer: 'tidal', grid_lat: Math.round(lat * 100) / 100, grid_lon: Math.round(lon * 100) / 100, horizon_end: range.end, active: true } as unknown as IngestTarget;
  const r = await fetchTidesAtlas(target, range, tenv);
  if (!r.ok) return { ok: false, error: r.error };
  const out = shape(r.rows as unknown as Row[], null);
  if (!out) return { ok: false, error: 'no tide series returned for this position' };
  return { ok: true, data: out };
}
