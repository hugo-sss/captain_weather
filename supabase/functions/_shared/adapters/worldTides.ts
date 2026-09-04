// Fallback tidal adapter: WorldTides v3 (https://www.worldtides.info/apidocs).
// GET /api/v3?heights&extremes&lat&lon&start=<unix>&length=<s>&step=3600&datum=CD&key=...
// Response: { station, heights: [{dt, date, height}], extremes: [{dt, date, height, type}], responseDatum }.
// Same output shape as tidesAtlas.ts. Selected via app_settings.sources.tidal = 'worldtides'.
import type { AdapterEnv, AdapterResult, FetchRange, IngestTarget, TidalRow } from '../contracts.ts';
import { deriveTideStates, normaliseDatum, type HeightPoint } from './tidal-common.ts';
import { getJson } from './types.ts';

export const WORLDTIDES_API = 'https://www.worldtides.info/api/v3';
export const WORLDTIDES_SOURCE = 'worldtides';

type WtResp = { status?: number; error?: string; station?: string; responseDatum?: string; heights?: { dt: number; height: number }[]; extremes?: { dt: number; height: number; type: string }[] };

export function worldTidesUrl(lat: number, lon: number, startUnix: number, lengthSec: number, key: string): string {
  const q = new URLSearchParams({ heights: '', extremes: '', datum: 'CD', lat: lat.toFixed(4), lon: lon.toFixed(4), start: String(startUnix), length: String(lengthSec), step: '3600', key });
  return `${WORLDTIDES_API}?${q.toString().replace(/=(&|$)/g, '$1')}`;
}

export async function fetchWorldTides(target: IngestTarget, range: FetchRange, env: AdapterEnv): Promise<AdapterResult<TidalRow>> {
  const key = env.env('WORLDTIDES_API_KEY');
  if (!key) return { ok: false, notConfigured: true, error: 'WORLDTIDES_API_KEY not set' };
  const start = Math.floor(Math.min(Date.parse(range.start), env.now().getTime()) / 1000);
  const length = Math.min(7 * 86_400, Math.max(86_400, Math.ceil(Date.parse(range.end) / 1000) - start));
  const { status, body } = await getJson(env, worldTidesUrl(target.grid_lat, target.grid_lon, start, length, key));
  const b = body as WtResp | null;
  if (status !== 200 || !b || b.error) return { ok: false, error: `worldtides: HTTP ${status} ${b?.error ?? ''}`.trim() };
  const series: HeightPoint[] = (b.heights ?? []).map((h) => ({ time: new Date(h.dt * 1000).toISOString(), heightM: h.height }));
  if (series.length === 0) return { ok: false, error: 'worldtides: no heights returned' };
  const states = deriveTideStates(series);
  const stationId = b.station ?? `worldtides@${target.grid_lat},${target.grid_lon}`;
  const datum = normaliseDatum(b.responseDatum ?? 'CD');
  const rows: TidalRow[] = series.map((p, i) => ({
    target_id: target.id, source: WORLDTIDES_SOURCE, station_id: stationId, station_name: b.station ?? null, station_distance_km: null,
    datum, forecast_time: p.time, tide_height_m: Math.round(p.heightM * 100) / 100, tide_state: states[i],
  }));
  return { ok: true, rows, init_time: null, station_id: stationId, notes: b.station ? [] : ['no station named; WorldTides global model'] };
}
