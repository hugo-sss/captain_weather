// Active passage monitoring (PRD §9.5 screen 8, Feature 12): progress, arrived toggles, re-check, material-changes banner, briefing diff.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useBriefing } from '@/hooks/useBriefing.ts';
import { num, type ConfidenceLevel, type RiskFlag } from '@/types/domain.ts';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { MaterialChangesBanner, type MaterialChange } from '@/components/briefing/MaterialChangesBanner.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';
import { materialChanges, type CondForDiff } from '../../supabase/functions/_shared/material-changes.ts';
import { useEffect } from 'react';
import type { WaypointConditionsRow } from '@/types/domain.ts';

export default function ActivePassage() {
  const { id } = useParams();
  const { data, loading, reload } = usePassage(id);
  const cond = useConditions(id);
  const br = useBriefing(id);
  const [prevConds, setPrevConds] = useState<WaypointConditionsRow[]>([]);
  const [showPrev, setShowPrev] = useState(false);
  const prevRunId = cond.data?.previousRun?.id ?? null;
  useEffect(() => {
    if (!prevRunId) return;
    let cancelled = false;
    supabase.from('waypoint_conditions').select('*').eq('run_id', prevRunId).then(({ data: rows }) => { if (!cancelled) setPrevConds(rows ?? []); });
    return () => { cancelled = true; };
  }, [prevRunId]);

  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  // Material changes: from the latest briefing when present, else a client-side diff of run N vs run N-1 with the same rules.
  const changes: MaterialChange[] = useMemo(() => {
    const fromBriefing = br.briefing?.material_changes as MaterialChange[] | null | undefined;
    if (fromBriefing && br.briefing?.run_id === cond.data?.run?.id) return fromBriefing;
    if (!prevRunId || !data) return [];
    const toDiff = (rows: WaypointConditionsRow[]): CondForDiff[] => rows.map((r) => ({ waypoint_id: r.waypoint_id, risk_flag: r.risk_flag as RiskFlag, source_disagreement: r.source_disagreement, confidence_level: r.confidence_level as ConfidenceLevel, wind_p90_kn: num(r.wind_p90_kn), wave_height_m: num(r.wave_height_m), tide_height_m: num(r.tide_height_m) }));
    const meta: Record<string, { sequence: number; name: string | null; is_anchorage: boolean }> = {};
    for (const w of data.waypoints) meta[w.id] = { sequence: w.sequence, name: w.name, is_anchorage: w.is_anchorage };
    return materialChanges(toDiff(prevConds), toDiff(conditions), meta);
  }, [br.briefing, cond.data, prevRunId, prevConds, conditions, data]);

  if (loading || !data) return <div className="p-4 text-text-2">Loading…</div>;
  const { passage, waypoints } = data;
  const arrivedCount = waypoints.filter((w) => w.arrived).length;
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const doneNm = waypoints.filter((w) => w.arrived).reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const pct = totalNm > 0 ? Math.round((doneNm / totalNm) * 100) : 0;
  const nextWp = waypoints.find((w) => !w.arrived);

  const setArrived = async (wpId: string, arrived: boolean) => {
    await supabase.from('waypoints').update({ arrived, arrived_at: arrived ? new Date().toISOString() : null }).eq('id', wpId);
    await reload();
  };
  const recheck = async () => {
    if (passage.status !== 'active') { await supabase.from('passages').update({ status: 'active', actual_departure: passage.actual_departure ?? new Date().toISOString() }).eq('id', passage.id); await reload(); }
    const r = await cond.compute('recheck');
    if (r) await br.generate('remaining');
  };
  const prevBriefingSummary = (br.briefing?.input_snapshot as { previous_briefing_summary?: string } | null)?.previous_briefing_summary ?? null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-bg-1 flex flex-wrap items-center gap-3">
        <div><div className="text-base font-semibold leading-tight">{passage.name}</div><div className="text-[11px] text-text-3">{passage.status} · departed {fmtUtc(passage.actual_departure ?? passage.planned_departure)} · last run {cond.data?.run ? `${cond.data.run.kind} ${fmtAge(cond.data.run.completed_at ?? cond.data.run.created_at)}` : 'none'}</div></div>
        <ModeTabs passageId={passage.id} current="active" />
        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" onClick={() => void recheck()} disabled={!!cond.busy || br.busy}><RefreshCw className="h-3.5 w-3.5" /> {cond.busy ?? (br.busy ? 'Briefing…' : 'Re-check conditions')}</Button>
          {passage.status === 'active' && <Button size="sm" variant="outline" onClick={async () => { await supabase.from('passages').update({ status: 'completed' }).eq('id', passage.id); await reload(); }}>Mark completed</Button>}
          <Link to={`/passages/${passage.id}`} className="text-xs text-accent">Table</Link>
        </div>
      </div>
      {cond.error && <div className="px-4 py-1.5 text-xs bg-risk-red/10 text-risk-red">{cond.error}</div>}
      <div className="p-4 space-y-4 max-w-5xl">
        <MaterialChangesBanner changes={changes} />
        {cond.data?.run?.kind === 'recheck' && changes.length === 0 && <p className="text-xs text-text-2">Re-check found no material changes against the previous run.</p>}
        <div className="rounded-lg border border-border bg-bg-1 p-3">
          <div className="flex items-center justify-between text-sm mb-2"><span className="label">Progress</span><span className="num text-xs text-text-2">{arrivedCount}/{waypoints.length} waypoints · {doneNm.toFixed(1)} of {totalNm.toFixed(1)} nm · {pct}%</span></div>
          <div className="h-2 rounded bg-bg-0 border border-border overflow-hidden"><div className="h-full bg-accent" style={{ width: `${pct}%` }} /></div>
          {nextWp && <div className="text-xs text-text-2 mt-2">Next: {nextWp.sequence}. {nextWp.name} · ETA {fmtUtc(byWp.get(nextWp.id)?.eta ?? nextWp.eta)}</div>}
          <div className="mt-3 divide-y divide-border">
            {waypoints.map((w) => { const c = byWp.get(w.id); return (
              <div key={w.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="num text-text-3 w-5">{w.sequence}</span>
                <span className="flex-1 truncate">{w.name}{w.is_anchorage && <Link to={`/passages/${passage.id}/anchorage/${w.id}`} className="ml-2 text-[11px] text-accent">stay view</Link>}</span>
                <span className="num text-xs text-text-2 hidden sm:inline">{w.arrived ? `arrived ${fmtUtc(w.arrived_at)}` : `ETA ${fmtUtc(c?.eta ?? w.eta)}`}</span>
                <RiskPill flag={(c?.risk_flag ?? 'unknown') as RiskFlag} reasons={(c?.risk_reasons as string[]) ?? []} />
                <label className="flex items-center gap-1 text-[11px] text-text-3">arrived <Switch checked={w.arrived} onCheckedChange={(v) => void setArrived(w.id, v)} /></label>
              </div>); })}
          </div>
        </div>
        <BriefingCard briefing={br.briefing} busy={br.busy} error={br.error} onGenerate={() => void br.generate('remaining')} passageId={passage.id} tableHref={`/passages/${passage.id}`} />
        {prevBriefingSummary && (
          <div className="rounded-lg border border-border bg-bg-1 p-3">
            <button className="flex items-center gap-1 text-xs text-text-2" onClick={() => setShowPrev((v) => !v)}>{showPrev ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Previous briefing summary</button>
            {showPrev && <p className="mt-2 text-sm text-text-2 whitespace-pre-line">{prevBriefingSummary}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
