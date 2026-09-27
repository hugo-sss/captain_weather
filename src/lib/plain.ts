// Plain-English layer: rows become sentences. Used everywhere in Simple mode and in card headers in
// Detailed mode. Describes, never decides: no "safe", no "should", no go/no-go (see language-rules.ts).
// Ranges use "to", never a dash.
import type { ConfidenceLevel, RiskFlag } from '@/types/domain.ts';
import { etaDeltaMinutes } from '@/lib/leg-profile.ts';

const H = 3_600_000;
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const asNum = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);
const r0 = (v: number) => Math.round(v).toString();
const r1 = (v: number) => (Math.round(v * 10) / 10).toFixed(1);

// ---- Compass ---------------------------------------------------------------------------------
export const COMPASS_8 = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'] as const;

/** 8-point compass word for a direction in degrees ("from" or "toward" is the caller's business). */
export function compassWord(deg: number | null | undefined): string | null {
  if (!isNum(deg)) return null;
  return COMPASS_8[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

// ---- Conditions ------------------------------------------------------------------------------
/** "12 to 18 kn from the west, gusts to 24". Null when there is no median wind. */
export function windPhrase(p50: unknown, p90: unknown, dirDeg: unknown, gustP90: unknown): string | null {
  const m = asNum(p50);
  if (m === null) return null;
  const hi = asNum(p90), dir = compassWord(asNum(dirDeg)), gust = asNum(gustP90);
  let s = hi !== null && Math.round(hi) > Math.round(m) ? `${r0(m)} to ${r0(hi)} kn` : `${r0(m)} kn`;
  if (dir) s += ` from the ${dir}`;
  if (gust !== null && Math.round(gust) > Math.round(hi ?? m)) s += `, gusts to ${r0(gust)}`;
  return s;
}

/** "1.1 m sea at 7 s, 0.8 m swell from the south-west". Null when there is neither sea nor swell. */
export function seaPhrase(hs: unknown, periodS: unknown, swellM: unknown, swellDir: unknown): string | null {
  const h = asNum(hs), p = asNum(periodS), sw = asNum(swellM), dir = compassWord(asNum(swellDir));
  const parts: string[] = [];
  if (h !== null) parts.push(`${r1(h)} m sea${p !== null ? ` at ${r0(p)} s` : ''}`);
  if (sw !== null) parts.push(`${r1(sw)} m swell${dir ? ` from the ${dir}` : ''}`);
  return parts.length ? parts.join(', ') : null;
}

const TIDE_STATE: Record<string, string> = { flood: 'rising', ebb: 'falling', high: 'high water', low: 'low water', slack: 'slack' };
/** "2.0 m above LAT, rising". */
export function tidePhrase(heightM: unknown, datum: string | null | undefined, state: string | null | undefined): string | null {
  const h = asNum(heightM);
  if (h === null) return null;
  const d = datum && datum !== 'unknown' ? datum : 'datum';
  const s = h < 0 ? `${r1(-h)} m below ${d}` : `${r1(h)} m above ${d}`;
  const st = state ? TIDE_STATE[state] : null;
  return st ? `${s}, ${st}` : s;
}

/** "0.3 kn setting north-east". */
export function currentPhrase(kn: unknown, towardDeg: unknown): string | null {
  const k = asNum(kn);
  if (k === null) return null;
  if (k < 0.05) return 'slack, under 0.1 kn';
  const dir = compassWord(asNum(towardDeg));
  return dir ? `${r1(k)} kn setting ${dir}` : `${r1(k)} kn`;
}

/** Squall risk in a word. */
export function squallPhrase(risk: unknown): string {
  return risk === 'likely' ? 'Likely' : risk === 'possible' ? 'Possible' : 'None expected';
}

export const RISK_WORD: Record<RiskFlag, string> = { green: 'Green', amber: 'Amber', red: 'Red', unknown: 'No data' };
export const riskWord = (flag: RiskFlag | string | null | undefined): string => RISK_WORD[(flag as RiskFlag) in RISK_WORD ? (flag as RiskFlag) : 'unknown'];

// ---- Status ----------------------------------------------------------------------------------
const STATUS_WORD: Record<string, string> = { planned: 'Planned', active: 'Underway', completed: 'Completed', archived: 'Archived' };
export const statusWord = (status: string | null | undefined): string => STATUS_WORD[status ?? ''] ?? 'Planned';

// ---- Confidence ------------------------------------------------------------------------------
const TRIGGER_SHORT: Record<string, string> = {
  lead_time_gt_120h: 'more than five days out', lead_time_72_120h: 'three to five days out',
  tropical_activity: 'tropical activity flagged', frontal_activity: 'frontal activity flagged',
  complex_coastal: 'complex coastline', source_disagreement: 'models disagree', wide_ensemble_spread: 'wide forecast spread',
  no_data_atmospheric: 'no wind data', no_data_marine: 'no sea state data', no_data_tidal: 'no tide data', no_data_comparison: 'no comparison model',
};
export const triggerWords = (t: string): string => TRIGGER_SHORT[t] ?? t.replace(/_/g, ' ');
const CONF_WORD: Record<ConfidenceLevel, string> = { high: 'High', moderate: 'Moderate', low: 'Low' };

/** "High confidence" / "Moderate confidence: models disagree at Ko Ha". */
export function confidencePhrase(level: ConfidenceLevel | string | null | undefined, triggers: string[] | null | undefined, where?: string | null): string {
  const lv = (level === 'high' || level === 'moderate' || level === 'low' ? level : 'low') as ConfidenceLevel;
  const head = `${CONF_WORD[lv]} confidence`;
  const reasons = [...new Set((triggers ?? []).map(triggerWords))].map((r) => (r === 'models disagree' && where ? `models disagree at ${where}` : r));
  if (reasons.length === 0) return head;
  return `${head}: ${reasons.join(', ')}`;
}

// ---- Time ------------------------------------------------------------------------------------
const browserOffset = () => (typeof Date !== 'undefined' ? -new Date().getTimezoneOffset() : 0);
function localParts(ms: number, offsetMin: number | null | undefined) {
  const off = offsetMin ?? browserOffset();
  const d = new Date(ms + off * 60_000);
  return { day: d.getUTCDay(), date: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear(), hh: d.getUTCHours(), mm: d.getUTCMinutes(), dayKey: Math.floor((ms + off * 60_000) / 86_400_000) };
}
const hhmm = (p: { hh: number; mm: number }) => `${String(p.hh).padStart(2, '0')}:${String(p.mm).padStart(2, '0')}`;
const parse = (iso: string | null | undefined): number | null => { if (!iso) return null; const t = Date.parse(iso); return Number.isFinite(t) ? t : null; };

/** "Thu 10 Sep, 18:30" in local time. */
export function localDateTime(iso: string | null | undefined, offsetMin: number | null | undefined): string | null {
  const t = parse(iso); if (t === null) return null;
  const p = localParts(t, offsetMin);
  return `${DAYS[p.day]} ${p.date} ${MONTHS[p.month]}, ${hhmm(p)}`;
}
/** "Thu 18:30" in local time: for lists where the date is already known. */
export function localDayTime(iso: string | null | undefined, offsetMin: number | null | undefined): string | null {
  const t = parse(iso); if (t === null) return null;
  const p = localParts(t, offsetMin);
  return `${DAYS[p.day]} ${hhmm(p)}`;
}
/** "18:30" in local time. */
export function localClock(iso: string | null | undefined, offsetMin: number | null | undefined): string | null {
  const t = parse(iso); if (t === null) return null;
  return hhmm(localParts(t, offsetMin));
}
/** "05 Sep 00:00 UTC": model run times in Detailed mode and the sources section. */
export function utcStamp(iso: string | null | undefined): string | null {
  const t = parse(iso); if (t === null) return null;
  const d = new Date(t);
  return `${String(d.getUTCDate()).padStart(2, '0')} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

/** "in 3 days" / "2 hours ago" / "in 40 min" / "just now". Absolute date beyond 30 days. */
export function relativePhrase(iso: string | null | undefined, nowMs = Date.now(), offsetMin: number | null | undefined = null): string | null {
  const t = parse(iso); if (t === null) return null;
  const diff = t - nowMs, abs = Math.abs(diff), future = diff > 0;
  const wrap = (s: string) => (future ? `in ${s}` : `${s} ago`);
  if (abs < 60_000) return 'just now';
  if (abs < H) return wrap(`${Math.round(abs / 60_000)} min`);
  if (abs < 36 * H) { const h = Math.round(abs / H); return wrap(`${h} ${h === 1 ? 'hour' : 'hours'}`); }
  if (abs < 30 * 24 * H) { const d = Math.round(abs / (24 * H)); return wrap(`${d} ${d === 1 ? 'day' : 'days'}`); }
  return localDateTime(iso, offsetMin);
}

/** Past only: "48 min ago", "3 hours ago", "2 days ago", "just now". */
export function agePhrase(iso: string | null | undefined, nowMs = Date.now()): string | null {
  const t = parse(iso); if (t === null) return null;
  return relativePhrase(iso, Math.max(nowMs, t));
}

/** "Thu 10 Sep, 18:30 local" (absolute), "in 3 days" (relative), or relative when within 36 h (auto). */
export function whenPhrase(iso: string | null | undefined, offsetMin: number | null | undefined, nowMs = Date.now(), style: 'absolute' | 'relative' | 'auto' = 'absolute'): string | null {
  const t = parse(iso); if (t === null) return null;
  if (style === 'relative') return relativePhrase(iso, nowMs, offsetMin);
  if (style === 'auto' && Math.abs(t - nowMs) < 36 * H) return relativePhrase(iso, nowMs, offsetMin);
  return `${localDateTime(iso, offsetMin)} local`;
}

/** "this afternoon" / "tomorrow morning" / "on Friday afternoon" / "on Thu 10 Sep". */
export function dayPartPhrase(iso: string | null | undefined, offsetMin: number | null | undefined, nowMs = Date.now()): string | null {
  const t = parse(iso); if (t === null) return null;
  const p = localParts(t, offsetMin), n = localParts(nowMs, offsetMin);
  const part = p.hh < 5 ? 'night' : p.hh < 12 ? 'morning' : p.hh < 17 ? 'afternoon' : p.hh < 21 ? 'evening' : 'night';
  const dd = p.dayKey - n.dayKey;
  if (dd === 0) return part === 'night' ? 'tonight' : `this ${part}`;
  if (dd === 1) return `tomorrow ${part}`;
  if (dd === -1) return `yesterday ${part}`;
  if (dd > 1 && dd < 7) return `on ${DAYS_LONG[p.day]} ${part}`;
  return `on ${DAYS[p.day]} ${p.date} ${MONTHS[p.month]}`;
}

/** "19 h 52 min" / "3 h" / "45 min". */
export function durationPhrase(hours: number | null | undefined): string | null {
  if (!isNum(hours) || hours < 0) return null;
  const total = Math.round(hours * 60), h = Math.floor(total / 60), m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/** "70 nm" (whole numbers from 10 nm, one decimal below). */
export function distancePhrase(nm: number | null | undefined): string | null {
  if (!isNum(nm)) return null;
  return nm >= 10 ? `${Math.round(nm)} nm` : `${r1(nm)} nm`;
}

/** "Arrive Fri 5 Sep, 09:40 local (16 min later than planned, sea state)". */
export function etaPhrase(eta: string | null | undefined, etaPlanned: string | null | undefined, offsetMin: number | null | undefined): string | null {
  const when = localDateTime(eta, offsetMin);
  if (!when) return null;
  const delta = etaDeltaMinutes(etaPlanned, eta);
  if (delta === null) return `Arrive ${when} local`;
  return `Arrive ${when} local (${durationPhrase(Math.abs(delta) / 60)} ${delta > 0 ? 'later' : 'earlier'} than planned, sea state)`;
}

/** "16 min later than planned, sea state" on its own, for a stat sub line. */
export function etaDeltaPhrase(eta: string | null | undefined, etaPlanned: string | null | undefined): string | null {
  const delta = etaDeltaMinutes(etaPlanned, eta);
  if (delta === null) return null;
  return `${durationPhrase(Math.abs(delta) / 60)} ${delta > 0 ? 'later' : 'earlier'} than planned, sea state`;
}

// ---- Sources ---------------------------------------------------------------------------------
const SOURCE_NAME: Record<string, string> = {
  google_weathernext2_ensemble: 'Google WeatherNext 2 ensemble', ecmwf_ifs025_ensemble: 'ECMWF ensemble', ecmwf_ifs025: 'ECMWF IFS',
  ncep_gfs_global: 'NOAA GFS', gfs_seamless: 'NOAA GFS', meteofrance_wave: 'Meteo-France wave model', tidesatlas: 'TidesAtlas', 'open-meteo': 'Open-Meteo',
};
/** Model id to a name a captain recognises. */
export const sourceName = (id: string | null | undefined): string | null => (id ? SOURCE_NAME[id] ?? id.replace(/_/g, ' ') : null);

// ---- Risk headline ---------------------------------------------------------------------------
export type HeadlineCondition = { waypoint_id: string; risk_flag: string | null; risk_reasons?: unknown; eta?: string | null; gust_p90_kn?: unknown; wind_p90_kn?: unknown; wave_height_m?: unknown; ukc_estimate_m?: unknown; current_speed_kn?: unknown };
export type HeadlinePoint = { risk: RiskFlag; riskReasons: string[]; eta: string; gustP90: number | null; windP90: number | null; waveHs: number | null; currentKn?: number | null };
export type HeadlineLeg = { toId: string; summary: { worstRisk: RiskFlag; worstPoint: HeadlinePoint | null } };
export type HeadlineWaypoint = { id: string; name: string | null; sequence: number; eta?: string | null };
export type HeadlineOptions = { utcOffsetMin?: number | null; nowMs?: number };

const RANK: Record<RiskFlag, number> = { unknown: 0, green: 1, amber: 2, red: 3 };
const asRisk = (v: unknown): RiskFlag => (v === 'green' || v === 'amber' || v === 'red' ? v : 'unknown');
const worse = (a: RiskFlag, b: RiskFlag): RiskFlag => (RANK[b] > RANK[a] ? b : a);
const maxOf = (...vals: (number | null)[]): number | null => vals.reduce<number | null>((m, v) => (v === null ? m : m === null ? v : Math.max(m, v)), null);
const minOf = (...vals: (number | null)[]): number | null => vals.reduce<number | null>((m, v) => (v === null ? m : m === null ? v : Math.min(m, v)), null);

type Stretch = { name: string; risk: RiskFlag; reasons: string[]; eta: string | null; gust: number | null; wind: number | null; wave: number | null; ukc: number | null; current: number | null };

/** The one number behind a flag: "gusts to 38 kn", "2.3 m sea", "wind to 22 kn". */
export function keyNumber(s: Pick<Stretch, 'reasons' | 'gust' | 'wind' | 'wave' | 'ukc' | 'current'>): string | null {
  const text = s.reasons.join(' ').toLowerCase();
  if (/gust/.test(text) && s.gust !== null) return `gusts to ${r0(s.gust)} kn`;
  if (/wind/.test(text) && s.wind !== null) return `wind to ${r0(s.wind)} kn`;
  if (/wave/.test(text) && s.wave !== null) return `${r1(s.wave)} m sea`;
  if (/ukc|keel/.test(text) && s.ukc !== null) return `${r1(s.ukc)} m under the keel`;
  if (/current/.test(text) && s.current !== null) return `${r1(s.current)} kn current`;
  if (/squall/.test(text)) return 'squalls likely';
  if (/disagree/.test(text)) return 'models disagree';
  if (s.gust !== null) return `gusts to ${r0(s.gust)} kn`;
  if (s.wind !== null) return `wind to ${r0(s.wind)} kn`;
  if (s.wave !== null) return `${r1(s.wave)} m sea`;
  return null;
}

function listNames(names: string[]): string {
  const shown = names.slice(0, 3);
  const rest = names.length - shown.length;
  const head = shown.length <= 1 ? shown.join('') : `${shown.slice(0, -1).join(', ')} and ${shown[shown.length - 1]}`;
  return rest > 0 ? `${head} and ${rest} more` : head;
}
const countWord = (n: number) => COUNT_WORDS[n] ?? String(n);

/**
 * One sentence for the hero. Uses the risk reasons already stored; never advisory.
 * "Conditions look manageable for the whole passage." / "One stretch to watch: Ko Ha, amber on Friday afternoon (gusts to 38 kn)." /
 * "Two legs exceed your limits: Ko Ha and Ko Phi Phi Don." / "Not checked yet."
 */
export function riskHeadline(conditions: HeadlineCondition[], legs: HeadlineLeg[], waypoints: HeadlineWaypoint[], opts: HeadlineOptions = {}): string {
  if (conditions.length === 0 && legs.length === 0) return 'Not checked yet.';
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  const legInto = new Map(legs.map((l) => [l.toId, l]));
  const stretches: Stretch[] = [];
  const ordered = [...waypoints].sort((a, b) => a.sequence - b.sequence);
  for (const w of ordered) {
    const c = byWp.get(w.id), l = legInto.get(w.id);
    if (!c && !l) continue;
    const wp = l?.summary.worstPoint ?? null;
    const risk = worse(asRisk(c?.risk_flag), l?.summary.worstRisk ?? 'unknown');
    const reasons = [...(Array.isArray(c?.risk_reasons) ? (c!.risk_reasons as unknown[]).map(String) : []), ...(wp?.riskReasons ?? [])];
    stretches.push({
      name: w.name?.trim() || `Waypoint ${w.sequence}`, risk, reasons,
      eta: (RANK[asRisk(c?.risk_flag)] >= RANK[l?.summary.worstRisk ?? 'unknown'] ? c?.eta : wp?.eta) ?? c?.eta ?? wp?.eta ?? w.eta ?? null,
      gust: maxOf(asNum(c?.gust_p90_kn), wp?.gustP90 ?? null), wind: maxOf(asNum(c?.wind_p90_kn), wp?.windP90 ?? null), wave: maxOf(asNum(c?.wave_height_m), wp?.waveHs ?? null),
      ukc: minOf(asNum(c?.ukc_estimate_m)), current: maxOf(asNum(c?.current_speed_kn), wp?.currentKn ?? null),
    });
  }
  if (stretches.length === 0) return 'Not checked yet.';
  const reds = stretches.filter((s) => s.risk === 'red'), ambers = stretches.filter((s) => s.risk === 'amber'), unknowns = stretches.filter((s) => s.risk === 'unknown');
  const detail = (s: Stretch, word: string) => {
    const when = dayPartPhrase(s.eta, opts.utcOffsetMin, opts.nowMs);
    const n = keyNumber(s);
    return `${s.name}, ${word}${when ? ` ${when}` : ''}${n ? ` (${n})` : ''}`;
  };
  if (reds.length === 1) return `One leg exceeds your limits: ${detail(reds[0], 'red')}.`;
  if (reds.length > 1) return `${countWord(reds.length)} legs exceed your limits: ${listNames(reds.map((s) => s.name))}.`;
  if (ambers.length === 1) return `One stretch to watch: ${detail(ambers[0], 'amber')}.`;
  if (ambers.length > 1) return `${countWord(ambers.length)} stretches to watch: ${listNames(ambers.map((s) => s.name))}.`;
  if (unknowns.length === stretches.length) return 'No forecast data for this route yet.';
  if (unknowns.length > 0) return `Conditions look manageable where there is data; no data at ${listNames(unknowns.map((s) => s.name))}.`;
  return 'Conditions look manageable for the whole passage.';
}

/** The worst stretch (for the "Worst stretch" stat): name, flag, when, and the key number. */
export function worstStretch(conditions: HeadlineCondition[], legs: HeadlineLeg[], waypoints: HeadlineWaypoint[]): { name: string; risk: RiskFlag; eta: string | null; number: string | null } | null {
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  const legInto = new Map(legs.map((l) => [l.toId, l]));
  let best: (Stretch & { rank: number }) | null = null;
  for (const w of waypoints) {
    const c = byWp.get(w.id), l = legInto.get(w.id);
    if (!c && !l) continue;
    const wp = l?.summary.worstPoint ?? null;
    const risk = worse(asRisk(c?.risk_flag), l?.summary.worstRisk ?? 'unknown');
    const s: Stretch & { rank: number } = {
      name: w.name?.trim() || `Waypoint ${w.sequence}`, risk, rank: RANK[risk],
      reasons: [...(Array.isArray(c?.risk_reasons) ? (c!.risk_reasons as unknown[]).map(String) : []), ...(wp?.riskReasons ?? [])],
      eta: c?.eta ?? wp?.eta ?? w.eta ?? null,
      gust: maxOf(asNum(c?.gust_p90_kn), wp?.gustP90 ?? null), wind: maxOf(asNum(c?.wind_p90_kn), wp?.windP90 ?? null), wave: maxOf(asNum(c?.wave_height_m), wp?.waveHs ?? null),
      ukc: minOf(asNum(c?.ukc_estimate_m)), current: maxOf(asNum(c?.current_speed_kn), wp?.currentKn ?? null),
    };
    if (!best || s.rank > best.rank || (s.rank === best.rank && (s.wind ?? -1) > (best.wind ?? -1))) best = s;
  }
  if (!best) return null;
  return { name: best.name, risk: best.risk, eta: best.eta, number: keyNumber(best) };
}

const fraction = (f: number) => (Math.abs(f - 0.75) < 0.001 ? 'three quarters' : Math.abs(f - 0.5) < 0.001 ? 'half' : `${Math.round(f * 100)}%`);
const REASON_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^wind p50 ([\d.]+) kn > max_wind ([\d.]+) kn$/, (m) => `Wind ${m[1]} kn is over your ${m[2]} kn wind limit`],
  [/^gust p90 ([\d.]+) kn > max_gust ([\d.]+) kn$/, (m) => `Gusts to ${m[1]} kn are over your ${m[2]} kn gust limit`],
  [/^wave ([\d.]+) m > max_wave ([\d.]+) m$/, (m) => `${m[1]} m sea is over your ${m[2]} m wave limit`],
  [/^current ([\d.]+) kn > max_current ([\d.]+) kn$/, (m) => `Current ${m[1]} kn is over your ${m[2]} kn current limit`],
  [/^UKC estimate ([\d.]+) m < min_ukc ([\d.]+) m$/, (m) => `Clearance under the keel ${m[1]} m is under your ${m[2]} m minimum`],
  [/^wind p90 ([\d.]+) kn > ([\d.]+) ?[x×] ?max_wind ([\d.]+) kn$/, (m) => `High-end wind ${m[1]} kn is over ${fraction(Number(m[2]))} of your ${m[3]} kn wind limit`],
  [/^gust p90 ([\d.]+) kn > ([\d.]+) ?[x×] ?max_gust ([\d.]+) kn$/, (m) => `Gusts to ${m[1]} kn are over ${fraction(Number(m[2]))} of your ${m[3]} kn gust limit`],
  [/^wave ([\d.]+) m > ([\d.]+) ?[x×] ?max_wave ([\d.]+) m$/, (m) => `${m[1]} m sea is over ${fraction(Number(m[2]))} of your ${m[3]} m wave limit`],
  [/^UKC estimate ([\d.]+) m < ([\d.]+) ?[x×] ?min_ukc ([\d.]+) m$/, (m) => `Clearance under the keel ${m[1]} m is within ${m[2]} times your ${m[3]} m minimum`],
  [/^primary and comparison models disagree on wind$/, () => 'The two wind models disagree here'],
  [/^no atmospheric data at this waypoint$/, () => 'No wind data at this waypoint'],
  [/^squall (?:risk )?(likely|possible)(?::| \()\s*CAPE ([\d>< ]+) J\/kg, precip prob ([\d>< ]+) ?%\)?$/, (m) => `Squalls ${m[1]}: CAPE ${m[2].trim()} J/kg, ${m[3].trim()}% chance of rain`],
  [/^squall risk (likely|possible) during the stay$/, (m) => `Squalls ${m[1]} during the stay`],
  [/^no (\w+) data within ([\d.]+) km \/ ±(\d+) h of ETA$/, (m) => `No ${m[1] === 'marine' ? 'sea state' : m[1]} data within ${m[2]} km or ${m[3]} h of the ETA`],
  [/^no (\w+) data in the stay window$/, (m) => `No ${m[1] === 'marine' ? 'sea state' : m[1]} data in the stay window`],
];
/** The engine's risk reason ("gust p90 38 kn > max_gust 35 kn") as a sentence a captain would say. Unknown shapes pass through. */
export function plainReason(reason: string): string {
  const r = reason.trim();
  for (const [re, fn] of REASON_RULES) { const m = r.match(re); if (m) return fn(m); }
  return r;
}
