// Feature 12: material change = any of risk_flag worsened, source_disagreement newly true,
// confidence_level dropped, wind p90 moved > 5 kn, wave moved > 0.5 m, tide at an anchorage moved > 0.3 m.
import type { ConfidenceLevel, RiskFlag } from './contracts.ts';
import { RISK_RANK } from './risk.ts';

export type CondForDiff = {
  waypoint_id: string; risk_flag: RiskFlag; source_disagreement: boolean; confidence_level: ConfidenceLevel;
  wind_p90_kn: number | null; wave_height_m: number | null; tide_height_m: number | null;
};
export type MaterialChange = { waypoint_id: string; sequence?: number; waypoint_name?: string | null; field: string; from: unknown; to: unknown; note?: string };

const CONF_RANK: Record<ConfidenceLevel, number> = { high: 3, moderate: 2, low: 1 };
export const MATERIAL_THRESHOLDS = { wind_p90_kn: 5, wave_height_m: 0.5, tide_height_m: 0.3 };

export function materialChanges(
  previous: CondForDiff[], current: CondForDiff[],
  meta: Record<string, { sequence: number; name: string | null; is_anchorage: boolean }> = {},
): MaterialChange[] {
  const prevBy = new Map(previous.map((c) => [c.waypoint_id, c]));
  const out: MaterialChange[] = [];
  for (const c of current) {
    const p = prevBy.get(c.waypoint_id);
    if (!p) continue; // new waypoint: nothing to diff against
    const m = meta[c.waypoint_id];
    const base = { waypoint_id: c.waypoint_id, sequence: m?.sequence, waypoint_name: m?.name ?? null };
    if (RISK_RANK[c.risk_flag] > RISK_RANK[p.risk_flag]) out.push({ ...base, field: 'risk_flag', from: p.risk_flag, to: c.risk_flag, note: 'worsened' });
    if (c.source_disagreement && !p.source_disagreement) out.push({ ...base, field: 'source_disagreement', from: false, to: true, note: 'models now diverge' });
    if (CONF_RANK[c.confidence_level] < CONF_RANK[p.confidence_level]) out.push({ ...base, field: 'confidence_level', from: p.confidence_level, to: c.confidence_level, note: 'dropped' });
    if (c.wind_p90_kn !== null && p.wind_p90_kn !== null && Math.abs(c.wind_p90_kn - p.wind_p90_kn) > MATERIAL_THRESHOLDS.wind_p90_kn) out.push({ ...base, field: 'wind_p90_kn', from: p.wind_p90_kn, to: c.wind_p90_kn, note: `moved > ${MATERIAL_THRESHOLDS.wind_p90_kn} kn` });
    if (c.wave_height_m !== null && p.wave_height_m !== null && Math.abs(c.wave_height_m - p.wave_height_m) > MATERIAL_THRESHOLDS.wave_height_m) out.push({ ...base, field: 'wave_height_m', from: p.wave_height_m, to: c.wave_height_m, note: `moved > ${MATERIAL_THRESHOLDS.wave_height_m} m` });
    if (m?.is_anchorage && c.tide_height_m !== null && p.tide_height_m !== null && Math.abs(c.tide_height_m - p.tide_height_m) > MATERIAL_THRESHOLDS.tide_height_m) out.push({ ...base, field: 'tide_height_m', from: p.tide_height_m, to: c.tide_height_m, note: `anchorage tide moved > ${MATERIAL_THRESHOLDS.tide_height_m} m` });
  }
  return out;
}
