// Dev-only preview fixtures. A realistic Andaman Sea passage (Phuket to Ko Lanta) that exercises
// every visual state: green / amber / red legs, a source-disagreement row, a marine data gap,
// all three confidence levels, an active passage with material changes, and a validated briefing.
// Never imported by production code: only the PREVIEW_MOCK Vite alias and the /preview route reach it.
import { haversineNm, initialBearingDeg } from '@/lib/passage-engine/geo.ts';

export type Row = Record<string, unknown>;
export type FixtureDb = Record<string, Row[]>;

const H = 3_600_000;
const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const floorTo = (ms: number, hours: number) => Math.floor(ms / (hours * H)) * hours * H;
const round1 = (v: number) => Math.round(v * 10) / 10;
const round2 = (v: number) => Math.round(v * 100) / 100;

export const OWNER = 'user-captain';
export const USER_EMAIL = 'captain@aurora.yacht';

// ---- Vessels -------------------------------------------------------------------------------
export const vessels: Row[] = [
  { id: 'v1', owner_id: OWNER, name: 'Aurora Borealis', vessel_class: 'motor', length_m: 46.2, beam_m: 9.1, draft_m: 2.6, air_draft_m: 14.8, cruise_speed_kn: 12, max_speed_kn: 17, max_wind_kn: 25, max_gust_kn: 35, max_wave_m: 2.0, max_current_kn: 3, min_ukc_m: 1.0, polar_data: null, notes: 'Stabilised at anchor. Owner prefers beam seas under 1.5 m.', created_at: iso(NOW - 90 * 24 * H), updated_at: iso(NOW - 3 * 24 * H) },
  { id: 'v2', owner_id: OWNER, name: 'Nyx (tender)', vessel_class: 'tender', length_m: 9.8, beam_m: 3.1, draft_m: 0.8, air_draft_m: 3.2, cruise_speed_kn: 26, max_speed_kn: 38, max_wind_kn: 18, max_gust_kn: 25, max_wave_m: 1.0, max_current_kn: 3, min_ukc_m: 0.5, polar_data: null, notes: null, created_at: iso(NOW - 60 * 24 * H), updated_at: iso(NOW - 60 * 24 * H) },
];

// ---- Passage p1: Phuket to Ko Lanta, active, departed 5 h ago ------------------------------
const DEP = NOW - 5 * H;
const ATMOS_INIT = floorTo(NOW - 5 * H, 6);
const CMP_INIT = floorTo(NOW - 3 * H, 6);
const MARINE_INIT = floorTo(NOW - 8 * H, 12);

type WpSeed = { id: string; name: string; lat: number; lon: number; anchorage?: boolean; stayH?: number; depth: number | null; exposure?: string | null; complex?: boolean; arrived?: boolean };
const seeds: WpSeed[] = [
  { id: 'wp1', name: 'Ao Chalong', lat: 7.8175, lon: 98.355, depth: 12, arrived: true },
  { id: 'wp2', name: 'Ko Racha Yai', lat: 7.603, lon: 98.367, anchorage: true, stayH: 14, depth: 8, exposure: 'partial', arrived: true },
  { id: 'wp3', name: 'Ko Phi Phi Don', lat: 7.7395, lon: 98.7735, depth: 14, complex: true },
  { id: 'wp4', name: 'Ko Ha', lat: 7.427, lon: 98.893, depth: 22 },
  { id: 'wp5', name: 'Ao Kantiang, Ko Lanta', lat: 7.514, lon: 99.072, anchorage: true, stayH: 36, depth: 6.5, exposure: 'exposed' },
];

