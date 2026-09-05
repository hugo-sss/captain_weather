// Client for the `point-tide` edge function: tide for an arbitrary lat/lon from the nearest station.
// Costs API credits, so it runs only on an explicit click and is cached per station id for the session.
import { invokeFunction } from '@/lib/supabase.ts';

export type TideDatum = 'LAT' | 'CD' | 'MSL' | 'MLLW' | 'unknown';
export type TideState = 'flood' | 'ebb' | 'slack' | 'high' | 'low' | null;
export type PointTideOk = {
  ok: true;
  station: { id: string; name: string; distance_km: number };
  datum: TideDatum;
  series: { time: string; height_m: number; state: TideState }[];
  extremes: { time: string; height_m: number; type: 'high' | 'low' }[];
  source: 'tidesatlas';
  cached: boolean;
};
export type PointTideResponse = PointTideOk | { ok: false; error: string };
export type PointTideRequest = { lat: number; lon: number; days?: number };

const byStation = new Map<string, PointTideOk>();
const stationByCell = new Map<string, string>();
const inflight = new Map<string, Promise<PointTideOk>>();

/** ~1 km cells: a second click on the same spot reuses the station answer without another credit. */
export const cellKey = (lat: number, lon: number, days: number) => `${lat.toFixed(2)},${lon.toFixed(2)},${days}`;

export function cachedPointTide(lat: number, lon: number, days = 3): PointTideOk | null {
  const sid = stationByCell.get(cellKey(lat, lon, days));
  return sid ? byStation.get(sid) ?? null : null;
}

/** POST { lat, lon, days } -> station + series + extremes. Throws with the function's error message. */
export async function fetchPointTide(req: PointTideRequest): Promise<PointTideOk> {
  const days = Math.min(7, Math.max(1, Math.round(req.days ?? 3)));
  const key = cellKey(req.lat, req.lon, days);
  const hit = cachedPointTide(req.lat, req.lon, days);
  if (hit) return hit;
  const running = inflight.get(key);
  if (running) return running;
  const p = (async () => {
    const res = await invokeFunction<PointTideResponse>('point-tide', { lat: req.lat, lon: req.lon, days });
    if (!res || res.ok !== true) throw new Error((res as { error?: string } | null)?.error ?? 'point-tide returned no data');
    byStation.set(res.station.id, res);
    stationByCell.set(key, res.station.id);
    return res;
  })();
  inflight.set(key, p);
  try { return await p; } finally { inflight.delete(key); }
}

/** Test seam. */
export function resetPointTideCache() { byStation.clear(); stationByCell.clear(); inflight.clear(); }
