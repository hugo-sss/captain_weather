// Phase 5 rules that are pure and unit-tested: sea-state speed loss, squall risk,
// sampling of virtual points along a leg, and the briefing house-style dash rule.
import { angularDeltaDeg } from './stats.ts';

export type SpeedLossCurvePoint = { hs_m: number; head_pct: number; beam_pct: number; follow_pct: number };
export type SpeedLossSettings = { head_sector_deg: number; beam_sector_deg: number; max_loss_pct: number; curve: SpeedLossCurvePoint[] };
export type SquallSettings = { likely: { cape_jkg: number; precip_prob_pct: number }; possible: { cape_jkg: number; precip_prob_pct: number } };
export type LegSampling = { hours: number; max_points_per_leg: number };
export type SquallRisk = 'none' | 'possible' | 'likely';
export type SeaSector = 'head' | 'beam' | 'follow';

/** Displacement-hull style loss curve for a 40 to 50 m motor yacht at cruise; tunable in app_settings.speed_loss. */
export const DEFAULT_SPEED_LOSS: SpeedLossSettings = {
  head_sector_deg: 45,
  beam_sector_deg: 135,
  max_loss_pct: 40,
  curve: [
    { hs_m: 0.5, head_pct: 2, beam_pct: 1, follow_pct: 0 },
    { hs_m: 1.0, head_pct: 6, beam_pct: 3, follow_pct: 1 },
    { hs_m: 1.5, head_pct: 12, beam_pct: 6, follow_pct: 2 },
    { hs_m: 2.0, head_pct: 18, beam_pct: 9, follow_pct: 3 },
    { hs_m: 2.5, head_pct: 25, beam_pct: 12, follow_pct: 4 },
    { hs_m: 3.0, head_pct: 33, beam_pct: 16, follow_pct: 5 },
  ],
};

export const DEFAULT_SQUALL: SquallSettings = {
  likely: { cape_jkg: 1000, precip_prob_pct: 40 },
  possible: { cape_jkg: 500, precip_prob_pct: 30 },
};

export const DEFAULT_LEG_SAMPLING: LegSampling = { hours: 6, max_points_per_leg: 12 };

/** Waves are reported as the direction they come FROM; a wave from dead ahead is a head sea. */
export function seaSector(waveFromDeg: number | null, headingDeg: number, s: SpeedLossSettings = DEFAULT_SPEED_LOSS): SeaSector {
  if (waveFromDeg === null || !Number.isFinite(waveFromDeg)) return 'beam';
  const rel = angularDeltaDeg(waveFromDeg, headingDeg);
  if (rel <= s.head_sector_deg) return 'head';
  if (rel <= s.beam_sector_deg) return 'beam';
  return 'follow';
}

/** Percentage of speed lost for a significant wave height and relative direction. Linear between curve points, capped. */
export function speedLossPct(hsM: number | null, waveFromDeg: number | null, headingDeg: number, s: SpeedLossSettings = DEFAULT_SPEED_LOSS): number {
  if (hsM === null || !Number.isFinite(hsM) || hsM <= 0 || s.curve.length === 0) return 0;
  const sector = seaSector(waveFromDeg, headingDeg, s);
  const col = (p: SpeedLossCurvePoint) => (sector === 'head' ? p.head_pct : sector === 'beam' ? p.beam_pct : p.follow_pct);
  const curve = [...s.curve].sort((a, b) => a.hs_m - b.hs_m);
  let pct: number;
  if (hsM <= curve[0].hs_m) pct = (col(curve[0]) * hsM) / curve[0].hs_m;
  else if (hsM >= curve[curve.length - 1].hs_m) pct = col(curve[curve.length - 1]);
  else {
    let i = 0;
    while (i < curve.length - 1 && curve[i + 1].hs_m < hsM) i++;
    const a = curve[i], b = curve[i + 1];
    const f = (hsM - a.hs_m) / (b.hs_m - a.hs_m);
    pct = col(a) + (col(b) - col(a)) * f;
  }
  return Math.round(Math.min(s.max_loss_pct, Math.max(0, pct)) * 10) / 10;
}

/** Convective squall indicator from ensemble CAPE and precipitation probability. A heuristic, labelled as such in the UI. */
export function squallRisk(capeJkg: number | null, precipProbPct: number | null, s: SquallSettings = DEFAULT_SQUALL): SquallRisk {
  if (capeJkg === null || !Number.isFinite(capeJkg)) return 'none';
  const pp = precipProbPct !== null && Number.isFinite(precipProbPct) ? precipProbPct : 0;
  if (capeJkg >= s.likely.cape_jkg && pp >= s.likely.precip_prob_pct) return 'likely';
  if (capeJkg >= s.possible.cape_jkg || (capeJkg >= s.possible.cape_jkg / 2 && pp >= s.possible.precip_prob_pct)) return 'possible';
  return 'none';
}

/** Interior fractions along a leg of the given duration: one point about every `hours`, capped, endpoints excluded (those are waypoints). */
export function legSampleFractions(legHours: number, s: LegSampling = DEFAULT_LEG_SAMPLING): number[] {
  if (!Number.isFinite(legHours) || legHours <= 0 || s.hours <= 0) return [];
  const n = Math.min(Math.max(1, Math.ceil(legHours / s.hours)), Math.max(1, s.max_points_per_leg));
  if (n <= 1) return [];
  const out: number[] = [];
  for (let k = 1; k < n; k++) out.push(Math.round((k / n) * 1e5) / 1e5);
  return out;
}

/** House style for briefing text: no em or en dashes. Numeric ranges become "6 to 9"; other dashes become commas. */
export function normaliseDashes(text: string): string {
  return text
    .replace(/(\d)\s*[–—]\s*(\d)/g, '$1 to $2')
    .replace(/\s*[–—]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+,/g, ',');
}

/** Worst risk across a set of flags. */
export function worstRisk(flags: string[]): 'green' | 'amber' | 'red' | 'unknown' {
  const rank: Record<string, number> = { green: 0, unknown: 1, amber: 2, red: 3 };
  let worst: 'green' | 'amber' | 'red' | 'unknown' = 'green';
  for (const f of flags) if ((rank[f] ?? 0) > rank[worst]) worst = f as typeof worst;
  return worst;
}
