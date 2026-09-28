// The one passage page. Groups in order: Alerts, At a glance, Briefing, Route, Conditions along the
// selected leg, Tide and depth, Departure windows, Data and sources. Simple hides internals behind
// tooltips and the full table page; Detailed shows every field inside the same groups.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Link } from 'react-router-dom';
import { Check, Download, Flag, GitCompareArrows, MapPin, Pencil, Play, Printer, RefreshCw, Table2 } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useBriefing } from '@/hooks/useBriefing.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { nearestTargetRow, useBandSeries } from '@/hooks/useBandSeries.ts';
import { useLegConditions, useLegProfiles } from '@/hooks/useLegConditions.ts';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { useNow } from '@/hooks/useNow.ts';
import { useTideSwellSeries } from '@/hooks/useTideSwellSeries.ts';
import { useDepartureWindows } from '@/hooks/useDepartureWindows.ts';
import { num, type ConfidenceLevel, type RiskFlag, type WaypointConditionsRow } from '@/types/domain.ts';
import { PassageHeader } from '@/components/passage/PassageHeader.tsx';
import { AtAGlance } from '@/components/passage/AtAGlance.tsx';
import { LegList } from '@/components/passage/LegList.tsx';
import { ConditionsSection } from '@/components/passage/ConditionsSection.tsx';
import { TideSection } from '@/components/passage/TideSection.tsx';
import { DepartureWindowsSection } from '@/components/passage/DepartureWindowsSection.tsx';
import { DataSources } from '@/components/passage/DataSources.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { MaterialChangesBanner, type MaterialChange } from '@/components/briefing/MaterialChangesBanner.tsx';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { MapHeaderStrip } from '@/components/map/MapHeaderStrip.tsx';
import { OverlayToggles, RiskLegend } from '@/components/map/OverlayToggles.tsx';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';
import { Section } from '@/components/ui/section.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import type { MenuItem } from '@/components/ui/dropdown-menu.tsx';
import { agePhrase, dayPartPhrase, distancePhrase, durationPhrase, etaDeltaPhrase, localDateTime, riskHeadline, worstStretch } from '@/lib/plain.ts';
import { toGpx } from '@/lib/gpx.ts';
import { buildRouteSegments, RISK_RANK } from '@/lib/leg-profile.ts';
import { changesFromPayload, unreadMaterialChangesFor } from '@/lib/notifications.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';
import { passageConfidence } from '../../supabase/functions/_shared/confidence.ts';
import { materialChanges, type CondForDiff } from '../../supabase/functions/_shared/material-changes.ts';
import { cn } from '@/lib/utils.ts';

const asRisk = (v: unknown): RiskFlag => (v === 'green' || v === 'amber' || v === 'red' ? v : 'unknown');

