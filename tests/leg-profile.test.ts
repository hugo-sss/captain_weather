import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED_LOSS, legSampleFractions, normaliseDashes, seaSector, speedLossPct, squallRisk, worstRisk } from '../supabase/functions/_shared/leg-profile.ts';

describe('seaSector', () => {
  it('classifies waves from ahead as head seas and from astern as following', () => {
    expect(seaSector(0, 0)).toBe('head');
    expect(seaSector(30, 0)).toBe('head');
    expect(seaSector(90, 0)).toBe('beam');
    expect(seaSector(180, 0)).toBe('follow');
    expect(seaSector(350, 10)).toBe('head'); // wraps across north
  });
  it('treats an unknown wave direction as beam', () => {
    expect(seaSector(null, 45)).toBe('beam');
  });
});

describe('speedLossPct', () => {
  it('is zero in flat water and capped at the configured maximum', () => {
    expect(speedLossPct(0, 0, 0)).toBe(0);
    expect(speedLossPct(null, 0, 0)).toBe(0);
    expect(speedLossPct(6, 0, 0)).toBe(33); // beyond the curve holds the last point
    expect(speedLossPct(6, 0, 0, { ...DEFAULT_SPEED_LOSS, max_loss_pct: 20 })).toBe(20);
  });
  it('interpolates between curve points and scales below the first', () => {
    expect(speedLossPct(1.25, 0, 0)).toBe(9); // between 1.0 (6) and 1.5 (12)
    expect(speedLossPct(0.25, 0, 0)).toBe(1); // half of the 0.5 m point
  });
  it('costs more into head seas than following seas', () => {
    expect(speedLossPct(2, 0, 0)).toBeGreaterThan(speedLossPct(2, 180, 0));
    expect(speedLossPct(2, 90, 0)).toBe(9);
  });
});

describe('squallRisk', () => {
  it('needs both CAPE and precipitation probability for likely', () => {
    expect(squallRisk(1500, 60)).toBe('likely');
    expect(squallRisk(1500, 10)).toBe('possible');
    expect(squallRisk(200, 80)).toBe('none');
    expect(squallRisk(300, 50)).toBe('possible'); // half the possible CAPE with wet probability
    expect(squallRisk(null, 90)).toBe('none');
  });
});

describe('legSampleFractions', () => {
  it('returns interior points about every six hours, never the endpoints', () => {
    expect(legSampleFractions(3)).toEqual([]);
    expect(legSampleFractions(12)).toEqual([0.5]);
    expect(legSampleFractions(43.5)).toEqual([0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875]);
    expect(legSampleFractions(43.5).every((f) => f > 0 && f < 1)).toBe(true);
  });
  it('caps the number of points on very long legs', () => {
    expect(legSampleFractions(400).length).toBe(11);
  });
});

describe('normaliseDashes', () => {
  it('turns numeric ranges into "to" and other dashes into commas', () => {
    expect(normaliseDashes('winds 6–9 kn from 273°T')).toBe('winds 6 to 9 kn from 273°T');
    expect(normaliseDashes('GFS runs stronger here — 12.3 kn from 291°')).toBe('GFS runs stronger here, 12.3 kn from 291°');
    expect(normaliseDashes('no dashes here')).toBe('no dashes here');
  });
});

describe('worstRisk', () => {
  it('orders red above amber above unknown above green', () => {
    expect(worstRisk(['green', 'green'])).toBe('green');
    expect(worstRisk(['green', 'unknown'])).toBe('unknown');
    expect(worstRisk(['amber', 'unknown'])).toBe('amber');
    expect(worstRisk(['amber', 'red', 'green'])).toBe('red');
    expect(worstRisk([])).toBe('green');
  });
});