let t = DEP;
export const waypoints: Row[] = seeds.map((s, i) => {
  const prev = seeds[i - 1];
  const dist = prev ? haversineNm(prev.lat, prev.lon, s.lat, s.lon) : 0;
  const brg = prev ? initialBearingDeg(prev.lat, prev.lon, s.lat, s.lon) : null;
  if (prev) t += (dist / 12) * H;
  const eta = t;
  const stayEnd = s.anchorage && s.stayH ? eta + s.stayH * H : null;
  if (stayEnd) t = stayEnd;
  return {
    id: s.id, passage_id: 'p1', sequence: i + 1, name: s.name, lat: s.lat, lon: s.lon, geom: null,
    planned_speed_kn: i === 3 ? 10 : null, is_anchorage: !!s.anchorage, planned_departure_from_here: stayEnd ? iso(stayEnd) : null,
    anchorage_exposure_tag: s.exposure ?? null, is_complex_coastal: !!s.complex, charted_depth_m: s.depth,
    eta: iso(eta), leg_distance_nm: round1(dist), leg_bearing_deg: brg === null ? null : Math.round(brg),
    arrived: !!s.arrived, arrived_at: s.arrived ? iso(eta + 0.2 * H) : null, source: i === 0 ? 'map' : 'gpx',
    created_at: iso(NOW - 4 * 24 * H), updated_at: iso(NOW - 6 * H),
  };
});
const etaOf = (id: string) => String(waypoints.find((w) => w.id === id)!.eta);
const stayEndOf = (id: string) => waypoints.find((w) => w.id === id)!.planned_departure_from_here as string;

export const passages: Row[] = [
  { id: 'p1', owner_id: OWNER, vessel_id: 'v1', name: 'Phuket to Ko Lanta', status: 'active', planned_departure: iso(DEP - 0.5 * H), actual_departure: iso(DEP), tropical_activity_flag: false, frontal_activity_flag: false, notes: 'SW monsoon. Ko Ha is exposed to the west; consider the inside of Ko Lanta if the swell builds.', created_at: iso(NOW - 4 * 24 * H), updated_at: iso(NOW - 5 * H) },
  { id: 'p2', owner_id: OWNER, vessel_id: 'v1', name: 'Gocek to Bodrum', status: 'completed', planned_departure: iso(NOW - 12 * 24 * H), actual_departure: iso(NOW - 12 * 24 * H + 0.3 * H), tropical_activity_flag: false, frontal_activity_flag: true, notes: null, created_at: iso(NOW - 15 * 24 * H), updated_at: iso(NOW - 11 * 24 * H) },
  { id: 'p3', owner_id: OWNER, vessel_id: 'v1', name: 'Phuket to Langkawi', status: 'completed', planned_departure: iso(NOW - 20 * 24 * H), actual_departure: iso(NOW - 20 * 24 * H), tropical_activity_flag: false, frontal_activity_flag: false, notes: null, created_at: iso(NOW - 1 * 24 * H), updated_at: iso(NOW - 1 * 24 * H) },
  { id: 'p4', owner_id: OWNER, vessel_id: 'v2', name: 'Lefkada to Corfu', status: 'planned', planned_departure: iso(NOW + 6 * 24 * H), actual_departure: null, tropical_activity_flag: false, frontal_activity_flag: false, notes: null, created_at: iso(NOW - 45 * 24 * H), updated_at: iso(NOW - 38 * 24 * H) },
];

// Second passage's waypoints (for history flags only).
for (const [i, [name, lat, lon]] of ([['Gocek', 36.755, 28.94], ['Kizilada', 36.62, 29.05], ['Bodrum', 37.03, 27.43]] as const).entries()) {
  waypoints.push({ id: `p2wp${i + 1}`, passage_id: 'p2', sequence: i + 1, name, lat, lon, geom: null, planned_speed_kn: null, is_anchorage: false, planned_departure_from_here: null, anchorage_exposure_tag: null, is_complex_coastal: false, charted_depth_m: null, eta: iso(NOW - 12 * 24 * H + (i + 1) * 4 * H), leg_distance_nm: i === 0 ? 0 : 42.3, leg_bearing_deg: null, arrived: true, arrived_at: iso(NOW - 12 * 24 * H + (i + 1) * 4 * H), source: 'csv', created_at: iso(NOW - 15 * 24 * H), updated_at: iso(NOW - 11 * 24 * H) });
}

