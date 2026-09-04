// Tidal adapter: TidesAtlas. PRD §5.4, marked "re-check at build time".
//
// What was verifiable at build time (2026-09-04): tidesatlas.com itself was
// unreachable from the build sandbox, so the contract below comes from the
// official Python SDK (PyPI `tidesatlas` 0.1.0, https://tidesatlas.com/api/docs):
//   base https://tidesatlas.com/api/v1, header X-API-Key,
//   GET /tides?lat&lon&days&date=YYYY-MM-DD&datum   -> {..., "extremes": [{type, datetime, height_m}]}
//   GET /ports?search&country&limit                  -> {"ports": [{name, country, ...}]}
// The response may also carry an hourly series and station metadata; this
// adapter reads them defensively and records what it actually found in
// `notes`, and derives hourly heights from extremes when no series is present.
// Datum is taken from the response and labelled "unknown" if absent (PRD §15 #5).
import type { AdapterEnv, AdapterResult, FetchRange, IngestTarget, TidalRow } from '../contracts.ts';
import { deriveTideStates, hourlyFromExtremes, normaliseDatum, type Extreme, type HeightPoint } from './tidal-common.ts';
import { getJson } from './types.ts';

export const TIDESATLAS_API = 'https://tidesatlas.com/api/v1';
export const TIDESATLAS_SOURCE = 'tidesatlas';
const MAX_DAYS = 10;

type AnyRec = Record<string, unknown>;
const rec = (v: unknown): AnyRec | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as AnyRec) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length ? v : typeof v === 'number' ? String(v) : null);

function timeOf(o: AnyRec): string | null {
  const t = str(o.datetime) ?? str(o.time) ?? str(o.date) ?? str(o.timestamp);
  if (t) { const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
  const dt = num(o.dt) ?? num(o.unix);
  return dt ? new Date(dt * 1000).toISOString() : null;
}
const heightOf = (o: AnyRec): number | null => num(o.height_m) ?? num(o.height) ?? num(o.value);

export function tidesUrl(lat: number, lon: number, date: string, days: number, datum?: string): string {
  const q = new URLSearchParams({ lat: lat.toFixed(4), lon: lon.toFixed(4), days: String(days), date });
  if (datum) q.set('datum', datum);
  return `${TIDESATLAS_API}/tides?${q}`;
}

export type ParsedTides = {
  station: { id: string; name: string | null; distanceKm: number | null };
  datum: TidalRow['datum'];
  series: HeightPoint[];
  extremes: Extreme[];
  derived: boolean;
  notes: string[];
};

export function parseTidesAtlas(body: unknown, range: FetchRange): ParsedTides | null {
  const b = rec(body);
  if (!b) return null;
  const notes: string[] = [];
  const st = rec(b.station) ?? rec(b.port) ?? rec(b.location) ?? rec(b.meta) ?? {};
  const id = str(st.id) ?? str(st.slug) ?? str(st.station_id) ?? str(b.station_id) ?? str(b.port) ?? str(b.slug) ?? null;
  const name = str(st.name) ?? str(b.station_name) ?? str(b.name) ?? null;
  const distanceKm = num(st.distance_km) ?? num(st.distance) ?? num(b.distance_km) ?? null;
  const datum = normaliseDatum(b.datum ?? st.datum ?? (rec(b.units) ?? {}).datum);
  if (datum === 'unknown') notes.push('datum not stated in response; labelled unknown');

  const seriesRaw = (Array.isArray(b.heights) ? b.heights : Array.isArray(b.hourly) ? b.hourly : Array.isArray(b.predictions) ? b.predictions : Array.isArray(b.series) ? b.series : []) as unknown[];
  const series: HeightPoint[] = [];
  for (const p of seriesRaw) {
    const o = rec(p); if (!o) continue;
    const t = timeOf(o), h = heightOf(o);
    if (t && h !== null) series.push({ time: t, heightM: h });
  }
  const extremes: Extreme[] = [];
  for (const p of (Array.isArray(b.extremes) ? b.extremes : []) as unknown[]) {
    const o = rec(p); if (!o) continue;
    const t = timeOf(o), h = heightOf(o);
    const ty = String(o.type ?? '').toLowerCase();
    if (t && h !== null && (ty.startsWith('h') || ty.startsWith('l'))) extremes.push({ time: t, heightM: h, type: ty.startsWith('h') ? 'high' : 'low' });
  }
  let derived = false;
  let out = series;
  if (out.length === 0 && extremes.length >= 2) {
    out = hourlyFromExtremes(extremes, range.start, range.end);
    derived = true;
    notes.push('hourly heights derived from high/low extremes by cosine interpolation');
  }
  if (out.length === 0) return null;
  const stationId = id ?? `fes2022@${'lat' in b ? num(b.lat) : ''},${'lon' in b ? num(b.lon) : ''}`;
  if (!id) notes.push('no station id in response; keyed on coordinates (global model fallback)');
  return { station: { id: stationId, name, distanceKm }, datum, series: out.sort((a, c) => Date.parse(a.time) - Date.parse(c.time)), extremes, derived, notes };
}

export function rowsFromParsed(p: ParsedTides, target: IngestTarget, range: FetchRange): TidalRow[] {
  const states = deriveTideStates(p.series);
  const rows: TidalRow[] = [];
  p.series.forEach((pt, i) => {
    const t = Date.parse(pt.time);
    if (t < Date.parse(range.start) - 3_600_000 || t > Date.parse(range.end) + 3_600_000) return;
    rows.push({
      target_id: target.id, source: TIDESATLAS_SOURCE, station_id: p.station.id, station_name: p.station.name,
      station_distance_km: p.station.distanceKm === null ? null : Math.round(p.station.distanceKm * 10) / 10,
      datum: p.datum, forecast_time: pt.time, tide_height_m: Math.round(pt.heightM * 100) / 100, tide_state: states[i],
    });
  });
  return rows;
}

export async function fetchTidesAtlas(target: IngestTarget, range: FetchRange, env: AdapterEnv): Promise<AdapterResult<TidalRow>> {
  const key = env.env('TIDESATLAS_API_KEY');
  if (!key) return { ok: false, notConfigured: true, error: 'TIDESATLAS_API_KEY not set' };
  const startMs = Math.min(Date.parse(range.start), env.now().getTime());
  const date = new Date(startMs).toISOString().slice(0, 10);
  const days = Math.min(MAX_DAYS, Math.max(1, Math.ceil((Date.parse(range.end) - startMs) / 86_400_000) + 1));
  const { status, body } = await getJson(env, tidesUrl(target.grid_lat, target.grid_lon, date, days), { headers: { 'X-API-Key': key, Accept: 'application/json' } });
  if (status === 401 || status === 403) return { ok: false, error: `tidesatlas: HTTP ${status} (check TIDESATLAS_API_KEY)` };
  if (status !== 200) {
    const msg = (rec(body)?.message as string | undefined) ?? '';
    return { ok: false, error: `tidesatlas: HTTP ${status} ${msg}`.trim() };
  }
  const parsed = parseTidesAtlas(body, range);
  if (!parsed) return { ok: false, error: 'tidesatlas: response had no heights or extremes (shape unrecognised; see adapter notes)' };
  const notes = [...parsed.notes];
  if (days === MAX_DAYS) notes.push(`horizon capped at ${MAX_DAYS} days per fetch`);
  return { ok: true, rows: rowsFromParsed(parsed, target, range), init_time: null, station_id: parsed.station.id, notes };
}
