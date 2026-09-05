import { describe, expect, it } from 'vitest';
import { cellKey, gridForView, gridPoints, MAX_GRID_POINTS, spacingFor, toGridXY, type Bounds } from '../src/lib/weather-browse/grid.ts';
import { bilinear, buildScalarGrid, buildVectorGrid, fromUV, sampleCells, sampleScalar, toUV } from '../src/lib/weather-browse/field.ts';
import { buildLut, rampColor, RAMPS } from '../src/lib/weather-browse/ramps.ts';
import { asArray, deriveRun, forecastBulkUrl, marineBulkUrl, mergeCells, pointCacheKey, pointForecastUrl, radarTileUrl } from '../src/lib/weather-browse/openMeteo.ts';
import { FixtureBrowseSource, synthWind } from '../src/lib/weather-browse/fixtures.ts';
import { WIND_RAMP } from '../src/lib/risk-colors.ts';
import type { CellForecast } from '../src/lib/weather-browse/types.ts';

const PHUKET: Bounds = { south: 7.0, west: 97.6, north: 8.6, east: 99.4 };

describe('grid sampling', () => {
  it('keeps the viewport at roughly 18 x 16 cells and never over the cap', () => {
    for (const [b, z] of [[PHUKET, 8], [{ south: 7.6, west: 98.2, north: 7.9, east: 98.6 }, 11], [{ south: -20, west: 60, north: 30, east: 120 }, 4], [{ south: 7.78, west: 98.38, north: 7.82, east: 98.42 }, 14]] as [Bounds, number][]) {
      const spec = gridForView(b, z);
      expect(spec.nx * spec.ny).toBeLessThanOrEqual(MAX_GRID_POINTS);
      expect(spec.nx).toBeGreaterThanOrEqual(4);
      expect(spec.ny).toBeGreaterThanOrEqual(4);
      // The grid covers the view with margin.
      expect(spec.lat0).toBeLessThanOrEqual(b.south);
      expect(spec.lon0).toBeLessThanOrEqual(b.west);
      expect(spec.lat0 + (spec.ny - 1) * spec.dLat).toBeGreaterThanOrEqual(b.north);
      expect(spec.lon0 + (spec.nx - 1) * spec.dLon).toBeGreaterThanOrEqual(b.east);
    }
  });
  it('snaps the origin to the spacing so a small pan reuses cached cells', () => {
    const a = gridForView(PHUKET, 8);
    const panned = gridForView({ south: 7.03, west: 97.64, north: 8.63, east: 99.44 }, 8);
    expect(panned.dLat).toBe(a.dLat);
    const keysA = new Set(gridPoints(a).map((p) => cellKey(p, 'ecmwf_ifs025', 'r')));
    const shared = gridPoints(panned).filter((p) => keysA.has(cellKey(p, 'ecmwf_ifs025', 'r'))).length;
    expect(shared / (panned.nx * panned.ny)).toBeGreaterThan(0.85);
    expect(Number.isInteger(Math.round(a.lat0 / a.dLat))).toBe(true);
  });
  it('spacing comes from the ladder', () => {
    expect([0.05, 0.1, 0.2, 0.25, 0.5, 1, 2, 4, 8]).toContain(spacingFor(PHUKET, 8));
    expect(spacingFor({ south: 0, west: 0, north: 40, east: 60 }, 3)).toBeGreaterThanOrEqual(2);
  });
  it('grid xy is the inverse of the point list', () => {
    const spec = gridForView(PHUKET, 8);
    const pts = gridPoints(spec);
    const last = pts[pts.length - 1];
    const xy = toGridXY(spec, last.lat, last.lon);
    expect(xy.x).toBeCloseTo(spec.nx - 1, 6);
    expect(xy.y).toBeCloseTo(spec.ny - 1, 6);
  });
});

describe('U/V conversion (meteorological FROM convention)', () => {
  it('a north wind blows toward the south: U 0, V negative', () => {
    const { u, v } = toUV(10, 0);
    expect(u).toBeCloseTo(0, 9);
    expect(v).toBeCloseTo(-10, 9);
  });
  it('a westerly (270°) has positive U', () => {
    const { u, v } = toUV(20, 270);
    expect(u).toBeCloseTo(20, 9);
    expect(v).toBeCloseTo(0, 9);
  });
  it('round-trips through fromUV', () => {
    for (const [s, d] of [[5, 45], [12.5, 235], [30, 359], [8, 0.5]]) {
      const r = fromUV(toUV(s, d).u, toUV(s, d).v);
      expect(r.speed).toBeCloseTo(s, 6);
      expect(r.dirFromDeg).toBeCloseTo(d, 5);
    }
  });
});

const spec2 = { lat0: 7, lon0: 98, dLat: 1, dLon: 1, nx: 2, ny: 2 };
const T = '2026-09-05T06:00Z';
const cell = (lat: number, lon: number, speed: number | null, dir = 270): CellForecast => ({ lat, lon, times: [T], vars: { wind_speed_10m: [speed], wind_direction_10m: [dir], wave_height: [speed === null ? null : speed / 10] } });

