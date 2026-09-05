import { describe, expect, it } from 'vitest';
import { departureWindows, windRose, type HourSample } from '../supabase/functions/_shared/departure-windows.ts';

const t = { max_wind_kn: 30, max_gust_kn: 40, max_wave_m: 2, max_current_kn: null, min_ukc_m: null };
const h = (i: number, p90: number, extra: Partial<HourSample> = {}): HourSample => ({ time: new Date(Date.UTC(2026, 8, 10, i)).toISOString(), wind_p90_kn: p90, wind_p50_kn: p90 - 4, gust_p90_kn: p90 + 5, wave_height_m: 0.8, disagreement: false, ...extra });

describe('departure windows (data-derived hint)', () => {
  it('finds contiguous quiet hours of at least 3 h', () => {
    const s = [h(0, 15), h(1, 16), h(2, 18), h(3, 30), h(4, 12), h(5, 12), h(6, 14), h(7, 14), h(8, 40)];
    const w = departureWindows(s, t);
    expect(w).toHaveLength(2);
    expect(w[0].hours).toBe(3);
    expect(w[1].hours).toBe(4);
    expect(w[1].start).toBe(h(4, 0).time);
  });
  it('a disagreement hour or a data gap breaks a window; missing thresholds skip that rule', () => {
    const s = [h(0, 10), h(1, 10, { disagreement: true }), h(2, 10), h(3, 10), h(4, 10)];
    expect(departureWindows(s, t)).toHaveLength(1);
    expect(departureWindows([h(0, 10), h(1, 10, { wind_p90_kn: null }), h(2, 10)], t)).toHaveLength(0);
    expect(departureWindows([h(0, 25), h(1, 25), h(2, 25)], { ...t, max_wind_kn: null })).toHaveLength(1);
  });
});

describe('wind rose binning', () => {
  it('bins into 16 sectors with mean and max speed', () => {
    const r = windRose([{ dir_deg: 350, speed_kn: 10 }, { dir_deg: 10, speed_kn: 14 }, { dir_deg: 90, speed_kn: 20 }, { dir_deg: null, speed_kn: 5 }]);
    expect(r).toHaveLength(16);
    expect(r[0].hours).toBe(2);
    expect(r[0].mean_speed_kn).toBe(12);
    expect(r[0].max_speed_kn).toBe(14);
    expect(r[4].label).toBe('E');
    expect(r[4].hours).toBe(1);
  });
});
