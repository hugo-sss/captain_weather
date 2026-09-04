// Marine adapter: sea state + currents. PRD §5.3. Verified against
// open-meteo/open-meteo openapi/marine.yml: every hourly variable below is in
// the enum; models enum has meteofrance_wave and meteofrance_currents;
// forecast_days max 16; wind_speed_unit (kmh|ms|mph|kn) exists. The unit of
// ocean_current_velocity is read back from hourly_units and converted here,
// never in the UI. sea_level_height_msl is stored as a model surface height
// and is NEVER shown as tide (non-negotiable 7).
import type { AdapterEnv, AdapterResult, FetchRange, IngestTarget, MarineRow } from '../contracts.ts';
import { getJson, nn, omTimeToIso, round, withinRange, type OpenMeteoResponse } from './types.ts';
import { resolveInitTime } from './openMeteoInit.ts';

export const MARINE_API = 'https://marine-api.open-meteo.com';
export const MARINE_SOURCE = 'open-meteo-marine';
const HOURLY = ['wave_height', 'wave_direction', 'wave_period', 'wind_wave_height', 'swell_wave_height', 'swell_wave_direction', 'swell_wave_period',
  'sea_level_height_msl', 'ocean_current_velocity', 'ocean_current_direction', 'sea_surface_temperature'];
const MODELS = ['meteofrance_wave', 'meteofrance_currents'];

export function marineUrl(lat: number, lon: number, models: string[] = MODELS): string {
  const q = new URLSearchParams({
    latitude: lat.toFixed(3), longitude: lon.toFixed(3), hourly: HOURLY.join(','),
    models: models.join(','), wind_speed_unit: 'kn', length_unit: 'metric', forecast_days: '8', timezone: 'UTC', cell_selection: 'sea',
  });
  return `${MARINE_API}/v1/marine?${q}`;
}

/** km/h, m/s or mph → knots, chosen from the unit string Open-Meteo returned. */
export function toKnots(v: number | null, unit: string | undefined): number | null {
  if (v === null) return null;
  switch ((unit ?? '').toLowerCase()) {
    case 'kn': case 'kt': case 'knots': return v;
    case 'km/h': case 'kmh': return v / 1.852;
    case 'm/s': case 'ms': return v / 0.514444;
    case 'mp/h': case 'mph': return v * 0.868976;
    default: return v / 1.852; // Open-Meteo default is km/h
  }
}

/** With several models requested, Open-Meteo suffixes variables with the model name. Prefer the plain key, then any suffixed key with data. */
function pick(h: Record<string, unknown>, variable: string, i: number): number | null {
  const plain = h[variable];
  if (Array.isArray(plain)) { const v = nn((plain as (number | null)[])[i]); if (v !== null) return v; }
  for (const k of Object.keys(h)) {
    if (k.startsWith(`${variable}_`) && !HOURLY.includes(k)) {
      const arr = h[k];
      if (Array.isArray(arr)) { const v = nn((arr as (number | null)[])[i]); if (v !== null) return v; }
    }
  }
  return null;
}

function unitFor(units: Record<string, string> | undefined, variable: string): string | undefined {
  if (!units) return undefined;
  if (units[variable]) return units[variable];
  const k = Object.keys(units).find((u) => u.startsWith(`${variable}_`));
  return k ? units[k] : undefined;
}

export function rowsFromMarineResponse(body: OpenMeteoResponse, target: IngestTarget, initTime: string, range: FetchRange): MarineRow[] {
  const h = body.hourly;
  if (!h || !Array.isArray(h.time)) return [];
  const curUnit = unitFor(body.hourly_units, 'ocean_current_velocity');
  const rows: MarineRow[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const ft = omTimeToIso(h.time[i]);
    if (!withinRange(ft, range)) continue;
    const wave = pick(h, 'wave_height', i);
    const cur = pick(h, 'ocean_current_velocity', i);
    if (wave === null && cur === null) continue;
    rows.push({
      target_id: target.id, source: MARINE_SOURCE, init_time: initTime, forecast_time: ft,
      wave_height_m: round(wave, 2), wave_dir_deg: round(pick(h, 'wave_direction', i), 1), wave_period_s: round(pick(h, 'wave_period', i), 1),
      wind_wave_height_m: round(pick(h, 'wind_wave_height', i), 2),
      swell_height_m: round(pick(h, 'swell_wave_height', i), 2), swell_dir_deg: round(pick(h, 'swell_wave_direction', i), 1), swell_period_s: round(pick(h, 'swell_wave_period', i), 1),
      sea_level_msl_m: round(pick(h, 'sea_level_height_msl', i), 2),
      current_speed_kn: round(toKnots(cur, curUnit), 2), current_dir_deg: round(pick(h, 'ocean_current_direction', i), 1),
      sst_c: round(pick(h, 'sea_surface_temperature', i), 1),
    });
  }
  return rows;
}

export async function fetchMarine(target: IngestTarget, range: FetchRange, env: AdapterEnv): Promise<AdapterResult<MarineRow>> {
  const notes: string[] = [];
  let { status, body } = await getJson(env, marineUrl(target.grid_lat, target.grid_lon));
  let resp = body as OpenMeteoResponse | null;
  if (status === 400) {
    notes.push(`explicit models rejected (${resp?.reason ?? 'no reason'}); retried with best_match`);
    ({ status, body } = await getJson(env, marineUrl(target.grid_lat, target.grid_lon, ['best_match'])));
    resp = body as OpenMeteoResponse | null;
  }
  if (status !== 200 || !resp || resp.error) return { ok: false, error: `open-meteo marine: HTTP ${status} ${resp?.reason ?? ''}`.trim() };
  const init = await resolveInitTime(env, MARINE_API, 'meteofrance_wave');
  if (init.via === 'fallback') notes.push('init_time floored to model cycle (meta.json unavailable)');
  notes.push('currents are SMOC at ~8 km and weak inside straits');
  return { ok: true, rows: rowsFromMarineResponse(resp, target, init.initTime, range), init_time: init.initTime, notes };
}
