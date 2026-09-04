// Persist the §11.1 target plan for one passage. Shared by plan-targets and compute-conditions.
import type { Admin } from './supabaseAdmin.ts';
import { planTargets } from '../targets.ts';
import { runEngine, type EngineOutput } from '../engine.ts';
import type { Settings } from './settings.ts';

export type PassageRow = { id: string; vessel_id: string; planned_departure: string; actual_departure: string | null; status: string; tropical_activity_flag: boolean; frontal_activity_flag: boolean; name: string };
export type VesselRow = { id: string; name: string; cruise_speed_kn: number; draft_m: number | null; max_wind_kn: number | null; max_gust_kn: number | null; max_wave_m: number | null; max_current_kn: number | null; min_ukc_m: number | null };
export type WaypointRow = {
  id: string; passage_id: string; sequence: number; name: string | null; lat: number; lon: number; planned_speed_kn: number | null;
  is_anchorage: boolean; planned_departure_from_here: string | null; anchorage_exposure_tag: string | null; is_complex_coastal: boolean;
  charted_depth_m: number | null; arrived: boolean; arrived_at: string | null; eta: string | null;
};

export async function loadPassage(admin: Admin, passageId: string): Promise<{ passage: PassageRow; vessel: VesselRow; waypoints: WaypointRow[] }> {
  const { data: passage, error: e1 } = await admin.from('passages').select('*').eq('id', passageId).single();
  if (e1 || !passage) throw new Error(`passage not found: ${e1?.message ?? passageId}`);
  const { data: vessel, error: e2 } = await admin.from('vessels').select('*').eq('id', passage.vessel_id).single();
  if (e2 || !vessel) throw new Error(`vessel not found: ${e2?.message ?? passage.vessel_id}`);
  const { data: waypoints, error: e3 } = await admin.from('waypoints').select('*').eq('passage_id', passageId).order('sequence');
  if (e3) throw new Error(e3.message);
  return { passage: passage as PassageRow, vessel: vessel as VesselRow, waypoints: (waypoints ?? []).map(numeric) as WaypointRow[] };
}

/** PostgREST returns numeric columns as strings; coerce the ones we compute with. */
function numeric<T extends Record<string, unknown>>(row: T): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of ['lat', 'lon', 'planned_speed_kn', 'charted_depth_m', 'leg_distance_nm', 'leg_bearing_deg', 'cruise_speed_kn', 'draft_m', 'max_wind_kn', 'max_gust_kn', 'max_wave_m', 'max_current_kn', 'min_ukc_m']) {
    if (typeof out[k] === 'string') out[k] = Number(out[k]);
  }
  return out as T;
}
export const coerceVessel = (v: VesselRow) => numeric(v as unknown as Record<string, unknown>) as unknown as VesselRow;

export function engineFor(passage: PassageRow, vessel: VesselRow, waypoints: WaypointRow[], currentPosition?: { lat: number; lon: number; at?: string }): EngineOutput {
  return runEngine({
    departure: passage.actual_departure ?? passage.planned_departure,
    cruiseSpeedKn: Number(vessel.cruise_speed_kn),
    useCurrent: false,
    currentPosition,
    waypoints: waypoints.map((w) => ({
      id: w.id, sequence: w.sequence, lat: Number(w.lat), lon: Number(w.lon), plannedSpeedKn: w.planned_speed_kn,
      isAnchorage: w.is_anchorage, departureFromHere: w.planned_departure_from_here, arrived: w.arrived, arrivedAt: w.arrived_at,
    })),
  });
}

/** Write engine outputs back to waypoints (§7 step 1). */
export async function persistEngine(admin: Admin, out: EngineOutput): Promise<void> {
  for (const leg of out.legs) {
    await admin.from('waypoints').update({
      eta: leg.eta,
      leg_distance_nm: leg.fromWaypointId === null && leg.distanceNm === 0 ? null : leg.distanceNm,
      leg_bearing_deg: leg.fromWaypointId === null && leg.distanceNm === 0 ? null : leg.bearingDeg,
    }).eq('id', leg.waypointId);
  }
}

export async function persistTargetPlan(admin: Admin, passage: PassageRow, waypoints: WaypointRow[], engine: EngineOutput, settings: Settings) {
  const etaById = new Map(engine.legs.map((l) => [l.waypointId, l.eta]));
  const { plan, horizon_end, grid_points } = planTargets(
    waypoints.map((w) => ({ lat: Number(w.lat), lon: Number(w.lon), eta: etaById.get(w.id) ?? w.eta, departureFromHere: w.planned_departure_from_here })),
    settings.ingest_grid.spacing_deg,
  );
  // 1. Insert missing targets (ignore existing keys).
  const { error: insErr } = await admin.from('ingest_targets').upsert(
    plan.map((t) => ({ layer: t.layer, grid_lat: t.grid_lat, grid_lon: t.grid_lon, horizon_end: t.horizon_end, active: true })),
    { onConflict: 'layer,grid_lat,grid_lon', ignoreDuplicates: true },
  );
  if (insErr) throw new Error(`ingest_targets upsert: ${insErr.message}`);
  // 2. Fetch every target on the plan's keys.
  const ids: number[] = [];
  let created = 0;
  for (const layer of ['atmospheric', 'comparison', 'marine', 'tidal'] as const) {
    const keys = plan.filter((t) => t.layer === layer);
    if (keys.length === 0) continue;
    const { data, error } = await admin.from('ingest_targets').select('id, grid_lat, grid_lon, horizon_end, active, created_at')
      .eq('layer', layer).in('grid_lat', [...new Set(keys.map((k) => k.grid_lat))]).in('grid_lon', [...new Set(keys.map((k) => k.grid_lon))]);
    if (error) throw new Error(error.message);
    const wanted = new Set(keys.map((k) => `${Number(k.grid_lat)},${Number(k.grid_lon)}`));
    for (const row of data ?? []) {
      if (!wanted.has(`${Number(row.grid_lat)},${Number(row.grid_lon)}`)) continue;
      ids.push(row.id);
      if (Date.now() - Date.parse(row.created_at) < 60_000) created++;
      const needsExtend = !row.horizon_end || Date.parse(row.horizon_end) < Date.parse(horizon_end);
      if (needsExtend || !row.active) {
        await admin.from('ingest_targets').update({ horizon_end: needsExtend ? horizon_end : row.horizon_end, active: true }).eq('id', row.id);
      }
    }
  }
  // 3. Relink the passage.
  await admin.from('passage_ingest_targets').delete().eq('passage_id', passage.id);
  if (ids.length) {
    const { error } = await admin.from('passage_ingest_targets').upsert(ids.map((target_id) => ({ passage_id: passage.id, target_id })), { onConflict: 'passage_id,target_id' });
    if (error) throw new Error(error.message);
  }
  // 4. Deactivate targets no live passage needs.
  const { data: live } = await admin.from('passage_ingest_targets').select('target_id, passages!inner(status)').in('passages.status', ['planned', 'active']);
  const liveIds = new Set((live ?? []).map((r: { target_id: number }) => r.target_id));
  const { data: allActive } = await admin.from('ingest_targets').select('id').eq('active', true);
  const stale = (allActive ?? []).map((r: { id: number }) => r.id).filter((id: number) => !liveIds.has(id));
  if (stale.length) await admin.from('ingest_targets').update({ active: false }).in('id', stale);
  return { targets: ids.length, created, deactivated: stale.length, horizon_end, grid_points };
}
