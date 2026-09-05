// Active passage monitoring (PRD §9.5 screen 8, Feature 12): progress, arrived toggles, re-check, material-changes banner, briefing diff.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Anchor, Check, ChevronDown, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useBriefing } from '@/hooks/useBriefing.ts';
import { num, type ConfidenceLevel, type RiskFlag, type WaypointConditionsRow } from '@/types/domain.ts';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { MaterialChangesBanner, type MaterialChange } from '@/components/briefing/MaterialChangesBanner.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { PageHeader, Sep } from '@/components/PageHeader.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';
import { cn } from '@/lib/utils.ts';
import { materialChanges, type CondForDiff } from '../../supabase/functions/_shared/material-changes.ts';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { changesFromPayload, unreadMaterialChangesFor } from '@/lib/notifications.ts';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';

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
  const notes = useNotifications();
  const alert = unreadMaterialChangesFor(notes.notifications, id)[0] ?? null;
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

  if (loading) return <PageSkeleton variant="list" />;
  if (!data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
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
  const busy = !!cond.busy || br.busy;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PageHeader
        title={passage.name}
        meta={<><StatusBadge status={passage.status} /><Sep /><span>departed <span className="num text-text-2">{fmtUtc(passage.actual_departure ?? passage.planned_departure)}</span></span><Sep /><span>last run {cond.data?.run ? <><span className="text-text-2">{cond.data.run.kind}</span> {fmtAge(cond.data.run.completed_at ?? cond.data.run.created_at)}</> : 'none'}</span></>}
        tabs={<ModeTabs passageId={passage.id} current="active" />}
        actions={<>
          <Button size="sm" onClick={() => void recheck()} disabled={busy}><RefreshCw className={cn('h-3.5 w-3.5', busy && 'animate-spin')} /> {cond.busy ?? (br.busy ? 'Briefing…' : 'Re-check conditions')}</Button>
          {passage.status === 'active' && <Button size="sm" variant="outline" onClick={async () => { await supabase.from('passages').update({ status: 'completed' }).eq('id', passage.id); await reload(); }}>Mark completed</Button>}
          <Button size="sm" variant="ghost" asChild><Link to={`/passages/${passage.id}`}>Table</Link></Button>
        </>}
      />
      {cond.error && <div className="px-4 py-1.5 text-xs bg-risk-red/10 text-risk-red border-b border-risk-red/30">{cond.error}</div>}
      <div className="p-4 space-y-4 max-w-5xl w-full">
        {alert ? <MaterialChangesBanner changes={changesFromPayload(alert.payload).length ? changesFromPayload(alert.payload) : changes} meta={<>{alert.title} · {fmtAge(alert.created_at)}</>} onDismiss={() => void notes.markRead([alert.id])} /> : <MaterialChangesBanner changes={changes} />}
        {cond.data?.run?.kind === 'recheck' && changes.length === 0 && <p className="rounded-md border border-border bg-bg-1 px-3 py-2 text-xs text-text-2 flex items-center gap-2"><Check className="h-3.5 w-3.5 text-risk-green" /> Re-check found no material changes against the previous run.</p>}

        <section className="panel p-4">
          <div className="flex flex-wrap items-end justify-between gap-2 mb-2">
            <div><div className="label">Progress</div><div className="num text-2xl font-medium leading-none mt-1">{pct}<span className="text-base text-text-3">%</span></div></div>
            <div className="num text-xs text-text-2 text-right">{arrivedCount}/{waypoints.length} waypoints · {doneNm.toFixed(1)} of {totalNm.toFixed(1)} nm{nextWp && <div className="text-text-3 mt-0.5">next <span className="text-text-1">{nextWp.sequence}. {nextWp.name}</span> · ETA {fmtUtc(byWp.get(nextWp.id)?.eta ?? nextWp.eta)}</div>}</div>
          </div>
          <div className="h-2 rounded-full bg-bg-0 border border-border overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          <ol className="mt-4">
            {waypoints.map((w, i) => {
              const c = byWp.get(w.id);
              const isNext = nextWp?.id === w.id;
              return (
                <li key={w.id} className="relative flex items-center gap-3 py-2 pl-7 border-b border-border/70 last:border-0">
                  {i < waypoints.length - 1 && <span aria-hidden className={cn('absolute left-[9px] top-[26px] bottom-[-8px] w-px', w.arrived ? 'bg-accent/60' : 'bg-border')} />}
                  <span aria-hidden className={cn('absolute left-0 top-1/2 -translate-y-1/2 h-[19px] w-[19px] rounded-full border-2 flex items-center justify-center', w.arrived ? 'border-accent bg-accent text-bg-0' : isNext ? 'border-accent bg-bg-1' : 'border-border bg-bg-1')}>{w.arrived ? <Check className="h-3 w-3" strokeWidth={3} /> : isNext ? <span className="h-1.5 w-1.5 rounded-full bg-accent" /> : null}</span>
                  <span className="num text-text-3 w-4 text-right text-xs">{w.sequence}</span>
                  <span className={cn('flex-1 truncate text-sm flex items-center gap-1.5', w.arrived && 'text-text-2', isNext && 'font-medium')}>{w.name}{w.is_anchorage && <Link to={`/passages/${passage.id}/anchorage/${w.id}`} className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-accent hover:bg-accent/15" title="Anchorage stay view"><Anchor className="h-3 w-3" /></Link>}</span>
                  <span className="num text-xs text-text-2 hidden sm:inline">{w.arrived ? <><span className="text-text-3">arrived</span> {fmtUtc(w.arrived_at)}</> : <><span className="text-text-3">ETA</span> {fmtUtc(c?.eta ?? w.eta)}</>}</span>
                  <RiskPill flag={(c?.risk_flag ?? 'unknown') as RiskFlag} reasons={(c?.risk_reasons as string[]) ?? []} />
                  <label className="flex items-center gap-1.5 text-[11px] text-text-3 cursor-pointer">arrived <Switch checked={w.arrived} onCheckedChange={(v) => void setArrived(w.id, v)} aria-label={`Arrived at ${w.name}`} /></label>
                </li>
              );
            })}
          </ol>
        </section>

        <BriefingCard briefing={br.briefing} busy={br.busy} error={br.error} onGenerate={() => void br.generate('remaining')} passageId={passage.id} tableHref={`/passages/${passage.id}`} hideMaterialChanges />
        {prevBriefingSummary && (
          <div className="panel p-3">
            <button className="flex items-center gap-1.5 text-xs text-text-2 hover:text-text-1" onClick={() => setShowPrev((v) => !v)} aria-expanded={showPrev}>{showPrev ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} Previous briefing summary</button>
            {showPrev && <p className="mt-2 text-sm text-text-2 whitespace-pre-line leading-relaxed border-l-2 border-border pl-3">{prevBriefingSummary}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
