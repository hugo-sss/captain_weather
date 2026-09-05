import { describe, expect, it } from 'vitest';
import { materialChanges, type CondForDiff } from '../supabase/functions/_shared/material-changes.ts';
import { confidenceStated, ensureConfidenceStated } from '../supabase/functions/_shared/briefing.ts';

const c = (o: Partial<CondForDiff>): CondForDiff => ({ waypoint_id: 'a', risk_flag: 'green', source_disagreement: false, confidence_level: 'high', wind_p90_kn: 18, wave_height_m: 1.0, tide_height_m: 1.2, ...o });

describe('material changes (Feature 12)', () => {
  it('unchanged forecasts produce an empty list', () => {
    expect(materialChanges([c({}), c({ waypoint_id: 'b' })], [c({}), c({ waypoint_id: 'b' })])).toEqual([]);
  });
  it('one leg raised above the vessel limit produces exactly one entry', () => {
    const out = materialChanges([c({}), c({ waypoint_id: 'b' })], [c({}), c({ waypoint_id: 'b', risk_flag: 'red' })], { b: { sequence: 2, name: 'B', is_anchorage: false } });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ waypoint_id: 'b', sequence: 2, field: 'risk_flag', from: 'green', to: 'red' });
  });
  it('improvements are not material; small moves are not material; ETA-only moves are ignored', () => {
    expect(materialChanges([c({ risk_flag: 'red' })], [c({ risk_flag: 'green' })])).toEqual([]);
    expect(materialChanges([c({})], [c({ wind_p90_kn: 22.5, wave_height_m: 1.4 })])).toEqual([]);
  });
  it('wind, wave, disagreement, confidence and anchorage tide thresholds', () => {
    const out = materialChanges([c({})], [c({ wind_p90_kn: 24, wave_height_m: 1.6, source_disagreement: true, confidence_level: 'moderate', tide_height_m: 0.8 })], { a: { sequence: 1, name: 'A', is_anchorage: true } });
    expect(out.map((x) => x.field).sort()).toEqual(['confidence_level', 'source_disagreement', 'tide_height_m', 'wave_height_m', 'wind_p90_kn']);
    const notAnch = materialChanges([c({})], [c({ tide_height_m: 0.8 })], { a: { sequence: 1, name: 'A', is_anchorage: false } });
    expect(notAnch).toEqual([]);
  });
});

describe('confidence stated in the first two sentences', () => {
  it('accepts a statement in sentence one or two and rejects a late one', () => {
    expect(confidenceStated('Winds are light. Confidence in this briefing is low because of lead time. More text.', 'low')).toBe(true);
    expect(confidenceStated('Winds are light. Seas are slight. Confidence is low.', 'low')).toBe(false);
    expect(confidenceStated('Anything.', 'high')).toBe(true);
  });
  it('prepends the rule-based statement when missing', () => {
    const r = ensureConfidenceStated('Winds are light.', 'low', 'Confidence in this briefing is low because X.');
    expect(r.prepended).toBe(true);
    expect(r.text.startsWith('Confidence in this briefing is low')).toBe(true);
    expect(ensureConfidenceStated(r.text, 'low', '').prepended).toBe(false);
  });
});
