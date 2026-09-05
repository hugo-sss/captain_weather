// generate-briefing: PRD §8. POST { passage_id, scope?: 'full' | 'remaining', run_id? }.
// Confidence is computed by rules before the call and injected as a constraint; the
// banned-phrase validator runs on every output (one retry, then fail closed); the
// SOLAS V/34 statement is appended by code. The governance is provider-agnostic:
// BRIEFING_PROVIDER selects the model backend. Default 'anthropic' (@anthropic-ai/sdk,
// claude-opus-5, structured JSON, effort medium, server-side refusal fallback). Set
// BRIEFING_PROVIDER=openai to use any OpenAI-compatible gateway (e.g. Synthetic, z.ai)
// via BRIEFING_BASE_URL + BRIEFING_API_KEY + BRIEFING_MODEL. A missing key stores an
// "unavailable" row so the UI can say why, with the raw data still shown.
import Anthropic from 'npm:@anthropic-ai/sdk@0.123.0';
import { adminClient, callerOwnsPassage, cronAuthorized, type Admin } from '../_shared/runtime/supabaseAdmin.ts';
import { json, preflight, readJson } from '../_shared/runtime/http.ts';
import { loadPassage, type WaypointRow } from '../_shared/runtime/planTargets.ts';
import {
  BRIEFING_OUTPUT_SCHEMA, BRIEFING_UNAVAILABLE_NO_KEY, DEFAULT_BRIEFING_MODEL, PROMPT_VERSION_DEFAULT,
  buildBriefingInput, ensureConfidenceStated, finalizeBriefing, parseBriefingOutput, retryTurn, sha256Hex, stableStringify, systemPrompt, userTurn, validateBriefing,
  type BriefingLeg, type BriefingOutput,
} from '../_shared/briefing.ts';
import { materialChanges, type CondForDiff } from '../_shared/material-changes.ts';
import type { ConfidenceLevel, RiskFlag } from '../_shared/contracts.ts';
import type { Violation } from '../_shared/language-rules.ts';

type Body = { passage_id?: string; scope?: 'full' | 'remaining'; run_id?: string };
type Row = Record<string, unknown>;
type Turn = { role: 'user' | 'assistant'; content: string };
type ModelResult = { text: string; servedModel: string; refused: boolean; refusalCategory: string | null; truncated: boolean };
const n = (v: unknown): number | null => (v === null || v === undefined ? null : Number.isFinite(Number(v)) ? Number(v) : null);

type BriefingConfig = { provider: string; model: string | undefined; baseUrl: string | undefined; key: string | undefined; promptVersion: string };
// Config comes from edge-function env first; whatever is missing is filled from
// the briefing_config() RPC (api key from Vault, provider/base_url/model from
// app_settings), so no function env secret is required. Mirrors the cron and
// tidal secret patterns.
async function resolveBriefingConfig(admin: Admin): Promise<BriefingConfig> {
  const e = (k: string) => { const v = Deno.env.get(k); return v && v.length ? v : undefined; };
  let provider = e('BRIEFING_PROVIDER');
  let model = e('BRIEFING_MODEL');
  let baseUrl = e('BRIEFING_BASE_URL');
  let key = e('BRIEFING_API_KEY');
  const promptVersion = e('BRIEFING_PROMPT_VERSION') ?? PROMPT_VERSION_DEFAULT;
  if (!provider || !model || !baseUrl || !key) {
    try {
      const { data } = await admin.rpc('briefing_config');
      const cfg = (data ?? null) as { api_key?: string | null; settings?: { provider?: string; base_url?: string; model?: string } | null } | null;
      const s = cfg?.settings ?? null;
      provider = provider ?? (s?.provider || undefined);
      model = model ?? (s?.model || undefined);
      baseUrl = baseUrl ?? (s?.base_url || undefined);
      key = key ?? (cfg?.api_key || undefined);
    } catch { /* RPC absent (e.g. no Vault): fall through to env-only */ }
  }
  return { provider: (provider ?? 'anthropic').toLowerCase(), model, baseUrl, key, promptVersion };
}

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<Body>(req);
  if (!body.passage_id) return json({ error: 'passage_id required' }, 400);
  if (!(await cronAuthorized(req)) && !(await callerOwnsPassage(req, body.passage_id))) return json({ error: 'not found' }, 404);
  try {
    const admin = adminClient();
    const result = await generate(admin, body.passage_id, body.scope === 'remaining' ? 'remaining' : 'full', body.run_id);
    return json(result, 200);
  } catch (e) {
    console.error('generate-briefing failed', e);
    return json({ error: (e as Error).message }, 500);
  }
});

