import { describe, expect, it } from 'vitest';
import { STANDING_STATEMENT, appendStandingStatement, findViolations, validateBriefingText } from '../supabase/functions/_shared/language-rules.ts';

describe('banned phrases (§8.3)', () => {
  const banned = [
    'It is safe to depart at 0600.', 'You should go now.', 'This is a go/no-go call.', 'Go / no go: go.',
    'It is unsafe tonight.', 'You have a green light.', 'All clear for the crossing.', 'We recommend you depart early.',
    'We recommend depart tomorrow.', 'Do not sail tonight.', 'You must wait for the front.', 'SAFE TO PROCEED.',
  ];
  for (const s of banned) it(`flags: ${s}`, () => expect(findViolations(s).length).toBeGreaterThan(0));

  const allowed = [
    'Conditions suggest a moderate sea state on leg 2.', 'The ensemble indicates 18 to 26 kn from the south-west.',
    'This leg carries elevated risk based on forecast data.', 'Consider the tide gate at Phi Phi; worth cross-checking against the official tables.',
    'Departure before 0600 avoids the strongest gusts; the master should verify this against official forecasts.',
  ];
  for (const s of allowed) it(`allows: ${s}`, () => expect(findViolations(s)).toEqual([]));

  it('walks every text field of a structured briefing', () => {
    const v = validateBriefingText({ summary_text: 'Conditions suggest fine.', per_leg_notes: [{ sequence: 2, note: 'safe to sail' }], disagreement_notes: null });
    expect(v).toHaveLength(1);
    expect(v[0].path).toBe('$.per_leg_notes[0].note');
  });
});

describe('standing statement (§8.3)', () => {
  it('is appended by code and idempotent', () => {
    const once = appendStandingStatement('Summary.');
    expect(once.endsWith(STANDING_STATEMENT)).toBe(true);
    expect(appendStandingStatement(once)).toBe(once);
  });
  it('mentions SOLAS Chapter V Regulation 34', () => {
    expect(STANDING_STATEMENT).toMatch(/SOLAS Chapter V Regulation 34/);
  });
});
