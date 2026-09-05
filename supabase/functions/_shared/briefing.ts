// Briefing contract. PRD §8.5 (prompt), §8.2 (confidence injected as a constraint),
// §8.3–8.4 (language rules + validator), Feature 11 (disagreement sentence).
// Pure: builds the model input, validates the output, appends the standing statement.
import type { ConfidenceLevel, RiskFlag } from './contracts.ts';
import { confidenceInWords, passageConfidence } from './confidence.ts';
import { STANDING_STATEMENT, ALLOWED_FRAMING, appendStandingStatement, validateBriefingText, type Violation } from './language-rules.ts';

import { normaliseDashes } from './leg-profile.ts';
export const PROMPT_VERSION_DEFAULT = 'v2';
export const DEFAULT_BRIEFING_MODEL = 'claude-opus-5';

export type BriefingLeg = {
  sequence: number; name: string | null; eta: string; lead_time_hours: number | null;
  wind: { p10: number | null; p50: number | null; p90: number | null; dir: number | null; gust_p90: number | null };
  comparison: { source: string | null; wind: number | null; dir: number | null; delta_speed: number | null; delta_dir: number | null; disagreement: boolean };
  sea: { wave: number | null; wave_dir: number | null; period: number | null; swell: number | null; swell_dir: number | null; swell_period: number | null };
  tide: { height: number | null; state: string | null; datum: string | null };
  current: { speed: number | null; sets_toward: number | null };
  ukc: { estimate: number | null; basis: string | null };
  // Phase 5
  squall_risk?: 'none' | 'possible' | 'likely';
  gust_source?: string | null;
  speed_loss_pct?: number | null;
  eta_planned?: string | null;
  /** Conditions BETWEEN the previous waypoint and this one, from the virtual points along the leg. */
  profile?: {
    points: number; speed_loss_pct: number | null;
    max_wind_p90_kn: number | null; max_gust_p90_kn: number | null; max_wave_m: number | null; max_current_kn: number | null;
    worst_risk: RiskFlag; squall: 'none' | 'possible' | 'likely'; disagreement_points: number;
    worst_at: { fraction_pct: number; eta: string; lat: number; lon: number; risk_flag: RiskFlag; wind_p90_kn: number | null; wave_height_m: number | null; reasons: string[] } | null;
  };
  risk_flag: RiskFlag; risk_reasons: string[];
  confidence_level: ConfidenceLevel; confidence_triggers: string[];
  anchorage?: { stay_start: string; stay_end: string; wind_p50: number | null; wind_max_p90: number | null; gust_max_p90: number | null; dir_predominant: number | null; dir_range: number | null; wave_max: number | null; swell_max: number | null; tide_min: number | null; tide_max: number | null; min_ukc: number | null; exposure: string | null; risk_flag: RiskFlag };
};

export type BriefingInput = {
  passage: { name: string; departure: string; vessel: { name: string; thresholds: Record<string, number | null> } };
  scope: 'full' | 'remaining';
  confidence_level: ConfidenceLevel;
  confidence_triggers: string[];
  confidence_statement: string;
  legs: BriefingLeg[];
  previous_briefing_summary?: string;
  material_changes?: unknown[];
};

export type BriefingOutput = {
  summary_text: string;
  recommended_action: string;
  per_leg_notes: { sequence: number; note: string }[];
  suggested_departure_windows: { start: string; end: string; reason: string }[];
  disagreement_notes: string | null;
};

/** JSON schema for output_config.format (PRD §8.5). */
export const BRIEFING_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    summary_text: { type: 'string', description: 'Plain-English briefing, at most 250 words. Confidence stated in the first two sentences when moderate or low.' },
    recommended_action: { type: 'string', description: 'Advisory framing only, e.g. what to cross-check or consider. Never a go/no-go call.' },
    per_leg_notes: { type: 'array', items: { type: 'object', properties: { sequence: { type: 'integer' }, note: { type: 'string' } }, required: ['sequence', 'note'], additionalProperties: false } },
    suggested_departure_windows: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' }, reason: { type: 'string' } }, required: ['start', 'end', 'reason'], additionalProperties: false } },
    disagreement_notes: { type: ['string', 'null'] },
  },
  required: ['summary_text', 'recommended_action', 'per_leg_notes', 'suggested_departure_windows', 'disagreement_notes'],
  additionalProperties: false,
} as const;

