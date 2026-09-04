// Token mapping and the dark-designed wind ramp. PRD §9.2.
import type { ConfidenceLevel, RiskFlag } from '@/types/domain.ts';

export const RISK_HEX: Record<RiskFlag, string> = { green: '#34D399', amber: '#FBBF24', red: '#F87171', unknown: '#66748F' };
export const RISK_CLASS: Record<RiskFlag, string> = {
  green: 'bg-risk-green/15 text-risk-green border-risk-green/40',
  amber: 'bg-risk-amber/15 text-risk-amber border-risk-amber/40',
  red: 'bg-risk-red/15 text-risk-red border-risk-red/40',
  unknown: 'bg-gap text-text-3 border-border',
};
export const RISK_LABEL: Record<RiskFlag, string> = { green: 'Green', amber: 'Amber', red: 'Red', unknown: 'No data' };

export const CONFIDENCE_HEX: Record<ConfidenceLevel, string> = { high: '#34D399', moderate: '#FBBF24', low: '#F87171' };
export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = { high: 'High', moderate: 'Moderate', low: 'Low' };

export const FLAG_VIOLET = '#A78BFA';
export const ACCENT = '#2DD4BF';

/** Wind ramp: 0, 5, 10, 15, 20, 30, 40, 50+ kn. Never starts at white. */
export const WIND_RAMP: [number, string][] = [
  [0, '#1E3A8A'], [5, '#0EA5E9'], [10, '#2DD4BF'], [15, '#A3E635'], [20, '#FBBF24'], [30, '#F97316'], [40, '#EF4444'], [50, '#C026D3'],
];

function hexToRgb(h: string): [number, number, number] {
  const v = parseInt(h.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

export function windColor(kn: number | null | undefined): string {
  if (kn === null || kn === undefined || !Number.isFinite(kn)) return RISK_HEX.unknown;
  if (kn <= WIND_RAMP[0][0]) return WIND_RAMP[0][1];
  for (let i = 1; i < WIND_RAMP.length; i++) {
    const [k1, c1] = WIND_RAMP[i], [k0, c0] = WIND_RAMP[i - 1];
    if (kn <= k1) {
      const f = (kn - k0) / (k1 - k0);
      const a = hexToRgb(c0), b = hexToRgb(c1);
      const mix = a.map((x, j) => Math.round(x + (b[j] - x) * f));
      return `rgb(${mix[0]},${mix[1]},${mix[2]})`;
    }
  }
  return WIND_RAMP[WIND_RAMP.length - 1][1];
}
