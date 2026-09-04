import { describe, expect, it } from 'vitest';
import { angularDeltaDeg, circularInterpolateDeg, circularMeanDeg, circularRangeDeg, circularStdDevDeg, p10, p50, p90, percentile } from '../supabase/functions/_shared/stats.ts';

describe('percentiles', () => {
  it('type-7 linear interpolation', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(p10(v)).toBeCloseTo(1.9, 6);
    expect(p50(v)).toBeCloseTo(5.5, 6);
    expect(p90(v)).toBeCloseTo(9.1, 6);
    expect(percentile([], 0.5)).toBeNull();
    expect(percentile([7], 0.9)).toBe(7);
  });
  it('ignores non-finite members', () => {
    expect(p50([1, NaN, 3])).toBe(2);
  });
});

describe('circular statistics', () => {
  it('350 and 10 average to 0, not 180', () => {
    expect(circularMeanDeg([350, 10])).toBeCloseTo(0, 6);
    expect(p50([350, 10])).toBe(180); // exactly why direction never uses percentiles
  });
  it('identical directions have zero spread', () => {
    expect(circularStdDevDeg([90, 90, 90])).toBeCloseTo(0, 6);
  });
  it('spread grows with scatter', () => {
    const tight = circularStdDevDeg([85, 90, 95])!;
    const wide = circularStdDevDeg([30, 90, 150])!;
    expect(tight).toBeLessThan(10);
    expect(wide).toBeGreaterThan(tight);
  });
  it('fully opposed directions have no mean', () => {
    expect(circularMeanDeg([0, 180])).toBeNull();
  });
  it('angular delta mirrors the SQL helper', () => {
    expect(angularDeltaDeg(350, 10)).toBe(20);
    expect(angularDeltaDeg(10, 350)).toBe(20);
    expect(angularDeltaDeg(0, 180)).toBe(180);
    expect(angularDeltaDeg(200, 220)).toBe(20);
  });
  it('interpolates along the short arc', () => {
    expect(circularInterpolateDeg(350, 10, 0.5)).toBeCloseTo(0, 6);
    expect(circularInterpolateDeg(10, 350, 0.25)).toBeCloseTo(5, 6);
  });
  it('range is the smallest containing arc', () => {
    expect(circularRangeDeg([350, 10])).toBe(20);
    expect(circularRangeDeg([0, 90, 180])).toBe(180);
    expect(circularRangeDeg([45])).toBe(0);
  });
});
