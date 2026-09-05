// Atmospheric ensemble adapter. PRD §5.1.
// Endpoint verified against open-meteo/open-meteo openapi/ensemble.yml and the
// Google WeatherNext page (model id google_weathernext2_ensemble, 64 members,
// 0.25°, 6-hourly native interpolated to hourly, 15 days).
import type { AdapterEnv, AdapterResult, AtmosphericRow, FetchRange, IngestTarget } from '../contracts.ts';
import { circularMeanDeg, circularStdDevDeg, p10, p50, p90 } from '../stats.ts';
import { getJson, omTimeToIso, round, withinRange, type OpenMeteoResponse } from './types.ts';
import { resolveInitTime } from './openMeteoInit.ts';

export const ENSEMBLE_API = 'https://ensemble-api.open-meteo.com';
const FULL_HOURLY = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'pressure_msl', 'cape', 'visibility', 'temperature_2m'];
const CORE_HOURLY = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m', 'precipitation', 'pressure_msl', 'temperature_2m'];

export function ensembleUrl(lat: number, lon: number, model: string, hourly: string[] = FULL_HOURLY, days = 10): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lon.toFixed(3), models: model,
    hourly: hourly.join(','), wind_speed_unit: 'kn', forecast_days: String(days), timezone: 'UTC',
  });
  return `${ENSEMBLE_API}/v1/ensemble?${q}`;
}

/** Forecast days this target actually needs: up to the passage horizon, never a blanket 10.
 *  Open-Meteo weights ensemble calls by volume (members × variables × days), so sizing the
 *  request to the horizon is what keeps a whole passage inside the per-minute budget. */
export function forecastDaysFor(range: FetchRange, now: Date): number {
  const days = Math.ceil((Date.parse(range.end) - now.getTime()) / 86_400_000) + 1;
  return Math.min(10, Math.max(1, Number.isFinite(days) ? days : 10));
}

/** Collect control + perturbed members for a variable: `v`, `v_member01` … `v_memberNN`. */
export function memberSeries(hourly: Record<string, unknown>, variable: string): (number | null)[][] {
  const out: (number | null)[][] = [];
  const keys = Object.keys(hourly).filter((k) => k === variable || k.startsWith(`${variable}_member`));
  for (const k of keys) {
    const arr = hourly[k];
    if (Array.isArray(arr)) out.push(arr as (number | null)[]);
  }
  return out;
}

function column(series: (number | null)[][], i: number): number[] {
  const v: number[] = [];
  for (const s of series) { const x = s[i]; if (x !== null && x !== undefined && Number.isFinite(x)) v.push(x); }
  return v;
}

export function rowsFromEnsembleResponse(
  body: OpenMeteoResponse, target: IngestTarget, source: string, initTime: string, range: FetchRange,
): AtmosphericRow[] {
  const h = body.hourly;
  if (!h || !Array.isArray(h.time)) return [];
  const wind = memberSeries(h, 'wind_speed_10m');
  const dir = memberSeries(h, 'wind_direction_10m');
  const gust = memberSeries(h, 'wind_gusts_10m');
  const precip = memberSeries(h, 'precipitation');
  const mslp = memberSeries(h, 'pressure_msl');
  const cape = memberSeries(h, 'cape');
  const vis = memberSeries(h, 'visibility');
  const temp = memberSeries(h, 'temperature_2m');
  const rows: AtmosphericRow[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const ft = omTimeToIso(h.time[i]);
    if (!withinRange(ft, range)) continue;
    const w = column(wind, i);
    if (w.length === 0) continue; // no members at this hour (beyond model horizon)
    const d = column(dir, i);
    const pr = column(precip, i);
    rows.push({
      target_id: target.id, source, kind: 'ensemble', init_time: initTime, forecast_time: ft,
      member_count: w.length,
      wind_p10_kn: round(p10(w), 1), wind_p50_kn: round(p50(w), 1), wind_p90_kn: round(p90(w), 1),
      wind_dir_mean_deg: round(circularMeanDeg(d), 1), wind_dir_spread_deg: round(circularStdDevDeg(d), 1),
      gust_p50_kn: round(p50(column(gust, i)), 1), gust_p90_kn: round(p90(column(gust, i)), 1),
      precip_prob_pct: pr.length ? round((100 * pr.filter((x) => x > 0.1).length) / pr.length, 1) : null,
      precip_p50_mm: round(p50(pr), 2),
      mslp_p10_hpa: round(p10(column(mslp, i)), 1), mslp_p50_hpa: round(p50(column(mslp, i)), 1), mslp_p90_hpa: round(p90(column(mslp, i)), 1),
      cape_p50_jkg: round(p50(column(cape, i)), 1),
      visibility_p50_m: round(p50(column(vis, i)), 0),
      temp_p50_c: round(p50(column(temp, i)), 1),
      wind_members_kn: w.map((x) => Math.round(x * 10) / 10),
      wind_dir_members_deg: d.map((x) => Math.round(x * 10) / 10),
    });
  }
  return rows;
}

export function makeEnsembleAdapter(model: string) {
  return async (target: IngestTarget, range: FetchRange, env: AdapterEnv): Promise<AdapterResult<AtmosphericRow>> => {
    const notes: string[] = [];
    const days = forecastDaysFor(range, env.now());
    let { status, body } = await getJson(env, ensembleUrl(target.grid_lat, target.grid_lon, model, FULL_HOURLY, days));
    let resp = body as OpenMeteoResponse | null;
    if (status === 400 && resp?.reason) {
      // A variable the model does not carry (e.g. cape/visibility) makes the whole call fail: retry with the core set.
      notes.push(`full variable set rejected (${resp.reason}); retried with core variables`);
      ({ status, body } = await getJson(env, ensembleUrl(target.grid_lat, target.grid_lon, model, CORE_HOURLY, days)));
      resp = body as OpenMeteoResponse | null;
    }
    if (status !== 200 || !resp || resp.error) return { ok: false, error: `open-meteo ensemble ${model}: HTTP ${status} ${resp?.reason ?? ''}`.trim() };
    const init = await resolveInitTime(env, ENSEMBLE_API, model);
    if (init.via === 'fallback') notes.push('init_time floored to model cycle (meta.json unavailable)');
    const rows = rowsFromEnsembleResponse(resp, target, model, init.initTime, range);
    if (rows[0]?.member_count !== undefined && rows[0].member_count !== null && rows[0].member_count < 2) notes.push(`only ${rows[0].member_count} member(s) returned`);
    return { ok: true, rows, init_time: init.initTime, notes };
  };
}

export const fetchWeatherNext2 = makeEnsembleAdapter('google_weathernext2_ensemble');
export const fetchEcmwfEnsemble = makeEnsembleAdapter('ecmwf_ifs025_ensemble');
