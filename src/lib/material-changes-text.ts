// One plain line per material change, shared by the changes banner and the alert cards.
import type { MaterialChange } from '../../supabase/functions/_shared/material-changes.ts';

const FIELD: Record<string, string> = { risk_flag: 'Risk', source_disagreement: 'Models', confidence_level: 'Confidence', wind_p90_kn: 'Wind, high end', wave_height_m: 'Sea', tide_height_m: 'Tide', squall_risk: 'Squall risk', speed_loss_pct: 'Speed loss' };
const UNIT: Record<string, string> = { wind_p90_kn: ' kn', wave_height_m: ' m', tide_height_m: ' m', speed_loss_pct: ' %' };
const val = (v: unknown, field: string) => (v === true ? 'disagree' : v === false ? 'agree' : v === null || v === undefined ? 'no data' : `${String(v)}${UNIT[field] ?? ''}`);

/** "Ko Ha: Wind, high end 24 kn to 31 kn, moved > 5 kn" split into its parts. */
export function changeLine(c: MaterialChange): { where: string; what: string; from: string; to: string; note: string | null; numeric: boolean } {
  const from = val(c.from, c.field), to = val(c.to, c.field);
  return { where: c.waypoint_name ?? (c.sequence !== undefined ? `Waypoint ${c.sequence}` : ''), what: FIELD[c.field] ?? c.field.replace(/_/g, ' '), from, to, note: c.note ?? null, numeric: /\d/.test(from) || /\d/.test(to) };
}