export default function Passage() {
  const { id } = useParams();
  const { data, loading, reload } = usePassage(id);
  const cond = useConditions(id);
  const br = useBriefing(id);
  const { prefs, update } = useDisplayPrefs();
  const detail = prefs.detail_level;
  const off = prefs.local_utc_offset_min;
  const nowMs = useNow(60_000);
  const notes = useNotifications();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const [encStatus, setEncStatus] = useState<string | null>(null);
  const [showSwell, setShowSwell] = useState(false);
  const [prevState, setPrevState] = useState<{ runId: string; rows: WaypointConditionsRow[] } | null>(null);

  const waypoints = useMemo(() => data?.waypoints ?? [], [data]);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  const run = cond.data?.run ?? null;
  const prevRunId = cond.data?.previousRun?.id ?? null;
  const legRows = useLegConditions(run?.id ?? null, id);
  const legs = useLegProfiles(legRows.rows, waypoints);
  const legInto = useMemo(() => new Map(legs.map((l) => [l.toId, l])), [legs]);
  const segments = useMemo(() => (legs.length ? buildRouteSegments(waypoints, legs, (wpId) => (byWp.get(wpId)?.risk_flag as RiskFlag | undefined) ?? null) : null), [legs, waypoints, byWp]);
  const targets = useMemo(() => cond.data?.targets ?? [], [cond.data]);

  // Default selection: the worst leg once a run exists, else the first leg.
  const defaultId = useMemo(() => {
    let best: { id: string; rank: number; wind: number } | null = null;
    for (const w of waypoints.slice(1)) {
      const c = byWp.get(w.id), l = legInto.get(w.id);
      const risk = [asRisk(c?.risk_flag), l?.summary.worstRisk ?? 'unknown'].reduce((a, b) => (RISK_RANK[b] > RISK_RANK[a] ? b : a));
      const wind = Math.max(num(c?.wind_p90_kn) ?? -1, l?.summary.maxWindP90 ?? -1);
      if (!best || RISK_RANK[risk] > best.rank || (RISK_RANK[risk] === best.rank && wind > best.wind)) best = { id: w.id, rank: RISK_RANK[risk], wind };
    }
    return best?.id ?? waypoints[1]?.id ?? waypoints[0]?.id ?? null;
  }, [waypoints, byWp, legInto]);
  const selected = waypoints.find((w) => w.id === selectedId) ?? waypoints.find((w) => w.id === defaultId) ?? null;
  const selC = selected ? byWp.get(selected.id) ?? null : null;
  const selLeg = selected ? legInto.get(selected.id) ?? null : null;
  const atmosTarget = selected ? nearestTargetRow(targets, 'atmospheric', Number(selected.lat), Number(selected.lon)) : null;
  const primarySource = selC?.atmos_source ?? conditions[0]?.atmos_source ?? 'google_weathernext2_ensemble';
  const comparisonSource = selC?.comparison_source ?? conditions[0]?.comparison_source ?? 'ncep_gfs_global';
  const band = useBandSeries(atmosTarget?.id ?? null, primarySource, comparisonSource);
  const tideSwell = useTideSwellSeries(selected, data?.vessel ?? null, targets);
  const dep = useDepartureWindows(waypoints[0] ?? null, data?.vessel ?? null, targets, primarySource, comparisonSource);

  // Previous run rows for a client-side diff when no alert row exists (underway re-checks).
  useEffect(() => {
    if (!prevRunId) return;
    let cancelled = false;
    supabase.from('waypoint_conditions').select('*').eq('run_id', prevRunId).then(({ data: rows }) => { if (!cancelled) setPrevState({ runId: prevRunId, rows: rows ?? [] }); });
    return () => { cancelled = true; };
  }, [prevRunId]);
  const prevConds = useMemo(() => (prevRunId && prevState?.runId === prevRunId ? prevState.rows : []), [prevRunId, prevState]);
  const diffChanges: MaterialChange[] = useMemo(() => {
    const fromBriefing = br.briefing?.material_changes as MaterialChange[] | null | undefined;
    if (fromBriefing && br.briefing?.run_id === run?.id) return fromBriefing;
    if (!prevRunId || !data || prevConds.length === 0) return [];
    const toDiff = (rows: WaypointConditionsRow[]): CondForDiff[] => rows.map((r) => ({ waypoint_id: r.waypoint_id, risk_flag: r.risk_flag as RiskFlag, source_disagreement: r.source_disagreement, confidence_level: r.confidence_level as ConfidenceLevel, wind_p90_kn: num(r.wind_p90_kn), wave_height_m: num(r.wave_height_m), tide_height_m: num(r.tide_height_m) }));
    const meta: Record<string, { sequence: number; name: string | null; is_anchorage: boolean }> = {};
    for (const w of data.waypoints) meta[w.id] = { sequence: w.sequence, name: w.name, is_anchorage: w.is_anchorage };
    return materialChanges(toDiff(prevConds), toDiff(conditions), meta);
  }, [br.briefing, run?.id, prevRunId, prevConds, conditions, data]);

  if (loading) return <PageSkeleton variant="passage" />;
  if (!data) return <div className="p-6 text-[14px] text-text-2">Passage not found.</div>;
  const { passage, vessel } = data;
  const underway = passage.status === 'active';
  const hasRun = !!run && conditions.length > 0;
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const departs = passage.actual_departure ?? passage.planned_departure;
  const last = waypoints[waypoints.length - 1] ?? null;
  const lastC = last ? byWp.get(last.id) ?? null : null;
  const arrival = lastC?.eta ?? last?.eta ?? null;
  const flags = [...conditions.map((c) => c.risk_flag as RiskFlag), ...legs.map((l) => l.summary.worstRisk)];
  const worst = flags.length ? worstRisk(flags) : null;
  const confidence = conditions.length ? passageConfidence(conditions.map((c) => c.confidence_level as ConfidenceLevel)) : null;
  const triggers = [...new Set(conditions.flatMap((c) => (c.confidence_triggers as string[] | null) ?? []))];
  const disagreeAt = conditions.filter((c) => c.source_disagreement).map((c) => waypoints.find((w) => w.id === c.waypoint_id)?.name).filter(Boolean) as string[];
  const headline = riskHeadline(conditions, legs, waypoints, { utcOffsetMin: off, nowMs });
  const worstS = hasRun ? worstStretch(conditions, legs, waypoints) : null;
  const alert = unreadMaterialChangesFor(notes.notifications, id)[0] ?? null;
  const busy = !!cond.busy || br.busy;

  const compute = async (kind: 'initial' | 'recheck') => { const r = await cond.compute(kind); if (r && kind === 'recheck') await br.generate('remaining'); };
  const setStatus = async (status: 'active' | 'completed') => {
    const patch: { status: string; actual_departure?: string } = { status };
    if (status === 'active' && !passage.actual_departure) patch.actual_departure = new Date().toISOString();
    await supabase.from('passages').update(patch).eq('id', passage.id);
    await reload();
  };
  const setArrived = async (wpId: string, arrived: boolean) => {
    await supabase.from('waypoints').update({ arrived, arrived_at: arrived ? new Date().toISOString() : null }).eq('id', wpId);
    await reload();
  };
  const exportGpx = () => {
    const blob = new Blob([toGpx(passage.name, waypoints.map((w) => ({ name: w.name, lat: Number(w.lat), lon: Number(w.lon), eta: w.eta })))], { type: 'application/gpx+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${passage.name.replace(/[^\w-]+/g, '_')}.gpx`; a.click(); URL.revokeObjectURL(a.href);
  };
  const exportPdf = () => { window.open(`/passages/${passage.id}/print`, '_blank', 'noopener'); };

  const primary = underway
    ? { label: 'Re-check now', onClick: () => void compute('recheck'), busy }
    : hasRun ? { label: 'Refresh conditions', onClick: () => void compute('initial'), busy } : { label: 'Check conditions', onClick: () => void compute('initial'), busy };
  const menu: MenuItem[] = [
    { label: 'Edit route', icon: Pencil, href: `/passages/${passage.id}/edit` },
    ...(underway ? [{ label: 'Mark completed', icon: Flag, onSelect: () => void setStatus('completed'), hint: 'Ends scheduled checks and files it under Past.' }] : passage.status === 'planned' ? [{ label: 'Start passage', icon: Play, onSelect: () => void setStatus('active'), hint: 'Marks it underway so scheduled checks and arrival toggles switch on.' }] : []),
    { kind: 'divider' },
    { label: 'Full table', icon: Table2, href: `/passages/${passage.id}/table`, hint: 'Every number, one row per waypoint.' },
    { label: 'Compare models', icon: GitCompareArrows, href: `/passages/${passage.id}/comparison`, hint: 'Primary ensemble against the comparison model, leg by leg.' },
    { label: 'Export GPX', icon: Download, onSelect: exportGpx },
    { label: 'Print briefing', icon: Printer, onSelect: exportPdf, hint: 'Opens a page laid out for paper.' },
    { kind: 'divider' },
    { kind: 'heading', label: 'Advanced' },
    { label: 'Refresh forecast data', icon: RefreshCw, onSelect: () => void cond.fetchNow(), hint: 'Pulls the newest model runs for every grid point now.', disabled: busy },
    { label: 'Recompute route points', icon: MapPin, onSelect: () => void cond.planTargets(), hint: 'Rebuilds the grid points along the route after editing it.', disabled: busy },
  ];

  const mapWps = waypoints.map((w) => ({ id: w.id, sequence: w.sequence, name: w.name, lat: Number(w.lat), lon: Number(w.lon), is_anchorage: w.is_anchorage, risk: (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }));
  const mapBlock = (heightClass: string) => (
    <div className="card overflow-hidden">
      <DisclaimerBar />
      <div className={cn('relative', heightClass)}>
        <PassageMap waypoints={mapWps} selectedId={selected?.id ?? null} showOpenSeaMap={prefs.show_openseamap} showNoaaEnc={prefs.show_noaa_enc} onEncStatus={setEncStatus} colourByRisk segments={segments} onSelect={setSelectedId} />
        <OverlayToggles prefs={prefs} update={update} encStatus={encStatus} />
        <RiskLegend segmented={!!segments} />
      </div>
    </div>
  );
  const prevSummary = (br.briefing?.input_snapshot as { previous_briefing_summary?: string } | null)?.previous_briefing_summary ?? null;
  const selEta = selC?.eta ?? selected?.eta ?? null;
  const etaMarks = selEta ? [{ t: Date.parse(selEta), label: 'Arrive' }] : [];
  const routeLine = `${waypoints.length} waypoints, ${distancePhrase(totalNm)}${vessel ? `, ${vessel.name}` : ''}`;
  const checkedSub = run ? (run.trigger === 'scheduled' || underway ? 'Checks again automatically each hour' : run.kind === 'recheck' ? 'Re-check by hand' : 'First check') : null;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PassageHeader passage={passage} vessel={vessel} from={waypoints[0]?.name ?? null} to={last?.name ?? null} totalNm={totalNm} utcOffsetMin={off} detail={detail} onDetail={(d) => update({ detail_level: d })} primary={primary} menu={menu} />
      {(cond.busy || cond.error) && <div role="status" className={cn('px-4 md:px-6 py-2 text-[13px] flex items-center gap-2 border-b border-border-soft', cond.error ? 'bg-risk-red/10 text-risk-red' : 'bg-bg-1 text-text-2')}>{!cond.error && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}{cond.error ?? cond.busy}</div>}

      <div className="px-4 md:px-6 py-5 md:py-6 space-y-8 max-w-[1280px] w-full mx-auto">
        {alert ? (
          <MaterialChangesBanner changes={changesFromPayload(alert.payload).length ? changesFromPayload(alert.payload) : diffChanges} meta={agePhrase(alert.created_at, nowMs)} onDismiss={() => void notes.markRead([alert.id])} />
        ) : diffChanges.length > 0 ? (
          <MaterialChangesBanner changes={diffChanges} meta={run ? agePhrase(run.completed_at ?? run.created_at, nowMs) : undefined} />
        ) : run?.kind === 'recheck' && prevConds.length > 0 ? (
          <p className="card px-4 py-3 text-[13px] text-text-2 flex items-center gap-2"><Check className="h-4 w-4 text-risk-green" /> The last re-check found no material changes against the previous one.</p>
        ) : null}

        <AtAGlance
          headline={headline}
          confidence={confidence ? { level: confidence, triggers, where: disagreeAt.length ? disagreeAt.join(' and ') : null } : null}
          noRun={!hasRun}
          routeLine={routeLine}
          primary={primary}
          stats={{
            departure: { value: localDateTime(departs, off), sub: passage.actual_departure ? 'Local, actual' : 'Local, planned' },
            arrival: { value: localDateTime(arrival, off), sub: etaDeltaPhrase(lastC?.eta, lastC?.eta_planned, conditions.some((c) => (num(c.speed_loss_pct) ?? 0) > 0) ? 1 : 0, conditions.some((c) => c.current_source === 'manual') ? 'manual' : conditions.some((c) => c.current_source === 'model') ? 'model' : null) ?? (arrival ? `${durationPhrase((Date.parse(arrival) - Date.parse(departs)) / 3_600_000)} under way` : null) },
            worst: worstS && worst && worst !== 'green' ? { name: worstS.name, risk: worstS.risk, sub: [dayPartPhrase(worstS.eta, off, nowMs)?.replace(/^on /, ''), worstS.number].filter(Boolean).join(', ') || null } : worst === 'green' ? { name: 'None', risk: 'green', sub: 'Every leg is green' } : null,
            checked: { value: run ? agePhrase(run.completed_at ?? run.created_at, nowMs) : null, sub: checkedSub },
          }}
        />

        <BriefingCard briefing={br.briefing} busy={br.busy} error={br.error} onGenerate={() => void br.generate(underway ? 'remaining' : 'full')} canGenerate={hasRun} nowMs={nowMs} previousSummary={underway ? prevSummary : null} />

        <Section id="route" title="Route" description={routeLine} actions={detail === 'detailed' ? <Button size="sm" variant="secondary" asChild><Link to={`/passages/${passage.id}/table`}><Table2 /> Full table</Link></Button> : undefined}>
          <div className="grid gap-4 lg:grid-cols-[55fr_45fr] items-start">
            <div className="hidden md:block lg:sticky lg:top-[132px]">{mapBlock('h-[440px]')}</div>
            {waypoints.length >= 2 && (
              <div className="md:hidden space-y-3 min-w-0">
                <div className="card overflow-hidden"><MapHeaderStrip from={`${waypoints[0].sequence}. ${waypoints[0].name ?? ''}`} to={`${last?.sequence}. ${last?.name ?? ''}`} totalNm={totalNm} legs={waypoints.slice(1).map((w) => ({ nm: num(w.leg_distance_nm) ?? 0, risk: legInto.get(w.id)?.summary.worstRisk ?? (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }))} open={showMapMobile} onToggle={() => setShowMapMobile((v) => !v)} /></div>
                {showMapMobile && mapBlock('h-72')}
              </div>
            )}
            <LegList passageId={passage.id} waypoints={waypoints} byWp={byWp} legInto={legInto} selectedId={selected?.id ?? null} onSelect={setSelectedId} utcOffsetMin={off} detail={detail} underway={underway} onArrived={underway ? (wpId, v) => void setArrived(wpId, v) : undefined} totalNm={totalNm} noRun={!hasRun} />
          </div>
        </Section>

        <ConditionsSection waypoints={waypoints} legs={legs} selected={selected} selC={selC} selLeg={selLeg} onSelect={setSelectedId} vessel={vessel} utcOffsetMin={off} detail={detail} band={{ points: band.points, target: atmosTarget, comparisonSource }} noRun={!hasRun} />

        <TideSection passageId={passage.id} selected={selected} selC={selC} vessel={vessel} tideSwell={tideSwell} nowMs={nowMs} etaMarks={etaMarks} etaIso={selEta} detail={detail} utcOffsetMin={off} showSwell={showSwell} onShowSwell={setShowSwell} noRun={!hasRun} />

        <DepartureWindowsSection derived={dep.windows} sampled={dep.sampled} suggested={(br.briefing?.suggested_departure_windows as { start: string; end: string; reason: string }[] | null) ?? []} utcOffsetMin={off} originName={waypoints[0]?.name ?? null} />

        <DataSources targets={targets} conditions={conditions} run={run} legPoints={legRows.rows.length} legCount={legs.length} nowMs={nowMs} busy={busy} onFetchNow={() => void cond.fetchNow()} onPlanTargets={() => void cond.planTargets()} />
      </div>
    </div>
  );
}