describe('bilinear interpolation', () => {
  const cells = [cell(7, 98, 0), cell(7, 99, 10), cell(8, 98, 20), cell(8, 99, 30)];
  it('matches corners and the centre', () => {
    const g = buildScalarGrid(spec2, cells, 'wind_speed_10m', T);
    expect(bilinear(g.values, spec2, 0, 0)).toBe(0);
    expect(bilinear(g.values, spec2, 1, 1)).toBe(30);
    expect(bilinear(g.values, spec2, 0.5, 0.5)).toBeCloseTo(15, 9);
    expect(bilinear(g.values, spec2, 1, 0)).toBe(10);
    expect(sampleScalar(g, 7.25, 98.5)).toBeCloseTo(0.75 * 5 + 0.25 * 25, 9);
  });
  it('is NaN outside the grid and renormalises around a missing corner', () => {
    const g = buildScalarGrid(spec2, cells, 'wind_speed_10m', T);
    expect(Number.isNaN(bilinear(g.values, spec2, -0.1, 0))).toBe(true);
    const holey = buildScalarGrid(spec2, [cell(7, 98, null), cell(7, 99, 10), cell(8, 98, 20), cell(8, 99, 30)], 'wind_speed_10m', T);
    expect(bilinear(holey.values, spec2, 0.5, 0.5)).toBeCloseTo(20, 9); // mean of the three present corners
    expect(Number.isNaN(bilinear(holey.values, spec2, 0, 0))).toBe(true);
  });
  it('averages directions through U/V so 350° and 010° give 000°', () => {
    const c = [cell(7, 98, 10, 350), cell(7, 99, 10, 10), cell(8, 98, 10, 350), cell(8, 99, 10, 10)];
    const s = sampleCells(spec2, c, 7.5, 98.5, T);
    expect(s.wind_direction_10m! < 1 || s.wind_direction_10m! > 359).toBe(true);
    expect(s.wind_speed_10m).toBeCloseTo(10, 6);
    const vg = buildVectorGrid(spec2, c, T);
    expect(vg.u.length).toBe(4);
  });
});

describe('ramp', () => {
  it('uses the PRD wind ramp verbatim and never starts at white', () => {
    expect(RAMPS.wind.stops.map(([v, c]) => [v, c])).toEqual(WIND_RAMP);
    expect(RAMPS.wind.stops[0][1]).toBe('#1E3A8A');
    for (const r of Object.values(RAMPS)) expect(r.stops[0][1].toUpperCase()).not.toBe('#FFFFFF');
  });
  it('interpolates between stops and clamps at both ends', () => {
    expect(rampColor(RAMPS.wind, 0)).toEqual([0x1e, 0x3a, 0x8a, 255]);
    expect(rampColor(RAMPS.wind, 10)).toEqual([0x2d, 0xd4, 0xbf, 255]);
    const mid = rampColor(RAMPS.wind, 2.5); // halfway #1E3A8A → #0EA5E9
    expect(mid[0]).toBe(Math.round((0x1e + 0x0e) / 2));
    expect(rampColor(RAMPS.wind, 80)).toEqual([0xc0, 0x26, 0xd3, 255]);
    expect(rampColor(RAMPS.wind, -5)).toEqual([0x1e, 0x3a, 0x8a, 255]);
  });
  it('rain starts transparent; the LUT spans min..max', () => {
    expect(rampColor(RAMPS.rain, 0)[3]).toBe(0);
    const { lut, min, max } = buildLut(RAMPS.wind, 64);
    expect(min).toBe(0); expect(max).toBe(50); expect(lut.length).toBe(256);
    expect([lut[252], lut[253], lut[254]]).toEqual([0xc0, 0x26, 0xd3]);
  });
});

