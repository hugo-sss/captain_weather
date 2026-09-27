import { describe, expect, it } from 'vitest';
import { agePhrase, compassWord, confidencePhrase, currentPhrase, dayPartPhrase, distancePhrase, durationPhrase, etaPhrase, keyNumber, relativePhrase, riskHeadline, seaPhrase, sourceName, squallPhrase, statusWord, tidePhrase, whenPhrase, windPhrase, worstStretch, type HeadlineCondition, type HeadlineLeg, type HeadlineWaypoint } from '../src/lib/plain.ts';
import { BANNED_PATTERNS, findViolations } from '../supabase/functions/_shared/language-rules.ts';

const OFF = 420; // UTC+07, Phuket
const NOW = Date.parse('2026-09-04T05:00:00Z'); // Fri 4 Sep 12:00 local

describe('condition phrases', () => {
  it('wind: range with "to", compass word, gusts only when higher', () => {
    expect(windPhrase(12, 18, 270, 24)).toBe('12 to 18 kn from the west, gusts to 24');
    expect(windPhrase(12, 12, 45, 12)).toBe('12 kn from the north-east');
    expect(windPhrase(12, null, null, null)).toBe('12 kn');
    expect(windPhrase(null, 18, 270, 24)).toBeNull();
    expect(windPhrase('16', '23', '250', '38')).toBe('16 to 23 kn from the west, gusts to 38');
  });
  it('sea, tide, current', () => {
    expect(seaPhrase(1.1, 7, 0.8, 225)).toBe('1.1 m sea at 7 s, 0.8 m swell from the south-west');
    expect(seaPhrase(1.1, null, null, null)).toBe('1.1 m sea');
    expect(seaPhrase(null, null, 0.8, 180)).toBe('0.8 m swell from the south');
    expect(seaPhrase(null, null, null, null)).toBeNull();
    expect(tidePhrase(2.0, 'LAT', 'flood')).toBe('2.0 m above LAT, rising');
    expect(tidePhrase(0.62, 'LAT', 'ebb')).toBe('0.6 m above LAT, falling');
    expect(tidePhrase(-0.3, 'CD', 'low')).toBe('0.3 m below CD, low water');
    expect(tidePhrase(null, 'LAT', 'ebb')).toBeNull();
    expect(currentPhrase(0.3, 45)).toBe('0.3 kn setting north-east');
    expect(currentPhrase(1.1, 35)).toBe('1.1 kn setting north-east');
    expect(currentPhrase(0.0, 35)).toBe('slack, under 0.1 kn');
    expect(currentPhrase(null, 35)).toBeNull();
  });
  it('compass words cover all eight points and wrap', () => {
    expect([0, 45, 90, 135, 180, 225, 270, 315, 360, 359, -10].map(compassWord)).toEqual(['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west', 'north', 'north', 'north']);
    expect(compassWord(null)).toBeNull();
  });
  it('squall and status words', () => {
    expect(squallPhrase('likely')).toBe('Likely');
    expect(squallPhrase('none')).toBe('None expected');
    expect(statusWord('active')).toBe('Underway');
    expect(statusWord('planned')).toBe('Planned');
    expect(statusWord('completed')).toBe('Completed');
  });
});

describe('confidence phrase', () => {
  it('maps triggers to short reasons', () => {
    expect(confidencePhrase('high', [])).toBe('High confidence');
    expect(confidencePhrase('moderate', ['source_disagreement'], 'Ko Ha')).toBe('Moderate confidence: models disagree at Ko Ha');
    expect(confidencePhrase('low', ['no_data_marine', 'lead_time_gt_120h'])).toBe('Low confidence: no sea state data, more than five days out');
    expect(confidencePhrase('moderate', ['wide_ensemble_spread', 'wide_ensemble_spread'])).toBe('Moderate confidence: wide forecast spread');
  });
});