// ---- Runs ----------------------------------------------------------------------------------
export const conditions_runs: Row[] = [
  { id: 'run-2', passage_id: 'p1', kind: 'recheck', status: 'complete', previous_run_id: 'run-1', created_at: iso(NOW - 0.7 * H), completed_at: iso(NOW - 0.65 * H), error: null, sources_used: { atmospheric: 'google_weathernext2_ensemble', comparison: 'ncep_gfs_global', marine: 'meteofrance_wave', tidal: 'tidesatlas' }, waypoints_evaluated: 5 },
  { id: 'run-1', passage_id: 'p1', kind: 'initial', status: 'complete', previous_run_id: null, created_at: iso(NOW - 7 * H), completed_at: iso(NOW - 6.9 * H), error: null, sources_used: null, waypoints_evaluated: 5 },
  { id: 'run-p2', passage_id: 'p2', kind: 'initial', status: 'complete', previous_run_id: null, created_at: iso(NOW - 12.5 * 24 * H), completed_at: iso(NOW - 12.5 * 24 * H), error: null, sources_used: null, waypoints_evaluated: 3 },
];

// ---- Waypoint conditions (run-2, the current run) ------------------------------------------
type CondSeed = {
  wp: string; wind: [number, number, number]; dir: number; spread: number; gust: number;
  wave: [number, number] | null; swell: [number, number, number] | null; tide: [number, string] | null; current: [number, number] | null;
  cmp: [number, number]; delta: [number, number]; diverge: boolean; risk: string; reasons: string[]; conf: string; triggers: string[]; vis: number | null; mslp: number; precip: number;
};
const condSeeds: CondSeed[] = [
  { wp: 'wp1', wind: [8, 12, 16], dir: 235, spread: 12, gust: 21, wave: [0.9, 6], swell: [0.8, 230, 8], tide: [1.42, 'flood'], current: [0.4, 40], cmp: [13, 240], delta: [1, 5], diverge: false, risk: 'green', reasons: [], conf: 'high', triggers: [], vis: 18000, mslp: 1008.2, precip: 20 },
  { wp: 'wp2', wind: [9, 13, 18], dir: 240, spread: 15, gust: 24, wave: [1.1, 7], swell: [1.0, 235, 9], tide: [0.86, 'ebb'], current: [0.3, 20], cmp: [15, 245], delta: [2, 5], diverge: false, risk: 'green', reasons: [], conf: 'high', triggers: [], vis: 16000, mslp: 1007.8, precip: 30 },
  { wp: 'wp3', wind: [12, 17, 22], dir: 245, spread: 18, gust: 29, wave: [1.6, 7], swell: [1.3, 240, 10], tide: [1.95, 'high'], current: [0.6, 30], cmp: [19, 250], delta: [2, 5], diverge: false, risk: 'amber', reasons: ['wind p90 22 kn > 0.75×max_wind 25 kn', 'gust p90 29 kn > 0.75×max_gust 35 kn', 'wave 1.6 m > 0.75×max_wave 2 m'], conf: 'moderate', triggers: ['complex_coastal', 'wide_ensemble_spread'], vis: 9000, mslp: 1006.4, precip: 55 },
  { wp: 'wp4', wind: [16, 23, 31], dir: 250, spread: 22, gust: 38, wave: [2.3, 8], swell: [1.8, 245, 11], tide: [0.62, 'ebb'], current: [1.1, 35], cmp: [14, 285], delta: [9, 35], diverge: true, risk: 'red', reasons: ['gust p90 38 kn > max_gust 35 kn', 'wave 2.3 m > max_wave 2 m'], conf: 'moderate', triggers: ['source_disagreement', 'wide_ensemble_spread'], vis: 6000, mslp: 1005.1, precip: 70 },
  { wp: 'wp5', wind: [10, 14, 18], dir: 240, spread: 14, gust: 25, wave: null, swell: null, tide: [1.1, 'flood'], current: null, cmp: [15, 238], delta: [1, 2], diverge: false, risk: 'green', reasons: [], conf: 'low', triggers: ['no_data_marine'], vis: 14000, mslp: 1006.9, precip: 40 },
];
const draft = 2.6;
function cond(run: string, s: CondSeed, overrides: Row = {}): Row {
  const wp = waypoints.find((w) => w.id === s.wp)!;
  const depth = wp.charted_depth_m as number | null;
  const isAnch = wp.is_anchorage as boolean;
  const eta = Date.parse(String(wp.eta));
  const ukc = depth !== null && s.tide ? round2(depth + s.tide[0] - draft - (s.swell ? s.swell[0] / 2 : 0) - (isAnch ? 0 : 0.3)) : null;
  return {
    id: Number(`${run === 'run-1' ? 1 : 2}${wp.sequence}`), run_id: run, waypoint_id: s.wp, eta: wp.eta, lead_time_hours: round1((eta - ATMOS_INIT) / H),
    atmos_source: 'google_weathernext2_ensemble', atmos_init_time: iso(ATMOS_INIT), atmos_forecast_time: iso(floorTo(eta, 1)),
    wind_p10_kn: s.wind[0], wind_p50_kn: s.wind[1], wind_p90_kn: s.wind[2], wind_dir_mean_deg: s.dir, wind_dir_spread_deg: s.spread, gust_p90_kn: s.gust,
    visibility_p50_m: s.vis, mslp_p50_hpa: s.mslp, precip_prob_pct: s.precip,
    marine_source: s.wave ? 'meteofrance_wave' : null, marine_init_time: s.wave ? iso(MARINE_INIT) : null,
    wave_height_m: s.wave?.[0] ?? null, wave_period_s: s.wave?.[1] ?? null, wave_dir_deg: s.wave ? s.dir - 5 : null,
    swell_height_m: s.swell?.[0] ?? null, swell_dir_deg: s.swell?.[1] ?? null, swell_period_s: s.swell?.[2] ?? null,
    current_speed_kn: s.current?.[0] ?? null, current_dir_deg: s.current?.[1] ?? null,
    tidal_source: s.tide ? 'tidesatlas' : null, tide_height_m: s.tide?.[0] ?? null, tide_state: s.tide?.[1] ?? null, tide_datum: s.tide ? 'LAT' : null, tide_station_id: s.tide ? 'TH-0421' : null,
    charted_depth_m: depth, ukc_estimate_m: ukc, ukc_basis: ukc === null ? 'none' : s.swell ? 'charted+tide+swell' : 'charted+tide',
    comparison_source: 'ncep_gfs_global', comparison_wind_kn: s.cmp[0], comparison_wind_dir_deg: s.cmp[1], wind_speed_delta_kn: s.delta[0], wind_dir_delta_deg: s.delta[1],
    source_disagreement: s.diverge, disagreement_detail: { comparison_init_time: iso(CMP_INIT), fired: { speed: s.delta[0] > 5, direction: s.delta[1] > 15, light_air_suppressed: false } },
    risk_flag: s.risk, risk_reasons: s.reasons, confidence_level: s.conf, confidence_triggers: s.triggers, hazard_flags: null, computed_at: iso(NOW - 0.65 * H),
    ...overrides,
  };
}
export const waypoint_conditions: Row[] = [
  ...condSeeds.map((s) => cond('run-2', s)),
  // Previous run: Ko Ha was amber with a lower p90, and the models still agreed.
  ...condSeeds.map((s) => s.wp === 'wp4'
    ? cond('run-1', s, { wind_p90_kn: 24, gust_p90_kn: 30, wave_height_m: 1.7, risk_flag: 'amber', risk_reasons: ['wind p90 24 kn > 0.75×max_wind 25 kn'], source_disagreement: false, wind_speed_delta_kn: 3, wind_dir_delta_deg: 8, confidence_level: 'high', confidence_triggers: [], computed_at: iso(NOW - 6.9 * H) })
    : cond('run-1', s, { computed_at: iso(NOW - 6.9 * H) })),
  // Completed Gocek passage (history row).
  ...(['p2wp1', 'p2wp2', 'p2wp3'] as const).map((id, i) => ({ id: 900 + i, run_id: 'run-p2', waypoint_id: id, eta: iso(NOW - 12 * 24 * H + (i + 1) * 4 * H), risk_flag: i === 2 ? 'amber' : 'green', risk_reasons: [], confidence_level: 'high', confidence_triggers: [], source_disagreement: false, wind_p50_kn: 9, wind_p90_kn: 14, wave_height_m: 0.6, tide_height_m: null, computed_at: iso(NOW - 12.5 * 24 * H) })),
];

