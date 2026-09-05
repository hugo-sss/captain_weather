// Regular lat/lon sampling grid for the current map view. Spacing comes from the zoom level so the
// viewport holds roughly 18 x 16 cells; the origin snaps to the spacing so panning reuses cached cells.
import type { LatLon } from './types.ts';

export type Bounds = { south: number; west: number; north: number; east: number };

export type GridSpec = {
  lat0: number; // south-west corner (snapped)
  lon0: number;
  dLat: number;
  dLon: number;
  nx: number; // columns (longitude)
  ny: number; // rows (latitude)
};

export const MAX_GRID_POINTS = 300;
const TARGET_COLS = 18;
const TARGET_ROWS = 16;
/** Spacing ladder in degrees. Snapping to a ladder value keeps cell keys stable across small zoom changes. */
export const SPACING_LADDER = [0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 4, 8];

/** Pick the ladder spacing at or above the ideal one, so the count never exceeds the target. */
export function spacingFor(bounds: Bounds, zoom: number): number {
  const latSpan = Math.max(0.01, bounds.north - bounds.south);
  const lonSpan = Math.max(0.01, bounds.east - bounds.west);
  const ideal = Math.max(latSpan / TARGET_ROWS, lonSpan / TARGET_COLS);
  // Zoom guards the degenerate case of a tiny container: never sample finer than the model grid (0.05° at z>=11).
  const floor = zoom >= 11 ? 0.05 : zoom >= 9 ? 0.1 : zoom >= 7 ? 0.25 : zoom >= 5 ? 0.5 : 1;
  const want = Math.max(ideal, floor);
  return SPACING_LADDER.find((s) => s >= want - 1e-9) ?? SPACING_LADDER[SPACING_LADDER.length - 1];
}

const snapDown = (v: number, step: number) => Math.floor(v / step + 1e-9) * step;

/** Build the grid spec for the view. One extra cell of margin on each side so edges interpolate cleanly. */
export function gridForView(bounds: Bounds, zoom: number): GridSpec {
  let d = spacingFor(bounds, zoom);
  for (;;) {
    const lat0 = Math.max(-85, snapDown(bounds.south, d) - d);
    const lon0 = snapDown(bounds.west, d) - d;
    const ny = Math.min(Math.ceil((Math.min(85, bounds.north) - lat0) / d) + 2, 400);
    const nx = Math.min(Math.ceil((bounds.east - lon0) / d) + 2, 400);
    if (nx * ny <= MAX_GRID_POINTS || d >= SPACING_LADDER[SPACING_LADDER.length - 1]) {
      return { lat0: round6(lat0), lon0: round6(lon0), dLat: d, dLon: d, nx: Math.max(2, nx), ny: Math.max(2, ny) };
    }
    d = SPACING_LADDER[Math.min(SPACING_LADDER.indexOf(d) + 1, SPACING_LADDER.length - 1)];
  }
}

export function gridPoints(spec: GridSpec): LatLon[] {
  const out: LatLon[] = [];
  for (let j = 0; j < spec.ny; j++) for (let i = 0; i < spec.nx; i++) out.push({ lat: round6(spec.lat0 + j * spec.dLat), lon: round6(normLon(spec.lon0 + i * spec.dLon)) });
  return out;
}

/** Cache key for one cell. Coordinates are rounded to the finest ladder step so float noise never splits a cell. */
export function cellKey(p: LatLon, model: string, runIso: string): string {
  return `${model}|${runIso}|${p.lat.toFixed(3)}|${normLon(p.lon).toFixed(3)}`;
}

export function normLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

const round6 = (v: number) => Math.round(v * 1e6) / 1e6;

/** Fractional grid coordinates of a lat/lon (x along longitude, y along latitude). */
export function toGridXY(spec: GridSpec, lat: number, lon: number): { x: number; y: number } {
  let dl = lon - spec.lon0;
  if (dl < -180) dl += 360;
  if (dl > 180) dl -= 360;
  return { x: dl / spec.dLon, y: (lat - spec.lat0) / spec.dLat };
}
