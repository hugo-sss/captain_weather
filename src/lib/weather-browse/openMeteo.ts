// Live browse source: Open-Meteo forecast + marine (bulk and point) and RainViewer radar frames.
// Request shapes follow open-meteo/open-meteo openapi/forecast.yml and marine.yml: multi-location
// requests take comma-joined latitude/longitude lists and return an ARRAY of per-location bodies in
// request order. Open-Meteo does not return the model init time, so the run label is derived.
import { ATMOS_VARS, MARINE_VARS, type BrowseModel, type BrowseSource, type BrowseVar, type CellForecast, type DailySummary, type GridResult, type LatLon, type PointForecast, type RadarFrames, type RunInfo } from './types.ts';

export const FORECAST_API = 'https://api.open-meteo.com/v1/forecast';
export const MARINE_API = 'https://marine-api.open-meteo.com/v1/marine';
export const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

const MODEL_CYCLE_HOURS = 6;
const AVAILABILITY_LAG_HOURS = 6;
const H = 3_600_000;

/** Same fallback as supabase/functions/_shared/adapters/openMeteoInit.ts: floor (now − lag) to the cycle. */
export function deriveRun(model: BrowseModel, now: Date = new Date(), generationTimeMs: number | null = null): RunInfo {
  const cycle = MODEL_CYCLE_HOURS * H;
  const runMs = Math.floor((now.getTime() - AVAILABILITY_LAG_HOURS * H) / cycle) * cycle;
  const runIso = new Date(runMs).toISOString();
  return { model, runIso, runLabel: `≈ run ${runIso.slice(11, 13)}Z`, generationTimeMs };
}

const fmtCoord = (v: number) => v.toFixed(3);
const joined = (points: LatLon[], k: keyof LatLon) => points.map((p) => fmtCoord(p[k])).join(',');

/** Bulk atmospheric: 3-hourly, 72 h, wind in knots, one model. */
export function forecastBulkUrl(points: LatLon[], model: BrowseModel): string {
  const q = new URLSearchParams({
    latitude: joined(points, 'lat'), longitude: joined(points, 'lon'),
    hourly: ATMOS_VARS.join(','), wind_speed_unit: 'kn', timezone: 'UTC', forecast_days: '3', temporal_resolution: 'hourly_3', models: model,
  });
  return `${FORECAST_API}?${q}`;
}

/** Bulk sea state: 3-hourly, 72 h, nearest sea cell. */
export function marineBulkUrl(points: LatLon[]): string {
  const q = new URLSearchParams({
    latitude: joined(points, 'lat'), longitude: joined(points, 'lon'),
    hourly: MARINE_VARS.join(','), timezone: 'UTC', forecast_days: '3', temporal_resolution: 'hourly_3', cell_selection: 'sea',
  });
  return `${MARINE_API}?${q}`;
}

export const DAILY_VARS = ['temperature_2m_max', 'temperature_2m_min', 'wind_speed_10m_max', 'wind_gusts_10m_max', 'precipitation_sum'] as const;

/** Point atmospheric: hourly for the card (72 h used by the card and sparkline) plus a 7-day daily block for the strip. */
export function pointForecastUrl(p: LatLon, model: BrowseModel): string {
  const q = new URLSearchParams({
    latitude: fmtCoord(p.lat), longitude: fmtCoord(p.lon),
    hourly: ATMOS_VARS.join(','), daily: DAILY_VARS.join(','), wind_speed_unit: 'kn', timezone: 'UTC', forecast_days: '7', models: model,
  });
  return `${FORECAST_API}?${q}`;
}

/** Point sea state: hourly, 3 days. */
export function pointMarineUrl(p: LatLon): string {
  const q = new URLSearchParams({ latitude: fmtCoord(p.lat), longitude: fmtCoord(p.lon), hourly: MARINE_VARS.join(','), timezone: 'UTC', forecast_days: '3', cell_selection: 'sea' });
  return `${MARINE_API}?${q}`;
}

/** RainViewer tile for one frame: 256 px, colour scheme 2 (universal blue), smooth=1, snow=1. */
export function radarTileUrl(host: string, path: string): string {
  return `${host}${path}/256/{z}/{x}/{y}/2/1_1.png`;
}

/** Points are cached at 0.1° so a hover that drifts inside one model cell reuses the fetch. */
export function pointCacheKey(p: LatLon, model: BrowseModel): string {
  return `${model}|${(Math.round(p.lat * 10) / 10).toFixed(1)}|${(Math.round(p.lon * 10) / 10).toFixed(1)}`;
}

// ---- Response shapes -------------------------------------------------------------------------
export type OmHourly = { time: string[] } & Record<string, (number | null)[] | string[]>;
export type OmBody = {
  latitude: number; longitude: number; generationtime_ms?: number; utc_offset_seconds?: number;
  hourly?: OmHourly; hourly_units?: Record<string, string>;
  daily?: { time: string[] } & Record<string, (number | null)[] | string[]>;
  error?: boolean; reason?: string;
  /** Present when a specific model was requested and the API echoes it. */
  model?: string;
};

/** Open-Meteo hourly `time` values are "YYYY-MM-DDTHH:MM" in the requested timezone (UTC here). */
export const omTimeToIso = (t: string): string => (t.endsWith('Z') ? t : `${t}:00Z`).replace(/(\d{2}:\d{2}):00Z$/, '$1:00Z');

const nn = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Some models return suffixed keys (`wave_height_meteofrance_wave`); take the plain key, then any suffixed one. */
function series(h: OmHourly | undefined, key: string): (number | null)[] | null {
  if (!h) return null;
  const plain = h[key];
  if (Array.isArray(plain) && plain !== h.time) return (plain as (number | null)[]).map(nn);
  const k = Object.keys(h).find((x) => x.startsWith(`${key}_`) && x !== 'time');
  return k && Array.isArray(h[k]) ? (h[k] as (number | null)[]).map(nn) : null;
}

