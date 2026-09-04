// Risk flag against vessel thresholds (PRD §7 step 7) and the Feature 11
// source-disagreement rule. Every rule that fires is written out in words.
import type { RiskFlag } from './contracts.ts';
import { angularDeltaDeg } from './stats.ts';

export type VesselThresholds = {
  max_wind_kn: number | null;
  max_gust_kn: number | null;
  max_wave_m: number | null;
  max_current_kn: number | null;
  min_ukc_m: number | null;
};

export type RiskInput = {
  windP50Kn: number | null;
  windP90Kn: number | null;
  gustP90Kn: number | null;
  waveHeightM: number | null;
  currentSpeedKn: number | null;
  ukcEstimateM: number | null;
  sourceDisagreement: boolean;
  atmosphericGap: boolean;
};

export type RiskResult = { flag: RiskFlag; reasons: string[] };

const f1 = (v: number) => (Math.round(v * 10) / 10).toString();

export function riskFlag(c: RiskInput, t: VesselThresholds, amberFraction = 0.75): RiskResult {
  const red: string[] = [];
  const amber: string[] = [];
  const gt = (a: number | null, b: number | null): a is number => a !== null && b !== null && a > b;
  const lt = (a: number | null, b: number | null): a is number => a !== null && b !== null && a < b;

  // Red: a limit is exceeded on the central estimate (p50) or on the worst case for gusts.
  if (gt(c.windP50Kn, t.max_wind_kn)) red.push(`wind p50 ${f1(c.windP50Kn)} kn > max_wind ${f1(t.max_wind_kn!)} kn`);
  if (gt(c.gustP90Kn, t.max_gust_kn)) red.push(`gust p90 ${f1(c.gustP90Kn)} kn > max_gust ${f1(t.max_gust_kn!)} kn`);
  if (gt(c.waveHeightM, t.max_wave_m)) red.push(`wave ${f1(c.waveHeightM)} m > max_wave ${f1(t.max_wave_m!)} m`);
  if (gt(c.currentSpeedKn, t.max_current_kn)) red.push(`current ${f1(c.currentSpeedKn)} kn > max_current ${f1(t.max_current_kn!)} kn`);
  if (lt(c.ukcEstimateM, t.min_ukc_m)) red.push(`UKC estimate ${f1(c.ukcEstimateM)} m < min_ukc ${f1(t.min_ukc_m!)} m`);
  if (red.length) return { flag: 'red', reasons: red };

  // Amber: the upper band approaches a limit, or the models disagree.
  if (t.max_wind_kn !== null && gt(c.windP90Kn, t.max_wind_kn * amberFraction))
    amber.push(`wind p90 ${f1(c.windP90Kn)} kn > ${amberFraction}×max_wind ${f1(t.max_wind_kn)} kn`);
  if (t.max_gust_kn !== null && gt(c.gustP90Kn, t.max_gust_kn * amberFraction))
    amber.push(`gust p90 ${f1(c.gustP90Kn)} kn > ${amberFraction}×max_gust ${f1(t.max_gust_kn)} kn`);
  if (t.max_wave_m !== null && gt(c.waveHeightM, t.max_wave_m * amberFraction))
    amber.push(`wave ${f1(c.waveHeightM)} m > ${amberFraction}×max_wave ${f1(t.max_wave_m)} m`);
  if (c.sourceDisagreement) amber.push('primary and comparison models disagree on wind');
  if (t.min_ukc_m !== null && lt(c.ukcEstimateM, t.min_ukc_m * 1.5))
    amber.push(`UKC estimate ${f1(c.ukcEstimateM)} m < 1.5×min_ukc ${f1(t.min_ukc_m)} m`);
  if (amber.length) return { flag: 'amber', reasons: amber };

  if (c.atmosphericGap) return { flag: 'unknown', reasons: ['no atmospheric data at this waypoint'] };
  return { flag: 'green', reasons: [] };
}

export const RISK_RANK: Record<RiskFlag, number> = { green: 0, unknown: 1, amber: 2, red: 3 };
export function worstRisk(flags: RiskFlag[]): RiskFlag {
  return flags.reduce((w, f) => (RISK_RANK[f] > RISK_RANK[w] ? f : w), 'green' as RiskFlag);
}

// ---------------------------------------------------------------------------
// Feature 11: source disagreement
// ---------------------------------------------------------------------------
export type DisagreementThresholds = { wind_speed_kn: number; wind_dir_deg: number; light_air_floor_kn?: number };
export const DEFAULT_DISAGREEMENT_THRESHOLDS: DisagreementThresholds = { wind_speed_kn: 5, wind_dir_deg: 15, light_air_floor_kn: 8 };

export type DisagreementInput = {
  primarySource: string;
  primaryWindP50Kn: number | null;
  primaryWindDirDeg: number | null;
  comparisonSource: string;
  comparisonWindKn: number | null;
  comparisonWindDirDeg: number | null;
};

export type DisagreementResult = {
  disagreement: boolean;
  windSpeedDeltaKn: number | null;
  windDirDeltaDeg: number | null;
  detail: Record<string, unknown>;
};

export function sourceDisagreement(i: DisagreementInput, th: DisagreementThresholds = DEFAULT_DISAGREEMENT_THRESHOLDS): DisagreementResult {
  const floor = th.light_air_floor_kn ?? 8;
  const speedDelta = i.primaryWindP50Kn !== null && i.comparisonWindKn !== null
    ? Math.abs(i.primaryWindP50Kn - i.comparisonWindKn) : null;
  const dirDelta = i.primaryWindDirDeg !== null && i.comparisonWindDirDeg !== null
    ? angularDeltaDeg(i.primaryWindDirDeg, i.comparisonWindDirDeg) : null;
  const notLightAir = i.primaryWindP50Kn !== null && i.primaryWindP50Kn >= floor;
  const speedTrip = speedDelta !== null && speedDelta > th.wind_speed_kn;
  const dirTrip = dirDelta !== null && dirDelta > th.wind_dir_deg;
  // Direction is noise in light air: the whole rule is gated on p50 >= floor.
  const disagreement = notLightAir && (speedTrip || dirTrip);
  return {
    disagreement,
    windSpeedDeltaKn: speedDelta === null ? null : Math.round(speedDelta * 10) / 10,
    windDirDeltaDeg: dirDelta === null ? null : Math.round(dirDelta * 10) / 10,
    detail: {
      primary: { source: i.primarySource, wind_p50_kn: i.primaryWindP50Kn, wind_dir_deg: i.primaryWindDirDeg },
      comparison: { source: i.comparisonSource, wind_kn: i.comparisonWindKn, wind_dir_deg: i.comparisonWindDirDeg },
      thresholds: { ...th, light_air_floor_kn: floor },
      fired: { speed: speedTrip && notLightAir, direction: dirTrip && notLightAir, light_air_suppressed: !notLightAir && (speedTrip || dirTrip) },
    },
  };
}