describe('open-meteo request and response shapes', () => {
  const pts = [{ lat: 7.8, lon: 98.4 }, { lat: 7.9, lon: 98.5 }];
  it('bulk forecast URL is comma-joined, 3-hourly, 3 days, knots, one model', () => {
    const u = new URL(forecastBulkUrl(pts, 'ecmwf_ifs025'));
    expect(u.origin + u.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(u.searchParams.get('latitude')).toBe('7.800,7.900');
    expect(u.searchParams.get('longitude')).toBe('98.400,98.500');
    expect(u.searchParams.get('hourly')).toBe('wind_speed_10m,wind_direction_10m,wind_gusts_10m,pressure_msl,precipitation,temperature_2m');
    expect(u.searchParams.get('wind_speed_unit')).toBe('kn');
    expect(u.searchParams.get('temporal_resolution')).toBe('hourly_3');
    expect(u.searchParams.get('forecast_days')).toBe('3');
    expect(u.searchParams.get('models')).toBe('ecmwf_ifs025');
    expect(new URL(forecastBulkUrl(pts, 'gfs_seamless')).searchParams.get('models')).toBe('gfs_seamless');
  });
  it('bulk marine URL selects sea cells', () => {
    const u = new URL(marineBulkUrl(pts));
    expect(u.origin + u.pathname).toBe('https://marine-api.open-meteo.com/v1/marine');
    expect(u.searchParams.get('hourly')).toBe('wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period');
    expect(u.searchParams.get('cell_selection')).toBe('sea');
    expect(u.searchParams.get('temporal_resolution')).toBe('hourly_3');
  });
  it('point URL is hourly with a daily block', () => {
    const u = new URL(pointForecastUrl({ lat: 7.81234, lon: 98.4 }, 'gfs_seamless'));
    expect(u.searchParams.get('latitude')).toBe('7.812');
    expect(u.searchParams.get('temporal_resolution')).toBeNull();
    expect(u.searchParams.get('daily')).toContain('wind_speed_10m_max');
    expect(pointCacheKey({ lat: 7.8123, lon: 98.4499 }, 'gfs_seamless')).toBe('gfs_seamless|7.8|98.4');
  });
  it('merges an array of bodies in request order and aligns marine on the atmospheric axis', () => {
    const atmos = asArray([
      { latitude: 7.8, longitude: 98.4, hourly: { time: ['2026-09-05T00:00', '2026-09-05T03:00'], wind_speed_10m: [10, 12], wind_direction_10m: [230, 240], wind_gusts_10m: [14, 16], pressure_msl: [1009, 1008.5], precipitation: [0, 0.3], temperature_2m: [28, 29] } },
      { latitude: 7.9, longitude: 98.5, hourly: { time: ['2026-09-05T00:00', '2026-09-05T03:00'], wind_speed_10m: [11, null], wind_direction_10m: [231, 241], wind_gusts_10m: [15, 17], pressure_msl: [1009, 1008.6], precipitation: [0, 0], temperature_2m: [28, 29] } },
    ]);
    const marine = asArray([
      { latitude: 7.8, longitude: 98.4, hourly: { time: ['2026-09-05T00:00', '2026-09-05T03:00'], wave_height: [1.1, 1.2], wave_direction: [240, 241], wave_period: [6, 6.5], swell_wave_height: [0.8, 0.9], swell_wave_direction: [238, 238], swell_wave_period: [9, 9] } },
      { latitude: 7.9, longitude: 98.5, hourly: { time: ['2026-09-05T00:00', '2026-09-05T03:00'], wave_height: [null, null], wave_direction: [null, null], wave_period: [null, null], swell_wave_height: [null, null], swell_wave_direction: [null, null], swell_wave_period: [null, null] } },
    ]);
    const cells = mergeCells(pts, atmos, marine);
    expect(cells[0].times).toEqual(['2026-09-05T00:00:00Z', '2026-09-05T03:00:00Z']);
    expect(cells[0].vars.wave_height).toEqual([1.1, 1.2]);
    expect(cells[1].vars.wind_speed_10m).toEqual([11, null]);
    expect(cells[1].vars.wave_height).toBeUndefined(); // land: marine all null, so absent
    expect(asArray({ latitude: 1, longitude: 2 }).length).toBe(1);
  });
  it('derives the run label from the 6 h cycle minus the 6 h lag', () => {
    const r = deriveRun('ecmwf_ifs025', new Date('2026-09-05T13:20:00Z'));
    expect(r.runIso).toBe('2026-09-05T06:00:00.000Z');
    expect(r.runLabel).toBe('≈ run 06Z');
    expect(deriveRun('gfs_seamless', new Date('2026-09-05T05:00:00Z')).runLabel).toBe('≈ run 18Z');
  });
  it('rainviewer tile template', () => {
    expect(radarTileUrl('https://tilecache.rainviewer.com', '/v2/radar/1757070000')).toBe('https://tilecache.rainviewer.com/v2/radar/1757070000/256/{z}/{x}/{y}/2/1_1.png');
  });
});

describe('fixtures', () => {
  it('produce a plausible monsoon flow, 3-hourly for 72 h, with land gaps', async () => {
    const src = new FixtureBrowseSource(() => new Date('2026-09-05T10:00:00Z'), 0);
    const g = await src.fetchGrid([{ lat: 7.5, lon: 98.0 }, { lat: 8.0, lon: 98.35 }], 'ecmwf_ifs025');
    expect(g.cells[0].times.length).toBe(24);
    expect(g.cells[0].times[0]).toBe('2026-09-05T00:00:00Z');
    const speeds = g.cells[0].vars.wind_speed_10m!.map(Number);
    expect(Math.min(...speeds)).toBeGreaterThanOrEqual(3);
    expect(Math.max(...speeds)).toBeLessThanOrEqual(34);
    expect(g.cells[0].vars.wave_height![0]).toBeGreaterThan(0.4);
    expect(g.cells[1].vars.wave_height).toBeUndefined(); // Phuket island
    const w = synthWind(7.5, 98, 12);
    expect(w.dir).toBeGreaterThan(180); expect(w.dir).toBeLessThan(300);
    const p = await src.fetchPoint({ lat: 7.5, lon: 98.0 }, 'ecmwf_ifs025');
    expect(p.hourly.times.length).toBe(72);
    expect(p.daily.length).toBe(7);
    const radar = await src.fetchRadarFrames();
    expect(radar.past.length).toBe(13); expect(radar.nowcast.length).toBe(3);
  });
});
