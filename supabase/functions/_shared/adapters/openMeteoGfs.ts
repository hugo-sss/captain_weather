// Comparison adapter: deterministic GFS. PRD §5.2. Verified against
// open-meteo/open-meteo openapi/forecast.yml (models enum has ncep_gfs_global;
// wind_speed_unit=kn). cape is not hourly on GFS: omitted.
import type { AdapterEnv, AdapterResult, AtmosphericRow, FetchRange, IngestTarget } from '../contracts.ts';
import { getJson, nn, omTimeToIso, round, withinRange, type OpenMeteoResponse } from './types.ts';
import { resolveInitTime } from './openMeteoInit.ts';

export const FORECAST_API = 'https://api.open-meteo.com';
export const GFS_MODEL = 'ncep_gfs_global';
const HOURLY = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'pressure_msl', 'visibility', 'temperature_2m'];

export function gfsUrl(lat: number, lon: number): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lon.toFixed(3), models: GFS_MODEL,
    hourly: HOURLY.join(','), wind_speed_unit: 'kn', forecast_days: '10', timezone: 'UTC',
  });
  return `${FORECAST_API}/v1/forecast?${q}`;
}

export function rowsFromGfsResponse(body: OpenMeteoResponse, target: IngestTarget, initTime: string, range: FetchRange): AtmosphericRow[] {
  const h = body.hourly;
  if (!h || !Array.isArray(h.time)) return [];
  const g = (k: string, i: number) => nn((h[k] as (number | null)[] | undefined)?.[i]);
  const rows: AtmosphericRow[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const ft = omTimeToIso(h.time[i]);
    if (!withinRange(ft, range)) continue;
    const ws = g('wind_speed_10m', i);
    if (ws === null) continue;
    const pr = g('precipitation', i);
    const mslp = round(g('pressure_msl', i), 1);
    rows.push({
      target_id: target.id, source: GFS_MODEL, kind: 'deterministic', init_time: initTime, forecast_time: ft,
      member_count: 1,
      wind_p10_kn: round(ws, 1), wind_p50_kn: round(ws, 1), wind_p90_kn: round(ws, 1),
      wind_dir_mean_deg: round(g('wind_direction_10m', i), 1), wind_dir_spread_deg: 0,
      gust_p50_kn: round(g('wind_gusts_10m', i), 1), gust_p90_kn: round(g('wind_gusts_10m', i), 1),
      precip_prob_pct: pr === null ? null : pr > 0.1 ? 100 : 0, precip_p50_mm: round(pr, 2),
      mslp_p10_hpa: mslp, mslp_p50_hpa: mslp, mslp_p90_hpa: mslp,
      cape_p50_jkg: null,
      visibility_p50_m: round(g('visibility', i), 0),
      temp_p50_c: round(g('temperature_2m', i), 1),
      wind_members_kn: null, wind_dir_members_deg: null,
    });
  }
  return rows;
}

export async function fetchGfs(target: IngestTarget, range: FetchRange, env: AdapterEnv): Promise<AdapterResult<AtmosphericRow>> {
  const { status, body } = await getJson(env, gfsUrl(target.grid_lat, target.grid_lon));
  const resp = body as OpenMeteoResponse | null;
  if (status !== 200 || !resp || resp.error) return { ok: false, error: `open-meteo forecast ${GFS_MODEL}: HTTP ${status} ${resp?.reason ?? ''}`.trim() };
  const init = await resolveInitTime(env, FORECAST_API, GFS_MODEL);
  const notes = init.via === 'fallback' ? ['init_time floored to model cycle (meta.json unavailable)'] : [];
  return { ok: true, rows: rowsFromGfsResponse(resp, target, init.initTime, range), init_time: init.initTime, notes };
}
