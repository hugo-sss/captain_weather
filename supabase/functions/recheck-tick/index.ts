// recheck-tick: Phase 5 scheduled re-check. POST { trigger?, passage_id?, force?, sync? }.
// Auth: x-cron-secret (pg_cron, hourly at :40, migration 0008) or a signed-in user.
// For every planned/active passage inside the forecast window it checks whether a
// newer primary-model run has landed since the last complete conditions run; if so it
// recomputes conditions, regenerates the briefing, and writes a notification when the
// material-changes diff is non-empty (e-mail as well when app_settings.alerts.email and
// a Resend key are configured). Responds 202 and does the work in the background.
import { adminClient, callerUserId, cronAuthorized, type Admin } from '../_shared/runtime/supabaseAdmin.ts';
import { background, json, preflight, readJson } from '../_shared/runtime/http.ts';
import { loadSettings, type Settings } from '../_shared/runtime/settings.ts';

type Body = { trigger?: string; passage_id?: string; force?: boolean; sync?: boolean };
type Passage = { id: string; owner_id: string; name: string; status: string; planned_departure: string; actual_departure: string | null };
type Row = Record<string, unknown>;
const DAY = 86_400_000;

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<Body>(req);
  if (!(await cronAuthorized(req)) && !(await callerUserId(req))) return json({ error: 'unauthorised' }, 401);
  const work = runRechecks(body).catch((e) => { console.error('recheck-tick failed', e); return [{ error: (e as Error).message }]; });
  if (body.sync) return json({ ok: true, mode: 'sync', summary: await work });
  background(work);
  return json({ ok: true, accepted: true, trigger: body.trigger ?? 'manual' }, 202);
});

async function cronSecret(admin: Admin): Promise<string | null> {
  const env = Deno.env.get('CRON_SECRET');
  if (env) return env;
  const { data } = await admin.rpc('cron_secret');
  return typeof data === 'string' && data.length ? data : null;
}

