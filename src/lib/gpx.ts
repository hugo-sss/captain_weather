// GPX importer. PRD Feature 1: <rte>/<rtept> first, fall back to <trk> with a notice.
import { gpx as gpxToGeoJson } from '@tmcw/togeojson';
import type { DraftWaypoint } from '@/types/domain.ts';

export type GpxImport = { waypoints: DraftWaypoint[]; notice: string | null; kind: 'route' | 'track' | 'waypoints' | 'none' };

export function parseGpx(text: string): GpxImport {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('Not a valid GPX file');
  const fc = gpxToGeoJson(doc);
  const wps: DraftWaypoint[] = [];
  const push = (lat: number, lon: number, name: string) => wps.push({ sequence: wps.length + 1, name, lat, lon, planned_speed_kn: null, is_anchorage: false, planned_departure_from_here: null, anchorage_exposure_tag: null, is_complex_coastal: false, charted_depth_m: null, source: 'gpx' });

  // Routes first.
  const rtepts = Array.from(doc.getElementsByTagName('rtept'));
  if (rtepts.length >= 2) {
    rtepts.forEach((el, i) => push(Number(el.getAttribute('lat')), Number(el.getAttribute('lon')), el.getElementsByTagName('name')[0]?.textContent?.trim() || `WP${i + 1}`));
    return { waypoints: wps, notice: null, kind: 'route' };
  }
  // Then tracks via togeojson (handles segments).
  const track = fc.features.find((f) => f.geometry.type === 'LineString' || f.geometry.type === 'MultiLineString');
  if (track) {
    const g = track.geometry as GeoJSON.LineString | GeoJSON.MultiLineString;
    const coords: GeoJSON.Position[] = g.type === 'LineString' ? g.coordinates : g.coordinates.flat();
    coords.forEach((c, i) => push(c[1], c[0], `T${i + 1}`));
    return { waypoints: wps, notice: `Track imported (${wps.length} points). Consider simplifying.`, kind: 'track' };
  }
  // Finally bare <wpt> markers in file order.
  const pts = fc.features.filter((f) => f.geometry.type === 'Point');
  if (pts.length >= 2) {
    pts.forEach((f, i) => { const c = (f.geometry as GeoJSON.Point).coordinates; push(c[1], c[0], String(f.properties?.name ?? `WP${i + 1}`)); });
    return { waypoints: wps, notice: 'No route or track found; imported <wpt> markers in file order.', kind: 'waypoints' };
  }
  return { waypoints: [], notice: 'No route, track or waypoints found in this GPX.', kind: 'none' };
}

/** Douglas-Peucker on lat/lon (degrees). Used when a track has more than 200 points. */
export function simplify(points: DraftWaypoint[], toleranceDeg = 0.002): DraftWaypoint[] {
  if (points.length <= 2) return points;
  const keep = new Array(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let maxD = 0, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const d = perpDistance(points[i], points[a], points[b]);
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > toleranceDeg && idx > 0) { keep[idx] = true; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]).map((p, i) => ({ ...p, sequence: i + 1 }));
}

function perpDistance(p: { lat: number; lon: number }, a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const cosLat = Math.cos((a.lat * Math.PI) / 180);
  const x = (p.lon - a.lon) * cosLat, y = p.lat - a.lat;
  const dx = (b.lon - a.lon) * cosLat, dy = b.lat - a.lat;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) return Math.hypot(x, y);
  const t = Math.max(0, Math.min(1, (x * dx + y * dy) / len2));
  return Math.hypot(x - t * dx, y - t * dy);
}

export const MAX_WAYPOINTS_BEFORE_SIMPLIFY = 200;

export function toGpx(name: string, waypoints: { name: string | null; lat: number; lon: number; eta?: string | null }[]): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const pts = waypoints.map((w) => `    <rtept lat="${w.lat.toFixed(6)}" lon="${w.lon.toFixed(6)}"><name>${esc(w.name ?? '')}</name>${w.eta ? `<time>${w.eta}</time>` : ''}</rtept>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Captain Passage Tool" xmlns="http://www.topografix.com/GPX/1/1">\n  <rte>\n    <name>${esc(name)}</name>\n${pts}\n  </rte>\n</gpx>\n`;
}
