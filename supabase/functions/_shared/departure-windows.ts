// Data-derived departure windows at the departure point. A hint, not a recommendation:
// contiguous hours where the ensemble p90 wind, p90 gust and wave all sit under the amber
// fraction of the vessel limits and the comparison model does not diverge. PRD §13 Phase 3.
import type { VesselThresholds } from './risk.ts';

export type HourSample = { time: string; wind_p90_kn: number | null; wind_p50_kn: number | null; gust_p90_kn: number | null; wave_height_m: number | null; disagreement: boolean | null };
export type DepartureWindow = { start: string; end: string; hours: number; max_wind_p90_kn: number | null; reason: string };

export function departureWindows(samples: HourSample[], t: VesselThresholds, amberFraction = 0.75, minHours = 3): DepartureWindow[] {
  const ok = (s: HourSample): boolean => {
    if (s.wind_p90_kn === null) return false; // no atmospheric data is never a window
    if (t.max_wind_kn !== null && s.wind_p90_kn > amberFraction * t.max_wind_kn) return false;
    if (t.max_gust_kn !== null && s.gust_p90_kn !== null && s.gust_p90_kn > amberFraction * t.max_gust_kn) return false;
    if (t.max_wave_m !== null && s.wave_height_m !== null && s.wave_height_m > amberFraction * t.max_wave_m) return false;
    if (s.disagreement === true) return false;
    return true;
  };
  const sorted = [...samples].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  const out: DepartureWindow[] = [];
  let run: HourSample[] = [];
  const flush = () => {
    if (run.length >= minHours) {
      const maxP90 = Math.max(...run.map((s) => s.wind_p90_kn ?? 0));
      out.push({ start: run[0].time, end: run[run.length - 1].time, hours: run.length, max_wind_p90_kn: maxP90, reason: `p90 wind ≤ ${Math.round(maxP90)} kn, gusts, waves and model agreement all inside ${amberFraction}× the vessel limits at the departure point` });
    }
    run = [];
  };
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    const contiguous = run.length === 0 || Date.parse(s.time) - Date.parse(run[run.length - 1].time) <= 3_600_000 * 1.5;
    if (ok(s) && contiguous) run.push(s);
    else { flush(); if (ok(s)) run.push(s); }
  }
  flush();
  return out;
}

/** 16-sector wind rose bins from hourly (direction, speed) pairs. Direction is "from". */
export type RoseBin = { sector: number; label: string; hours: number; mean_speed_kn: number | null; max_speed_kn: number | null };
const LABELS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function windRose(hours: { dir_deg: number | null; speed_kn: number | null }[]): RoseBin[] {
  const bins: RoseBin[] = LABELS.map((label, sector) => ({ sector, label, hours: 0, mean_speed_kn: null, max_speed_kn: null }));
  const sums = new Array(16).fill(0);
  for (const h of hours) {
    if (h.dir_deg === null || !Number.isFinite(h.dir_deg)) continue;
    const s = Math.round((((h.dir_deg % 360) + 360) % 360) / 22.5) % 16;
    bins[s].hours += 1;
    if (h.speed_kn !== null) { sums[s] += h.speed_kn; bins[s].max_speed_kn = Math.max(bins[s].max_speed_kn ?? -Infinity, h.speed_kn); }
  }
  for (const b of bins) if (b.hours > 0 && b.max_speed_kn !== null) b.mean_speed_kn = Math.round((sums[b.sector] / b.hours) * 10) / 10;
  return bins;
}