describe('time phrases', () => {
  it('absolute local, relative and auto', () => {
    expect(whenPhrase('2026-09-10T11:30:00Z', OFF, NOW)).toBe('Thu 10 Sep, 18:30 local');
    expect(whenPhrase('2026-09-07T05:00:00Z', OFF, NOW, 'relative')).toBe('in 3 days');
    expect(whenPhrase('2026-09-04T03:00:00Z', OFF, NOW, 'relative')).toBe('2 hours ago');
    expect(whenPhrase('2026-09-04T03:00:00Z', OFF, NOW, 'auto')).toBe('2 hours ago');
    expect(whenPhrase('2026-09-10T11:30:00Z', OFF, NOW, 'auto')).toBe('Thu 10 Sep, 18:30 local');
    expect(relativePhrase('2026-09-04T05:00:30Z', NOW)).toBe('just now');
    expect(relativePhrase('2026-09-04T05:40:00Z', NOW)).toBe('in 40 min');
    expect(agePhrase('2026-09-04T04:12:00Z', NOW)).toBe('48 min ago');
    expect(agePhrase('2026-09-02T05:00:00Z', NOW)).toBe('2 days ago');
    expect(whenPhrase(null, OFF, NOW)).toBeNull();
  });
  it('day parts relative to today', () => {
    expect(dayPartPhrase('2026-09-04T08:00:00Z', OFF, NOW)).toBe('this afternoon');
    expect(dayPartPhrase('2026-09-04T16:00:00Z', OFF, NOW)).toBe('tonight');
    expect(dayPartPhrase('2026-09-05T01:00:00Z', OFF, NOW)).toBe('tomorrow morning');
    expect(dayPartPhrase('2026-09-07T10:00:00Z', OFF, NOW)).toBe('on Monday evening');
    expect(dayPartPhrase('2026-09-20T10:00:00Z', OFF, NOW)).toBe('on Sun 20 Sep');
  });
  it('eta and durations', () => {
    expect(etaPhrase('2026-09-05T02:40:00Z', '2026-09-05T02:24:00Z', OFF)).toBe('Arrive Sat 5 Sep, 09:40 local (16 min later than planned, sea state)');
    expect(etaPhrase('2026-09-05T02:40:00Z', '2026-09-05T03:50:00Z', OFF)).toBe('Arrive Sat 5 Sep, 09:40 local (1 h 10 min earlier than planned, sea state)');
    expect(etaPhrase('2026-09-05T02:40:00Z', null, OFF)).toBe('Arrive Sat 5 Sep, 09:40 local');
    expect(durationPhrase(19.87)).toBe('19 h 52 min');
    expect(durationPhrase(3)).toBe('3 h');
    expect(durationPhrase(0.75)).toBe('45 min');
    expect(distancePhrase(70.4)).toBe('70 nm');
    expect(distancePhrase(7.44)).toBe('7.4 nm');
  });
});

const wps: HeadlineWaypoint[] = [
  { id: 'w1', name: 'Ao Chalong', sequence: 1 }, { id: 'w2', name: 'Ko Racha Yai', sequence: 2 }, { id: 'w3', name: 'Ko Phi Phi Don', sequence: 3 }, { id: 'w4', name: 'Ko Ha', sequence: 4 }, { id: 'w5', name: 'Ao Kantiang', sequence: 5 },
];
const cond = (id: string, risk: string, reasons: string[] = [], extra: Partial<HeadlineCondition> = {}): HeadlineCondition => ({ waypoint_id: id, risk_flag: risk, risk_reasons: reasons, eta: '2026-09-04T08:00:00Z', ...extra });
const leg = (toId: string, worstRisk: HeadlineLeg['summary']['worstRisk'], point: Partial<NonNullable<HeadlineLeg['summary']['worstPoint']>> | null = null): HeadlineLeg => ({ toId, summary: { worstRisk, worstPoint: point ? { risk: worstRisk, riskReasons: [], eta: '2026-09-04T10:00:00Z', gustP90: null, windP90: null, waveHs: null, ...point } : null } });