// ---- Anchorage stay summaries --------------------------------------------------------------
export const anchorage_conditions: Row[] = [
  { id: 1, run_id: 'run-2', waypoint_id: 'wp2', stay_start: etaOf('wp2'), stay_end: stayEndOf('wp2'), hours_evaluated: 14, wind_p50_kn: 13, wind_max_p90_kn: 19, gust_max_p90_kn: 25, wind_dir_predominant_deg: 240, wind_dir_range_deg: 35, wave_max_m: 1.2, swell_max_m: 1.1, swell_dir_predominant_deg: 235, tide_min_m: 0.41, tide_max_m: 2.28, tide_range_m: 1.87, min_ukc_estimate_m: 5.26, exposure_tag: 'partial', seabed_type: null, shelter_exposure: null, risk_flag: 'green', risk_reasons: [], confidence_level: 'high', confidence_triggers: [], computed_at: iso(NOW - 0.65 * H) },
  { id: 2, run_id: 'run-2', waypoint_id: 'wp5', stay_start: etaOf('wp5'), stay_end: stayEndOf('wp5'), hours_evaluated: 36, wind_p50_kn: 14, wind_max_p90_kn: 21, gust_max_p90_kn: 27, wind_dir_predominant_deg: 245, wind_dir_range_deg: 60, wave_max_m: null, swell_max_m: null, swell_dir_predominant_deg: null, tide_min_m: 0.33, tide_max_m: 2.41, tide_range_m: 2.08, min_ukc_estimate_m: 4.23, exposure_tag: 'exposed', seabed_type: null, shelter_exposure: null, risk_flag: 'amber', risk_reasons: ['wind p90 21 kn > 0.75×max_wind 25 kn'], confidence_level: 'low', confidence_triggers: ['no_data_marine'], computed_at: iso(NOW - 0.65 * H) },
];

