// Ingest target generation. PRD §11.1. Pure; the Deno wrapper persists it.
import { haversineNm, intermediatePoint, snapToGrid } from '../../../src/lib/passage-engine/geo.ts';
import type { Layer } from './contracts.ts';

export type GridPoint = { grid_lat: number; grid_lon: number };
export type TargetPlan = { layer: Layer; grid_lat: number; grid_lon: number; horizon_end: string }[];

const NM_PER_DEG = 60;

/** Sample every leg every `spacingDeg` along the great circle, snap to the model grid, dedupe. */
export function sampleRouteGrid(points: { lat: number; lon: number }[], spacingDeg = 0.25): GridPoint[] {
  const seen = new Set<string>();
  const out: GridPoint[] = [];
  const push = (lat: number, lon: number) => {
    const g = { grid_lat: round3(snapToGrid(lat, spacingDeg)), grid_lon: round3(snapToGrid(lon, spacingDeg)) };
    if (g.grid_lon === -180) g.grid_lon = 180;
    const k = `${g.grid_lat},${g.grid_lon}`;
    if (!seen.has(k)) { seen.add(k); out.push(g); }
  };
  if (points.length === 0) return out;
  push(points[0].lat, points[0].lon);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i];
    const nm = haversineNm(a.lat, a.lon, b.lat, b.lon);
    const steps = Math.max(1, Math.ceil(nm / (spacingDeg * NM_PER_DEG)));
    for (let s = 1; s <= steps; s++) {
      const p = intermediatePoint(a.lat, a.lon, b.lat, b.lon, s / steps);
      push(p.lat, p.lon);
    }
  }
  return out;
}

/** Tidal targets sit at the waypoints themselves (0.01° cells), not along the corridor: tides are station-based and credit-metered. */
export function tidalPoints(points: { lat: number; lon: number }[]): GridPoint[] {
  const seen = new Set<string>();
  const out: GridPoint[] = [];
  for (const p of points) {
    const g = { grid_lat: round3(Math.round(p.lat * 100) / 100), grid_lon: round3(Math.round(p.lon * 100) / 100) };
    const k = `${g.grid_lat},${g.grid_lon}`;
    if (!seen.has(k)) { seen.add(k); out.push(g); }
  }
  return out;
}

export function planTargets(
  waypoints: { lat: number; lon: number; eta: string | null; departureFromHere?: string | null }[],
  spacingDeg = 0.25,
): { plan: TargetPlan; horizon_end: string; grid_points: number } {
  const times = waypoints.flatMap((w) => [w.eta, w.departureFromHere ?? null]).filter((t): t is string => !!t).map((t) => Date.parse(t));
  const maxT = times.length ? Math.max(...times) : Date.now();
  const horizon_end = new Date(maxT + 24 * 3_600_000).toISOString();
  const grid = sampleRouteGrid(waypoints, spacingDeg);
  const plan: TargetPlan = [];
  for (const layer of ['atmospheric', 'comparison', 'marine'] as Layer[]) {
    for (const g of grid) plan.push({ layer, ...g, horizon_end });
  }
  for (const g of tidalPoints(waypoints)) plan.push({ layer: 'tidal', ...g, horizon_end });
  return { plan, horizon_end, grid_points: grid.length };
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;
