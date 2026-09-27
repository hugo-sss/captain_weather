// One query set for the passages list and the landing page's "Your passages": every passage with its
// vessel, route ends, distance, latest run flags (for the headline) and the latest briefing confidence.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import { usePassages } from './usePassage.ts';
import { useVessels } from './useVessels.ts';
import type { ConfidenceLevel, PassageRow, RiskFlag, VesselRow } from '@/types/domain.ts';
import type { HeadlineCondition, HeadlineWaypoint } from '@/lib/plain.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';

export type PassageSummary = {
  passage: PassageRow;
  vessel: VesselRow | null;
  waypoints: HeadlineWaypoint[];
  from: string | null;
  to: string | null;
  totalNm: number;
  conditions: HeadlineCondition[];
  worst: RiskFlag | null;
  runAt: string | null;
  confidence: ConfidenceLevel | null;
  briefingAt: string | null;
};

type Extra = Omit<PassageSummary, 'passage' | 'vessel'>;

export function usePassageSummaries() {
  const { passages, loading: loadingPassages, reload: reloadPassages } = usePassages();
  const { vessels, loading: loadingVessels } = useVessels();
  const [extra, setExtra] = useState<Record<string, Extra>>({});
  const [extraLoaded, setExtraLoaded] = useState(false);
  const ids = passages.map((p) => p.id).join(',');

  const load = useCallback(async (pids: string[], isCancelled: () => boolean) => {
    if (pids.length === 0) { setExtra({}); setExtraLoaded(true); return; }
    const [{ data: wps }, { data: runs }, { data: briefs }] = await Promise.all([
      supabase.from('waypoints').select('id, passage_id, sequence, name, leg_distance_nm, eta').in('passage_id', pids).order('sequence'),
      supabase.from('conditions_runs').select('id, passage_id, completed_at, created_at').in('passage_id', pids).eq('status', 'complete').order('created_at', { ascending: false }),
      supabase.from('passage_briefings').select('passage_id, confidence_level, generated_at').in('passage_id', pids).is('superseded_by', null).order('generated_at', { ascending: false }),
    ]);
    const latestRun = new Map<string, { id: string; at: string }>();
    for (const r of runs ?? []) if (!latestRun.has(r.passage_id)) latestRun.set(r.passage_id, { id: r.id, at: r.completed_at ?? r.created_at });
    const runIds = [...latestRun.values()].map((r) => r.id);
    const { data: conds } = runIds.length
      ? await supabase.from('waypoint_conditions').select('run_id, waypoint_id, risk_flag, risk_reasons, eta, gust_p90_kn, wind_p90_kn, wave_height_m, ukc_estimate_m, current_speed_kn').in('run_id', runIds)
      : { data: [] as { run_id: string; waypoint_id: string; risk_flag: string; risk_reasons: unknown; eta: string | null; gust_p90_kn: unknown; wind_p90_kn: unknown; wave_height_m: unknown; ukc_estimate_m: unknown; current_speed_kn: unknown }[] };
    const byRun = new Map<string, HeadlineCondition[]>();
    for (const c of conds ?? []) byRun.set(c.run_id, [...(byRun.get(c.run_id) ?? []), { waypoint_id: c.waypoint_id, risk_flag: c.risk_flag, risk_reasons: c.risk_reasons, eta: c.eta, gust_p90_kn: c.gust_p90_kn, wind_p90_kn: c.wind_p90_kn, wave_height_m: c.wave_height_m, ukc_estimate_m: c.ukc_estimate_m, current_speed_kn: c.current_speed_kn }]);
    const latestBrief = new Map<string, { confidence: ConfidenceLevel; at: string }>();
    for (const b of briefs ?? []) if (!latestBrief.has(b.passage_id)) latestBrief.set(b.passage_id, { confidence: b.confidence_level as ConfidenceLevel, at: b.generated_at });
    const wpsBy = new Map<string, HeadlineWaypoint[]>();
    const nmBy = new Map<string, number>();
    for (const w of wps ?? []) {
      wpsBy.set(w.passage_id, [...(wpsBy.get(w.passage_id) ?? []), { id: w.id, name: w.name, sequence: w.sequence, eta: w.eta }]);
      nmBy.set(w.passage_id, (nmBy.get(w.passage_id) ?? 0) + (Number(w.leg_distance_nm) || 0));
    }
    const out: Record<string, Extra> = {};
    for (const pid of pids) {
      const r = latestRun.get(pid), b = latestBrief.get(pid);
      const conditions = r ? byRun.get(r.id) ?? [] : [];
      const waypoints = (wpsBy.get(pid) ?? []).sort((a, c) => a.sequence - c.sequence);
      const flags = conditions.map((c) => (c.risk_flag ?? 'unknown') as RiskFlag);
      out[pid] = {
        waypoints, from: waypoints[0]?.name ?? null, to: waypoints[waypoints.length - 1]?.name ?? null, totalNm: nmBy.get(pid) ?? 0,
        conditions, worst: flags.length ? worstRisk(flags) : null, runAt: r?.at ?? null, confidence: b?.confidence ?? null, briefingAt: b?.at ?? null,
      };
    }
    if (isCancelled()) return;
    setExtra(out);
    setExtraLoaded(true);
  }, []);

  useEffect(() => {
    if (loadingPassages) return;
    let cancelled = false;
    // Deferred so the fetch and its state updates never run synchronously inside the effect body.
    void Promise.resolve().then(() => load(ids ? ids.split(',') : [], () => cancelled));
    return () => { cancelled = true; };
  }, [ids, loadingPassages, load]);

  const reload = useCallback(async () => { await reloadPassages(); }, [reloadPassages]);

  const summaries: PassageSummary[] = passages.map((p) => {
    const e = extra[p.id] ?? { waypoints: [], from: null, to: null, totalNm: 0, conditions: [], worst: null, runAt: null, confidence: null, briefingAt: null };
    return { passage: p, vessel: vessels.find((v) => v.id === p.vessel_id) ?? null, ...e };
  });
  return { summaries, vessels, loading: loadingPassages || loadingVessels || (passages.length > 0 && !extraLoaded), reload };
}
