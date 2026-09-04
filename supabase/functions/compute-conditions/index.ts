// compute-conditions: PRD §7. POST { passage_id, kind: 'initial' | 'recheck', current_position? }.
// One conditions_runs row per invocation; never left 'running'.
import { adminClient, callerOwnsPassage, type Admin } from '../_shared/runtime/supabaseAdmin.ts';
import { json, preflight, readJson } from '../_shared/runtime/http.ts';
import { loadSettings, type Settings } from '../_shared/runtime/settings.ts';
import { coerceVessel, engineFor, loadPassage, persistEngine, persistTargetPlan, type PassageRow, type VesselRow, type WaypointRow } from '../_shared/runtime/planTargets.ts';
import { latestRowsAround, loadActiveTargets, maxTargetDistanceKm, nearestTarget, pickAtTime, rowsInWindow, tidalRowsAround, tidalRowsInWindow, type TargetIndex } from '../_shared/runtime/forecastLookup.ts';
import { confidenceForWaypoint } from '../_shared/confidence.ts';
import { riskFlag, sourceDisagreement, type VesselThresholds } from '../_shared/risk.ts';
import { ukcEstimate } from '../_shared/ukc.ts';
import { circularMeanDeg, circularRangeDeg, median } from '../_shared/stats.ts';
import type { Layer } from '../_shared/contracts.ts';
import type { EngineLeg } from '../_shared/engine.ts';

type Body = { passage_id?: string; kind?: 'initial' | 'recheck'; current_position?: { lat: number; lon: number; at?: string } };
const HOUR = 3_600_000;
const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<Body>(req);
  if (!body.passage_id) return json({ error: 'passage_id required' }, 400);
  const kind = body.kind === 'recheck' ? 'recheck' : 'initial';
  if (!(await callerOwnsPassage(req, body.passage_id))) return json({ error: 'not found' }, 404);

  const admin = adminClient();
  const { data: prev } = await admin.from('conditions_runs').select('id').eq('passage_id', body.passage_id).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: run, error: runErr } = await admin.from('conditions_runs').insert({ passage_id: body.passage_id, kind, status: 'running', previous_run_id: kind === 'recheck' ? prev?.id ?? null : null }).select('id').single();
  if (runErr || !run) return json({ error: runErr?.message ?? 'could not create run' }, 500);

  try {
    const result = await computeRun(admin, run.id, body.passage_id, kind, body.current_position);
    await admin.from('conditions_runs').update({ status: 'complete', completed_at: new Date().toISOString(), sources_used: result.sources_used, waypoints_evaluated: result.waypoints }).eq('id', run.id);
    return json({ ok: true, run_id: run.id, previous_run_id: prev?.id ?? null, ...result });
  } catch (e) {
    const msg = (e as Error).message;
    console.error('compute-conditions failed', e);
    await admin.from('conditions_runs').update({ status: 'failed', completed_at: new Date().toISOString(), error: msg }).eq('id', run.id);
    return json({ error: msg, run_id: run.id }, 500);
  }
});

async function computeRun(admin: Admin, runId: string, passageId: string, kind: 'initial' | 'recheck', currentPosition?: Body['current_position']) {
  const settings = await loadSettings(admin);
  const loaded = await loadPassage(admin, passageId);
  const passage = loaded.passage; const vessel = coerceVessel(loaded.vessel); const waypoints = loaded.waypoints;
  if (waypoints.length < 2) throw new Error('a passage needs at least two waypoints');

  // 1. Engine, persisted; targets planned before the run (§11.1).
  const engine = engineFor(passage, vessel, waypoints, currentPosition);
  await persistEngine(admin, engine);
  await persistTargetPlan(admin, passage, waypoints, engine, settings);
  const idx = await loadActiveTargets(admin);

  const byId = new Map(waypoints.map((w) => [w.id, w]));
  const thresholds: VesselThresholds = { max_wind_kn: n(vessel.max_wind_kn), max_gust_kn: n(vessel.max_gust_kn), max_wave_m: n(vessel.max_wave_m), max_current_kn: n(vessel.max_current_kn), min_ukc_m: n(vessel.min_ukc_m) };
  const sourcesUsed: Record<string, unknown> = {};
  const rows: Record<string, unknown>[] = [];

  for (const leg of engine.legs) {
    const w = byId.get(leg.waypointId);
    if (!w) continue;
    const row = await conditionsForWaypoint(admin, settings, idx, passage, vessel, thresholds, w, leg, sourcesUsed);
    rows.push({ run_id: runId, waypoint_id: w.id, ...row });
    if (w.is_anchorage && w.planned_departure_from_here) {
      const anch = await anchorageFor(admin, settings, idx, passage, vessel, thresholds, w, leg);
      if (anch) await admin.from('anchorage_conditions').upsert({ run_id: runId, waypoint_id: w.id, ...anch }, { onConflict: 'run_id,waypoint_id' });
    }
  }
  const { error } = await admin.from('waypoint_conditions').upsert(rows, { onConflict: 'run_id,waypoint_id' });
  if (error) throw new Error(`waypoint_conditions upsert: ${error.message}`);
  return { kind, waypoints: rows.length, sources_used: sourcesUsed, engine: { total_distance_nm: engine.totalDistanceNm, total_hours: engine.totalHours, arrival: engine.arrival, errors: engine.errors, anchored_from_sequence: engine.anchoredFromSequence } };
}