async function runRechecks(body: Body) {
  const admin = adminClient();
  const settings = await loadSettings(admin);
  const secret = await cronSecret(admin);
  if (!secret) throw new Error('no cron secret available for self-calls');
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1`;
  const now = Date.now();
  const sel = 'id, owner_id, name, status, planned_departure, actual_departure';
  const q = body.passage_id
    ? admin.from('passages').select(sel).eq('id', body.passage_id)
    : admin.from('passages').select(sel).in('status', ['planned', 'active']).gte('planned_departure', new Date(now - 2 * DAY).toISOString()).lte('planned_departure', new Date(now + 10 * DAY).toISOString());
  const { data: passages, error } = await q;
  if (error) throw new Error(error.message);
  const summary: Row[] = [];
  for (const p of (passages ?? []) as Passage[]) {
    try {
      summary.push(await recheckPassage(admin, settings, base, secret, p, !!body.force));
    } catch (e) {
      const msg = (e as Error).message;
      console.error('recheck failed', p.id, msg);
      await notify(admin, p, 'recheck_failed', `${p.name}: re-check failed`, msg, {});
      summary.push({ passage_id: p.id, error: msg });
    }
  }
  console.log('recheck-tick summary', JSON.stringify(summary));
  return summary;
}

async function recheckPassage(admin: Admin, settings: Settings, base: string, secret: string, p: Passage, force: boolean): Promise<Row> {
  const { data: run } = await admin.from('conditions_runs').select('id, sources_used, created_at').eq('passage_id', p.id).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle();
  const runInit = ((run?.sources_used as Row | null)?.atmospheric as Row | undefined)?.init_time as string | undefined ?? null;

  // Newest primary-model init among the passage's own targets.
  const { data: links } = await admin.from('passage_ingest_targets').select('target_id').eq('passage_id', p.id);
  const ids = (links ?? []).map((l) => l.target_id as number);
  let newest: string | null = null;
  if (ids.length) {
    const { data } = await admin.from('forecast_atmospheric').select('init_time').in('target_id', ids).eq('source', settings.sources.atmospheric_primary).order('init_time', { ascending: false }).limit(1).maybeSingle();
    newest = (data?.init_time as string | undefined) ?? null;
  }
  const due = force || !run || (newest !== null && (!runInit || Date.parse(newest) > Date.parse(runInit)));
  if (!due) return { passage_id: p.id, skipped: 'no newer model run', run_init: runInit, newest };

  const headers = { 'Content-Type': 'application/json', 'x-cron-secret': secret };
  const kind = run ? 'recheck' : 'initial';
  const cres = await fetch(`${base}/compute-conditions`, { method: 'POST', headers, body: JSON.stringify({ passage_id: p.id, kind, trigger: 'scheduled' }) });
  const cjson = (await cres.json().catch(() => ({}))) as Row;
  if (!cres.ok || !cjson.ok) throw new Error(`compute-conditions ${cres.status}: ${String(cjson.error ?? 'failed')}`);
  const runId = cjson.run_id as string;

  const bres = await fetch(`${base}/generate-briefing`, { method: 'POST', headers, body: JSON.stringify({ passage_id: p.id, run_id: runId, scope: p.status === 'active' ? 'remaining' : 'full' }) });
  const bjson = (await bres.json().catch(() => ({}))) as Row;
  const briefing = (bjson.briefing ?? null) as Row | null;
  const changes = Array.isArray(briefing?.material_changes) ? (briefing!.material_changes as Row[]) : [];

  let notified: string | null = null;
  if (changes.length) {
    const lines = changes.map(describeChange);
    notified = await notify(admin, p, 'material_change', `${p.name}: ${changes.length} material change${changes.length > 1 ? 's' : ''} since the last briefing`, lines.join('\n'), { changes, run_id: runId, briefing_id: briefing?.id ?? null, newest_init: newest }, settings);
  } else if (!run) {
    const summaryText = typeof briefing?.summary_text === 'string' ? (briefing!.summary_text as string).slice(0, 500) : 'Conditions computed for the first time.';
    notified = await notify(admin, p, 'briefing', `${p.name}: first briefing ready`, summaryText, { run_id: runId, briefing_id: briefing?.id ?? null }, settings);
  }
  return { passage_id: p.id, kind, run_id: runId, briefing_ok: !!bjson.ok, changes: changes.length, notified, newest_init: newest };
}

function describeChange(c: Row): string {
  const wp = (c.waypoint_name as string | null) ?? `waypoint ${String(c.sequence ?? '?')}`;
  return `${wp}: ${String(c.field)} from ${String(c.from)} to ${String(c.to)}, ${String(c.note ?? '')}`.trim();
}

async function notify(admin: Admin, p: Passage, kind: string, title: string, body: string, payload: Row, settings?: Settings): Promise<string | null> {
  const { data, error } = await admin.from('notifications').insert({
    owner_id: p.owner_id, passage_id: p.id, run_id: (payload.run_id as string | undefined) ?? null, briefing_id: (payload.briefing_id as string | undefined) ?? null,
    kind, title, body, payload,
  }).select('id').single();
  if (error) { console.error('notification insert failed', error.message); return null; }
  const id = data?.id as string | undefined ?? null;
  const to = settings?.alerts?.email ?? null;
  if (id && to) {
    const key = await resendKey(admin);
    if (key) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Captain Passage Tool <onboarding@resend.dev>', to: [to], subject: title, text: `${body}\n\nOpen the passage in the app for the full table and briefing.` }),
      });
      if (res.ok) await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).eq('id', id);
      else console.warn('resend failed', res.status, await res.text().catch(() => ''));
    }
  }
  return id;
}

/** RESEND_API_KEY env, else the Vault secret via public.resend_api_key() when that RPC exists. */
async function resendKey(admin: Admin): Promise<string | null> {
  const env = Deno.env.get('RESEND_API_KEY');
  if (env) return env;
  try {
    const { data } = await admin.rpc('resend_api_key');
    return typeof data === 'string' && data.length ? data : null;
  } catch { return null; }
}
