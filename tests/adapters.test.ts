import { describe, expect, it } from 'vitest';
import type { AdapterEnv, IngestTarget } from '../supabase/functions/_shared/contracts.ts';
import type { OpenMeteoResponse } from '../supabase/functions/_shared/adapters/types.ts';
import { ensembleUrl, fetchWeatherNext2, memberSeries, rowsFromEnsembleResponse } from '../supabase/functions/_shared/adapters/openMeteoEnsemble.ts';
import { fetchGfs, gfsUrl } from '../supabase/functions/_shared/adapters/openMeteoGfs.ts';
import { fetchMarine, marineUrl, toKnots } from '../supabase/functions/_shared/adapters/openMeteoMarine.ts';
import { fetchTidesAtlas, parseTidesAtlas, tidesUrl } from '../supabase/functions/_shared/adapters/tidesAtlas.ts';
import { deriveTideStates, hourlyFromExtremes } from '../supabase/functions/_shared/adapters/tidal-common.ts';

const target: IngestTarget = { id: 7, layer: 'atmospheric', grid_lat: 7.75, grid_lon: 98.5, station_id: null, horizon_end: null, next_fetch_at: '', last_fetched_at: null, last_init_time: null, last_error: null, active: true };
const range = { start: '2026-09-10T00:00:00Z', end: '2026-09-10T03:00:00Z' };
const NOW = new Date('2026-09-09T20:00:00Z');

function envWith(routes: Record<string, { status: number; body: unknown }>, vars: Record<string, string> = {}): AdapterEnv & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls, now: () => NOW, env: (n) => vars[n],
    fetch: (async (url: string | URL | Request) => {
      const u = String(url); calls.push(u);
      const hit = Object.entries(routes).find(([k]) => u.includes(k));
      const r = hit ? hit[1] : { status: 404, body: { error: true, reason: 'no route' } };
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
    }) as typeof fetch,
  };
}

