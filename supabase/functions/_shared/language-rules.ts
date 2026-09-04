// Language rules. PRD §8.3–8.4. Binding on the prompt, enforced by the validator.

export const BANNED_PATTERNS: RegExp[] = [
  /safe to (depart|go|leave|proceed|sail)/i,
  /you should (go|depart|leave|proceed|wait)/i,
  /go\s*\/\s*no[- ]?go/i,
  /it is (safe|unsafe)/i,
  /green light/i,
  /all clear/i,
  /we recommend (you )?(depart|go|leave)/i,
  /do not (go|depart|leave|sail)/i,
  /must (depart|wait|go)/i,
];

export const ALLOWED_FRAMING = [
  'conditions suggest',
  'the ensemble indicates',
  'this leg carries elevated risk based on forecast data',
  'consider',
  'worth cross-checking',
];

export const STANDING_STATEMENT =
  "This briefing supports, and does not replace, the master's own passage-planning responsibility under SOLAS Chapter V Regulation 34. Verify against official forecasts, charts and tide tables before acting.";

export type Violation = { path: string; phrase: string; pattern: string };

export function findViolations(text: string, path = 'text'): Violation[] {
  const out: Violation[] = [];
  for (const re of BANNED_PATTERNS) {
    const m = text.match(re);
    if (m) out.push({ path, phrase: m[0], pattern: re.source });
  }
  return out;
}

/** Walk every string in a structured briefing and collect violations. */
export function validateBriefingText(obj: unknown, path = '$'): Violation[] {
  if (typeof obj === 'string') return findViolations(obj, path);
  if (Array.isArray(obj)) return obj.flatMap((v, i) => validateBriefingText(v, `${path}[${i}]`));
  if (obj && typeof obj === 'object') {
    return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => validateBriefingText(v, `${path}.${k}`));
  }
  return [];
}

/** Appended by code, never by the model. Idempotent. */
export function appendStandingStatement(summary: string): string {
  const trimmed = summary.trimEnd();
  if (trimmed.endsWith(STANDING_STATEMENT)) return trimmed;
  return `${trimmed}\n\n${STANDING_STATEMENT}`;
}

export const BRIEFING_UNAVAILABLE = 'Briefing unavailable. Raw data below.';
