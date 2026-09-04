// Great-circle helpers. Pure, no I/O. PRD §6.2.
export const EARTH_RADIUS_NM = 3440.065;

const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/** Normalise a bearing/direction to [0, 360). */
export function normalizeDeg(d: number): number {
  let x = d % 360;
  if (x < 0) x += 360;
  return x >= 360 ? 0 : x;
}

/** Haversine distance in nautical miles (R = 3440.065 nm). */
export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2);
  const dφ = toRad(lat2 - lat1), dλ = toRad(lon2 - lon1);
  const a = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2;
  return 2 * EARTH_RADIUS_NM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial great-circle bearing, degrees true, [0, 360). */
export function initialBearingDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const φ1 = toRad(lat1), φ2 = toRad(lat2), dλ = toRad(lon2 - lon1);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return normalizeDeg(toDeg(Math.atan2(y, x)));
}

/**
 * Point at fraction f (0..1) along the great circle from A to B.
 * Antimeridian-safe because it works in 3D vectors, not on lon arithmetic.
 */
export function intermediatePoint(
  lat1: number, lon1: number, lat2: number, lon2: number, f: number,
): { lat: number; lon: number } {
  const φ1 = toRad(lat1), λ1 = toRad(lon1), φ2 = toRad(lat2), λ2 = toRad(lon2);
  const d = 2 * Math.asin(Math.min(1, Math.sqrt(
    Math.sin((φ2 - φ1) / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin((λ2 - λ1) / 2) ** 2)));
  if (d === 0) return { lat: lat1, lon: lon1 };
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2);
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2);
  const z = A * Math.sin(φ1) + B * Math.sin(φ2);
  const lat = toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)));
  let lon = toDeg(Math.atan2(y, x));
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return { lat, lon };
}

export function midpoint(lat1: number, lon1: number, lat2: number, lon2: number) {
  return intermediatePoint(lat1, lon1, lat2, lon2, 0.5);
}

/** Snap a coordinate to a model grid of `spacingDeg` (0.25° by default). */
export function snapToGrid(v: number, spacingDeg = 0.25): number {
  return Math.round(v / spacingDeg) * spacingDeg;
}