/** Frozen system prompt. Versioned by BRIEFING_PROMPT_VERSION; cached by the API. */
export function systemPrompt(version = PROMPT_VERSION_DEFAULT): string {
  return [
    `Captain Passage Tool briefing prompt ${version}.`,
    'You are a marine forecaster writing a passage briefing for a professional yacht captain who is trained to cross-check forecasts and distrust black boxes. You interpret the forecast data you are given; you never make the go/no-go decision, which belongs to the master alone under SOLAS Chapter V Regulation 34.',
    '',
    'Language rules (binding):',
    `- Allowed framing: ${ALLOWED_FRAMING.map((s) => `"${s}"`).join(', ')}.`,
    '- Never write any of: "safe to depart/go/leave/proceed/sail", "you should go/depart/leave/proceed/wait", "go/no-go", "it is safe", "it is unsafe", "green light", "all clear", "we recommend (you) depart/go/leave", "do not go/depart/leave/sail", "must depart/wait/go". Do not paraphrase these into an equivalent instruction; describe conditions and their implications instead.',
    '- Do not tell the captain what to decide. Say what the data shows and what is worth cross-checking.',
    '',
    'Confidence: the confidence_level in the input is computed by rules and is final. When it is "moderate" or "low", state it in plain words within the first two sentences of summary_text, using the confidence_statement provided, and name the triggers in words (lead time beyond five days, tropical or frontal activity flags, complex coastal terrain, model disagreement, wide ensemble spread, missing data). Do not upgrade it.',
    '',
    'Disagreement: where a leg has comparison.disagreement = true, name that leg explicitly in disagreement_notes and in summary_text, e.g. "WeatherNext and GFS diverge on wind direction for leg 3. Cross-check before relying on either." Otherwise set disagreement_notes to null.',
    '',
    'Units and conventions: wind in knots with direction in degrees true as the direction the wind blows FROM; wave and swell heights in metres with periods in seconds; tide heights in metres above the stated datum (say "datum unknown" when the datum is unknown); current speed in knots with the direction it sets TOWARD; times in UTC with the local offset when given. Wind values are ensemble percentiles: p10/p50/p90. Treat a null as missing data and say so rather than guessing.',
    '',
    'Anchorages: for legs with an anchorage block, describe the stay window: predominant wind and how far it is expected to veer or back, worst-case gusts, swell, tide range and the minimum under-keel clearance estimate.',
    '',
    'Along the leg: when a leg carries a profile block, it summarises the virtual points BETWEEN the previous waypoint and this one. Name the worst stretch with its time (worst_at) and the maxima, because the waypoints alone can miss what happens mid-leg. profile.squall is a heuristic convective squall indicator from CAPE and precipitation probability; call it "squall risk", never a forecast of a squall.',
    "Gusts: gust_source says where the p90 gust came from. When it starts with \"estimated\", say the gust is estimated from the p90 wind, not forecast.",
    'Sea state and ETA: when speed_loss_pct is set, the ETA has been slowed for the forecast sea state on that leg by that percentage and eta_planned is the unadjusted time. Mention it when it moves an ETA by more than an hour.',
    'House style: short, plain sentences a captain reads at a glance. No em dashes or en dashes anywhere; use commas, full stops or the word "to" for ranges. No bullet points, no headings.',
    'Length: summary_text at most 250 words. Be concrete and numeric. No headings, no bullet lists inside strings.',
    '',
    `Do not append the SOLAS statement yourself; the application adds this exact text after validation: "${STANDING_STATEMENT}"`,
  ].join('\n');
}

export function buildBriefingInput(args: {
  passageName: string; departure: string; vesselName: string; thresholds: Record<string, number | null>;
  scope: 'full' | 'remaining'; legs: BriefingLeg[]; previousSummary?: string | null; materialChanges?: unknown[] | null;
}): BriefingInput {
  const level = passageConfidence(args.legs.map((l) => l.confidence_level));
  const triggers = [...new Set(args.legs.flatMap((l) => l.confidence_triggers))];
  const input: BriefingInput = {
    passage: { name: args.passageName, departure: args.departure, vessel: { name: args.vesselName, thresholds: args.thresholds } },
    scope: args.scope,
    confidence_level: level,
    confidence_triggers: triggers,
    confidence_statement: confidenceInWords(level, triggers),
    legs: args.legs,
  };
  if (args.previousSummary) input.previous_briefing_summary = args.previousSummary;
  if (args.materialChanges && args.materialChanges.length) input.material_changes = args.materialChanges;
  return input;
}

