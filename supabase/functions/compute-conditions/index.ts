// compute-conditions: PRD §7 + Phase 5. POST { passage_id, kind: 'initial' | 'recheck', current_position?, trigger? }.
// Runs the engine, joins each waypoint ETA to the newest init of each layer, and (Phase 5)
// also evaluates virtual points BETWEEN waypoints, falls back for gusts when the primary
// ensemble has none, flags convective squall risk, and adjusts ETAs for sea-state speed loss.
import { adminClient, callerOwnsPassage, cronAuthorized, type Admin } from '../_shared/runtime/supabaseAdmin.ts';
import { json, preflight, readJson } from '../_shared/runtime/http.ts';
import { loadSettings, type Settings } from '../_shared/runtime/settings.ts';
import { coerceVessel, engineFor, loadPassage, persistEngine, persistTargetPlan, type PassageRow, type VesselRow, type WaypointRow } from '../_shared/runtime/planTargets.ts';
import { latestRowsAround, loadActiveTargets, maxTargetDistanceKm, nearestTarget, pickAtTime, rowsInWindow, tidalRowsAround, tidalRowsInWindow, type TargetIndex } from '../_shared/runtime/forecastLookup.ts';
import { confidenceForWaypoint } from '../_shared/confidence.ts';
import { riskFlag, sourceDisagreement, type VesselThresholds } from '../_shared/risk.ts';
import { ukcEstimate } from '../_shared/ukc.ts';
import { circularMeanDeg, circularRangeDeg, mean, median } from '../_shared/stats.ts';
import { legSampleFractions, speedLossPct, squallRisk, worstRisk } from '../_shared/leg-profile.ts';
import { intermediatePoint, type EngineLeg, type EngineOutput } from '../_shared/engine.ts';
import type { Layer, RiskFlag } from '../_shared/contracts.ts';

type Body = { passage_id?: string; kind?: 'initial' | 'recheck'; current_position?: { lat: number; lon: number; at?: string }; trigger?: 'manual' | 'scheduled' };
type Row = Record<string, unknown>;
const HOUR = 3_600_000;
const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const r1 = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<Body>(req);
  if (!body.passage_id) return json({ error: 'passage_id required' }, 400);
  const kind = body.kind === 'recheck' ? 'recheck' : 'initial';
  const trigger = body.trigger === 'scheduled' ? 'scheduled' : 'manual';
  if (!(await cronAuthorized(req)) && !(await callerOwnsPassage(req, body.passage_id))) return json({ error: 'not found' }, 404);

  const admin = adminClient();
  const { data: prev } = await admin.from('conditions_runs').select('id').eq('passage_id', body.passage_id).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: run, error: runErr } = await admin.from('conditions_runs').insert({ passage_id: body.passage_id, kind, trigger, status: 'running', previous_run_id: kind === 'recheck' ? prev?.id ?? null : null }).select('id').single();
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

type LegGeometry = { leg: EngineLeg; fromId: string | null; fromLat: number; fromLon: number; toLat: number; toLon: number; startIso: string };

/** Pair each engine leg with the coordinates it runs between and the time it starts. */
function legGeometry(engine: EngineOutput, byId: Map<string, WaypointRow>, currentPosition?: Body['current_position']): LegGeometry[] {
  const out: LegGeometry[] = [];
  let prev: { id: string | null; lat: number; lon: number; departFrom: string } | null = currentPosition ? { id: null, lat: currentPosition.lat, lon: currentPosition.lon, departFrom: currentPosition.at ?? engine.legs[0]?.departFrom ?? '' } : null;
  for (const leg of engine.legs) {
    const w = byId.get(leg.waypointId);
    if (!w) continue;
    const toLat = Number(w.lat), toLon = Number(w.lon);
    if (prev) out.push({ leg, fromId: prev.id, fromLat: prev.lat, fromLon: prev.lon, toLat, toLon, startIso: prev.departFrom });
    else out.push({ leg, fromId: null, fromLat: toLat, fromLon: toLon, toLat, toLon, startIso: leg.eta }); // origin row
    prev = { id: w.id, lat: toLat, lon: toLon, departFrom: leg.departFrom };
  }
  return out;
}