async function conditionsForWaypoint(admin: Admin, s: Settings, idx: TargetIndex, passage: PassageRow, vessel: VesselRow, th: VesselThresholds, w: WaypointRow, leg: EngineLeg, sourcesUsed: Record<string, unknown>) {
  const lat = Number(w.lat), lon = Number(w.lon);
  const maxKm = maxTargetDistanceKm(s.ingest_grid.spacing_deg);
  const gaps: Layer[] = [];
  const out: Record<string, unknown> = { eta: leg.eta };

  // --- atmospheric (primary ensemble) ---------------------------------------
  const at = nearestTarget(idx, 'atmospheric', lat, lon);
  let atmosOk = false;
  let atmosTargetId: number | null = null;
  if (!at || at.distanceKm > maxKm) gaps.push('atmospheric');
  else {
    atmosTargetId = at.target.id;
    const { rows, init_time } = await latestRowsAround(admin, 'forecast_atmospheric', at.target.id, s.sources.atmospheric_primary, leg.eta);
    const pick = pickAtTime(rows, leg.eta, ['wind_dir_mean_deg']);
    if (!pick) gaps.push('atmospheric');
    else {
      atmosOk = true;
      const r = pick.row;
      Object.assign(out, {
        atmos_source: s.sources.atmospheric_primary, atmos_init_time: init_time, atmos_forecast_time: pick.forecast_time,
        lead_time_hours: init_time ? Math.round(((Date.parse(leg.eta) - Date.parse(init_time)) / HOUR) * 10) / 10 : null,
        wind_p10_kn: n(r.wind_p10_kn), wind_p50_kn: n(r.wind_p50_kn), wind_p90_kn: n(r.wind_p90_kn),
        wind_dir_mean_deg: n(r.wind_dir_mean_deg), wind_dir_spread_deg: n(r.wind_dir_spread_deg), gust_p90_kn: n(r.gust_p90_kn),
        precip_prob_pct: n(r.precip_prob_pct), visibility_p50_m: n(r.visibility_p50_m), mslp_p50_hpa: n(r.mslp_p50_hpa),
      });
      sourcesUsed.atmospheric = { source: s.sources.atmospheric_primary, init_time };
    }
  }

  // --- marine ---------------------------------------------------------------
  const mt = nearestTarget(idx, 'marine', lat, lon);
  if (!mt || mt.distanceKm > maxKm) gaps.push('marine');
  else {
    const { rows, init_time } = await latestRowsAround(admin, 'forecast_marine', mt.target.id, s.sources.marine, leg.eta);
    const pick = pickAtTime(rows, leg.eta, ['wave_dir_deg', 'swell_dir_deg', 'current_dir_deg']);
    if (!pick) gaps.push('marine');
    else {
      const r = pick.row;
      Object.assign(out, {
        marine_source: s.sources.marine, marine_init_time: init_time,
        wave_height_m: n(r.wave_height_m), wave_dir_deg: n(r.wave_dir_deg), wave_period_s: n(r.wave_period_s),
        swell_height_m: n(r.swell_height_m), swell_dir_deg: n(r.swell_dir_deg), swell_period_s: n(r.swell_period_s),
        current_speed_kn: n(r.current_speed_kn), current_dir_deg: n(r.current_dir_deg),
      });
      sourcesUsed.marine = { source: s.sources.marine, init_time };
    }
  }

  // --- tidal ----------------------------------------------------------------
  const tt = nearestTarget(idx, 'tidal', lat, lon);
  if (!tt || tt.distanceKm > maxKm) gaps.push('tidal');
  else {
    const rows = await tidalRowsAround(admin, tt.target.id, leg.eta);
    const pick = pickAtTime(rows, leg.eta, []);
    if (!pick) gaps.push('tidal');
    else {
      const r = pick.row;
      Object.assign(out, { tidal_source: r.source, tide_station_id: r.station_id, tide_height_m: n(r.tide_height_m), tide_datum: r.datum, tide_state: pick.interpolated ? null : r.tide_state });
      sourcesUsed.tidal = { source: r.source, station_id: r.station_id, datum: r.datum };
    }
  }

  // --- comparison (Feature 11) via the forecast_comparison view -------------
  let disagreement = false;
  if (atmosOk && atmosTargetId !== null) {
    const etaHour = new Date(Math.round(Date.parse(leg.eta) / HOUR) * HOUR).toISOString();
    const { data: cmp } = await admin.from('forecast_comparison').select('*').eq('target_id', atmosTargetId).eq('primary_source', s.sources.atmospheric_primary).eq('forecast_time', etaHour).maybeSingle();
    if (cmp) {
      const d = sourceDisagreement({
        primarySource: cmp.primary_source, primaryWindP50Kn: n(out.wind_p50_kn), primaryWindDirDeg: n(out.wind_dir_mean_deg),
        comparisonSource: cmp.comparison_source, comparisonWindKn: n(cmp.comparison_wind_kn), comparisonWindDirDeg: n(cmp.comparison_wind_dir_deg),
      }, s.disagreement_thresholds);
      disagreement = d.disagreement;
      Object.assign(out, { comparison_source: cmp.comparison_source, comparison_wind_kn: n(cmp.comparison_wind_kn), comparison_wind_dir_deg: n(cmp.comparison_wind_dir_deg), wind_speed_delta_kn: d.windSpeedDeltaKn, wind_dir_delta_deg: d.windDirDeltaDeg, source_disagreement: disagreement, disagreement_detail: { ...d.detail, comparison_init_time: cmp.comparison_init_time } });
      sourcesUsed.comparison = { source: cmp.comparison_source, init_time: cmp.comparison_init_time };
    } else {
      out.source_disagreement = false;
      out.disagreement_detail = { note: 'no comparison row for this target and hour' };
    }
  }

  // --- UKC, risk, confidence --------------------------------------------------
  const ukc = ukcEstimate({ draftM: n(vessel.draft_m), chartedDepthM: n(w.charted_depth_m), tideHeightM: n(out.tide_height_m), swellHeightM: n(out.swell_height_m), isAnchorage: w.is_anchorage });
  Object.assign(out, { charted_depth_m: n(w.charted_depth_m), ukc_estimate_m: ukc.ukcEstimateM, ukc_basis: ukc.basis });
  const risk = riskFlag({ windP50Kn: n(out.wind_p50_kn), windP90Kn: n(out.wind_p90_kn), gustP90Kn: n(out.gust_p90_kn), waveHeightM: n(out.wave_height_m), currentSpeedKn: n(out.current_speed_kn), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: disagreement, atmosphericGap: !atmosOk }, th, s.risk_defaults.amber_fraction_of_limit);
  const conf = confidenceForWaypoint({ leadTimeHours: n(out.lead_time_hours), tropicalActivity: passage.tropical_activity_flag, frontalActivity: passage.frontal_activity_flag, complexCoastal: w.is_complex_coastal, sourceDisagreement: disagreement, windP10Kn: n(out.wind_p10_kn), windP90Kn: n(out.wind_p90_kn), dataGaps: gaps }, s.confidence_rules);
  const gapReasons = gaps.map((g) => `no ${g} data within ${Math.round(maxKm)} km / ±6 h of ETA`);
  Object.assign(out, { risk_flag: risk.flag, risk_reasons: [...risk.reasons, ...gapReasons], confidence_level: conf.level, confidence_triggers: conf.triggers });
  return out;
}

