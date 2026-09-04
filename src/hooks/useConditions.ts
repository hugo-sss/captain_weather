import { useCallback, useEffect, useState } from 'react';
import { invokeFunction, supabase } from '@/lib/supabase.ts';
import type { AnchorageConditionsRow, ConditionsRunRow, IngestTargetRow, WaypointConditionsRow } from '@/types/domain.ts';

export type ConditionsBundle = {
  run: ConditionsRunRow | null;
  previousRun: ConditionsRunRow | null;
  conditions: WaypointConditionsRow[];
  anchorages: AnchorageConditionsRow[];
  targets: IngestTargetRow[];
};

/** Latest complete (or failed) run for a passage, with its rows. Raw data first: the UI reads these tables directly. */
export function useConditions(passageId: string | undefined) {
  const [data, setData] = useState<ConditionsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!passageId) return;
    const { data: runs } = await supabase.from('conditions_runs').select('*').eq('passage_id', passageId).order('created_at', { ascending: false }).limit(5);
    const run = (runs ?? []).find((r) => r.status === 'complete') ?? (runs ?? [])[0] ?? null;
    const previousRun = run?.previous_run_id ? (await supabase.from('conditions_runs').select('*').eq('id', run.previous_run_id).maybeSingle()).data ?? null : null;
    const [{ data: conditions }, { data: anchorages }, { data: links }] = await Promise.all([
      run ? supabase.from('waypoint_conditions').select('*').eq('run_id', run.id) : Promise.resolve({ data: [] as WaypointConditionsRow[] }),
      run ? supabase.from('anchorage_conditions').select('*').eq('run_id', run.id) : Promise.resolve({ data: [] as AnchorageConditionsRow[] }),
      supabase.from('passage_ingest_targets').select('target_id').eq('passage_id', passageId),
    ]);
    const ids = (links ?? []).map((l) => l.target_id);
    const { data: targets } = ids.length ? await supabase.from('ingest_targets').select('*').in('id', ids) : { data: [] as IngestTargetRow[] };
    setData({ run, previousRun, conditions: conditions ?? [], anchorages: anchorages ?? [], targets: targets ?? [] });
    setLoading(false);
  }, [passageId]);

  useEffect(() => { void Promise.resolve().then(reload); }, [reload]);

  const planTargets = useCallback(async () => {
    if (!passageId) return;
    setBusy('Planning ingest targets…'); setError(null);
    try { await invokeFunction('plan-targets', { passage_id: passageId }); await reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }, [passageId, reload]);

  const fetchNow = useCallback(async () => {
    setBusy('Fetching all layers now…'); setError(null);
    try { await invokeFunction('ingest-tick', { layer: 'all', force: true, sync: true, trigger: 'manual' }); await reload(); }
    catch (e) { setError((e as Error).message); } finally { setBusy(null); }
  }, [reload]);

  const compute = useCallback(async (kind: 'initial' | 'recheck' = 'initial') => {
    if (!passageId) return null;
    setBusy(kind === 'recheck' ? 'Re-checking conditions…' : 'Computing conditions…'); setError(null);
    try { const r = await invokeFunction<{ run_id: string }>('compute-conditions', { passage_id: passageId, kind }); await reload(); return r; }
    catch (e) { setError((e as Error).message); return null; } finally { setBusy(null); }
  }, [passageId, reload]);

  return { data, loading: passageId ? loading : false, busy, error, reload, planTargets, fetchNow, compute };
}