async function computeRun(admin: Admin, runId: string, passageId: string, kind: 'initial' | 'recheck', currentPosition?: Body['current_position']) {
  const settings = await loadSettings(admin);
  const loaded = await loadPassage(admin, passageId);
  const passage = loaded.passage; const vessel = coerceVessel(loaded.vessel); const waypoints = loaded.waypoints;
  if (waypoints.length < 2) throw new Error('a passage needs at least two waypoints');
  const byId = new Map(waypoints.map((w) => [w.id, w]));
  const thresholds: VesselThresholds = { max_wind_kn: n(vessel.max_wind_kn), max_gust_kn: n(vessel.max_gust_kn), max_wave_m: n(vessel.max_wave_m), max_current_kn: n(vessel.max_current_kn), min_ukc_m: n(vessel.min_ukc_m) };
  const sourcesUsed: Record<string, unknown> = {};

  // 1. Engine at planned speed; targets planned before the run (§11.1).
  const planned = engineFor(passage, vessel, waypoints, currentPosition);
  await persistTargetPlan(admin, passage, waypoints, planned, settings);
  const idx = await loadActiveTargets(admin);

  // 2. Sea-state speed loss per leg from the marine forecast at points along the leg (Phase 5).
  const lossByWaypoint = new Map<string, number>();
  for (const g of legGeometry(planned, byId, currentPosition)) {
    if (g.leg.distanceNm <= 0 || g.leg.hours <= 0) continue;
    const fractions = legSampleFractions(g.leg.hours, settings.leg_sampling);
    const samples = fractions.length ? fractions : [0.5];
    const losses: number[] = [];
    for (const f of samples) {
      const p = intermediatePoint(g.fromLat, g.fromLon, g.toLat, g.toLon, f);
      const eta = new Date(Date.parse(g.startIso) + g.leg.hours * f * HOUR).toISOString();
      const m = await marineAt(admin, settings, idx, p.lat, p.lon, eta);
      if (m) losses.push(speedLossPct(m.hs, m.waveDir, g.leg.bearingDeg, settings.speed_loss));
    }
    const loss = losses.length ? mean(losses) ?? 0 : 0;
    lossByWaypoint.set(g.leg.waypointId, Math.round(loss * 10) / 10);
  }
  const adjustedWaypoints = waypoints.map((w) => {
    const loss = lossByWaypoint.get(w.id) ?? 0;
    const stw = n(w.planned_speed_kn) ?? Number(vessel.cruise_speed_kn);
    return loss > 0 ? { ...w, planned_speed_kn: Math.max(1, stw * (1 - loss / 100)) } : w;
  });
  const engine = engineFor(passage, vessel, adjustedWaypoints, currentPosition);
  await persistEngine(admin, engine);
  const plannedEta = new Map(planned.legs.map((l) => [l.waypointId, l.eta]));

  // 3. Waypoints, anchorages and the points between them.
  const rows: Row[] = [];
  const legRows: Row[] = [];
  const legSummaries: Row[] = [];
  for (const g of legGeometry(engine, byId, currentPosition)) {
    const w = byId.get(g.leg.waypointId)!;
    const loss = lossByWaypoint.get(w.id) ?? 0;
    const ev = await evaluatePoint(admin, settings, idx, passage, vessel, thresholds, {
      lat: Number(w.lat), lon: Number(w.lon), eta: g.leg.eta, isAnchorage: w.is_anchorage, complexCoastal: w.is_complex_coastal,
      chartedDepthM: n(w.charted_depth_m), withTidal: true, withUkc: true,
    }, sourcesUsed);
    rows.push({ run_id: runId, waypoint_id: w.id, ...ev.out, eta_planned: plannedEta.get(w.id) ?? g.leg.eta, speed_loss_pct: loss > 0 ? loss : null });
    if (w.is_anchorage && w.planned_departure_from_here) {
      const anch = await anchorageFor(admin, settings, idx, passage, vessel, thresholds, w, g.leg);
      if (anch) await admin.from('anchorage_conditions').upsert({ run_id: runId, waypoint_id: w.id, ...anch }, { onConflict: 'run_id,waypoint_id' });
    }

    // Virtual points along the leg into this waypoint (skipped for the origin row and a synthetic position leg).
    if (!g.fromId || g.leg.distanceNm <= 0) continue;
    const fractions = legSampleFractions(g.leg.hours, settings.leg_sampling);
    const flags: RiskFlag[] = [];
    let maxWindP90: number | null = null, maxGust: number | null = null, maxWave: number | null = null, maxCurrent: number | null = null, worstSquall = 'none';
    let worstAt: Row | null = null;
    const rank: Record<string, number> = { green: 0, unknown: 1, amber: 2, red: 3 };
    for (let k = 0; k < fractions.length; k++) {
      const f = fractions[k];
      const p = intermediatePoint(g.fromLat, g.fromLon, g.toLat, g.toLon, f);
      const eta = new Date(Date.parse(g.startIso) + g.leg.hours * f * HOUR).toISOString();
      const pt = await evaluatePoint(admin, settings, idx, passage, vessel, thresholds, {
        lat: p.lat, lon: p.lon, eta, isAnchorage: false, complexCoastal: false, chartedDepthM: null, withTidal: false, withUkc: false,
      }, sourcesUsed);
      const o = pt.out;
      legRows.push({
        run_id: runId, from_waypoint_id: g.fromId, to_waypoint_id: w.id, seq: k, fraction: f, lat: Math.round(p.lat * 1e6) / 1e6, lon: Math.round(p.lon * 1e6) / 1e6, eta,
        lead_time_hours: o.lead_time_hours ?? null, atmos_init_time: o.atmos_init_time ?? null,
        wind_p10_kn: o.wind_p10_kn ?? null, wind_p50_kn: o.wind_p50_kn ?? null, wind_p90_kn: o.wind_p90_kn ?? null,
        wind_dir_mean_deg: o.wind_dir_mean_deg ?? null, wind_dir_spread_deg: o.wind_dir_spread_deg ?? null,
        gust_p90_kn: o.gust_p90_kn ?? null, gust_source: o.gust_source ?? null,
        comparison_source: o.comparison_source ?? null, comparison_wind_kn: o.comparison_wind_kn ?? null, comparison_wind_dir_deg: o.comparison_wind_dir_deg ?? null,
        wind_speed_delta_kn: o.wind_speed_delta_kn ?? null, wind_dir_delta_deg: o.wind_dir_delta_deg ?? null, source_disagreement: !!o.source_disagreement,
        wave_height_m: o.wave_height_m ?? null, wave_dir_deg: o.wave_dir_deg ?? null, wave_period_s: o.wave_period_s ?? null,
        swell_height_m: o.swell_height_m ?? null, swell_dir_deg: o.swell_dir_deg ?? null, swell_period_s: o.swell_period_s ?? null,
        current_speed_kn: o.current_speed_kn ?? null, current_dir_deg: o.current_dir_deg ?? null,
        precip_prob_pct: o.precip_prob_pct ?? null, cape_p50_jkg: o.cape_p50_jkg ?? null, mslp_p50_hpa: o.mslp_p50_hpa ?? null, visibility_p50_m: o.visibility_p50_m ?? null,
        squall_risk: o.squall_risk ?? 'none', speed_loss_pct: loss > 0 ? loss : null,
        risk_flag: o.risk_flag, risk_reasons: o.risk_reasons, confidence_level: o.confidence_level, confidence_triggers: o.confidence_triggers, data_gaps: pt.gaps,
      });
      const flag = o.risk_flag as RiskFlag;
      flags.push(flag);
      const bump = (cur: number | null, v: unknown) => { const x = n(v); return x === null ? cur : cur === null ? x : Math.max(cur, x); };
      maxWindP90 = bump(maxWindP90, o.wind_p90_kn); maxGust = bump(maxGust, o.gust_p90_kn); maxWave = bump(maxWave, o.wave_height_m); maxCurrent = bump(maxCurrent, o.current_speed_kn);
      const sq = String(o.squall_risk ?? 'none');
      if ((sq === 'likely') || (sq === 'possible' && worstSquall === 'none')) worstSquall = sq;
      if (!worstAt || rank[flag] > rank[String(worstAt.risk_flag)] || (rank[flag] === rank[String(worstAt.risk_flag)] && (n(o.wind_p90_kn) ?? 0) > (n(worstAt.wind_p90_kn) ?? 0))) {
        worstAt = { fraction: f, eta, lat: p.lat, lon: p.lon, risk_flag: flag, wind_p90_kn: o.wind_p90_kn ?? null, wave_height_m: o.wave_height_m ?? null, risk_reasons: o.risk_reasons };
      }
    }
    legSummaries.push({ to_waypoint_id: w.id, sequence: w.sequence, points: fractions.length, speed_loss_pct: loss > 0 ? loss : null, max_wind_p90_kn: maxWindP90, max_gust_p90_kn: maxGust, max_wave_m: maxWave, max_current_kn: maxCurrent, worst_risk: worstRisk(flags), squall: worstSquall, worst_at: worstAt });
  }

  const { error } = await admin.from('waypoint_conditions').upsert(rows, { onConflict: 'run_id,waypoint_id' });
  if (error) throw new Error(`waypoint_conditions upsert: ${error.message}`);
  if (legRows.length) {
    const { error: legErr } = await admin.from('leg_conditions').upsert(legRows, { onConflict: 'run_id,from_waypoint_id,seq' });
    if (legErr) throw new Error(`leg_conditions upsert: ${legErr.message}`);
  }
  return {
    kind, waypoints: rows.length, leg_points: legRows.length, legs: legSummaries, sources_used: sourcesUsed,
    engine: { total_distance_nm: engine.totalDistanceNm, total_hours: engine.totalHours, arrival: engine.arrival, planned_arrival: planned.arrival, errors: engine.errors, anchored_from_sequence: engine.anchoredFromSequence },
  };
}

