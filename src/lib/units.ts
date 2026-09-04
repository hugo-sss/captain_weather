// Unit helpers. Units live in names. Circular stats re-exported from _shared
// so the UI and the edge functions never disagree.
export { circularMeanDeg, circularStdDevDeg, angularDeltaDeg, normalizeDeg } from '../../supabase/functions/_shared/stats.ts';

export const KMH_PER_KN = 1.852;
export const MS_PER_KN = 0.514444;
export const FT_PER_M = 3.28084;

export const kmhToKn = (kmh: number) => kmh / KMH_PER_KN;
export const knToKmh = (kn: number) => kn * KMH_PER_KN;
export const msToKn = (ms: number) => ms / MS_PER_KN;
export const knToMs = (kn: number) => kn * MS_PER_KN;
export const mToFt = (m: number) => m * FT_PER_M;
export const ftToM = (ft: number) => ft / FT_PER_M;

/** Compass point (16-wind) for a "from" direction in degrees true. */
export function compassPoint(deg: number): string {
  const pts = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  return pts[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

export function fmtNum(v: number | null | undefined, dp = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v.toFixed(dp);
}

export function fmtDeg(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${Math.round(v).toString().padStart(3, '0')}°`;
}