const times = ['2026-09-10T00:00', '2026-09-10T01:00', '2026-09-10T02:00', '2026-09-10T03:00', '2026-09-10T04:00'];
function ensembleBody() {
  const hourly: Record<string, unknown> = { time: times };
  const members = ['', '_member01', '_member02', '_member03'];
  const speeds = [[10, 12, 14, 16], [10, 11, 12, 13], [10, 10, 10, 10], [10, 20, 30, 40], [null, null, null, null]];
  const dirs = [[350, 10, 0, 5], [90, 90, 90, 90], [180, 180, 180, 180], [270, 270, 270, 270], [null, null, null, null]];
  members.forEach((m, k) => {
    hourly[`wind_speed_10m${m}`] = speeds.map((row) => row[k]);
    hourly[`wind_direction_10m${m}`] = dirs.map((row) => row[k]);
    hourly[`wind_gusts_10m${m}`] = speeds.map((row) => (row[k] === null ? null : row[k]! * 1.3));
    hourly[`precipitation${m}`] = [[0, 0, 0.5, 0.2], [0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [null, null, null, null]].map((row) => row[k]);
    hourly[`pressure_msl${m}`] = speeds.map((row) => (row[k] === null ? null : 1010));
    hourly[`temperature_2m${m}`] = speeds.map((row) => (row[k] === null ? null : 29));
  });
  return { latitude: 7.75, longitude: 98.5, utc_offset_seconds: 0, hourly } as unknown as OpenMeteoResponse;
}

describe('ensemble adapter (§5.1)', () => {
  it('builds the documented URL', () => {
    const u = ensembleUrl(7.75, 98.5, 'google_weathernext2_ensemble');
    expect(u).toContain('ensemble-api.open-meteo.com/v1/ensemble');
    expect(u).toContain('models=google_weathernext2_ensemble');
    expect(u).toContain('wind_speed_unit=kn');
    expect(u).toContain('forecast_days=10');
    expect(u).toContain('timezone=UTC');
  });
  it('collects control + perturbed members', () => {
    expect(memberSeries(ensembleBody().hourly as unknown as Record<string, unknown>, 'wind_speed_10m')).toHaveLength(4);
  });
  it('computes percentiles, circular mean and precip probability per hour; drops hours with no members', () => {
    const rows = rowsFromEnsembleResponse(ensembleBody(), target, 'google_weathernext2_ensemble', '2026-09-09T12:00:00Z', { start: '2026-09-10T00:00:00Z', end: '2026-09-11T00:00:00Z' });
    expect(rows).toHaveLength(4);
    expect(rows[0].member_count).toBe(4);
    expect(rows[0].wind_p50_kn).toBe(13);
    expect(rows[0].wind_p10_kn).toBeCloseTo(10.6, 1);
    expect(rows[0].wind_p90_kn).toBeCloseTo(15.4, 1);
    expect(rows[0].wind_dir_mean_deg).toBeCloseTo(1.2, 0); // 350,10,0,5 -> ~1°, not 91°
    expect(rows[0].precip_prob_pct).toBe(50);
    expect(rows[2].wind_dir_spread_deg).toBe(0);
    expect(rows[3].wind_p90_kn).toBeCloseTo(37, 0);
    expect(rows[0].wind_members_kn).toEqual([10, 12, 14, 16]);
  });
  it('uses meta.json for init_time when present and falls back to a floored cycle otherwise', async () => {
    const meta = { last_run_initialisation_time: Date.parse('2026-09-09T12:00:00Z') / 1000 };
    const env = envWith({ '/v1/ensemble': { status: 200, body: ensembleBody() }, '/static/meta.json': { status: 200, body: meta } });
    const r = await fetchWeatherNext2(target, range, env);
    expect(r.ok && r.init_time).toBe('2026-09-09T12:00:00.000Z');
    const env2 = envWith({ '/v1/ensemble': { status: 200, body: ensembleBody() } });
    const r2 = await fetchWeatherNext2(target, range, env2);
    // now 20:00 − 6 h lag = 14:00, floored to a 6 h cycle = 12:00
    expect(r2.ok && r2.init_time).toBe('2026-09-09T12:00:00.000Z');
    expect(r2.ok && r2.notes?.join(' ')).toContain('floored');
  });
  it('retries with core variables when the model rejects cape/visibility', async () => {
    let n = 0;
    const env = envWith({});
    env.fetch = (async (url: string | URL | Request) => {
      const u = String(url); n++;
      if (u.includes('meta.json')) return new Response('{}', { status: 404 });
      if (u.includes('cape')) return new Response(JSON.stringify({ error: true, reason: 'Cannot initialize WeatherVariable from invalid String value cape' }), { status: 400 });
      return new Response(JSON.stringify(ensembleBody()), { status: 200 });
    }) as typeof fetch;
    const r = await fetchWeatherNext2(target, range, env);
    expect(r.ok).toBe(true);
    expect(n).toBeGreaterThanOrEqual(2);
    expect(r.ok && r.notes?.join(' ')).toContain('retried with core variables');
  });
  it('surfaces HTTP errors', async () => {
    const r = await fetchWeatherNext2(target, range, envWith({ '/v1/ensemble': { status: 429, body: { error: true, reason: 'Minutely API request limit exceeded' } } }));
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toContain('429');
  });
});

describe('GFS comparison adapter (§5.2)', () => {
  it('builds the documented URL without cape', () => {
    const u = gfsUrl(7.75, 98.5);
    expect(u).toContain('api.open-meteo.com/v1/forecast');
    expect(u).toContain('models=ncep_gfs_global');
    expect(u).not.toContain('cape');
  });
  it('writes deterministic rows with p10 = p50 = p90 and zero direction spread', async () => {
    const body = { hourly: { time: times.slice(0, 2), wind_speed_10m: [18, 20], wind_direction_10m: [200, 210], wind_gusts_10m: [25, 28], precipitation: [0, 0.3], pressure_msl: [1008, 1007], visibility: [20000, 15000], temperature_2m: [28, 28] } };
    const r = await fetchGfs(target, range, envWith({ '/v1/forecast': { status: 200, body } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].kind).toBe('deterministic');
    expect(r.rows[0].member_count).toBe(1);
    expect(r.rows[0].wind_p10_kn).toBe(18);
    expect(r.rows[0].wind_p90_kn).toBe(18);
    expect(r.rows[0].wind_dir_spread_deg).toBe(0);
    expect(r.rows[1].precip_prob_pct).toBe(100);
  });
});

describe('marine adapter (§5.3)', () => {
  it('builds the documented URL', () => {
    const u = marineUrl(7.75, 98.5);
    expect(u).toContain('marine-api.open-meteo.com/v1/marine');
    for (const v of ['wave_height', 'swell_wave_period', 'sea_level_height_msl', 'ocean_current_velocity', 'ocean_current_direction', 'sea_surface_temperature']) expect(u).toContain(v);
    expect(u).toContain('models=meteofrance_wave%2Cmeteofrance_currents');
    expect(u).toContain('forecast_days=8');
  });
  it('converts current velocity from the unit Open-Meteo reports', () => {
    expect(toKnots(18.52, 'km/h')).toBeCloseTo(10, 3);
    expect(toKnots(10, 'kn')).toBe(10);
    expect(toKnots(5.14444, 'm/s')).toBeCloseTo(10, 3);
  });
  it('handles model-suffixed variables and keeps sea level as a model height only', async () => {
    const body = {
      hourly_units: { ocean_current_velocity_meteofrance_currents: 'km/h' },
      hourly: {
        time: times.slice(0, 2),
        wave_height_meteofrance_wave: [1.2, 1.4], wave_direction_meteofrance_wave: [210, 215], wave_period_meteofrance_wave: [6, 6.5],
        swell_wave_height_meteofrance_wave: [0.9, 1.0], swell_wave_direction_meteofrance_wave: [220, 220], swell_wave_period_meteofrance_wave: [9, 9],
        sea_level_height_msl_meteofrance_currents: [0.4, 0.5],
        ocean_current_velocity_meteofrance_currents: [1.852, 3.704], ocean_current_direction_meteofrance_currents: [45, 50],
      },
    };
    const r = await fetchMarine(target, range, envWith({ '/v1/marine': { status: 200, body } }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.rows[0].wave_height_m).toBe(1.2);
    expect(r.rows[0].current_speed_kn).toBe(1);
    expect(r.rows[1].current_speed_kn).toBe(2);
    expect(r.rows[0].sea_level_msl_m).toBe(0.4);
    expect(Object.keys(r.rows[0])).not.toContain('tide_height_m');
  });
});

describe('TidesAtlas adapter (§5.4)', () => {
  it('reports not configured without a key and never invents one', async () => {
    const env = envWith({});
    const r = await fetchTidesAtlas(target, range, env);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.notConfigured).toBe(true);
    expect(env.calls).toHaveLength(0);
  });
  it('sends X-API-Key and the SDK parameter names', async () => {
    expect(tidesUrl(7.75, 98.5, '2026-09-10', 2)).toBe('https://tidesatlas.com/api/v1/tides?lat=7.7500&lon=98.5000&days=2&date=2026-09-10');
    let headers: Record<string, string> = {};
    const env = envWith({}, { TIDESATLAS_API_KEY: 'k' });
    env.fetch = (async (_u: string | URL | Request, init?: RequestInit) => { headers = init?.headers as Record<string, string>; return new Response(JSON.stringify({ station: { id: 'ao-chalong', name: 'Ao Chalong', distance_km: 3.2 }, datum: 'LAT', heights: [{ datetime: '2026-09-10T00:00:00Z', height_m: 1.0 }, { datetime: '2026-09-10T01:00:00Z', height_m: 1.4 }, { datetime: '2026-09-10T02:00:00Z', height_m: 1.6 }, { datetime: '2026-09-10T03:00:00Z', height_m: 1.5 }] }), { status: 200 }); }) as typeof fetch;
    const r = await fetchTidesAtlas(target, range, env);
    expect(headers['X-API-Key']).toBe('k');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.station_id).toBe('ao-chalong');
    expect(r.rows[0].datum).toBe('LAT');
    expect(r.rows[0].station_distance_km).toBe(3.2);
    expect(r.rows.map((x) => x.tide_state)).toEqual(['flood', 'flood', 'high', 'ebb']);
  });
  it('derives an hourly series from extremes and labels the datum unknown when absent', () => {
    const p = parseTidesAtlas({ extremes: [{ type: 'low', datetime: '2026-09-10T00:00:00Z', height_m: 0.5 }, { type: 'high', datetime: '2026-09-10T06:00:00Z', height_m: 2.5 }] }, { start: '2026-09-10T00:00:00Z', end: '2026-09-10T06:00:00Z' });
    expect(p?.derived).toBe(true);
    expect(p?.datum).toBe('unknown');
    expect(p?.series).toHaveLength(7);
    expect(p?.series[3].heightM).toBeCloseTo(1.5, 2); // midpoint of a cosine curve
    expect(p?.notes.join(' ')).toContain('cosine');
  });
  it('parses the real TidesAtlas shape (port block, datum object, extremes only)', () => {
    const body = { port: { name: 'Ban Chalong', slug: 'ban-chalong', lat: 7.84468, lon: 98.33897 }, data_source: 'ticon', datum: { reference: 'LAT', native: 'LAT', available: ['MSL', 'LAT', 'MLLW'] }, extremes: [
      { datetime: '2026-09-04T08:50:10+07:00', timestamp: 1788486610, height_m: 1.04, type: 'low' },
      { datetime: '2026-09-04T14:49:29+07:00', timestamp: 1788508169, height_m: 2.2, type: 'high' },
      { datetime: '2026-09-04T20:55:03+07:00', timestamp: 1788530103, height_m: 1.09, type: 'low' },
    ] };
    const p = parseTidesAtlas(body, { start: '2026-09-04T02:00:00Z', end: '2026-09-04T13:00:00Z' });
    expect(p?.station.id).toBe('ban-chalong');
    expect(p?.station.name).toBe('Ban Chalong');
    expect(p?.datum).toBe('LAT');
    expect(p?.derived).toBe(true);
    expect(p!.series.length).toBeGreaterThan(3);
  });
  it('does not guess a station when the response has none', () => {
    const p = parseTidesAtlas({ heights: [{ time: '2026-09-10T00:00:00Z', height: 1 }, { time: '2026-09-10T01:00:00Z', height: 1.2 }] }, range);
    expect(p?.station.id.startsWith('fes2022@')).toBe(true);
  });
});

describe('tide state derivation', () => {
  it('marks turning points, flood, ebb and slack', () => {
    const hs = [0.0, 0.3, 0.8, 1.4, 1.9, 2.2, 2.3, 2.2, 1.9, 1.4, 0.8, 0.3, 0.0];
    const s = deriveTideStates(hs.map((h, i) => ({ time: new Date(Date.UTC(2026, 8, 10, i)).toISOString(), heightM: h })));
    expect(s[6]).toBe('high');
    expect(s[0]).toBe('flood'); // an endpoint is never a turning point
    expect(s[12]).toBe('ebb');
    expect(s[3]).toBe('flood');
    expect(s[9]).toBe('ebb');
    expect(s[5]).toBe('slack'); // within 10 % of range of the high
  });
  it('hourlyFromExtremes hits the extremes exactly', () => {
    const pts = hourlyFromExtremes([{ time: '2026-09-10T00:00:00Z', heightM: 0.5, type: 'low' }, { time: '2026-09-10T06:00:00Z', heightM: 2.5, type: 'high' }], '2026-09-10T00:00:00Z', '2026-09-10T06:00:00Z');
    expect(pts[0].heightM).toBe(0.5);
    expect(pts[6].heightM).toBe(2.5);
  });
});
