// Scalar and vector fields on the sampling grid, and bilinear interpolation for the painters.
// Wind direction is meteorological (FROM): U = -speed·sin(dir), V = -speed·cos(dir).
import { toGridXY, type GridSpec } from './grid.ts';
import type { BrowseVar, CellForecast } from './types.ts';

const DEG = Math.PI / 180;

export function toUV(speed: number, dirFromDeg: number): { u: number; v: number } {
  const r = dirFromDeg * DEG;
  return { u: -speed * Math.sin(r), v: -speed * Math.cos(r) };
}

/** Inverse of toUV: speed and the FROM direction in degrees (0..360). */
export function fromUV(u: number, v: number): { speed: number; dirFromDeg: number } {
  const speed = Math.hypot(u, v);
  let dir = (Math.atan2(-u, -v) / DEG) % 360;
  if (dir < 0) dir += 360;
  return { speed, dirFromDeg: dir };
}

export type ScalarGrid = { spec: GridSpec; values: Float32Array; timeIso: string | null };
export type VectorGrid = { spec: GridSpec; u: Float32Array; v: Float32Array; timeIso: string | null };

const idx = (spec: GridSpec, i: number, j: number) => j * spec.nx + i;

function cellIndex(spec: GridSpec, c: CellForecast): number | null {
  const { x, y } = toGridXY(spec, c.lat, c.lon);
  const i = Math.round(x), j = Math.round(y);
  if (Math.abs(x - i) > 0.01 || Math.abs(y - j) > 0.01 || i < 0 || j < 0 || i >= spec.nx || j >= spec.ny) return null;
  return idx(spec, i, j);
}

function valueAt(c: CellForecast, key: BrowseVar, timeIso: string): number | null {
  const arr = c.vars[key];
  if (!arr) return null;
  const t = c.times.indexOf(timeIso);
  if (t < 0) return null;
  const v = arr[t];
  return v === null || v === undefined || !Number.isFinite(v) ? null : v;
}

/** Fill a scalar grid for one variable at one time step. Missing cells are NaN. */
export function buildScalarGrid(spec: GridSpec, cells: Iterable<CellForecast>, key: BrowseVar, timeIso: string): ScalarGrid {
  const values = new Float32Array(spec.nx * spec.ny).fill(NaN);
  for (const c of cells) {
    const k = cellIndex(spec, c);
    if (k === null) continue;
    const v = valueAt(c, key, timeIso);
    if (v !== null) values[k] = v;
  }
  return { spec, values, timeIso };
}

/** Wind U/V grid (kn) at one time step from speed + FROM direction. */
export function buildVectorGrid(spec: GridSpec, cells: Iterable<CellForecast>, timeIso: string, speedKey: BrowseVar = 'wind_speed_10m', dirKey: BrowseVar = 'wind_direction_10m'): VectorGrid {
  const n = spec.nx * spec.ny;
  const u = new Float32Array(n).fill(NaN), v = new Float32Array(n).fill(NaN);
  for (const c of cells) {
    const k = cellIndex(spec, c);
    if (k === null) continue;
    const s = valueAt(c, speedKey, timeIso), d = valueAt(c, dirKey, timeIso);
    if (s === null || d === null) continue;
    const uv = toUV(s, d);
    u[k] = uv.u; v[k] = uv.v;
  }
  return { spec, u, v, timeIso };
}

/**
 * Bilinear sample at fractional grid coordinates. NaN corners are dropped and the weights renormalised,
 * so a single missing neighbour does not punch a hole; all four missing (or outside) returns NaN.
 */
export function bilinear(values: Float32Array, spec: GridSpec, x: number, y: number): number {
  if (x < 0 || y < 0 || x > spec.nx - 1 || y > spec.ny - 1) return NaN;
  const i0 = Math.min(Math.floor(x), spec.nx - 2), j0 = Math.min(Math.floor(y), spec.ny - 2);
  const fx = x - i0, fy = y - j0;
  const w = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  const v = [values[idx(spec, i0, j0)], values[idx(spec, i0 + 1, j0)], values[idx(spec, i0, j0 + 1)], values[idx(spec, i0 + 1, j0 + 1)]];
  let sum = 0, wsum = 0;
  for (let k = 0; k < 4; k++) {
    if (Number.isNaN(v[k])) continue;
    sum += v[k] * w[k]; wsum += w[k];
  }
  return wsum > 0 ? sum / wsum : NaN;
}

export function sampleScalar(g: ScalarGrid, lat: number, lon: number): number {
  const { x, y } = toGridXY(g.spec, lat, lon);
  return bilinear(g.values, g.spec, x, y);
}

export function sampleVector(g: VectorGrid, lat: number, lon: number): { u: number; v: number } {
  const { x, y } = toGridXY(g.spec, lat, lon);
  return { u: bilinear(g.u, g.spec, x, y), v: bilinear(g.v, g.spec, x, y) };
}

/** Interpolate every variable at a lat/lon for one time step (directions via U/V so 350°/010° averages to 000°). */
export function sampleCells(spec: GridSpec, cells: Iterable<CellForecast>, lat: number, lon: number, timeIso: string): Partial<Record<BrowseVar, number | null>> {
  const list = Array.from(cells);
  const out: Partial<Record<BrowseVar, number | null>> = {};
  const scalar = (k: BrowseVar) => { const v = sampleScalar(buildScalarGrid(spec, list, k, timeIso), lat, lon); return Number.isNaN(v) ? null : v; };
  const dir = (speedKey: BrowseVar, dirKey: BrowseVar) => {
    const { u, v } = sampleVector(buildVectorGrid(spec, list, timeIso, speedKey, dirKey), lat, lon);
    return Number.isNaN(u) || Number.isNaN(v) ? null : fromUV(u, v).dirFromDeg;
  };
  for (const k of ['wind_speed_10m', 'wind_gusts_10m', 'pressure_msl', 'precipitation', 'temperature_2m', 'wave_height', 'wave_period', 'swell_wave_height', 'swell_wave_period'] as BrowseVar[]) out[k] = scalar(k);
  out.wind_direction_10m = dir('wind_speed_10m', 'wind_direction_10m');
  out.wave_direction = dir('wave_height', 'wave_direction');
  out.swell_wave_direction = dir('swell_wave_height', 'swell_wave_direction');
  return out;
}
