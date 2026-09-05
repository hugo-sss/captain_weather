import { describe, expect, it } from 'vitest';
import { confidenceForWaypoint, confidenceInWords, passageConfidence } from '../supabase/functions/_shared/confidence.ts';
import sevenDay from '../scripts/fixtures/seven-day-out-fixture.json';

const base = {
  leadTimeHours: 24, tropicalActivity: false, frontalActivity: false, complexCoastal: false,
  sourceDisagreement: false, windP10Kn: 10, windP90Kn: 14, dataGaps: [] as never[],
};

describe('confidence triggers (§8.2)', () => {
  it('starts high with nothing firing', () => {
    expect(confidenceForWaypoint(base)).toEqual({ level: 'high', triggers: [] });
  });
  it('7-day-out fixture is low with lead_time_gt_120h', () => {
    const r = confidenceForWaypoint({ ...base, leadTimeHours: sevenDay.lead_time_hours, windP10Kn: sevenDay.wind_p10_kn, windP90Kn: sevenDay.wind_p90_kn });
    expect(r.level).toBe(sevenDay.expect.confidence_level);
    expect(r.triggers).toEqual(sevenDay.expect.triggers);
    const words = confidenceInWords(r.level, r.triggers);
    expect(words.toLowerCase()).toContain('low');
    expect(words).toContain('beyond five days');
  });
  it('72..120 h caps at moderate', () => {
    expect(confidenceForWaypoint({ ...base, leadTimeHours: 100 })).toEqual({ level: 'moderate', triggers: ['lead_time_72_120h'] });
    expect(confidenceForWaypoint({ ...base, leadTimeHours: 72 }).level).toBe('high');
    expect(confidenceForWaypoint({ ...base, leadTimeHours: 120 }).level).toBe('moderate');
    expect(confidenceForWaypoint({ ...base, leadTimeHours: 120.5 }).level).toBe('low');
  });
  it('rule-based triggers beat a narrow spread: tropical forces low', () => {
    const r = confidenceForWaypoint({ ...base, tropicalActivity: true, windP10Kn: 10, windP90Kn: 11 });
    expect(r.level).toBe('low');
    expect(r.triggers).toContain('tropical_activity');
  });
  it('caps stack: complex coastal + disagreement + wide spread stays moderate', () => {
    const r = confidenceForWaypoint({ ...base, complexCoastal: true, sourceDisagreement: true, windP10Kn: 5, windP90Kn: 25 });
    expect(r.level).toBe('moderate');
    expect(r.triggers).toEqual(['complex_coastal', 'source_disagreement', 'wide_ensemble_spread']);
  });
  it('data gaps force low per layer', () => {
    const r = confidenceForWaypoint({ ...base, dataGaps: ['marine', 'tidal'] as never });
    expect(r.level).toBe('low');
    expect(r.triggers).toEqual(['no_data_marine', 'no_data_tidal']);
  });
  it('passage level is the lowest waypoint level', () => {
    expect(passageConfidence(['high', 'moderate', 'high'])).toBe('moderate');
    expect(passageConfidence(['high', 'low', 'moderate'])).toBe('low');
    expect(passageConfidence([])).toBe('low');
  });
});
