// plan-targets: PRD §11.1. Called by the UI after any waypoint or departure change.
// POST { passage_id } with the user's JWT. Owner check runs through RLS as the caller;
// writes use the service role.
import { adminClient, callerOwnsPassage } from '../_shared/runtime/supabaseAdmin.ts';
import { json, preflight, readJson } from '../_shared/runtime/http.ts';
import { loadSettings } from '../_shared/runtime/settings.ts';
import { coerceVessel, engineFor, loadPassage, persistEngine, persistTargetPlan } from '../_shared/runtime/planTargets.ts';

Deno.serve(async (req) => {
  const pf = preflight(req); if (pf) return pf;
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  const body = await readJson<{ passage_id?: string }>(req);
  if (!body.passage_id) return json({ error: 'passage_id required' }, 400);
  if (!(await callerOwnsPassage(req, body.passage_id))) return json({ error: 'not found' }, 404);
  try {
    const admin = adminClient();
    const settings = await loadSettings(admin);
    const { passage, vessel, waypoints } = await loadPassage(admin, body.passage_id);
    if (waypoints.length < 2) return json({ error: 'a passage needs at least two waypoints' }, 422);
    const engine = engineFor(passage, coerceVessel(vessel), waypoints);
    await persistEngine(admin, engine);
    const result = await persistTargetPlan(admin, passage, waypoints, engine, settings);
    return json({ ok: true, ...result, engine: { total_distance_nm: engine.totalDistanceNm, total_hours: engine.totalHours, arrival: engine.arrival, errors: engine.errors } });
  } catch (e) {
    console.error('plan-targets failed', e);
    return json({ error: (e as Error).message }, 500);
  }
});