async function anchorageFor(admin: Admin, s: Settings, idx: TargetIndex, passage: PassageRow, vessel: VesselRow, th: VesselThresholds, w: WaypointRow, leg: EngineLeg) {
  const stayStart = leg.eta;
  const stayEnd = w.planned_departure_from_here!;
  if (Date.parse(stayEnd) <= Date.parse(stayStart)) return null;
  const lat = Number(w.lat), lon = Number(w.lon);
  const maxKm = maxTargetDistanceKm(s.ingest_grid.spacing_deg);
  const gaps: Layer[] = [];
  const at = nearestTarget(idx, 'atmospheric', lat, lon);
  const atmos = at && at.distanceKm <= maxKm ? await rowsInWindow(admin, 'forecast_atmospheric', at.target.id, s.sources.atmospheric_primary, stayStart, stayEnd) : [];
  if (atmos.length === 0) gaps.push('atmospheric');
  const mt = nearestTarget(idx, 'marine', lat, lon);
  const marine = mt && mt.distanceKm <= maxKm ? await rowsInWindow(admin, 'forecast_marine', mt.target.id, s.sources.marine, stayStart, stayEnd) : [];
  if (marine.length === 0) gaps.push('marine');
  const tt = nearestTarget(idx, 'tidal', lat, lon);
  const tidal = tt && tt.distanceKm <= maxKm ? await tidalRowsInWindow(admin, tt.target.id, stayStart, stayEnd) : [];
  if (tidal.length === 0) gaps.push('tidal');

  const nums = (rows: Record<string, unknown>[], k: string) => rows.map((r) => n(r[k])).filter((v): v is number => v !== null);
  const max = (v: number[]) => (v.length ? Math.max(...v) : null);
  const min = (v: number[]) => (v.length ? Math.min(...v) : null);
  const windP50 = median(nums(atmos, 'wind_p50_kn'));
  const windMaxP90 = max(nums(atmos, 'wind_p90_kn'));
  const gustMaxP90 = max(nums(atmos, 'gust_p90_kn'));
  const dirs = nums(atmos, 'wind_dir_mean_deg');
  const tideMin = min(nums(tidal, 'tide_height_m')), tideMax = max(nums(tidal, 'tide_height_m'));
  const swellMax = max(nums(marine, 'swell_height_m'));
  // Minimum UKC over the stay: lowest tide paired with the largest swell in the window (conservative).
  const ukc = ukcEstimate({ draftM: n(vessel.draft_m), chartedDepthM: n(w.charted_depth_m), tideHeightM: tideMin, swellHeightM: swellMax, isAnchorage: true });
  const risk = riskFlag({ windP50Kn: windP50, windP90Kn: windMaxP90, gustP90Kn: gustMaxP90, waveHeightM: max(nums(marine, 'wave_height_m')), currentSpeedKn: max(nums(marine, 'current_speed_kn')), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: false, atmosphericGap: atmos.length === 0 }, th, s.risk_defaults.amber_fraction_of_limit);
  const initTime = atmos[0]?.init_time as string | undefined;
  const lead = initTime ? (Date.parse(stayEnd) - Date.parse(initTime)) / HOUR : null;
  const conf = confidenceForWaypoint({ leadTimeHours: lead, tropicalActivity: passage.tropical_activity_flag, frontalActivity: passage.frontal_activity_flag, complexCoastal: w.is_complex_coastal, sourceDisagreement: false, windP10Kn: min(nums(atmos, 'wind_p10_kn')), windP90Kn: windMaxP90, dataGaps: gaps }, s.confidence_rules);
  return {
    stay_start: stayStart, stay_end: stayEnd, hours_evaluated: atmos.length,
    wind_p50_kn: windP50, wind_max_p90_kn: windMaxP90, gust_max_p90_kn: gustMaxP90,
    wind_dir_predominant_deg: circularMeanDeg(dirs), wind_dir_range_deg: circularRangeDeg(dirs),
    wave_max_m: max(nums(marine, 'wave_height_m')), swell_max_m: swellMax, swell_dir_predominant_deg: circularMeanDeg(nums(marine, 'swell_dir_deg')),
    tide_min_m: tideMin, tide_max_m: tideMax, tide_range_m: tideMin !== null && tideMax !== null ? Math.round((tideMax - tideMin) * 100) / 100 : null,
    min_ukc_estimate_m: ukc.ukcEstimateM, exposure_tag: w.anchorage_exposure_tag,
    confidence_triggers: conf.triggers, confidence_level: conf.level, risk_flag: risk.flag,
    risk_reasons: [...risk.reasons, ...gaps.map((g) => `no ${g} data in the stay window`)],
  };
}
