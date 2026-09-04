import { describe, expect, it } from 'vitest';
import { riskFlag, sourceDisagreement, worstRisk, type VesselThresholds } from '../supabase/functions/_shared/risk.ts';
import { ukcEstimate } from '../supabase/functions/_shared/ukc.ts';
import divergence from '../scripts/fixtures/divergence-fixture.json';

const vessel: VesselThresholds = { max_wind_kn: 30, max_gust_kn: 40, max_wave_m: 2.0, max_current_kn: 3, min_ukc_m: 1.0 };
const calm = { windP50Kn: 10, windP90Kn: 14, gustP90Kn: 18, waveHeightM: 0.8, currentSpeedKn: 0.5, ukcEstimateM: 5, sourceDisagreement: false, atmosphericGap: false };

describe('risk flag (§7 step 7)', () => {
  it('green when everything is inside limits', () => {
    expect(riskFlag(calm, vessel)).toEqual({ flag: 'green', reasons: [] });
  });
  it('red when p50 wind exceeds the limit, with the rule in words', () => {
    const r = riskFlag({ ...calm, windP50Kn: 31 }, vessel);
    expect(r.flag).toBe('red');
    expect(r.reasons[0]).toMatch(/wind p50 31 kn > max_wind 30 kn/);
  });
  it('amber when p90 wind exceeds 0.75 × limit', () => {
    const r = riskFlag({ ...calm, windP90Kn: 23 }, vessel);
    expect(r.flag).toBe('amber');
    expect(r.reasons[0]).toMatch(/wind p90 23 kn > 0.75×max_wind 30 kn/);
    expect(riskFlag({ ...calm, windP90Kn: 22 }, vessel).flag).toBe('green');
  });
  it('editing max_wave_m changes the flag on the affected leg and nothing else (Feature 9)', () => {
    const legs = [{ ...calm, waveHeightM: 0.8 }, { ...calm, waveHeightM: 1.8 }, { ...calm, waveHeightM: 1.0 }];
    const before = legs.map((l) => riskFlag(l, vessel).flag);
    const after = legs.map((l) => riskFlag(l, { ...vessel, max_wave_m: 1.5 }).flag);
    expect(before).toEqual(['green', 'amber', 'green']);
    expect(after).toEqual(['green', 'red', 'green']);
  });
  it('a missing threshold skips that rule and never guesses', () => {
    expect(riskFlag({ ...calm, waveHeightM: 4 }, { ...vessel, max_wave_m: null }).flag).toBe('green');
  });
  it('disagreement alone is amber; UKC below minimum is red; unknown when atmospheric is a gap', () => {
    expect(riskFlag({ ...calm, sourceDisagreement: true }, vessel).flag).toBe('amber');
    expect(riskFlag({ ...calm, ukcEstimateM: 0.9 }, vessel).flag).toBe('red');
    expect(riskFlag({ ...calm, ukcEstimateM: 1.2 }, vessel).flag).toBe('amber');
    expect(riskFlag({ ...calm, windP50Kn: null, windP90Kn: null, gustP90Kn: null, atmosphericGap: true }, vessel).flag).toBe('unknown');
  });
  it('worstRisk ranks red > amber > unknown > green', () => {
    expect(worstRisk(['green', 'unknown', 'amber'])).toBe('amber');
    expect(worstRisk(['green', 'red', 'amber'])).toBe('red');
    expect(worstRisk(['green', 'unknown'])).toBe('unknown');
  });
});

describe('UKC estimate (§7 step 6)', () => {
  it('charted+tide+swell with squat underway', () => {
    expect(ukcEstimate({ draftM: 2.5, chartedDepthM: 5, tideHeightM: 1.2, swellHeightM: 1.0, isAnchorage: false }))
      .toEqual({ ukcEstimateM: 2.9, basis: 'charted+tide+swell' });
  });
  it('no squat at an anchorage; charted+tide when swell missing', () => {
    expect(ukcEstimate({ draftM: 2.5, chartedDepthM: 5, tideHeightM: 1.2, swellHeightM: null, isAnchorage: true }))
      .toEqual({ ukcEstimateM: 3.7, basis: 'charted+tide' });
    expect(ukcEstimate({ draftM: 2.5, chartedDepthM: 5, tideHeightM: 1.2, swellHeightM: null, isAnchorage: false }))
      .toEqual({ ukcEstimateM: 3.4, basis: 'charted+tide' });
  });
  it('none when draft, depth or tide is missing', () => {
    expect(ukcEstimate({ draftM: null, chartedDepthM: 5, tideHeightM: 1, swellHeightM: 1, isAnchorage: false })).toEqual({ ukcEstimateM: null, basis: 'none' });
    expect(ukcEstimate({ draftM: 2, chartedDepthM: 5, tideHeightM: null, swellHeightM: 1, isAnchorage: false })).toEqual({ ukcEstimateM: null, basis: 'none' });
  });
});

describe('source disagreement (Feature 11)', () => {
  for (const c of divergence.cases) {
    it(c.name, () => {
      const r = sourceDisagreement({
        primarySource: 'google_weathernext2_ensemble', primaryWindP50Kn: c.primary.wind_p50_kn, primaryWindDirDeg: c.primary.wind_dir_deg,
        comparisonSource: 'ncep_gfs_global', comparisonWindKn: c.comparison.wind_kn, comparisonWindDirDeg: c.comparison.wind_dir_deg,
      }, divergence.thresholds);
      expect(r.disagreement).toBe(c.expect);
    });
  }
  it('records deltas and the thresholds used', () => {
    const r = sourceDisagreement({ primarySource: 'p', primaryWindP50Kn: 15, primaryWindDirDeg: 200, comparisonSource: 'c', comparisonWindKn: 15, comparisonWindDirDeg: 220 });
    expect(r.windDirDeltaDeg).toBe(20);
    expect(r.windSpeedDeltaKn).toBe(0);
    expect((r.detail.thresholds as { wind_dir_deg: number }).wind_dir_deg).toBe(15);
  });
});