// ---- Briefing ------------------------------------------------------------------------------
const DEP_WIN_START = floorTo(NOW + 9 * H, 1);
export const passage_briefings: Row[] = [
  {
    id: 'br-2', passage_id: 'p1', run_id: 'run-2', scope: 'remaining', is_recheck: true, superseded_by: null,
    confidence_level: 'moderate', confidence_triggers: ['source_disagreement', 'wide_ensemble_spread'],
    summary_text: 'Confidence in this briefing is moderate: the primary ensemble and the GFS comparison disagree on wind at Ko Ha, and the ensemble spread is wide from Ko Phi Phi Don onward.\n\nThe ensemble indicates a south-westerly monsoon flow building through the remaining legs. Ko Racha Yai to Ko Phi Phi Don sees 12 to 22 kn (p10 to p90) from 245° with significant wave height near 1.6 m at 7 s. Ko Ha carries elevated risk based on forecast data: gusts to 38 kn on the p90 and a 2.3 m sea from the west exceed the vessel limits on the central estimate, with a 1.1 kn current setting north-east. The ensemble eases again at Ao Kantiang, but no marine grid point covers the anchorage so sea state there is unknown.\n\nTide at Ko Ha is ebbing at the ETA (0.62 m LAT) with an estimated 20 m under the keel; at Ao Kantiang the minimum UKC over the 36 h stay is 4.2 m with the largest swell paired against low water.',
    recommended_action: 'Consider holding at Ko Racha Yai until the window opening at ' + new Date(DEP_WIN_START).toISOString().slice(11, 16) + 'Z, when p90 wind at the departure point drops below 19 kn for at least 6 h, and routing east of Ko Ha rather than through the exposed western side. Worth cross-checking the Ko Ha leg against the official TMD marine forecast before committing.',
    disagreement_notes: 'At Ko Ha the primary ensemble (23 kn p50 from 250°) and ncep_gfs_global (14 kn from 285°) differ by 9 kn and 35°. The models are independent; verify against an official forecast before relying on either.',
    per_leg_notes: [],
    suggested_departure_windows: [{ start: iso(DEP_WIN_START), end: iso(DEP_WIN_START + 7 * H), reason: 'p90 wind under 19 kn at the departure point, models in agreement' }],
    material_changes: [
      { waypoint_id: 'wp4', sequence: 4, waypoint_name: 'Ko Ha', field: 'risk_flag', from: 'amber', to: 'red', note: 'worsened' },
      { waypoint_id: 'wp4', sequence: 4, waypoint_name: 'Ko Ha', field: 'wind_p90_kn', from: 24, to: 31, note: 'moved > 5 kn' },
      { waypoint_id: 'wp4', sequence: 4, waypoint_name: 'Ko Ha', field: 'source_disagreement', from: false, to: true, note: 'models now diverge' },
      { waypoint_id: 'wp4', sequence: 4, waypoint_name: 'Ko Ha', field: 'wave_height_m', from: 1.7, to: 2.3, note: 'moved > 0.5 m' },
    ],
    model_used: 'claude-opus-5', prompt_version: 'v1', generated_at: iso(NOW - 0.6 * H), validator_passed: true, validator_result: { passed: true, violations: [], attempts: 1 },
    input_hash: '9f2c1e7a5b0d4c3e8a1f6b2d7c9e0a4b', input_snapshot: { previous_briefing_summary: 'Confidence in this briefing is high. The ensemble indicates a steady south-westerly of 10 to 18 kn for the whole passage, with a 1.2 to 1.7 m sea at Ko Ha and models in agreement at every waypoint. Tide at Ko Racha Yai is ebbing at the ETA with an estimated 5.5 m under the keel over the stay.' },
  },
  { id: 'br-p2', passage_id: 'p2', run_id: 'run-p2', scope: 'full', is_recheck: false, superseded_by: null, confidence_level: 'high', confidence_triggers: [], summary_text: 'Confidence in this briefing is high.', recommended_action: null, disagreement_notes: null, per_leg_notes: [], suggested_departure_windows: [], material_changes: null, model_used: 'claude-opus-5', prompt_version: 'v1', generated_at: iso(NOW - 12.4 * 24 * H), validator_passed: true, validator_result: { passed: true }, input_hash: 'aa', input_snapshot: {} },
];