/** One body per requested point, in request order. A single-point request returns a bare object. */
export function asArray(body: unknown): OmBody[] {
  if (Array.isArray(body)) return body as OmBody[];
  if (body && typeof body === 'object') return [body as OmBody];
  return [];
}

export function mergeCells(points: LatLon[], atmos: OmBody[], marine: OmBody[] | null): CellForecast[] {
  return points.map((p, i) => {
    const a = atmos[i], m = marine?.[i];
    const times = (a?.hourly?.time ?? []).map(omTimeToIso);
    const vars: CellForecast['vars'] = {};
    for (const k of ATMOS_VARS) { const s = series(a?.hourly, k); if (s) vars[k] = s; }
    if (m?.hourly?.time) {
      // Align marine on the atmospheric time axis (same 3-hourly UTC grid; guard against any offset).
      const mt = m.hourly.time.map(omTimeToIso);
      const map = new Map(mt.map((t, j) => [t, j]));
      for (const k of MARINE_VARS) {
        const s = series(m.hourly, k);
        if (!s || s.every((v) => v === null)) continue;
        vars[k] = times.map((t) => { const j = map.get(t); return j === undefined ? null : s[j]; });
      }
    }
    return { lat: p.lat, lon: p.lon, times, vars };
  });
}

export function parseDaily(body: OmBody | undefined): DailySummary[] {
  const d = body?.daily;
  if (!d?.time) return [];
  const g = (k: string, i: number) => nn((d[k] as (number | null)[] | undefined)?.[i]);
  return d.time.map((date, i) => ({ date, tMaxC: g('temperature_2m_max', i), tMinC: g('temperature_2m_min', i), windMaxKn: g('wind_speed_10m_max', i), gustMaxKn: g('wind_gusts_10m_max', i), precipMm: g('precipitation_sum', i) }));
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal, headers: { accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const reason = body && typeof body === 'object' && 'reason' in body ? String((body as { reason: unknown }).reason) : '';
    throw new Error(`HTTP ${res.status} ${reason}`.trim());
  }
  return body;
}

export class OpenMeteoSource implements BrowseSource {
  readonly name = 'open-meteo' as const;
  constructor(private readonly now: () => Date = () => new Date()) {}

  async fetchGrid(points: LatLon[], model: BrowseModel, signal?: AbortSignal): Promise<GridResult> {
    if (points.length === 0) return { run: deriveRun(model, this.now()), cells: [] };
    // Marine is best-effort: a marine outage must not blank the wind field.
    const [atmosBody, marineBody] = await Promise.all([
      getJson(forecastBulkUrl(points, model), signal),
      getJson(marineBulkUrl(points), signal).catch(() => null),
    ]);
    const atmos = asArray(atmosBody);
    if (atmos.length !== points.length) throw new Error(`open-meteo forecast returned ${atmos.length} bodies for ${points.length} points`);
    const marine = marineBody ? asArray(marineBody) : null;
    const gen = atmos.reduce((s, b) => s + (b.generationtime_ms ?? 0), 0);
    return { run: deriveRun(model, this.now(), gen || null), cells: mergeCells(points, atmos, marine && marine.length === points.length ? marine : null) };
  }

  async fetchPoint(p: LatLon, model: BrowseModel, signal?: AbortSignal): Promise<PointForecast> {
    const [atmosBody, marineRes] = await Promise.all([
      getJson(pointForecastUrl(p, model), signal),
      getJson(pointMarineUrl(p), signal).then((b) => ({ ok: true as const, body: b })).catch((e: Error) => ({ ok: false as const, error: e.message })),
    ]);
    const a = asArray(atmosBody)[0];
    if (!a?.hourly?.time) throw new Error('open-meteo forecast: empty hourly block');
    const times = a.hourly.time.map(omTimeToIso);
    const vars: PointForecast['hourly']['vars'] = {};
    for (const k of ATMOS_VARS) { const s = series(a.hourly, k); if (s) vars[k] = s; }
    let marineReason: string | null = null;
    let marineRun: PointForecast['marineRun'] = null;
    if (marineRes.ok) {
      const m = asArray(marineRes.body)[0];
      const mt = (m?.hourly?.time ?? []).map(omTimeToIso);
      const map = new Map(mt.map((t, j) => [t, j]));
      let any = false;
      for (const k of MARINE_VARS) {
        const s = series(m?.hourly, k);
        if (!s || s.every((v) => v === null)) continue;
        any = true;
        vars[k] = times.map((t) => { const j = map.get(t); return j === undefined ? null : s[j]; });
      }
      if (!any) marineReason = 'no sea cell at this point (marine model returns null on land)';
      else marineRun = { runLabel: deriveRun(model, this.now()).runLabel };
    } else {
      marineReason = `marine request failed: ${marineRes.error}`;
    }
    return { lat: p.lat, lon: p.lon, run: deriveRun(model, this.now(), a.generationtime_ms ?? null), marineRun, hourly: { times, vars }, daily: parseDaily(a), marineReason };
  }

  async fetchRadarFrames(signal?: AbortSignal): Promise<RadarFrames> {
    const b = (await getJson(RAINVIEWER_API, signal)) as { host?: string; generated?: number; radar?: { past?: { time: number; path: string }[]; nowcast?: { time: number; path: string }[] } };
    if (!b?.host || !b.radar) throw new Error('rainviewer: unexpected body');
    return { host: b.host, generated: b.generated ?? Math.floor(Date.now() / 1000), past: b.radar.past ?? [], nowcast: b.radar.nowcast ?? [] };
  }
}

export type { BrowseVar };
