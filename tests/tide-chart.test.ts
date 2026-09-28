import { describe, expect, it } from 'vitest';
import { deriveTideExtremes, mergeExtremes, tideAt } from '../src/lib/tide.ts';

const H = 3_600_000;
const series = (heights: (number | null)[]) => heights.map((h, i) => ({ t: i * H, height: h }));

describe('tide extremes for the tide-only chart', () => {
  it('finds high and low water as local maxima and minima, never at the endpoints', () => {
    const s = series([1.0, 1.4, 1.9, 2.1, 1.8, 1.2, 0.6, 0.4, 0.7, 1.3, 1.9, 2.2, 2.0]);
    expect(deriveTideExtremes(s)).toEqual([{ t: 3 * H, height: 2.1, type: 'high' }, { t: 7 * H, height: 0.4, type: 'low' }, { t: 11 * H, height: 2.2, type: 'high' }]);
  });
  it('a flat top counts once, at its first sample', () => {
    const s = series([0.5, 1.0, 1.5, 1.5, 1.5, 1.0, 0.5]);
    expect(deriveTideExtremes(s)).toEqual([{ t: 2 * H, height: 1.5, type: 'high' }]);
  });
  it('nulls are skipped and unsorted input is sorted by time', () => {
    const s = [...series([1.0, 1.5, null, 1.2, 0.8, 0.3, 0.9])].reverse();
    expect(deriveTideExtremes(s)).toEqual([{ t: 5 * H, height: 0.3, type: 'low' }, { t: 1 * H, height: 1.5, type: 'high' }].sort((a, b) => a.t - b.t));
  });
  it('function-supplied extremes win over derived ones and are sorted', () => {
    const given = [{ t: 9 * H, height: 0.2, type: 'low' as const }, { t: 2 * H, height: 2.3, type: 'high' as const }];
    expect(mergeExtremes(given, [{ t: 0, height: 1, type: 'high' }]).map((e) => e.t)).toEqual([2 * H, 9 * H]);
    expect(mergeExtremes([], [{ t: 0, height: 1, type: 'high' }])).toHaveLength(1);
  });
  it('interpolates the height at a moment inside the series and returns null outside', () => {
    const s = series([1.0, 2.0, 1.0]);
    expect(tideAt(s, 0.5 * H)).toBe(1.5);
    expect(tideAt(s, 2 * H)).toBe(1.0);
    expect(tideAt(s, 3 * H)).toBeNull();
  });
});
