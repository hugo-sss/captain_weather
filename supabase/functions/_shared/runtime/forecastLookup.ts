// Forecast row selection for a waypoint ETA. PRD §7 steps 2–3.
import type { Admin } from './supabaseAdmin.ts';
import type { IngestTarget, Layer } from '../contracts.ts';
import { circularInterpolateDeg, lerp } from '../stats.ts';
import { haversineNm } from '../engine.ts';

const HOUR = 3_600_000;
const INTERP_THRESHOLD_MS = 90 * 60_000;
const KM_PER_NM = 1.852;

export type TargetIndex = Record<Layer, IngestTarget[]>;

export async function loadActiveTargets(admin: Admin): Promise<TargetIndex> {
  const { data, error } = await admin.from('ingest_targets').select('*').eq('active', true);
  if (error) throw new Error(error.message);
  const idx: TargetIndex = { atmospheric: [], comparison: [], marine: [], tidal: [] };
  for (const raw of data ?? []) {
    const t = { ...raw, grid_lat: Number(raw.grid_lat), grid_lon: Number(raw.grid_lon) } as IngestTarget;
    idx[t.layer].push(t);
  }
  return idx;
}

/** Nearest active target for a layer plus its distance in km (same result as SQL nearest_target()). */
export function nearestTarget(idx: TargetIndex, layer: Layer, lat: number, lon: number): { target: IngestTarget; distanceKm: number } | null {
  let best: { target: IngestTarget; distanceKm: number } | null = null;
  for (const t of idx[layer]) {
    const d = haversineNm(lat, lon, t.grid_lat, t.grid_lon) * KM_PER_NM;
    if (!best || d < best.distanceKm) best = { target: t, distanceKm: d };
  }
  return best;
}

export const maxTargetDistanceKm = (spacingDeg: number) => 2 * spacingDeg * 111.2;

type Row = Record<string, unknown> & { forecast_time: string };
const num = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

/**
 * Pick the row nearest the ETA; if more than 90 min away, interpolate between
 * the bracketing hours (circular for *_deg fields). Null when no bracket exists.
 */
export function pickAtTime(rows: Row[], etaIso: string, circularFields: string[]): { row: Row; interpolated: boolean; forecast_time: string } | null {
  if (rows.length === 0) return null;
  const eta = Date.parse(etaIso);
  const sorted = [...rows].sort((a, b) => Date.parse(a.forecast_time) - Date.parse(b.forecast_time));
  let nearest = sorted[0];
  for (const r of sorted) if (Math.abs(Date.parse(r.forecast_time) - eta) < Math.abs(Date.parse(nearest.forecast_time) - eta)) nearest = r;
  const gap = Math.abs(Date.parse(nearest.forecast_time) - eta);
  if (gap <= INTERP_THRESHOLD_MS) return { row: nearest, interpolated: false, forecast_time: nearest.forecast_time };
  const before = [...sorted].reverse().find((r) => Date.parse(r.forecast_time) <= eta);
  const after = sorted.find((r) => Date.parse(r.forecast_time) >= eta);
  if (!before || !after) return null;
  const span = Date.parse(after.forecast_time) - Date.parse(before.forecast_time);
  if (span > 12 * HOUR) return null; // too sparse to bridge honestly
  const f = (eta - Date.parse(before.forecast_time)) / span;
  const out: Row = { ...before, forecast_time: new Date(eta).toISOString() };
  for (const k of Object.keys(before)) {
    if (k === 'forecast_time' || k === 'init_time' || k === 'id') continue;
    const a = num(before[k]), b = num(after[k]);
    if (a === null && b === null) continue;
    if (typeof before[k] === 'string' && !Number.isFinite(Number(before[k]))) continue;
    out[k] = circularFields.includes(k) ? (a !== null && b !== null ? circularInterpolateDeg(a, b, f) : (a ?? b)) : lerp(a, b, f);
  }
  return { row: out, interpolated: true, forecast_time: new Date(eta).toISOString() };
}

/** Rows of the newest init for a target+source within ±window of the ETA. */
export async function latestRowsAround(admin: Admin, table: 'forecast_atmospheric' | 'forecast_marine', targetId: number, source: string, etaIso: string, windowHours = 6): Promise<{ rows: Row[]; init_time: string | null }> {
  const { data: latest } = await admin.from(table).select('init_time').eq('target_id', targetId).eq('source', source).order('init_time', { ascending: false }).limit(1).maybeSingle();
  if (!latest) return { rows: [], init_time: null };
  const eta = Date.parse(etaIso);
  const { data, error } = await admin.from(table).select('*').eq('target_id', targetId).eq('source', source).eq('init_time', latest.init_time)
    .gte('forecast_time', new Date(eta - windowHours * HOUR).toISOString()).lte('forecast_time', new Date(eta + windowHours * HOUR).toISOString());
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as Row[], init_time: latest.init_time as string };
}

export async function tidalRowsAround(admin: Admin, targetId: number, etaIso: string, windowHours = 6): Promise<Row[]> {
  const eta = Date.parse(etaIso);
  const { data, error } = await admin.from('forecast_tidal').select('*').eq('target_id', targetId)
    .gte('forecast_time', new Date(eta - windowHours * HOUR).toISOString()).lte('forecast_time', new Date(eta + windowHours * HOUR).toISOString()).order('fetched_at', { ascending: false });
  if (error) throw new Error(error.message);
  // one row per forecast_time: newest fetch wins
  const seen = new Map<string, Row>();
  for (const r of (data ?? []) as Row[]) if (!seen.has(r.forecast_time)) seen.set(r.forecast_time, r);
  return [...seen.values()];
}

export async function rowsInWindow(admin: Admin, table: 'forecast_atmospheric' | 'forecast_marine', targetId: number, source: string, startIso: string, endIso: string): Promise<Row[]> {
  const { data: latest } = await admin.from(table).select('init_time').eq('target_id', targetId).eq('source', source).order('init_time', { ascending: false }).limit(1).maybeSingle();
  if (!latest) return [];
  const { data, error } = await admin.from(table).select('*').eq('target_id', targetId).eq('source', source).eq('init_time', latest.init_time).gte('forecast_time', startIso).lte('forecast_time', endIso).order('forecast_time');
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}

export async function tidalRowsInWindow(admin: Admin, targetId: number, startIso: string, endIso: string): Promise<Row[]> {
  const { data, error } = await admin.from('forecast_tidal').select('*').eq('target_id', targetId).gte('forecast_time', startIso).lte('forecast_time', endIso).order('forecast_time');
  if (error) throw new Error(error.message);
  return (data ?? []) as Row[];
}
