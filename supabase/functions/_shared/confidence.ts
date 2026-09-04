// Confidence governance. PRD §8.2. Computed by rules, never model-judged.
import type { ConfidenceLevel, Layer } from './contracts.ts';

export type ConfidenceRules = {
  low_confidence_lead_time_hours: number;      // default 120
  moderate_confidence_lead_time_hours: number; // default 72
  wide_spread_kn?: number;                     // default 15
};

export const DEFAULT_CONFIDENCE_RULES: ConfidenceRules = {
  low_confidence_lead_time_hours: 120,
  moderate_confidence_lead_time_hours: 72,
  wide_spread_kn: 15,
};

export type ConfidenceInput = {
  leadTimeHours: number | null;
  tropicalActivity: boolean;
  frontalActivity: boolean;
  complexCoastal: boolean;
  sourceDisagreement: boolean;
  windP10Kn: number | null;
  windP90Kn: number | null;
  dataGaps: Layer[];
};

export type ConfidenceResult = { level: ConfidenceLevel; triggers: string[] };

const RANK: Record<ConfidenceLevel, number> = { high: 3, moderate: 2, low: 1 };

export function confidenceForWaypoint(
  input: ConfidenceInput,
  rules: ConfidenceRules = DEFAULT_CONFIDENCE_RULES,
): ConfidenceResult {
  const triggers: string[] = [];
  let level: ConfidenceLevel = 'high';
  const cap = (l: ConfidenceLevel) => { if (RANK[l] < RANK[level]) level = l; };
  const lowH = rules.low_confidence_lead_time_hours;
  const modH = rules.moderate_confidence_lead_time_hours;
  const spread = rules.wide_spread_kn ?? 15;

  if (input.leadTimeHours !== null && input.leadTimeHours > lowH) {
    triggers.push('lead_time_gt_120h'); cap('low');
  } else if (input.leadTimeHours !== null && input.leadTimeHours > modH) {
    triggers.push('lead_time_72_120h'); cap('moderate');
  }
  if (input.tropicalActivity) { triggers.push('tropical_activity'); cap('low'); }
  if (input.frontalActivity) { triggers.push('frontal_activity'); cap('low'); }
  if (input.complexCoastal) { triggers.push('complex_coastal'); cap('moderate'); }
  if (input.sourceDisagreement) { triggers.push('source_disagreement'); cap('moderate'); }
  if (input.windP10Kn !== null && input.windP90Kn !== null && input.windP90Kn - input.windP10Kn > spread) {
    triggers.push('wide_ensemble_spread'); cap('moderate');
  }
  for (const layer of input.dataGaps) { triggers.push(`no_data_${layer}`); cap('low'); }

  return { level, triggers };
}

/** Passage-level confidence is the lowest level among the waypoints in scope. */
export function passageConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return 'low';
  return levels.reduce((worst, l) => (RANK[l] < RANK[worst] ? l : worst), 'high' as ConfidenceLevel);
}

export function confidenceInWords(level: ConfidenceLevel, triggers: string[]): string {
  const why: string[] = [];
  if (triggers.includes('lead_time_gt_120h')) why.push('the forecast lead time is beyond five days, where forecasts are rarely reliable');
  if (triggers.includes('lead_time_72_120h')) why.push('the forecast lead time is between three and five days');
  if (triggers.includes('tropical_activity')) why.push('tropical activity is flagged for this passage');
  if (triggers.includes('frontal_activity')) why.push('frontal activity is flagged for this passage');
  if (triggers.includes('complex_coastal')) why.push('at least one waypoint is in complex coastal terrain');
  if (triggers.includes('source_disagreement')) why.push('the primary and comparison models disagree');
  if (triggers.includes('wide_ensemble_spread')) why.push('the ensemble spread on wind speed is wide');
  const gaps = triggers.filter((t) => t.startsWith('no_data_')).map((t) => t.replace('no_data_', ''));
  if (gaps.length) why.push(`there is no ${gaps.join(', ')} data for at least one waypoint`);
  const head = level === 'high' ? 'Confidence in this briefing is high'
    : level === 'moderate' ? 'Confidence in this briefing is moderate' : 'Confidence in this briefing is low';
  return why.length ? `${head} because ${why.join('; ')}.` : `${head}.`;
}