describe('risk headline', () => {
  const outputs: string[] = [];
  const headline = (c: HeadlineCondition[], l: HeadlineLeg[]) => { const s = riskHeadline(c, l, wps, { utcOffsetMin: OFF, nowMs: NOW }); outputs.push(s); return s; };

  it('not checked, all green, some no data', () => {
    expect(headline([], [])).toBe('Not checked yet.');
    expect(headline(wps.map((w) => cond(w.id, 'green')), [])).toBe('Conditions look manageable for the whole passage.');
    expect(headline([cond('w1', 'green'), cond('w2', 'green'), cond('w5', 'unknown')], [])).toBe('Conditions look manageable where there is data; no data at Ao Kantiang.');
    expect(headline([cond('w1', 'unknown'), cond('w2', 'unknown')], [])).toBe('No forecast data for this route yet.');
  });
  it('one amber stretch names the place, the time of day and the key number', () => {
    expect(headline([cond('w1', 'green'), cond('w4', 'amber', ['gust p90 29 kn > 0.75 x max_gust 35 kn'], { gust_p90_kn: 29 })], []))
      .toBe('One stretch to watch: Ko Ha, amber this afternoon (gusts to 29 kn).');
    expect(headline([cond('w3', 'amber', ['wind p90 22 kn > 0.75 x max_wind 25 kn'], { wind_p90_kn: 22, eta: '2026-09-07T11:00:00Z' })], []))
      .toBe('One stretch to watch: Ko Phi Phi Don, amber on Monday evening (wind to 22 kn).');
  });
  it('several amber, one red, several red', () => {
    expect(headline([cond('w3', 'amber'), cond('w4', 'amber')], [])).toBe('Two stretches to watch: Ko Phi Phi Don and Ko Ha.');
    expect(headline([cond('w3', 'amber'), cond('w4', 'red', ['gust p90 38 kn > max_gust 35 kn', 'wave 2.3 m > max_wave 2 m'], { gust_p90_kn: 38, wave_height_m: 2.3 })], []))
      .toBe('One leg exceeds your limits: Ko Ha, red this afternoon (gusts to 38 kn).');
    expect(headline([cond('w3', 'red'), cond('w4', 'red')], [])).toBe('Two legs exceed your limits: Ko Phi Phi Don and Ko Ha.');
    expect(headline([cond('w2', 'red'), cond('w3', 'red'), cond('w4', 'red'), cond('w5', 'red')], [])).toBe('Four legs exceed your limits: Ko Racha Yai, Ko Phi Phi Don and Ko Ha and 1 more.');
  });
  it('along-leg points can be worse than the waypoint', () => {
    expect(headline([cond('w3', 'green'), cond('w4', 'green')], [leg('w4', 'amber', { riskReasons: ['wind p90 24 kn > 0.75 x max_wind 25 kn'], windP90: 24 })]))
      .toBe('One stretch to watch: Ko Ha, amber this evening (wind to 24 kn).');
    const w = worstStretch([cond('w3', 'green'), cond('w4', 'green')], [leg('w4', 'red', { riskReasons: ['wave 2.4 m > max_wave 2 m'], waveHs: 2.4 })], wps);
    expect(w).toMatchObject({ name: 'Ko Ha', risk: 'red', number: '2.4 m sea' });
  });
  it('key number picks the figure behind the reason', () => {
    expect(keyNumber({ reasons: ['UKC estimate 0.8 m < min_ukc 1 m'], gust: 30, wind: 20, wave: 1, ukc: 0.8, current: null })).toBe('0.8 m under the keel');
    expect(keyNumber({ reasons: ['squall likely: CAPE 1350 J/kg'], gust: null, wind: null, wave: null, ukc: null, current: null })).toBe('squalls likely');
    expect(keyNumber({ reasons: [], gust: null, wind: null, wave: null, ukc: null, current: null })).toBeNull();
  });
  it('never uses advisory language or dashes', () => {
    expect(BANNED_PATTERNS.length).toBeGreaterThan(0);
    for (const s of outputs) {
      expect(findViolations(s), s).toEqual([]);
      expect(s, s).not.toMatch(/[–—]/);
      expect(s).not.toMatch(/\bsafe\b|\bshould\b|go\/no-go/i);
    }
    const more = [windPhrase(12, 18, 270, 24), seaPhrase(1.1, 7, 0.8, 225), tidePhrase(2, 'LAT', 'flood'), currentPhrase(0.3, 45), confidencePhrase('low', ['no_data_marine', 'source_disagreement'], 'Ko Ha'), etaPhrase('2026-09-05T02:40:00Z', '2026-09-05T02:24:00Z', OFF), whenPhrase('2026-09-10T11:30:00Z', OFF, NOW), sourceName('google_weathernext2_ensemble')];
    for (const s of more) { expect(s).not.toBeNull(); expect(findViolations(s as string)).toEqual([]); expect(s).not.toMatch(/[–—]/); }
  });
});
