// Percentiles and circular statistics. PRD §2 #10, §5.1.
// Wind direction is circular: mean and spread only, never percentiles.

/** Linear-interpolated percentile (Hyndman & Fan type 7). p in [0,1]. */
export function percentile(values: number[], p: number): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  if (v.length === 1) return v[0];
  const h = (v.length - 1) * p;
  const lo = Math.floor(h), hi = Math.ceil(h);
  return v[lo] + (v[hi] - v[lo]) * (h - lo);
}

export const p10 = (v: number[]) => percentile(v, 0.1);
export const p50 = (v: number[]) => percentile(v, 0.5);
export const p90 = (v: number[]) => percentile(v, 0.9);
export const median = p50;

export function mean(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function normalizeDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x >= 360 ? 0 : x;
}

/** Circular mean of bearings in degrees, [0, 360). Null when empty or fully cancelling. */
export function circularMeanDeg(degs: number[]): number | null {
  const v = degs.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  let s = 0, c = 0;
  for (const d of v) { s += Math.sin(toRad(d)); c += Math.cos(toRad(d)); }
  s /= v.length; c /= v.length;
  if (Math.hypot(s, c) < 1e-9) return null;
  return normalizeDeg(toDeg(Math.atan2(s, c)));
}

/**
 * Circular standard deviation in degrees (Mardia): sqrt(-2 ln R), where R is
 * the mean resultant length. 0 for identical directions; large for scattered.
 */
export function circularStdDevDeg(degs: number[]): number | null {
  const v = degs.filter((x) => Number.isFinite(x));
  if (v.length === 0) return null;
  let s = 0, c = 0;
  for (const d of v) { s += Math.sin(toRad(d)); c += Math.cos(toRad(d)); }
  const R = Math.hypot(s / v.length, c / v.length);
  if (R <= 1e-12) return 180;
  if (R >= 1) return 0;
  return toDeg(Math.sqrt(-2 * Math.log(R)));
}

/** Smallest angle between two bearings, 0..180. Mirrors angular_delta_deg() in SQL. */
export function angularDeltaDeg(a: number, b: number): number {
  return Math.abs((((a - b + 540) % 360) + 360) % 360 - 180);
}

/** Interpolate between two bearings along the shortest arc. f in [0,1]. */
export function circularInterpolateDeg(a: number, b: number, f: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return normalizeDeg(a + delta * f);
}

/** Linear interpolation for scalar quantities; passes nulls through. */
export function lerp(a: number | null, b: number | null, f: number): number | null {
  if (a === null || b === null) return a ?? b;
  return a + (b - a) * f;
}

/**
 * How far a set of directions spans, 0..360: the smallest arc containing every
 * value. Used for anchorage wind_dir_range_deg (veer/back during a stay).
 */
export function circularRangeDeg(degs: number[]): number | null {
  const v = degs.filter((x) => Number.isFinite(x)).map(normalizeDeg).sort((a, b) => a - b);
  if (v.length === 0) return null;
  if (v.length === 1) return 0;
  let maxGap = 0;
  for (let i = 0; i < v.length; i++) {
    const next = i + 1 < v.length ? v[i + 1] : v[0] + 360;
    maxGap = Math.max(maxGap, next - v[i]);
  }
  return 360 - maxGap;
}