/** Wave height and direction at a point and time, or null when no marine grid point / series covers it. */
async function marineAt(admin: Admin, s: Settings, idx: TargetIndex, lat: number, lon: number, eta: string): Promise<{ hs: number | null; waveDir: number | null } | null> {
  const mt = nearestTarget(idx, 'marine', lat, lon);
  if (!mt || mt.distanceKm > maxTargetDistanceKm(s.ingest_grid.spacing_deg)) return null;
  const { rows } = await latestRowsAround(admin, 'forecast_marine', mt.target.id, s.sources.marine, eta);
  const pick = pickAtTime(rows, eta, ['wave_dir_deg', 'swell_dir_deg', 'current_dir_deg']);
  if (!pick) return null;
  return { hs: n(pick.row.wave_height_m), waveDir: n(pick.row.wave_dir_deg) };
}

type PointSpec = { lat: number; lon: number; eta: string; isAnchorage: boolean; complexCoastal: boolean; chartedDepthM: number | null; withTidal: boolean; withUkc: boolean };

/** Join one point in space and time to the newest forecast of each layer and apply the rules. Shared by waypoints and along-leg points. */
async function evaluatePoint(admin: Admin, s: Settings, idx: TargetIndex, passage: PassageRow, vessel: VesselRow, th: VesselThresholds, pt: PointSpec, sourcesUsed: Record<string, unknown>): Promise<{ out: Row; gaps: Layer[]; atmosOk: boolean }> {
  const { lat, lon, eta } = pt;
  const maxKm = maxTargetDistanceKm(s.ingest_grid.spacing_deg);
  const gaps: Layer[] = [];
  const out: Row = { eta };

  // --- atmospheric (primary ensemble) ---------------------------------------
  const at = nearestTarget(idx, 'atmospheric', lat, lon);
  let atmosOk = false;
  let atmosTargetId: number | null = null;
  if (!at || at.distanceKm > maxKm) gaps.push('atmospheric');
  else {
    atmosTargetId = at.target.id;
    const { rows, init_time } = await latestRowsAround(admin, 'forecast_atmospheric', at.target.id, s.sources.atmospheric_primary, eta);
    const pick = pickAtTime(rows, eta, ['wind_dir_mean_deg']);
    if (!pick) gaps.push('atmospheric');
    else {
      atmosOk = true;
      const r = pick.row;
      Object.assign(out, {
        atmos_source: s.sources.atmospheric_primary, atmos_init_time: init_time, atmos_forecast_time: pick.forecast_time,
        lead_time_hours: init_time ? Math.round(((Date.parse(eta) - Date.parse(init_time)) / HOUR) * 10) / 10 : null,
        wind_p10_kn: n(r.wind_p10_kn), wind_p50_kn: n(r.wind_p50_kn), wind_p90_kn: n(r.wind_p90_kn),
        wind_dir_mean_deg: n(r.wind_dir_mean_deg), wind_dir_spread_deg: n(r.wind_dir_spread_deg), gust_p90_kn: n(r.gust_p90_kn),
        gust_source: n(r.gust_p90_kn) !== null ? s.sources.atmospheric_primary : null,
        precip_prob_pct: n(r.precip_prob_pct), cape_p50_jkg: n(r.cape_p50_jkg), visibility_p50_m: n(r.visibility_p50_m), mslp_p50_hpa: n(r.mslp_p50_hpa),
      });
      sourcesUsed.atmospheric = { source: s.sources.atmospheric_primary, init_time };

      // Gust and CAPE fallback (Phase 5): the primary ensemble may carry neither gusts nor CAPE.
      // Secondary ensemble, then the comparison model, then (gusts only) a labelled estimate from
      // the p90 wind. Gust provenance is stored in gust_source; CAPE keeps the same order.
      if (out.gust_p90_kn === null || out.cape_p50_jkg === null) {
        for (const src of [s.sources.atmospheric_secondary, s.sources.comparison]) {
          if (out.gust_p90_kn !== null && out.cape_p50_jkg !== null) break;
          const alt = await latestRowsAround(admin, 'forecast_atmospheric', at.target.id, src, eta);
          const ap = pickAtTime(alt.rows, eta, ['wind_dir_mean_deg']);
          if (!ap) continue;
          const g = n(ap.row.gust_p90_kn);
          if (out.gust_p90_kn === null && g !== null) { out.gust_p90_kn = g; out.gust_source = src; }
          const cape = n(ap.row.cape_p50_jkg);
          if (out.cape_p50_jkg === null && cape !== null) out.cape_p50_jkg = cape;
        }
        if (out.gust_p90_kn === null && n(out.wind_p90_kn) !== null) {
          const factor = s.risk_defaults.gust_factor_if_missing;
          out.gust_p90_kn = r1((n(out.wind_p90_kn) as number) * factor);
          out.gust_source = `estimated_x${factor}`;
        }
      }
    }
  }

  // --- marine ---------------------------------------------------------------
  const mt = nearestTarget(idx, 'marine', lat, lon);
  if (!mt || mt.distanceKm > maxKm) gaps.push('marine');
  else {
    const { rows, init_time } = await latestRowsAround(admin, 'forecast_marine', mt.target.id, s.sources.marine, eta);
    const pick = pickAtTime(rows, eta, ['wave_dir_deg', 'swell_dir_deg', 'current_dir_deg']);
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

  // --- tidal (waypoints and anchorages only; mid-leg points do not need a station) ---
  if (pt.withTidal) {
    const tt = nearestTarget(idx, 'tidal', lat, lon);
    if (!tt || tt.distanceKm > maxKm) gaps.push('tidal');
    else {
      const rows = await tidalRowsAround(admin, tt.target.id, eta);
      const pick = pickAtTime(rows, eta, []);
      if (!pick) gaps.push('tidal');
      else {
        const r = pick.row;
        Object.assign(out, { tidal_source: r.source, tide_station_id: r.station_id, tide_height_m: n(r.tide_height_m), tide_datum: r.datum, tide_state: pick.interpolated ? null : r.tide_state });
        sourcesUsed.tidal = { source: r.source, station_id: r.station_id, datum: r.datum };
      }
    }
  }

  // --- comparison (Feature 11) via the forecast_comparison view -------------
  let disagreement = false;
  if (atmosOk && atmosTargetId !== null) {
    const etaHour = new Date(Math.round(Date.parse(eta) / HOUR) * HOUR).toISOString();
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

  // --- squall (Phase 5 heuristic from CAPE + precipitation probability) ------
  const squall = squallRisk(n(out.cape_p50_jkg), n(out.precip_prob_pct), s.squall);
  out.squall_risk = squall;

  // --- UKC, risk, confidence --------------------------------------------------
  const ukc = pt.withUkc ? ukcEstimate({ draftM: n(vessel.draft_m), chartedDepthM: pt.chartedDepthM, tideHeightM: n(out.tide_height_m), swellHeightM: n(out.swell_height_m), isAnchorage: pt.isAnchorage }) : { ukcEstimateM: null, basis: 'none' as const };
  if (pt.withUkc) Object.assign(out, { charted_depth_m: pt.chartedDepthM, ukc_estimate_m: ukc.ukcEstimateM, ukc_basis: ukc.basis });
  const risk = riskFlag({ windP50Kn: n(out.wind_p50_kn), windP90Kn: n(out.wind_p90_kn), gustP90Kn: n(out.gust_p90_kn), waveHeightM: n(out.wave_height_m), currentSpeedKn: n(out.current_speed_kn), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: disagreement, atmosphericGap: !atmosOk }, th, s.risk_defaults.amber_fraction_of_limit);
  let flag: RiskFlag = risk.flag;
  const reasons = [...risk.reasons];
  if (squall !== 'none') {
    const note = `squall risk ${squall} (CAPE ${Math.round(n(out.cape_p50_jkg) ?? 0)} J/kg, precip prob ${Math.round(n(out.precip_prob_pct) ?? 0)}%)`;
    reasons.push(note);
    if (squall === 'likely' && flag === 'green') flag = 'amber';
  }
  const conf = confidenceForWaypoint({ leadTimeHours: n(out.lead_time_hours), tropicalActivity: passage.tropical_activity_flag, frontalActivity: passage.frontal_activity_flag, complexCoastal: pt.complexCoastal, sourceDisagreement: disagreement, windP10Kn: n(out.wind_p10_kn), windP90Kn: n(out.wind_p90_kn), dataGaps: gaps }, s.confidence_rules);
  const gapReasons = gaps.map((g) => `no ${g} data within ${Math.round(maxKm)} km / ±6 h of ETA`);
  Object.assign(out, { risk_flag: flag, risk_reasons: [...reasons, ...gapReasons], confidence_level: conf.level, confidence_triggers: conf.triggers });
  return { out, gaps, atmosOk };
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

  const nums = (rows: Row[], k: string) => rows.map((r) => n(r[k])).filter((v): v is number => v !== null);
  const max = (v: number[]) => (v.length ? Math.max(...v) : null);
  const min = (v: number[]) => (v.length ? Math.min(...v) : null);
  const windP50 = median(nums(atmos, 'wind_p50_kn'));
  const windMaxP90 = max(nums(atmos, 'wind_p90_kn'));
  let gustMaxP90 = max(nums(atmos, 'gust_p90_kn'));
  let capeMax = max(nums(atmos, 'cape_p50_jkg'));
  if ((gustMaxP90 === null || capeMax === null) && at && at.distanceKm <= maxKm) {
    const alt = await rowsInWindow(admin, 'forecast_atmospheric', at.target.id, s.sources.atmospheric_secondary, stayStart, stayEnd);
    if (gustMaxP90 === null) gustMaxP90 = max(nums(alt, 'gust_p90_kn'));
    if (capeMax === null) capeMax = max(nums(alt, 'cape_p50_jkg'));
    if (gustMaxP90 === null && windMaxP90 !== null) gustMaxP90 = r1(windMaxP90 * s.risk_defaults.gust_factor_if_missing);
  }
  const dirs = nums(atmos, 'wind_dir_mean_deg');
  const tideMin = min(nums(tidal, 'tide_height_m')), tideMax = max(nums(tidal, 'tide_height_m'));
  const swellMax = max(nums(marine, 'swell_height_m'));
  const squall = squallRisk(capeMax, max(nums(atmos, 'precip_prob_pct')), s.squall);
  // Minimum UKC over the stay: lowest tide paired with the largest swell in the window (conservative).
  const ukc = ukcEstimate({ draftM: n(vessel.draft_m), chartedDepthM: n(w.charted_depth_m), tideHeightM: tideMin, swellHeightM: swellMax, isAnchorage: true });
  const risk = riskFlag({ windP50Kn: windP50, windP90Kn: windMaxP90, gustP90Kn: gustMaxP90, waveHeightM: max(nums(marine, 'wave_height_m')), currentSpeedKn: max(nums(marine, 'current_speed_kn')), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: false, atmosphericGap: atmos.length === 0 }, th, s.risk_defaults.amber_fraction_of_limit);
  const initTime = atmos[0]?.init_time as string | undefined;
  const lead = initTime ? (Date.parse(stayEnd) - Date.parse(initTime)) / HOUR : null;
  const conf = confidenceForWaypoint({ leadTimeHours: lead, tropicalActivity: passage.tropical_activity_flag, frontalActivity: passage.frontal_activity_flag, complexCoastal: w.is_complex_coastal, sourceDisagreement: false, windP10Kn: min(nums(atmos, 'wind_p10_kn')), windP90Kn: windMaxP90, dataGaps: gaps }, s.confidence_rules);
  const reasons = [...risk.reasons];
  let flag: RiskFlag = risk.flag;
  if (squall !== 'none') { reasons.push(`squall risk ${squall} during the stay`); if (squall === 'likely' && flag === 'green') flag = 'amber'; }
  return {
    stay_start: stayStart, stay_end: stayEnd, hours_evaluated: atmos.length,
    wind_p50_kn: windP50, wind_max_p90_kn: windMaxP90, gust_max_p90_kn: gustMaxP90,
    wind_dir_predominant_deg: circularMeanDeg(dirs), wind_dir_range_deg: circularRangeDeg(dirs),
    wave_max_m: max(nums(marine, 'wave_height_m')), swell_max_m: swellMax, swell_dir_predominant_deg: circularMeanDeg(nums(marine, 'swell_dir_deg')),
    tide_min_m: tideMin, tide_max_m: tideMax, tide_range_m: tideMin !== null && tideMax !== null ? Math.round((tideMax - tideMin) * 100) / 100 : null,
    min_ukc_estimate_m: ukc.ukcEstimateM, exposure_tag: w.anchorage_exposure_tag, squall_risk: squall,
    confidence_triggers: conf.triggers, confidence_level: conf.level, risk_flag: flag,
    risk_reasons: [...reasons, ...gaps.map((g) => `no ${g} data in the stay window`)],
  };
}
