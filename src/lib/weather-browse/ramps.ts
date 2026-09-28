// Colour ramps for the map fields. The wind ramp is the PRD §9.2 one, verbatim. The others are built
// from the same token family so the map reads as one system on the dark base.
import { WIND_RAMP } from '@/lib/risk-colors.ts';

export type RampStop = [value: number, hex: string, alpha?: number];
export type Ramp = { stops: RampStop[]; unit: string; ticks: number[]; fmt: (v: number) => string };

export type FieldKind = 'wind' | 'gusts' | 'waves' | 'swell' | 'rain' | 'pressure';

/** Sequential teal → amber for sea state (m). */
const WAVE_STOPS: RampStop[] = [[0, '#134E4A'], [0.5, '#0D9488'], [1, '#2DD4BF'], [1.5, '#A3E635'], [2.5, '#FBBF24'], [4, '#F97316'], [6, '#EF4444']];
/** Sequential teal → amber for precipitation (mm per step); dry is fully transparent. */
const RAIN_STOPS: RampStop[] = [[0, '#134E4A', 0], [0.2, '#134E4A', 0.6], [1, '#0D9488'], [3, '#2DD4BF'], [8, '#A3E635'], [15, '#FBBF24'], [30, '#F97316']];
/** Diverging around 1013 hPa: blue low, quiet at the mean, amber high. */
const PRESSURE_STOPS: RampStop[] = [[980, '#1E3A8A'], [995, '#0EA5E9'], [1005, '#2DD4BF', 0.7], [1013, '#182338', 0.35], [1021, '#FBBF24', 0.7], [1030, '#F97316'], [1045, '#EF4444']];

export const RAMPS: Record<FieldKind, Ramp> = {
  wind: { stops: WIND_RAMP.map(([v, c]) => [v, c] as RampStop), unit: 'kn', ticks: [0, 5, 10, 15, 20, 30, 40, 50], fmt: (v) => String(Math.round(v)) },
  gusts: { stops: WIND_RAMP.map(([v, c]) => [v, c] as RampStop), unit: 'kn', ticks: [0, 5, 10, 15, 20, 30, 40, 50], fmt: (v) => String(Math.round(v)) },
  waves: { stops: WAVE_STOPS, unit: 'm', ticks: [0, 1, 2.5, 4, 6], fmt: (v) => (v % 1 ? v.toFixed(1) : String(v)) },
  swell: { stops: WAVE_STOPS, unit: 'm', ticks: [0, 1, 2.5, 4, 6], fmt: (v) => (v % 1 ? v.toFixed(1) : String(v)) },
  rain: { stops: RAIN_STOPS, unit: 'mm/3h', ticks: [0, 1, 3, 8, 15, 30], fmt: (v) => String(v) },
  pressure: { stops: PRESSURE_STOPS, unit: 'hPa', ticks: [980, 995, 1013, 1030, 1045], fmt: (v) => String(v) },
};

export function hexToRgb(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

/** RGBA (0..255) for a value on a ramp: linear between stops, clamped at the ends. */
export function rampColor(ramp: Ramp, value: number): [number, number, number, number] {
  const s = ramp.stops;
  if (!Number.isFinite(value) || value <= s[0][0]) { const [r, g, b] = hexToRgb(s[0][1]); return [r, g, b, Math.round((s[0][2] ?? 1) * 255)]; }
  for (let i = 1; i < s.length; i++) {
    if (value <= s[i][0]) {
      const [v0, c0, a0 = 1] = s[i - 1], [v1, c1, a1 = 1] = s[i];
      const f = (value - v0) / (v1 - v0);
      const a = hexToRgb(c0), b = hexToRgb(c1);
      return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.round(a[2] + (b[2] - a[2]) * f), Math.round((a0 + (a1 - a0) * f) * 255)];
    }
  }
  const last = s[s.length - 1];
  const [r, g, b] = hexToRgb(last[1]);
  return [r, g, b, Math.round((last[2] ?? 1) * 255)];
}

/** Precomputed lookup so the painter does no interpolation per pixel. */
export function buildLut(ramp: Ramp, size = 256): { lut: Uint8ClampedArray; min: number; max: number } {
  const min = ramp.stops[0][0], max = ramp.stops[ramp.stops.length - 1][0];
  const lut = new Uint8ClampedArray(size * 4);
  for (let i = 0; i < size; i++) {
    const [r, g, b, a] = rampColor(ramp, min + ((max - min) * i) / (size - 1));
    lut[i * 4] = r; lut[i * 4 + 1] = g; lut[i * 4 + 2] = b; lut[i * 4 + 3] = a;
  }
  return { lut, min, max };
}

/** CSS gradient for the legend bar (uses the alpha of each stop so rain starts transparent). */
export function rampCss(ramp: Ramp): string {
  const min = ramp.stops[0][0], max = ramp.stops[ramp.stops.length - 1][0];
  return `linear-gradient(90deg, ${ramp.stops.map(([v, c, a = 1]) => { const [r, g, b] = hexToRgb(c); return `rgba(${r},${g},${b},${a}) ${(((v - min) / (max - min)) * 100).toFixed(1)}%`; }).join(', ')})`;
}