// ---- Ingest targets and forecast series ----------------------------------------------------
export const ingest_targets: Row[] = [];
export const passage_ingest_targets: Row[] = [];
export const forecast_atmospheric: Row[] = [];
export const forecast_marine: Row[] = [];
export const forecast_tidal: Row[] = [];

let targetId = 100;
const snap = (v: number) => Math.round(v * 4) / 4;
for (const [i, s] of seeds.entries()) {
  for (const layer of ['atmospheric', 'comparison', 'marine', 'tidal'] as const) {
    if (layer === 'marine' && s.id === 'wp5') continue; // the marine gap
    const id = ++targetId;
    ingest_targets.push({ id, layer, grid_lat: layer === 'tidal' ? s.lat : snap(s.lat), grid_lon: layer === 'tidal' ? s.lon : snap(s.lon), geom: null, station_id: layer === 'tidal' ? 'TH-0421' : null, active: true, horizon_end: iso(NOW + 5 * 24 * H), last_fetched_at: iso(NOW - (layer === 'marine' ? 2.5 : 0.8) * H), last_init_time: iso(layer === 'marine' ? MARINE_INIT : layer === 'comparison' ? CMP_INIT : ATMOS_INIT), last_error: null, next_fetch_at: iso(NOW + 2 * H), created_at: iso(NOW - 4 * 24 * H) });
    passage_ingest_targets.push({ passage_id: 'p1', target_id: id });
    if (layer === 'atmospheric') {
      // 96 h primary ensemble + comparison series on the same target. Wind builds through day 2 then eases.
      const phase = i * 0.35;
      for (let h = 0; h <= 96; h++) {
        const ft = ATMOS_INIT + h * H;
        const build = 12 + 9 * Math.exp(-Math.pow((h - 30 - i * 3) / 14, 2)) + 2.5 * Math.sin(h / 6 + phase);
        const p50 = round1(Math.max(4, build));
        const spread = 0.28 + 0.12 * (h / 96);
        const cmpDiv = i === 3 ? 6 * Math.exp(-Math.pow((h - 26) / 10, 2)) : 0;
        forecast_atmospheric.push({ id: id * 1000 + h, target_id: id, source: 'google_weathernext2_ensemble', kind: 'ensemble', init_time: iso(ATMOS_INIT), forecast_time: iso(ft), lead_time_hours: h, member_count: 50, wind_p10_kn: round1(p50 * (1 - spread)), wind_p50_kn: p50, wind_p90_kn: round1(p50 * (1 + spread * 1.2)), gust_p90_kn: round1(p50 * (1 + spread * 1.2) * 1.28), wind_dir_mean_deg: Math.round(238 + 12 * Math.sin(h / 9 + phase)), wind_dir_spread_deg: Math.round(10 + 14 * spread), wind_members_kn: null, wind_dir_members_deg: null, visibility_p50_m: 15000, mslp_p50_hpa: 1007, precip_prob_pct: 30, fetched_at: iso(NOW - 0.8 * H) });
        const cmp = round1(p50 - cmpDiv + 1.5 * Math.sin(h / 5));
        forecast_atmospheric.push({ id: id * 1000 + 500 + h, target_id: id, source: 'ncep_gfs_global', kind: 'deterministic', init_time: iso(CMP_INIT), forecast_time: iso(ft), lead_time_hours: h, member_count: 1, wind_p10_kn: null, wind_p50_kn: cmp, wind_p90_kn: null, gust_p90_kn: null, wind_dir_mean_deg: Math.round(242 + (i === 3 ? 30 * Math.exp(-Math.pow((h - 26) / 10, 2)) : 0) + 8 * Math.sin(h / 8)), wind_dir_spread_deg: null, wind_members_kn: null, wind_dir_members_deg: null, visibility_p50_m: null, mslp_p50_hpa: null, precip_prob_pct: null, fetched_at: iso(NOW - 0.5 * H) });
      }
    }
    if (layer === 'marine') {
      for (let h = 0; h <= 96; h += 3) {
        const ft = MARINE_INIT + h * H;
        const swell = round2(0.8 + 0.6 * Math.exp(-Math.pow((h - 34 - i * 3) / 16, 2)) + 0.15 * Math.sin(h / 7));
        forecast_marine.push({ id: id * 1000 + h, target_id: id, source: 'meteofrance_wave', init_time: iso(MARINE_INIT), forecast_time: iso(ft), lead_time_hours: h, wave_height_m: round2(swell * 1.25), wave_period_s: 7, wave_dir_deg: 240, wind_wave_height_m: round2(swell * 0.6), swell_height_m: swell, swell_period_s: 9, swell_dir_deg: 236, sea_level_msl_m: null, current_speed_kn: 0.5, current_dir_deg: 30, sst_c: 29.4, fetched_at: iso(NOW - 2.5 * H) });
      }
    }
    if (layer === 'tidal') {
      const t0 = floorTo(NOW - 12 * H, 1);
      for (let h = 0; h <= 84; h++) {
        const ft = t0 + h * H;
        const ph = (h / 12.42) * 2 * Math.PI + i * 0.2;
        const height = round2(1.35 + 1.05 * Math.sin(ph) + 0.12 * Math.sin(2 * ph));
        const dh = Math.cos(ph);
        forecast_tidal.push({ id: id * 1000 + h, target_id: id, source: 'tidesatlas', station_id: 'TH-0421', station_name: 'Ko Lanta', station_distance_km: 6.4, forecast_time: iso(ft), tide_height_m: height, tide_state: Math.abs(dh) < 0.15 ? (dh > 0 ? 'high' : 'low') : dh > 0 ? 'flood' : 'ebb', datum: 'LAT', fetched_at: iso(NOW - 3 * H) });
      }
    }
  }
}

export const app_settings: Row[] = [
  { key: 'disagreement_thresholds', value: { wind_speed_kn: 5, wind_dir_deg: 15, light_air_floor_kn: 8 }, description: null, updated_at: iso(NOW - 30 * 24 * H) },
];

export function buildDb(): FixtureDb {
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
  return clone({ vessels, passages, waypoints, conditions_runs, waypoint_conditions, anchorage_conditions, passage_briefings, ingest_targets, passage_ingest_targets, forecast_atmospheric, forecast_marine, forecast_tidal, app_settings });
}
