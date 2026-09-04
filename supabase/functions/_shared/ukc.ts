// Under-keel clearance estimate. PRD §7 step 6.
import type { UkcBasis } from './contracts.ts';

export const SQUAT_UNDERWAY_M = 0.3;

export type UkcInput = {
  draftM: number | null;
  chartedDepthM: number | null;
  tideHeightM: number | null;
  swellHeightM: number | null;
  isAnchorage: boolean;
};

export function ukcEstimate(i: UkcInput): { ukcEstimateM: number | null; basis: UkcBasis } {
  if (i.draftM === null || i.chartedDepthM === null || i.tideHeightM === null) {
    return { ukcEstimateM: null, basis: 'none' };
  }
  const squat = i.isAnchorage ? 0 : SQUAT_UNDERWAY_M;
  if (i.swellHeightM !== null) {
    const ukc = i.chartedDepthM + i.tideHeightM - i.draftM - i.swellHeightM / 2 - squat;
    return { ukcEstimateM: round2(ukc), basis: 'charted+tide+swell' };
  }
  const ukc = i.chartedDepthM + i.tideHeightM - i.draftM - squat;
  return { ukcEstimateM: round2(ukc), basis: 'charted+tide' };
}

const round2 = (v: number) => Math.round(v * 100) / 100;
