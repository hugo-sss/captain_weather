import { describe, expect, it } from 'vitest';
import { BRIEFING_OUTPUT_SCHEMA, buildBriefingInput, finalizeBriefing, parseBriefingOutput, retryTurn, stableStringify, systemPrompt, validateBriefing, type BriefingLeg } from '../supabase/functions/_shared/briefing.ts';
import { STANDING_STATEMENT, BANNED_PATTERNS } from '../supabase/functions/_shared/language-rules.ts';
import sevenDay from '../scripts/fixtures/seven-day-out-fixture.json';

const leg = (over: Partial<BriefingLeg>): BriefingLeg => ({
  sequence: 1, name: 'A', eta: '2026-09-10T00:00:00Z', lead_time_hours: 24,
  wind: { p10: 8, p50: 12, p90: 16, dir: 200, gust_p90: 20 },
  comparison: { source: 'ncep_gfs_global', wind: 13, dir: 205, delta_speed: 1, delta_dir: 5, disagreement: false },
  sea: { wave: 0.8, wave_dir: 210, period: 6, swell: 0.6, swell_dir: 220, swell_period: 9 },
  tide: { height: 1.2, state: 'flood', datum: 'CD' }, current: { speed: 0.4, sets_toward: 45 }, ukc: { estimate: 3.1, basis: 'charted+tide+swell' },
  risk_flag: 'green', risk_reasons: [], confidence_level: 'high', confidence_triggers: [], ...over,
});

describe('briefing contract (§8.5)', () => {
  it('passage confidence is the lowest leg and the 7-day-out fixture yields low, in words', () => {
    const input = buildBriefingInput({ passageName: 'P', departure: '2026-09-10T00:00:00Z', vesselName: 'V', thresholds: { max_wind_kn: 30 }, scope: 'full',
      legs: [leg({}), leg({ sequence: 2, lead_time_hours: sevenDay.lead_time_hours, confidence_level: 'low', confidence_triggers: ['lead_time_gt_120h'] })] });
    expect(input.confidence_level).toBe('low');
    expect(input.confidence_triggers).toEqual(['lead_time_gt_120h']);
    expect(input.confidence_statement).toMatch(/Confidence in this briefing is low because the forecast lead time is beyond five days/);
  });
  it('the system prompt carries the banned list, the confidence rule and does not ask the model to add SOLAS', () => {
    const sp = systemPrompt('v1');
    expect(sp).toContain('go/no-go');
    expect(sp).toContain('first two sentences');
    expect(sp).toContain('Do not append the SOLAS statement yourself');
    expect(sp).toContain('FROM');
    expect(sp).toContain('TOWARD');
  });
  it('the system prompt itself only mentions banned phrases inside the prohibition line', () => {
    // Sanity: the prompt is not run through the validator, but make sure the allowed-framing lines are clean.
    const allowedLines = systemPrompt().split('\n').filter((l) => l.startsWith('- Allowed framing'));
    for (const l of allowedLines) for (const re of BANNED_PATTERNS) expect(re.test(l)).toBe(false);
  });
  it('schema requires every field and forbids extras', () => {
    expect(BRIEFING_OUTPUT_SCHEMA.required).toContain('disagreement_notes');
    expect(BRIEFING_OUTPUT_SCHEMA.additionalProperties).toBe(false);
  });
  it('parses, validates and fails closed on a banned phrase', () => {
    const bad = parseBriefingOutput(JSON.stringify({ summary_text: 'Conditions suggest 12 kn. It is safe to depart.', recommended_action: 'Consider', per_leg_notes: [], suggested_departure_windows: [], disagreement_notes: null }));
    expect(bad.ok).toBe(true);
    if (!bad.ok) return;
    const v = validateBriefing(bad.output);
    expect(v.length).toBeGreaterThanOrEqual(1); // "safe to depart" and "it is safe" both fire
    expect(v.every((x) => x.path === '$.summary_text')).toBe(true);
    expect(retryTurn(v)).toContain('"safe to depart"');
  });
  it('finalize appends the standing statement exactly once, by code', () => {
    const out = finalizeBriefing({ summary_text: 'Conditions suggest a quiet crossing.', recommended_action: 'Cross-check the tide table.', per_leg_notes: [], suggested_departure_windows: [], disagreement_notes: null });
    expect(out.summary_text.endsWith(STANDING_STATEMENT)).toBe(true);
    expect(finalizeBriefing(out).summary_text).toBe(out.summary_text);
  });
  it('rejects non-JSON and non-object output', () => {
    expect(parseBriefingOutput('not json').ok).toBe(false);
    expect(parseBriefingOutput('[1]').ok).toBe(false);
  });
  it('stableStringify is key-order independent', () => {
    expect(stableStringify({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(stableStringify({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
});