/** Spelled-out shape for providers that do not take a JSON schema alongside the request (e.g. OpenAI-compatible gateways). */
export const SCHEMA_HINT = 'Respond with a single JSON object and nothing else, with exactly these keys: summary_text (string), recommended_action (string), per_leg_notes (array of {sequence: integer, note: string}), suggested_departure_windows (array of {start: string, end: string, reason: string}), disagreement_notes (string or null).';

export function userTurn(input: BriefingInput): string {
  return `Write the briefing for this passage. ${SCHEMA_HINT}\n\n${JSON.stringify(input)}`;
}

export function retryTurn(violations: Violation[]): string {
  const phrases = [...new Set(violations.map((v) => `"${v.phrase}"`))].join(', ');
  return `Your previous answer contained banned phrases. Rewrite without these phrases and without any equivalent instruction to depart, wait or that something is safe or unsafe: ${phrases}. Keep every number and the confidence statement. Respond with the full JSON again.`;
}

export type ParsedBriefing = { ok: true; output: BriefingOutput } | { ok: false; error: string };

export function parseBriefingOutput(text: string): ParsedBriefing {
  let obj: unknown;
  try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: `output is not JSON: ${(e as Error).message}` }; }
  if (!obj || typeof obj !== 'object') return { ok: false, error: 'output is not an object' };
  const o = obj as Record<string, unknown>;
  if (typeof o.summary_text !== 'string' || typeof o.recommended_action !== 'string') return { ok: false, error: 'summary_text / recommended_action missing' };
  return {
    ok: true,
    output: {
      summary_text: o.summary_text,
      recommended_action: o.recommended_action,
      per_leg_notes: Array.isArray(o.per_leg_notes) ? (o.per_leg_notes as BriefingOutput['per_leg_notes']) : [],
      suggested_departure_windows: Array.isArray(o.suggested_departure_windows) ? (o.suggested_departure_windows as BriefingOutput['suggested_departure_windows']) : [],
      disagreement_notes: typeof o.disagreement_notes === 'string' ? o.disagreement_notes : null,
    },
  };
}

export type ValidatorResult = { passed: boolean; violations: Violation[]; attempts: number };

/** Run the §8.3 regexes over every text field. */
export function validateBriefing(output: BriefingOutput): Violation[] {
  return validateBriefingText(output);
}

/** Final shape stored and shown: standing statement appended by code, never by the model. */
/** House style applied by code (no em or en dashes), then the SOLAS statement appended by code. */
export function finalizeBriefing(output: BriefingOutput): BriefingOutput {
  const d = normaliseDashes;
  return {
    ...output,
    summary_text: appendStandingStatement(d(output.summary_text)),
    recommended_action: d(output.recommended_action),
    per_leg_notes: output.per_leg_notes.map((p) => ({ ...p, note: d(String(p.note ?? '')) })),
    suggested_departure_windows: output.suggested_departure_windows.map((w) => ({ ...w, reason: d(String(w.reason ?? '')) })),
    disagreement_notes: output.disagreement_notes === null ? null : d(output.disagreement_notes),
  };
}

/** PRD §8.2/§8.5: moderate or low confidence must be stated in plain words within the first two sentences. */
export function confidenceStated(summary: string, level: ConfidenceLevel): boolean {
  if (level === 'high') return true;
  const firstTwo = summary.split(/(?<=[.!?])\s+/).slice(0, 2).join(' ').toLowerCase();
  return firstTwo.includes('confidence') && firstTwo.includes(level);
}

/** Deterministic fallback: prepend the rule-based statement when the model failed to state it. */
export function ensureConfidenceStated(summary: string, level: ConfidenceLevel, statement: string): { text: string; prepended: boolean } {
  if (confidenceStated(summary, level)) return { text: summary, prepended: false };
  return { text: `${statement} ${summary}`.trim(), prepended: true };
}

export const BRIEFING_UNAVAILABLE_NO_KEY = 'Briefing unavailable: ANTHROPIC_API_KEY not set';

export async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Stable JSON (sorted keys) so input_hash is reproducible. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(',')}}`;
}
