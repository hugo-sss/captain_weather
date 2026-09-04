// Passage engine. PRD §6. Pure functions, no I/O; shared with the
// compute-conditions edge function via supabase/functions/_shared/engine.ts.
import { haversineNm, initialBearingDeg, midpoint } from './geo.ts';

export type EngineWaypoint = {
  id: string;
  sequence: number;
  lat: number;
  lon: number;
  plannedSpeedKn?: number | null;
  isAnchorage: boolean;
  departureFromHere?: string | null;
  arrived: boolean;
  arrivedAt?: string | null;
};

export type CurrentAt = (lat: number, lon: number, iso: string) => { speedKn: number; dirTowardDeg: number } | null;

export type EngineInput = {
  departure: string; // ISO, passage.actual_departure ?? planned_departure
  cruiseSpeedKn: number;
  useCurrent: boolean;
  waypoints: EngineWaypoint[];
  currentAt?: CurrentAt;
  /** Optional current vessel position for re-checks (§6.4). Prepends a synthetic leg. */
  currentPosition?: { lat: number; lon: number; at?: string };
};

export type EngineLeg = {
  waypointId: string;
  sequence: number;
  fromWaypointId: string | null; // null for the origin row and for a synthetic position leg
  distanceNm: number;
  bearingDeg: number;
  stwKn: number;
  sogKn: number;
  hours: number;
  eta: string;
  departFrom: string;
  warnings: string[];
};

export type EngineOutput = {
  /** One row per waypoint in scope. The first row is the origin (distance 0). */
  legs: EngineLeg[];
  totalDistanceNm: number;
  totalHours: number;
  arrival: string;
  errors: string[];
  /** Index (in the sorted waypoint list) the passage was re-anchored from, if any. */
  anchoredFromSequence: number | null;
};

const MIN_SOG_KN = 1;
const HOUR_MS = 3_600_000;

const isoAdd = (iso: string, hours: number) => new Date(new Date(iso).getTime() + hours * HOUR_MS).toISOString();

function round(v: number, dp: number) {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
}

export function runEngine(input: EngineInput): EngineOutput {
  const errors: string[] = [];
  const sorted = [...input.waypoints].sort((a, b) => a.sequence - b.sequence);
  if (sorted.length === 0) {
    return { legs: [], totalDistanceNm: 0, totalHours: 0, arrival: input.departure, errors: ['no_waypoints'], anchoredFromSequence: null };
  }

  // §6.4 re-anchoring: start from the last arrived waypoint.
  let startIdx = 0;
  let departure = input.departure;
  let anchoredFromSequence: number | null = null;
  const lastArrived = sorted.map((w, i) => (w.arrived ? i : -1)).filter((i) => i >= 0).pop();
  if (lastArrived !== undefined) {
    startIdx = lastArrived;
    const w = sorted[lastArrived];
    departure = w.arrivedAt ?? input.departure;
    anchoredFromSequence = w.sequence;
    if (!w.arrivedAt) errors.push(`arrived_without_time:${w.id}`);
  }

  const legs: EngineLeg[] = [];
  let prev: { lat: number; lon: number; id: string | null; departFrom: string };

  if (input.currentPosition && lastArrived !== undefined) {
    // Synthetic leg from the reported position to the next waypoint.
    const at = input.currentPosition.at ?? departure;
    prev = { lat: input.currentPosition.lat, lon: input.currentPosition.lon, id: null, departFrom: at };
    startIdx = lastArrived + 1;
    if (startIdx >= sorted.length) {
      return { legs: [], totalDistanceNm: 0, totalHours: 0, arrival: at, errors: [...errors, 'all_waypoints_arrived'], anchoredFromSequence };
    }
  } else {
    const origin = sorted[startIdx];
    const originWarnings: string[] = [];
    let departFrom = departure;
    if (origin.isAnchorage && origin.departureFromHere) {
      if (new Date(origin.departureFromHere).getTime() < new Date(departure).getTime()) {
        originWarnings.push('stay_window_invalid');
      } else {
        departFrom = origin.departureFromHere;
      }
    }
    legs.push({
      waypointId: origin.id, sequence: origin.sequence, fromWaypointId: null,
      distanceNm: 0, bearingDeg: 0, stwKn: 0, sogKn: 0, hours: 0,
      eta: departure, departFrom, warnings: originWarnings,
    });
    prev = { lat: origin.lat, lon: origin.lon, id: origin.id, departFrom };
    startIdx += 1;
  }

  let totalDistanceNm = 0;
  let totalHours = 0;

  for (let i = startIdx; i < sorted.length; i++) {
    const w = sorted[i];
    const warnings: string[] = [];
    const distanceNm = haversineNm(prev.lat, prev.lon, w.lat, w.lon);
    const bearingDeg = distanceNm > 0 ? initialBearingDeg(prev.lat, prev.lon, w.lat, w.lon) : 0;
    const stwKn = w.plannedSpeedKn ?? input.cruiseSpeedKn;

    let sogKn = stwKn;
    let hours: number;
    let eta: string;
    if (!(stwKn > 0)) {
      warnings.push('invalid_speed');
      errors.push(`invalid_speed:${w.id}`);
      hours = 0;
      eta = prev.departFrom;
      sogKn = 0;
    } else {
      hours = distanceNm / stwKn;
      if (input.useCurrent && input.currentAt) {
        // One refinement pass: sample the current at the leg midpoint at the
        // first-pass mid-leg time, then recompute SOG.
        const mid = midpoint(prev.lat, prev.lon, w.lat, w.lon);
        const midTime = isoAdd(prev.departFrom, hours / 2);
        const cur = input.currentAt(mid.lat, mid.lon, midTime);
        if (cur) {
          const rel = ((cur.dirTowardDeg - bearingDeg) * Math.PI) / 180;
          sogKn = Math.max(MIN_SOG_KN, stwKn + cur.speedKn * Math.cos(rel));
          hours = distanceNm / sogKn;
          warnings.push('current_adjusted');
        }
      }
      eta = isoAdd(prev.departFrom, hours);
    }

    let departFrom = eta;
    if (w.isAnchorage) {
      if (!w.departureFromHere) {
        warnings.push('stay_window_missing');
      } else if (new Date(w.departureFromHere).getTime() < new Date(eta).getTime()) {
        warnings.push('stay_window_invalid');
      } else {
        departFrom = w.departureFromHere;
      }
    }

    legs.push({
      waypointId: w.id, sequence: w.sequence, fromWaypointId: prev.id,
      distanceNm: round(distanceNm, 2), bearingDeg: round(bearingDeg, 1),
      stwKn, sogKn: round(sogKn, 2), hours: round(hours, 4), eta, departFrom, warnings,
    });
    totalDistanceNm += distanceNm;
    totalHours += hours;
    prev = { lat: w.lat, lon: w.lon, id: w.id, departFrom };
  }

  const arrival = legs.length ? legs[legs.length - 1].eta : departure;
  const passageHours = (new Date(arrival).getTime() - new Date(departure).getTime()) / HOUR_MS;
  return {
    legs,
    totalDistanceNm: round(totalDistanceNm, 2),
    // Total passage time includes anchorage stays; totalHours of the legs alone is the sum of leg hours.
    totalHours: round(Math.max(passageHours, totalHours), 4),
    arrival,
    errors,
    anchoredFromSequence,
  };
}

export { haversineNm, initialBearingDeg } from './geo.ts';
