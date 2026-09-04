import { describe, expect, it } from 'vitest';
import { runEngine, type EngineInput } from '../src/lib/passage-engine/engine.ts';
import { haversineNm, initialBearingDeg, intermediatePoint } from '../src/lib/passage-engine/geo.ts';

// 3-leg fixture (scripts/fixtures/passage-3leg.csv). Hand calculation with
// R = 3440.065 nm, haversine:
//   Ao Chalong (7.8167, 98.3500) -> Racha Yai (7.6000, 98.3667)   = 13.049 nm
//   Racha Yai  -> Phi Phi Don (7.7400, 98.7780)                    = 25.877 nm
//   Phi Phi Don -> Koh Lanta (7.5200, 99.0800)                     = 22.304 nm
//   total 61.23 nm
const WP = [
  { id: 'a', sequence: 1, lat: 7.8167, lon: 98.35, isAnchorage: false, arrived: false },
  { id: 'b', sequence: 2, lat: 7.6, lon: 98.3667, isAnchorage: false, arrived: false },
  { id: 'c', sequence: 3, lat: 7.74, lon: 98.778, isAnchorage: false, arrived: false },
  { id: 'd', sequence: 4, lat: 7.52, lon: 99.08, isAnchorage: false, arrived: false },
];
const DEP = '2026-09-10T00:00:00.000Z';
const base: EngineInput = { departure: DEP, cruiseSpeedKn: 9, useCurrent: false, waypoints: WP };
const minutes = (iso: string) => new Date(iso).getTime() / 60000;

describe('geo', () => {
  it('haversine matches a hand calculation', () => {
    expect(haversineNm(7.8167, 98.35, 7.6, 98.3667)).toBeCloseTo(13.049, 1);
    expect(haversineNm(0, 0, 0, 1)).toBeCloseTo(60.04, 1); // one degree of longitude at the equator
  });
  it('bearing is normalised 0..360', () => {
    expect(initialBearingDeg(0, 0, 1, 0)).toBeCloseTo(0, 5);
    expect(initialBearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 5);
    expect(initialBearingDeg(0, 0, -1, 0)).toBeCloseTo(180, 5);
    expect(initialBearingDeg(0, 0, 0, -1)).toBeCloseTo(270, 5);
  });
  it('intermediate point crosses the antimeridian cleanly', () => {
    const p = intermediatePoint(0, 179, 0, -179, 0.5);
    expect(Math.abs(p.lon)).toBeCloseTo(180, 3);
    expect(p.lat).toBeCloseTo(0, 6);
  });
});

describe('passage engine (§6)', () => {
  it('3-leg passage at 9 kn matches a hand calculation within one minute', () => {
    const out = runEngine(base);
    expect(out.legs).toHaveLength(4);
    expect(out.legs[0].eta).toBe(DEP);
    // hours = 13.049/9 = 1.4499 h -> 86.99 min
    const eta1 = minutes(DEP) + (13.049 / 9) * 60;
    const eta2 = eta1 + (25.877 / 9) * 60;
    const eta3 = eta2 + (22.304 / 9) * 60;
    expect(Math.abs(minutes(out.legs[1].eta) - eta1)).toBeLessThan(1);
    expect(Math.abs(minutes(out.legs[2].eta) - eta2)).toBeLessThan(1);
    expect(Math.abs(minutes(out.legs[3].eta) - eta3)).toBeLessThan(1);
    expect(out.totalDistanceNm).toBeCloseTo(61.23, 1);
    expect(out.arrival).toBe(out.legs[3].eta);
  });

  it('changing one leg planned_speed_kn shifts only downstream ETAs', () => {
    const a = runEngine(base);
    const b = runEngine({ ...base, waypoints: WP.map((w) => (w.id === 'c' ? { ...w, plannedSpeedKn: 6 } : w)) });
    expect(b.legs[1].eta).toBe(a.legs[1].eta);
    expect(b.legs[2].eta).not.toBe(a.legs[2].eta);
    expect(minutes(b.legs[2].eta) - minutes(a.legs[2].eta)).toBeCloseTo((25.877 / 6 - 25.877 / 9) * 60, 0);
    // Leg 3 keeps its own duration but starts later.
    expect(b.legs[3].hours).toBeCloseTo(a.legs[3].hours, 6);
  });

  it('anchorage stay window sets the departure for the next leg; an invalid window is flagged', () => {
    const stayEnd = '2026-09-11T00:00:00.000Z';
    const out = runEngine({ ...base, waypoints: WP.map((w) => (w.id === 'c' ? { ...w, isAnchorage: true, departureFromHere: stayEnd } : w)) });
    expect(out.legs[2].departFrom).toBe(stayEnd);
    expect(minutes(out.legs[3].eta)).toBeCloseTo(minutes(stayEnd) + (22.304 / 9) * 60, 0);
    expect(out.totalHours).toBeGreaterThan(24);

    const bad = runEngine({ ...base, waypoints: WP.map((w) => (w.id === 'c' ? { ...w, isAnchorage: true, departureFromHere: DEP } : w)) });
    expect(bad.legs[2].warnings).toContain('stay_window_invalid');
    expect(bad.legs[2].departFrom).toBe(bad.legs[2].eta);
  });

  it('zero speed is an error for that leg, not a crash', () => {
    const out = runEngine({ ...base, waypoints: WP.map((w) => (w.id === 'b' ? { ...w, plannedSpeedKn: 0 } : w)) });
    expect(out.errors).toContain('invalid_speed:b');
    expect(out.legs[1].warnings).toContain('invalid_speed');
  });

  it('current adjustment: a fair current shortens the leg, clamped to 1 kn minimum', () => {
    const fair = runEngine({ ...base, useCurrent: true, currentAt: () => ({ speedKn: 2, dirTowardDeg: 184 }) });
    expect(fair.legs[1].sogKn).toBeGreaterThan(9);
    expect(fair.legs[1].warnings).toContain('current_adjusted');
    const foul = runEngine({ ...base, useCurrent: true, currentAt: () => ({ speedKn: 20, dirTowardDeg: 4 }) });
    expect(foul.legs[1].sogKn).toBe(1);
  });

  it('re-anchors from the last arrived waypoint (§6.4)', () => {
    const arrivedAt = '2026-09-10T02:00:00.000Z';
    const out = runEngine({ ...base, waypoints: WP.map((w) => (w.sequence <= 2 ? { ...w, arrived: true, arrivedAt: w.id === 'b' ? arrivedAt : DEP } : w)) });
    expect(out.anchoredFromSequence).toBe(2);
    expect(out.legs[0].waypointId).toBe('b');
    expect(out.legs[0].eta).toBe(arrivedAt);
    expect(out.legs.map((l) => l.waypointId)).toEqual(['b', 'c', 'd']);
    expect(minutes(out.legs[1].eta)).toBeCloseTo(minutes(arrivedAt) + (25.877 / 9) * 60, 0);
  });

  it('prepends a synthetic leg from a current position on re-check', () => {
    const out = runEngine({
      ...base,
      currentPosition: { lat: 7.7, lon: 98.5, at: '2026-09-10T03:00:00.000Z' },
      waypoints: WP.map((w) => (w.sequence <= 2 ? { ...w, arrived: true, arrivedAt: DEP } : w)),
    });
    expect(out.legs[0].waypointId).toBe('c');
    expect(out.legs[0].fromWaypointId).toBeNull();
    expect(out.legs[0].distanceNm).toBeGreaterThan(0);
  });
});
