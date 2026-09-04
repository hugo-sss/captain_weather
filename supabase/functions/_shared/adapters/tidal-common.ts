// Shared tidal helpers: state derivation and hourly series from extremes.
import type { TideDatum, TideState } from '../contracts.ts';

export type HeightPoint = { time: string; heightM: number };
export type Extreme = { time: string; heightM: number; type: 'high' | 'low' };

/**
 * PRD §5.4: rising = flood, falling = ebb, turning points = high/low, and
 * within ±10 % of the local range of a turning point = slack.
 */
export function deriveTideStates(series: HeightPoint[]): TideState[] {
  const n = series.length;
  const h = series.map((p) => p.heightM);
  if (n === 0) return [];
  if (n === 1) return ['slack'];
  // Turning points are interior local extrema; series endpoints are never turning points.
  const turning: number[] = [];
  for (let i = 1; i < n - 1; i++) {
    if ((h[i] > h[i - 1] && h[i] >= h[i + 1]) || (h[i] < h[i - 1] && h[i] <= h[i + 1])) turning.push(i);
  }
  const globalRange = Math.max(...h) - Math.min(...h);
  const states: TideState[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (turning.includes(i)) { states[i] = h[i] > h[i - 1] ? 'high' : 'low'; continue; }
    const prevTp = [...turning].reverse().find((t) => t < i);
    const nextTp = turning.find((t) => t > i);
    const nearest = prevTp === undefined ? nextTp : nextTp === undefined ? prevTp : (i - prevTp <= nextTp - i ? prevTp : nextTp);
    const range = prevTp !== undefined && nextTp !== undefined ? Math.abs(h[prevTp] - h[nextTp]) : globalRange;
    if (nearest !== undefined && range > 0 && Math.abs(h[i] - h[nearest]) <= 0.1 * range) { states[i] = 'slack'; continue; }
    const rising = i + 1 < n ? h[i + 1] > h[i] : h[i] > h[i - 1];
    states[i] = rising ? 'flood' : 'ebb';
  }
  return states;
}

/** Hourly heights between consecutive extremes with a cosine curve (the standard rule-of-twelfths shape). */
export function hourlyFromExtremes(extremes: Extreme[], start: string, end: string): HeightPoint[] {
  const ex = [...extremes].sort((a, b) => Date.parse(a.time) - Date.parse(b.time));
  if (ex.length < 2) return [];
  const out: HeightPoint[] = [];
  const t0 = Math.ceil(Date.parse(start) / 3_600_000) * 3_600_000;
  const t1 = Date.parse(end);
  for (let t = t0; t <= t1; t += 3_600_000) {
    let k = -1;
    for (let i = 0; i < ex.length - 1; i++) {
      if (t >= Date.parse(ex[i].time) && t <= Date.parse(ex[i + 1].time)) { k = i; break; }
    }
    if (k < 0) continue;
    const a = ex[k], b = ex[k + 1];
    const f = (t - Date.parse(a.time)) / (Date.parse(b.time) - Date.parse(a.time));
    const h = a.heightM + (b.heightM - a.heightM) * (1 - Math.cos(Math.PI * f)) / 2;
    out.push({ time: new Date(t).toISOString(), heightM: Math.round(h * 100) / 100 });
  }
  return out;
}

export function normaliseDatum(d: unknown): TideDatum {
  const s = String(d ?? '').toUpperCase().replace(/[^A-Z]/g, '');
  if (s === 'CD' || s === 'CHARTDATUM') return 'CD';
  if (s === 'LAT' || s === 'LOWESTASTRONOMICALTIDE') return 'LAT';
  if (s === 'MSL' || s === 'MEANSEALEVEL') return 'MSL';
  if (s === 'MLLW') return 'MLLW';
  return 'unknown';
}