async function generate(admin: Admin, passageId: string, scope: 'full' | 'remaining', runId?: string) {
  const { passage, vessel, waypoints } = await loadPassage(admin, passageId);
  const runQ = runId
    ? admin.from('conditions_runs').select('*').eq('id', runId).eq('passage_id', passageId).maybeSingle()
    : admin.from('conditions_runs').select('*').eq('passage_id', passageId).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const { data: run } = await runQ;
  if (!run) throw new Error('no complete conditions run for this passage; compute conditions first');
  const [{ data: conds }, { data: anchs }, { data: legRows }] = await Promise.all([
    admin.from('waypoint_conditions').select('*').eq('run_id', run.id),
    admin.from('anchorage_conditions').select('*').eq('run_id', run.id),
    admin.from('leg_conditions').select('*').eq('run_id', run.id),
  ]);
  const byWp = new Map<string, WaypointRow>(waypoints.map((w) => [w.id, w]));
  const anchBy = new Map<string, Row>(((anchs ?? []) as Row[]).map((a) => [a.waypoint_id as string, a]));
  const inScope = ((conds ?? []) as Row[])
    .map((c) => ({ c, w: byWp.get(c.waypoint_id as string) }))
    .filter((x): x is { c: Row; w: WaypointRow } => !!x.w && (scope === 'full' || !x.w.arrived))
    .sort((a, b) => a.w.sequence - b.w.sequence);
  if (inScope.length === 0) throw new Error('no waypoint conditions in scope');

  // Phase 5: along-leg profile per destination waypoint from the virtual points in leg_conditions.
  const byTo = new Map<string, Row[]>();
  for (const l of (legRows ?? []) as Row[]) {
    const k = l.to_waypoint_id as string;
    if (!byTo.has(k)) byTo.set(k, []);
    byTo.get(k)!.push(l);
  }
  const rank: Record<string, number> = { green: 0, unknown: 1, amber: 2, red: 3 };
  const profileFor = (wpId: string): BriefingLeg['profile'] | undefined => {
    const pts = (byTo.get(wpId) ?? []).sort((a, b) => Number(a.seq) - Number(b.seq));
    if (pts.length === 0) return undefined;
    const mx = (k: string) => { const v = pts.map((p) => n(p[k])).filter((x): x is number => x !== null); return v.length ? Math.max(...v) : null; };
    let worst: Row | null = null;
    let worstFlag: RiskFlag = 'green';
    for (const p of pts) {
      const f = String(p.risk_flag) as RiskFlag;
      if ((rank[f] ?? 0) > (rank[worstFlag] ?? 0)) worstFlag = f;
      if (!worst || (rank[f] ?? 0) > (rank[String(worst.risk_flag)] ?? 0) || ((rank[f] ?? 0) === (rank[String(worst.risk_flag)] ?? 0) && (n(p.wind_p90_kn) ?? 0) > (n(worst.wind_p90_kn) ?? 0))) worst = p;
    }
    const squalls = pts.map((p) => String(p.squall_risk ?? 'none'));
    const squall = squalls.includes('likely') ? 'likely' : squalls.includes('possible') ? 'possible' : 'none';
    return {
      points: pts.length, speed_loss_pct: n(pts[0].speed_loss_pct),
      max_wind_p90_kn: mx('wind_p90_kn'), max_gust_p90_kn: mx('gust_p90_kn'), max_wave_m: mx('wave_height_m'), max_current_kn: mx('current_speed_kn'),
      worst_risk: worstFlag, squall, disagreement_points: pts.filter((p) => !!p.source_disagreement).length,
      worst_at: worst ? { fraction_pct: Math.round(Number(worst.fraction) * 100), eta: String(worst.eta), lat: Number(worst.lat), lon: Number(worst.lon), risk_flag: String(worst.risk_flag) as RiskFlag, wind_p90_kn: n(worst.wind_p90_kn), wave_height_m: n(worst.wave_height_m), reasons: Array.isArray(worst.risk_reasons) ? (worst.risk_reasons as string[]) : [] } : null,
    };
  };

  const legs: BriefingLeg[] = inScope.map(({ c, w }) => {
    const a = anchBy.get(w.id);
    return {
      sequence: w.sequence, name: w.name, eta: c.eta as string, lead_time_hours: n(c.lead_time_hours),
      wind: { p10: n(c.wind_p10_kn), p50: n(c.wind_p50_kn), p90: n(c.wind_p90_kn), dir: n(c.wind_dir_mean_deg), gust_p90: n(c.gust_p90_kn) },
      comparison: { source: (c.comparison_source as string | null) ?? null, wind: n(c.comparison_wind_kn), dir: n(c.comparison_wind_dir_deg), delta_speed: n(c.wind_speed_delta_kn), delta_dir: n(c.wind_dir_delta_deg), disagreement: !!c.source_disagreement },
      sea: { wave: n(c.wave_height_m), wave_dir: n(c.wave_dir_deg), period: n(c.wave_period_s), swell: n(c.swell_height_m), swell_dir: n(c.swell_dir_deg), swell_period: n(c.swell_period_s) },
      tide: { height: n(c.tide_height_m), state: (c.tide_state as string | null) ?? null, datum: (c.tide_datum as string | null) ?? null },
      current: { speed: n(c.current_speed_kn), sets_toward: n(c.current_dir_deg) },
      ukc: { estimate: n(c.ukc_estimate_m), basis: (c.ukc_basis as string | null) ?? null },
      squall_risk: ((c.squall_risk as string | null) ?? 'none') as 'none' | 'possible' | 'likely',
      gust_source: (c.gust_source as string | null) ?? null,
      speed_loss_pct: n(c.speed_loss_pct),
      eta_planned: (c.eta_planned as string | null) ?? null,
      profile: profileFor(w.id),
      risk_flag: c.risk_flag as RiskFlag, risk_reasons: (c.risk_reasons as string[]) ?? [],
      confidence_level: c.confidence_level as ConfidenceLevel, confidence_triggers: (c.confidence_triggers as string[]) ?? [],
      ...(a ? { anchorage: { stay_start: a.stay_start as string, stay_end: a.stay_end as string, wind_p50: n(a.wind_p50_kn), wind_max_p90: n(a.wind_max_p90_kn), gust_max_p90: n(a.gust_max_p90_kn), dir_predominant: n(a.wind_dir_predominant_deg), dir_range: n(a.wind_dir_range_deg), wave_max: n(a.wave_max_m), swell_max: n(a.swell_max_m), tide_min: n(a.tide_min_m), tide_max: n(a.tide_max_m), min_ukc: n(a.min_ukc_estimate_m), exposure: (a.exposure_tag as string | null) ?? null, risk_flag: a.risk_flag as RiskFlag } } : {}),
    };
  });

  const { data: prevBriefing } = await admin.from('passage_briefings').select('id, summary_text').eq('passage_id', passageId).is('superseded_by', null).order('generated_at', { ascending: false }).limit(1).maybeSingle();
  let changes: ReturnType<typeof materialChanges> = [];
  if (run.kind === 'recheck' && run.previous_run_id) {
    const { data: prevConds } = await admin.from('waypoint_conditions').select('waypoint_id, risk_flag, source_disagreement, confidence_level, wind_p90_kn, wave_height_m, tide_height_m').eq('run_id', run.previous_run_id);
    const toDiff = (rows: Row[]): CondForDiff[] => rows.map((r) => ({ waypoint_id: r.waypoint_id as string, risk_flag: r.risk_flag as RiskFlag, source_disagreement: !!r.source_disagreement, confidence_level: r.confidence_level as ConfidenceLevel, wind_p90_kn: n(r.wind_p90_kn), wave_height_m: n(r.wave_height_m), tide_height_m: n(r.tide_height_m) }));
    const meta: Record<string, { sequence: number; name: string | null; is_anchorage: boolean }> = {};
    for (const w of waypoints) meta[w.id] = { sequence: w.sequence, name: w.name, is_anchorage: w.is_anchorage };
    changes = materialChanges(toDiff((prevConds ?? []) as Row[]), toDiff(inScope.map((x) => x.c)), meta);
  }

  const thresholds = { max_wind_kn: n(vessel.max_wind_kn), max_gust_kn: n(vessel.max_gust_kn), max_wave_m: n(vessel.max_wave_m), max_current_kn: n(vessel.max_current_kn), min_ukc_m: n(vessel.min_ukc_m), draft_m: n(vessel.draft_m) };
  const input = buildBriefingInput({ passageName: passage.name, departure: passage.actual_departure ?? passage.planned_departure, vesselName: vessel.name, thresholds, scope, legs, previousSummary: prevBriefing?.summary_text ?? null, materialChanges: changes });
  const inputHash = await sha256Hex(stableStringify(input));
  const cfg = await resolveBriefingConfig(admin);
  const promptVersion = cfg.promptVersion;
  const provider = cfg.provider;
  const openaiCompatible = provider === 'openai' || provider === 'openai-compatible' || provider === 'synthetic';
  const model = cfg.model ?? (openaiCompatible ? '' : DEFAULT_BRIEFING_MODEL);
  const base = {
    passage_id: passageId, run_id: run.id, scope, confidence_level: input.confidence_level, confidence_triggers: input.confidence_triggers,
    material_changes: run.kind === 'recheck' ? changes : null, is_recheck: run.kind === 'recheck', prompt_version: promptVersion, input_snapshot: input, input_hash: inputHash,
  };
  const system = systemPrompt(promptVersion);

  // --- model backend (provider-agnostic) -----------------------------------
  const storeUnavailable = async (reason: string, modelUsed: string) => store(admin, { ...base, model_used: modelUsed, summary_text: null, recommended_action: null, suggested_departure_windows: null, disagreement_notes: null, validator_passed: false, validator_result: { passed: false, violations: [], attempts: 0, error: reason } }, prevBriefing?.id);

  let callModel: (msgs: Turn[]) => Promise<ModelResult>;
  if (openaiCompatible) {
    const baseUrl = (cfg.baseUrl ?? '').replace(/\/+$/, '');
    const key = cfg.key;
    if (!baseUrl || !key || !model) {
      const reason = `Briefing unavailable: set BRIEFING_BASE_URL, BRIEFING_API_KEY and BRIEFING_MODEL for provider "${provider}"`;
      return { ok: false, unavailable: reason, briefing: await storeUnavailable(reason, 'unavailable') };
    }
    callModel = async (msgs) => {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        // Reasoning models (e.g. GLM via Synthetic) emit reasoning tokens before
        // the JSON, counted toward the completion, so budget generously or the
        // output truncates mid-object and the pipeline fails closed.
        body: JSON.stringify({ model, max_tokens: 8192, temperature: 0.3, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, ...msgs] }),
      });
      if (!res.ok) throw new Error(`briefing model HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`);
      const data = await res.json();
      const choice = data?.choices?.[0];
      // OpenAI-compatible gateways have no separate refusal channel; empty/junk output is caught by the validator and fails closed.
      return { text: choice?.message?.content ?? '', servedModel: (data?.model as string) ?? model, refused: false, refusalCategory: null, truncated: choice?.finish_reason === 'length' };
    };
  } else {
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
    if (!apiKey) return { ok: false, unavailable: BRIEFING_UNAVAILABLE_NO_KEY, briefing: await storeUnavailable(BRIEFING_UNAVAILABLE_NO_KEY, 'unavailable') };
    const client = new Anthropic({ apiKey });
    callModel = async (msgs) => {
      const res = await client.beta.messages.create({
        model, max_tokens: 4096,
        betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default',
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: msgs as unknown as Anthropic.Beta.BetaMessageParam[],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: BRIEFING_OUTPUT_SCHEMA as unknown as Record<string, unknown> } },
      });
      const text = res.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text').map((b) => b.text).join('');
      return { text, servedModel: res.model, refused: res.stop_reason === 'refusal', refusalCategory: res.stop_details?.category ?? null, truncated: res.stop_reason === 'max_tokens' };
    };
  }

  // --- generate, validate, retry once, then fail closed ---------------------
  const messages: Turn[] = [{ role: 'user', content: userTurn(input) }];
  let attempts = 0;
  let violations: Violation[] = [];
  let output: BriefingOutput | null = null;
  let servedModel = model;
  let failure: string | null = null;
  let confidencePrepended = false;

  while (attempts < 2) {
    attempts += 1;
    const r = await callModel(messages);
    servedModel = r.servedModel;
    if (r.refused) { failure = `model refused (${r.refusalCategory ?? 'unspecified'}); failing closed`; break; }
    const text = r.text;
    if (r.truncated) { failure = 'output truncated at max_tokens; failing closed'; break; }
    const parsed = parseBriefingOutput(text);
    if (!parsed.ok) { failure = parsed.error; if (attempts < 2) { messages.push({ role: 'assistant', content: text }, { role: 'user', content: 'That was not valid JSON for the schema. Respond again with the full JSON only.' }); continue; } break; }
    violations = validateBriefing(parsed.output);
    const stated = ensureConfidenceStated(parsed.output.summary_text, input.confidence_level, input.confidence_statement);
    if (violations.length === 0 && !stated.prepended) { output = parsed.output; break; }
    if (attempts < 2) {
      const asks = [violations.length ? retryTurn(violations) : '', stated.prepended ? `Also state the confidence level in plain words within the first two sentences of summary_text, using: "${input.confidence_statement}"` : ''].filter(Boolean).join('\n');
      messages.push({ role: 'assistant', content: text }, { role: 'user', content: asks });
      continue;
    }
    if (violations.length === 0) { output = { ...parsed.output, summary_text: stated.text }; confidencePrepended = stated.prepended; } // rule statement prepended by code, recorded below
  }

  if (!output) {
    const row = await store(admin, { ...base, model_used: servedModel, summary_text: null, recommended_action: null, suggested_departure_windows: null, disagreement_notes: null, validator_passed: false, validator_result: { passed: false, violations, attempts, error: failure ?? 'banned phrases after retry' } }, prevBriefing?.id);
    return { ok: false, unavailable: 'Briefing unavailable. Raw data below.', briefing: row, validator: row.validator_result };
  }
  const final = finalizeBriefing(output);
  const row = await store(admin, {
    ...base, model_used: servedModel, summary_text: final.summary_text, recommended_action: final.recommended_action, suggested_departure_windows: final.suggested_departure_windows,
    disagreement_notes: final.disagreement_notes, validator_passed: true, validator_result: { passed: true, violations: [], attempts, confidence_prepended: confidencePrepended, per_leg_notes: final.per_leg_notes },
  }, prevBriefing?.id);
  return { ok: true, briefing: row };
}

async function store(admin: Admin, row: Row, previousId?: string | null): Promise<Row> {
  const { data, error } = await admin.from('passage_briefings').insert(row).select('*').single();
  if (error || !data) throw new Error(`passage_briefings insert: ${error?.message}`);
  if (previousId) await admin.from('passage_briefings').update({ superseded_by: data.id }).eq('id', previousId);
  return data as Row;
}
