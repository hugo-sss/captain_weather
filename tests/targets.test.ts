import { describe, expect, it } from 'vitest';
import { planTargets, sampleRouteGrid, tidalPoints } from '../supabase/functions/_shared/targets.ts';

const route = [{ lat: 7.8167, lon: 98.35 }, { lat: 7.6, lon: 98.3667 }, { lat: 7.74, lon: 98.778 }, { lat: 7.52, lon: 99.08 }];

describe('ingest target planning (§11.1)', () => {
  it('samples the route on a 0.25° grid with no duplicates', () => {
    const g = sampleRouteGrid(route, 0.25);
    expect(g.length).toBeGreaterThanOrEqual(3);
    expect(new Set(g.map((p) => `${p.grid_lat},${p.grid_lon}`)).size).toBe(g.length);
    for (const p of g) { expect((p.grid_lat * 4) % 1).toBe(0); expect((p.grid_lon * 4) % 1).toBe(0); }
  });
  it('a 300 nm passage stays well under the daily budget', () => {
    const long = [{ lat: 1.3, lon: 103.8 }, { lat: 5.4, lon: 100.3 }];
    const g = sampleRouteGrid(long, 0.25);
    expect(g.length).toBeLessThan(40);
  });
  it('tidal targets sit at waypoints, atmospheric/comparison/marine along the corridor', () => {
    const { plan, horizon_end, grid_points } = planTargets(route.map((p, i) => ({ ...p, eta: `2026-09-10T0${i}:00:00Z`, departureFromHere: i === 2 ? '2026-09-11T00:00:00Z' : null })));
    expect(plan.filter((t) => t.layer === 'tidal')).toHaveLength(tidalPoints(route).length);
    expect(plan.filter((t) => t.layer === 'atmospheric')).toHaveLength(grid_points);
    expect(plan.filter((t) => t.layer === 'comparison')).toHaveLength(grid_points);
    expect(horizon_end).toBe('2026-09-12T00:00:00.000Z'); // stay end + 24 h
  });
});
