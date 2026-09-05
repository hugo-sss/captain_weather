import { describe, expect, it } from 'vitest';
import { buildRouteSegments, etaDeltaMinutes, fmtEtaDelta, groupLegConditions, summarisePoints, worstPointAlongPassage } from '../src/lib/leg-profile.ts';
import type { LegConditionsRow, WaypointRow } from '../src/types/domain.ts';

const wp = (id: string, sequence: number, lat: number, lon: number, legNm: number | null): WaypointRow => ({
  id, passage_id: 'p', sequence, name: id.toUpperCase(), lat, lon, geom: null, planned_speed_kn: null, is_anchorage: false, planned_departure_from_here: null, anchorage_exposure_tag: null,
  is_complex_coastal: false, charted_depth_m: null, charted_depth_source: null, eta: '2026-09-05T00:00:00Z', leg_distance_nm: legNm, leg_bearing_deg: null, arrived: false, arrived_at: null, source: 'map', created_at: '', updated_at: '',
});
const row = (o: Partial<LegConditionsRow> & { from_waypoint_id: string; to_waypoint_id: string; seq: number; fraction: number }): LegConditionsRow => ({
  id: `${o.from_waypoint_id}-${o.seq}`, run_id: 'r', lat: 0, lon: 0, eta: '2026-09-05T06:00:00Z', lead_time_hours: 6, atmos_init_time: null,
  wind_p10_kn: 8, wind_p50_kn: 12, wind_p90_kn: 16, wind_dir_mean_deg: 240, wind_dir_spread_deg: 10, gust_p90_kn: 20, gust_source: 'google_weathernext2_ensemble',
  comparison_source: null, comparison_wind_kn: null, comparison_wind_dir_deg: null, wind_speed_delta_kn: null, wind_dir_delta_deg: null, source_disagreement: false,
  wave_height_m: 1.0, wave_dir_deg: 230, wave_period_s: 7, swell_height_m: 0.8, swell_dir_deg: 230, swell_period_s: 9, current_speed_kn: 0.4, current_dir_deg: 30,
  precip_prob_pct: 20, cape_p50_jkg: 200, mslp_p50_hpa: 1008, visibility_p50_m: 15000, squall_risk: 'none', speed_loss_pct: 3,
  risk_flag: 'green', risk_reasons: [], confidence_level: 'high', confidence_triggers: [], data_gaps: [], created_at: '', ...o,
});

const wps = [wp('a', 1, 7.8, 98.35, 0), wp('b', 2, 7.6, 98.37, 12.0), wp('c', 3, 7.74, 98.77, 25.0)];

describe('groupLegConditions', () => {
  it('groups by (from, to) in passage order, sorts by seq and scales distance by fraction', () => {
    const rows = [
      row({ from_waypoint_id: 'b', to_waypoint_id: 'c', seq: 1, fraction: 0.5 }),
      row({ from_waypoint_id: 'b', to_waypoint_id: 'c', seq: 0, fraction: 0 }),
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 0, fraction: 0 }),
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 1, fraction: 1 }),
    ];
    const legs = groupLegConditions(rows, wps);
    expect(legs.map((l) => `${l.fromId}>${l.toId}`)).toEqual(['a>b', 'b>c']);
    expect(legs[1].points.map((p) => p.seq)).toEqual([0, 1]);
    expect(legs[1].distanceNm).toBe(25);
    expect(legs[1].points[1].distanceNm).toBe(12.5);
    expect(legs[0].from?.name).toBe('A');
  });
  it('summarises maxima, worst risk/squall and the worst point; all-unknown legs are unknown', () => {
    const pts = groupLegConditions([
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 0, fraction: 0, wind_p90_kn: 18, wave_height_m: 1.1 }),
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 1, fraction: 0.5, wind_p90_kn: 31, wave_height_m: 2.3, risk_flag: 'red', risk_reasons: ['gust p90 38 kn > max_gust 35 kn'], squall_risk: 'likely' }),
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 2, fraction: 1, wind_p90_kn: 22, wave_height_m: null, risk_flag: 'amber', squall_risk: 'possible', data_gaps: ['marine'] }),
    ], wps)[0];
    expect(pts.summary.maxWindP90).toBe(31);
    expect(pts.summary.maxHs).toBe(2.3);
    expect(pts.summary.worstRisk).toBe('red');
    expect(pts.summary.worstSquall).toBe('likely');
    expect(pts.summary.worstPoint?.seq).toBe(1);
    expect(pts.summary.meanSpeedLossPct).toBe(3);
    expect(summarisePoints(pts.points.map((p) => ({ ...p, risk: 'unknown' as const }))).worstRisk).toBe('unknown');
    expect(summarisePoints([]).worstRisk).toBe('unknown');
  });
  it('picks the worst point across the passage by rank then wind', () => {
    const legs = groupLegConditions([
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 0, fraction: 0, risk_flag: 'amber', wind_p90_kn: 28 }),
      row({ from_waypoint_id: 'b', to_waypoint_id: 'c', seq: 0, fraction: 0, risk_flag: 'amber', wind_p90_kn: 22 }),
    ], wps);
    expect(worstPointAlongPassage(legs)?.leg.toId).toBe('b');
  });
});

describe('buildRouteSegments', () => {
  it('splits each leg at the midpoints between points and colours by that point flag; legs without data fall back', () => {
    const legs = groupLegConditions([
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 0, fraction: 0, risk_flag: 'green' }),
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 1, fraction: 0.5, risk_flag: 'red' }),
      row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 2, fraction: 1, risk_flag: 'unknown' }),
    ], wps);
    const segs = buildRouteSegments(wps, legs, (to) => (to === 'c' ? 'amber' : null));
    expect(segs.map((s) => s.risk)).toEqual(['green', 'red', 'unknown', 'amber']);
    // First segment starts exactly at A, last leg segment ends exactly at B; the fallback leg runs B -> C.
    expect(segs[0].positions[0]).toEqual([7.8, 98.35]);
    expect(segs[2].positions[1]).toEqual([7.6, 98.37]);
    expect(segs[3].positions).toEqual([[7.6, 98.37], [7.74, 98.77]]);
    // Segment boundaries meet: the end of one is the start of the next.
    expect(segs[0].positions[1]).toEqual(segs[1].positions[0]);
    expect(segs[1].positions[1]).toEqual(segs[2].positions[0]);
  });
  it('a single point tints the whole leg', () => {
    const legs = groupLegConditions([row({ from_waypoint_id: 'a', to_waypoint_id: 'b', seq: 0, fraction: 0.5, risk_flag: 'amber' })], wps);
    const segs = buildRouteSegments(wps, legs);
    expect(segs[0]).toMatchObject({ risk: 'amber', positions: [[7.8, 98.35], [7.6, 98.37]] });
    expect(segs[1].risk).toBeNull();
  });
});

describe('sea-state ETA delta', () => {
  it('returns minutes of adjusted minus planned, null when equal or missing', () => {
    expect(etaDeltaMinutes('2026-09-05T00:00:00Z', '2026-09-05T01:10:00Z')).toBe(70);
    expect(etaDeltaMinutes('2026-09-05T00:00:00Z', '2026-09-05T00:00:00Z')).toBeNull();
    expect(etaDeltaMinutes(null, '2026-09-05T00:00:00Z')).toBeNull();
    expect(fmtEtaDelta(70)).toBe('+1 h 10 m');
    expect(fmtEtaDelta(120)).toBe('+2 h');
    expect(fmtEtaDelta(-25)).toBe('−25 m');
  });
});
