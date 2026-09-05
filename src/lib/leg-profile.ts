// Phase 5: conditions between waypoints. Pure helpers that turn `leg_conditions` rows into one
// continuous picture per leg (points ordered along the leg, along-leg maxima, route segments).
import type { LegConditionsRow, RiskFlag, SquallRisk, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { haversineNm, intermediatePoint } from '@/lib/passage-engine/geo.ts';

export const RISK_RANK: Record<RiskFlag, number> = { unknown: 0, green: 1, amber: 2, red: 3 };
export const SQUALL_RANK: Record<SquallRisk, number> = { none: 0, possible: 1, likely: 2 };
export const SQUALL_LABEL: Record<SquallRisk, string> = { none: 'none', possible: 'possible', likely: 'likely' };

export const asSquall = (v: unknown): SquallRisk => (v === 'possible' || v === 'likely' ? v : 'none');
export const asRisk = (v: unknown): RiskFlag => (v === 'green' || v === 'amber' || v === 'red' ? v : 'unknown');

/** One virtual point along a leg, numbers coerced, with its distance from the leg start. */
export type LegPoint = {
  id: string; seq: number; fraction: number; distanceNm: number; lat: number; lon: number; eta: string;
  leadHours: number | null;
  windP10: number | null; windP50: number | null; windP90: number | null; windDir: number | null; windSpread: number | null;
  gustP90: number | null; gustSource: string | null;
  cmpWind: number | null; cmpDir: number | null; disagreement: boolean;
  waveHs: number | null; waveDir: number | null; wavePeriod: number | null;
  swellHs: number | null; swellDir: number | null; swellPeriod: number | null;
  currentKn: number | null; currentDir: number | null;
  precipPct: number | null; capeJkg: number | null; mslpHpa: number | null; visibilityM: number | null;
  squall: SquallRisk; speedLossPct: number | null;
  risk: RiskFlag; riskReasons: string[]; confidence: string; confidenceTriggers: string[]; dataGaps: string[];
};

export type LegSummary = {
  maxWindP90: number | null; maxGustP90: number | null; maxHs: number | null; maxCurrentKn: number | null;
  worstRisk: RiskFlag; worstSquall: SquallRisk; meanSpeedLossPct: number | null;
  /** Point carrying the worst risk (highest rank, then highest wind p90). */
  worstPoint: LegPoint | null;
};

export type LegProfileData = {
  fromId: string; toId: string; from: WaypointRow | null; to: WaypointRow | null;
  legIndex: number; distanceNm: number; points: LegPoint[]; summary: LegSummary;
};

const strList = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

export function toLegPoint(r: LegConditionsRow, distanceNm: number): LegPoint {
  return {
    id: r.id, seq: r.seq, fraction: Number(r.fraction), distanceNm, lat: Number(r.lat), lon: Number(r.lon), eta: r.eta,
    leadHours: num(r.lead_time_hours),
    windP10: num(r.wind_p10_kn), windP50: num(r.wind_p50_kn), windP90: num(r.wind_p90_kn), windDir: num(r.wind_dir_mean_deg), windSpread: num(r.wind_dir_spread_deg),
    gustP90: num(r.gust_p90_kn), gustSource: r.gust_source ?? null,
    cmpWind: num(r.comparison_wind_kn), cmpDir: num(r.comparison_wind_dir_deg), disagreement: !!r.source_disagreement,
    waveHs: num(r.wave_height_m), waveDir: num(r.wave_dir_deg), wavePeriod: num(r.wave_period_s),
    swellHs: num(r.swell_height_m), swellDir: num(r.swell_dir_deg), swellPeriod: num(r.swell_period_s),
    currentKn: num(r.current_speed_kn), currentDir: num(r.current_dir_deg),
    precipPct: num(r.precip_prob_pct), capeJkg: num(r.cape_p50_jkg), mslpHpa: num(r.mslp_p50_hpa), visibilityM: num(r.visibility_p50_m),
    squall: asSquall(r.squall_risk), speedLossPct: num(r.speed_loss_pct),
    risk: asRisk(r.risk_flag), riskReasons: strList(r.risk_reasons), confidence: r.confidence_level, confidenceTriggers: strList(r.confidence_triggers), dataGaps: strList(r.data_gaps),
  };
}

const maxOf = (vals: (number | null)[]): number | null => vals.reduce<number | null>((m, v) => (v === null ? m : m === null ? v : Math.max(m, v)), null);
const meanOf = (vals: (number | null)[]): number | null => { const xs = vals.filter((v): v is number => v !== null); return xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null; };

export function summarisePoints(points: LegPoint[]): LegSummary {
  let worstRisk: RiskFlag = points.length ? 'green' : 'unknown';
  let worstSquall: SquallRisk = 'none';
  let worstPoint: LegPoint | null = null;
  for (const p of points) {
    if (RISK_RANK[p.risk] > RISK_RANK[worstRisk]) worstRisk = p.risk;
    if (SQUALL_RANK[p.squall] > SQUALL_RANK[worstSquall]) worstSquall = p.squall;
    if (!worstPoint || RISK_RANK[p.risk] > RISK_RANK[worstPoint.risk] || (RISK_RANK[p.risk] === RISK_RANK[worstPoint.risk] && (p.windP90 ?? -1) > (worstPoint.windP90 ?? -1))) worstPoint = p;
  }
  // A leg with only 'unknown' points is unknown, not green.
  if (points.length && points.every((p) => p.risk === 'unknown')) worstRisk = 'unknown';
  return {
    maxWindP90: maxOf(points.map((p) => p.windP90)), maxGustP90: maxOf(points.map((p) => p.gustP90)), maxHs: maxOf(points.map((p) => p.waveHs)), maxCurrentKn: maxOf(points.map((p) => p.currentKn)),
    worstRisk, worstSquall, meanSpeedLossPct: meanOf(points.map((p) => p.speedLossPct)), worstPoint,
  };
}

/**
 * Group `leg_conditions` rows by (from, to) in passage order. Rows arrive ordered by from_waypoint_id, seq
 * (the query order) so the grouping re-sorts by seq and orders legs by the waypoint sequence.
 */
export function groupLegConditions(rows: LegConditionsRow[], waypoints: WaypointRow[]): LegProfileData[] {
  const byId = new Map(waypoints.map((w) => [w.id, w]));
  const groups = new Map<string, LegConditionsRow[]>();
  for (const r of rows) {
    const k = `${r.from_waypoint_id}|${r.to_waypoint_id}`;
    const g = groups.get(k);
    if (g) g.push(r); else groups.set(k, [r]);
  }
  const legs: LegProfileData[] = [];
  for (const [k, g] of groups) {
    const [fromId, toId] = k.split('|');
    const from = byId.get(fromId) ?? null, to = byId.get(toId) ?? null;
    const distanceNm = to && num(to.leg_distance_nm) !== null ? (num(to.leg_distance_nm) as number) : from && to ? haversineNm(Number(from.lat), Number(from.lon), Number(to.lat), Number(to.lon)) : 0;
    const points = [...g].sort((a, b) => a.seq - b.seq).map((r) => toLegPoint(r, Math.round(Number(r.fraction) * distanceNm * 10) / 10));
    legs.push({ fromId, toId, from, to, legIndex: to ? to.sequence - 1 : Number.MAX_SAFE_INTEGER, distanceNm, points, summary: summarisePoints(points) });
  }
  legs.sort((a, b) => a.legIndex - b.legIndex);
  return legs;
}

/** One coloured piece of the route polyline. `risk` null = no leg data on this stretch (drawn in the accent). */
export type RouteSegment = { positions: [number, number][]; risk: RiskFlag | null; label?: string };

/**
 * Route segments between consecutive points along each leg, coloured by that point's risk_flag.
 * Each point's flag applies from the midpoint before it to the midpoint after it, so the tint changes where
 * the assessment changes rather than at the point itself. Legs without data fall back to a single segment
 * carrying the waypoint flag supplied by `fallbackRisk` (or null).
 */
export function buildRouteSegments(waypoints: WaypointRow[], legs: LegProfileData[], fallbackRisk: (toWaypointId: string) => RiskFlag | null = () => null): RouteSegment[] {
  const out: RouteSegment[] = [];
  const legBy = new Map(legs.map((l) => [`${l.fromId}|${l.toId}`, l]));
  for (let i = 1; i < waypoints.length; i++) {
    const a = waypoints[i - 1], b = waypoints[i];
    const A: [number, number] = [Number(a.lat), Number(a.lon)], B: [number, number] = [Number(b.lat), Number(b.lon)];
    const leg = legBy.get(`${a.id}|${b.id}`);
    if (!leg || leg.points.length === 0) { out.push({ positions: [A, B], risk: fallbackRisk(b.id) }); continue; }
    const pts = leg.points;
    // Boundaries: 0, midpoints between consecutive fractions, 1.
    const bounds = [0, ...pts.slice(1).map((p, j) => (pts[j].fraction + p.fraction) / 2), 1];
    for (let j = 0; j < pts.length; j++) {
      const f0 = bounds[j], f1 = bounds[j + 1];
      if (f1 <= f0) continue;
      const P0 = f0 === 0 ? A : ll(intermediatePoint(A[0], A[1], B[0], B[1], f0));
      const P1 = f1 === 1 ? B : ll(intermediatePoint(A[0], A[1], B[0], B[1], f1));
      out.push({ positions: [P0, P1], risk: pts[j].risk, label: `${a.name ?? ''} → ${b.name ?? ''} · ${pts[j].distanceNm.toFixed(1)} nm` });
    }
  }
  return out;
}
const ll = (p: { lat: number; lon: number }): [number, number] => [p.lat, p.lon];

/** Worst point across the whole passage, for the Simplified hero. */
export function worstPointAlongPassage(legs: LegProfileData[]): { leg: LegProfileData; point: LegPoint } | null {
  let best: { leg: LegProfileData; point: LegPoint } | null = null;
  for (const leg of legs) {
    const p = leg.summary.worstPoint;
    if (!p) continue;
    if (!best || RISK_RANK[p.risk] > RISK_RANK[best.point.risk] || (RISK_RANK[p.risk] === RISK_RANK[best.point.risk] && (p.windP90 ?? -1) > (best.point.windP90 ?? -1))) best = { leg, point: p };
  }
  return best;
}

/** Sea-state ETA delta in minutes (adjusted minus planned); null when either is missing or they match to the minute. */
export function etaDeltaMinutes(etaPlanned: string | null | undefined, eta: string | null | undefined): number | null {
  if (!etaPlanned || !eta) return null;
  const d = Math.round((Date.parse(eta) - Date.parse(etaPlanned)) / 60_000);
  return Number.isFinite(d) && d !== 0 ? d : null;
}

export function fmtEtaDelta(minutes: number): string {
  const sign = minutes > 0 ? '+' : '−';
  const m = Math.abs(minutes), h = Math.floor(m / 60), mm = m % 60;
  return `${sign}${h ? `${h} h ` : ''}${mm ? `${mm} m` : h ? '' : '0 m'}`.trim();
}
