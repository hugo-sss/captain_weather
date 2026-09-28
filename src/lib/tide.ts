// Tide series helpers for the tide-only chart. Tide comes only from forecast_tidal or the point-tide
// function (a station); Open-Meteo sea level is never presented as tide.
export type TideSeriesPoint = { t: number; height: number | null; state?: string | null };
export type TideExtreme = { t: number; height: number; type: 'high' | 'low' };

/**
 * High and low water from a sampled series: a local maximum (or minimum) strictly above (below) both
 * neighbours. Flat tops count once at their first sample. Endpoints are never extremes because the
 * turn cannot be seen. Nulls break the series.
 */
export function deriveTideExtremes(series: TideSeriesPoint[]): TideExtreme[] {
  const pts = series.filter((p): p is TideSeriesPoint & { height: number } => p.height !== null && Number.isFinite(p.height)).sort((a, b) => a.t - b.t);
  const out: TideExtreme[] = [];
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1].height, cur = pts[i].height;
    // Look past a flat run to the next different sample.
    let j = i + 1;
    while (j < pts.length && pts[j].height === cur) j++;
    if (j >= pts.length) break;
    const next = pts[j].height;
    if (cur > prev && cur > next) out.push({ t: pts[i].t, height: cur, type: 'high' });
    else if (cur < prev && cur < next) out.push({ t: pts[i].t, height: cur, type: 'low' });
    if (j > i + 1) i = j - 1;
  }
  return out;
}

/** Extremes the function already supplies win over derived ones; both are the same shape. */
export function mergeExtremes(given: TideExtreme[] | null | undefined, derived: TideExtreme[]): TideExtreme[] {
  return given && given.length ? [...given].sort((a, b) => a.t - b.t) : derived;
}

/** Tide height at a moment by linear interpolation between samples; null outside the series. */
export function tideAt(series: TideSeriesPoint[], t: number): number | null {
  const pts = series.filter((p): p is TideSeriesPoint & { height: number } => p.height !== null).sort((a, b) => a.t - b.t);
  if (pts.length === 0 || t < pts[0].t || t > pts[pts.length - 1].t) return null;
  for (let i = 1; i < pts.length; i++) {
    if (t <= pts[i].t) {
      const a = pts[i - 1], b = pts[i];
      const f = b.t === a.t ? 0 : (t - a.t) / (b.t - a.t);
      return Math.round((a.height + (b.height - a.height) * f) * 100) / 100;
    }
  }
  return pts[pts.length - 1].height;
}
