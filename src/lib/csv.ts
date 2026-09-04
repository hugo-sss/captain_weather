// CSV importer: name,lat,lon[,is_anchorage,stay_hours]. PRD Feature 1.
import type { DraftWaypoint } from '@/types/domain.ts';

export type CsvImport = { waypoints: DraftWaypoint[]; errors: string[] };

const truthy = (v: string) => ['1', 'true', 'yes', 'y', 't'].includes(v.trim().toLowerCase());

export function parseCsv(text: string): CsvImport {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  const wps: DraftWaypoint[] = [];
  if (lines.length === 0) return { waypoints: [], errors: ['empty file'] };
  const header = lines[0].toLowerCase().split(',').map((h) => h.trim());
  const hasHeader = header.includes('lat') && header.includes('lon');
  const col = (k: string, fallback: number) => (hasHeader ? header.indexOf(k) : fallback);
  const iName = col('name', 0), iLat = col('lat', 1), iLon = col('lon', 2), iAnch = col('is_anchorage', 3), iStay = col('stay_hours', 4);
  for (let r = hasHeader ? 1 : 0; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const lat = Number(cells[iLat]), lon = Number(cells[iLon]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) { errors.push(`line ${r + 1}: bad lat/lon`); continue; }
    const isAnch = iAnch >= 0 && cells[iAnch] !== undefined ? truthy(cells[iAnch]) : false;
    const stayH = iStay >= 0 && cells[iStay] !== undefined && cells[iStay].trim() !== '' ? Number(cells[iStay]) : null;
    wps.push({
      sequence: wps.length + 1, name: (cells[iName] ?? '').trim() || `WP${wps.length + 1}`, lat, lon,
      planned_speed_kn: null, is_anchorage: isAnch,
      // Stay end is resolved against the computed ETA when saving; keep hours in a sidecar field.
      planned_departure_from_here: null, anchorage_exposure_tag: null, is_complex_coastal: false, charted_depth_m: null, source: 'csv',
      ...(isAnch && stayH !== null && Number.isFinite(stayH) ? { stay_hours: stayH } : {}),
    } as DraftWaypoint & { stay_hours?: number });
  }
  return { waypoints: wps, errors };
}

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '', q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}
