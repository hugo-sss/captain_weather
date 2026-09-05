// Simplified mode: map first, briefing as hero card, stat tiles, "show table" always visible (PRD §9.5 screen 3).
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, Table } from 'lucide-react';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useBriefing } from '@/hooks/useBriefing.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { num, type ConfidenceLevel, type RiskFlag } from '@/types/domain.ts';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { MapHeaderStrip } from '@/components/map/MapHeaderStrip.tsx';
import { OverlayToggles, RiskLegend } from '@/components/map/OverlayToggles.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { PageHeader, Sep } from '@/components/PageHeader.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { fmtAge, fmtUtc } from '@/lib/time.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';
import { passageConfidence } from '../../supabase/functions/_shared/confidence.ts';
import { useDepartureWindows } from '@/hooks/useDepartureWindows.ts';
import { useLegConditions, useLegProfiles } from '@/hooks/useLegConditions.ts';
import { buildRouteSegments, worstPointAlongPassage } from '@/lib/leg-profile.ts';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';
import { cn } from '@/lib/utils.ts';

export default function DashboardSimple() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const br = useBriefing(id);
  const { prefs, update } = useDisplayPrefs();
  const [encStatus, setEncStatus] = useState<string | null>(null);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  const wpsMemo = useMemo(() => data?.waypoints ?? [], [data]);
  const legRows = useLegConditions(cond.data?.run?.id ?? null, id);
  const legs = useLegProfiles(legRows.rows, wpsMemo);
  const segments = useMemo(() => (legs.length ? buildRouteSegments(wpsMemo, legs, (wpId) => (byWp.get(wpId)?.risk_flag as RiskFlag | undefined) ?? null) : null), [legs, wpsMemo, byWp]);
  const worstPt = useMemo(() => worstPointAlongPassage(legs), [legs]);
  const dep = useDepartureWindows(data?.waypoints[0] ?? null, data?.vessel ?? null, cond.data?.targets ?? [], conditions[0]?.atmos_source ?? 'google_weathernext2_ensemble', conditions[0]?.comparison_source ?? 'ncep_gfs_global');
  if (loading) return <PageSkeleton variant="map" />;
  if (!data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
  const { passage, waypoints, vessel } = data;
  const flags = conditions.map((c) => c.risk_flag as RiskFlag);
  const worst = flags.length ? worstRisk(flags) : 'unknown';
  const worstLeg = conditions.filter((c) => c.risk_flag === worst).map((c) => waypoints.find((w) => w.id === c.waypoint_id)).find(Boolean);
  const confidence = conditions.length ? passageConfidence(conditions.map((c) => c.confidence_level as ConfidenceLevel)) : null;
  const windows = (br.briefing?.suggested_departure_windows as { start: string; end: string }[] | null) ?? [];
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const win = windows[0] ?? dep.windows[0] ?? null;
  const tiles: { label: string; value: React.ReactNode; sub?: React.ReactNode }[] = [
    { label: 'Confidence', value: confidence ? <ConfidenceDot level={confidence} withLabel /> : <span className="text-text-3">—</span>, sub: confidence ? 'lowest across legs' : 'no run yet' },
    { label: 'Worst leg', value: <RiskPill flag={worst} />, sub: worstLeg ? <><span className="num">{worstLeg.sequence}.</span> {worstLeg.name}</> : undefined },
    { label: 'Departure window', value: win ? <span className="num text-[13px]">{fmtUtc(win.start)} → {fmtUtc(win.end)}</span> : <span className="text-text-3 text-sm">none found</span>, sub: win ? (windows[0] ? 'from the briefing' : 'from the raw series') : undefined },
    { label: 'Re-check age', value: <span className="num text-[15px]">{cond.data?.run ? fmtAge(cond.data.run.completed_at ?? cond.data.run.created_at) : 'no run'}</span>, sub: cond.data?.run ? `${cond.data.run.kind} run${cond.data.run.trigger === 'scheduled' ? ' · scheduled' : ''}` : undefined },
  ];
  const worstWhy = worstPt ? (worstPt.point.riskReasons[0] ?? (worstPt.point.risk === 'unknown' ? `no data: ${worstPt.point.dataGaps.join(', ') || 'layers missing'}` : `wind p90 ${Math.round(worstPt.point.windP90 ?? 0)} kn, Hs ${worstPt.point.waveHs === null ? '—' : worstPt.point.waveHs.toFixed(1)} m`)) : null;
  const mapWps = waypoints.map((w) => ({ id: w.id, sequence: w.sequence, name: w.name, lat: Number(w.lat), lon: Number(w.lon), is_anchorage: w.is_anchorage, risk: (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }));
  const map = (h: string) => (
    <div className={cn('relative', h)}>
      <PassageMap waypoints={mapWps} showOpenSeaMap={prefs.show_openseamap} showNoaaEnc={prefs.show_noaa_enc} onEncStatus={setEncStatus} colourByRisk segments={segments} />
      <OverlayToggles prefs={prefs} update={update} encStatus={encStatus} />
      <RiskLegend segmented={!!segments} />
    </div>
  );
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PageHeader
        title={passage.name}
        meta={<>{vessel?.name ?? 'no vessel'}<Sep /><StatusBadge status={passage.status} /><Sep /><span>departs <span className="num text-text-2">{fmtUtc(passage.actual_departure ?? passage.planned_departure)}</span></span></>}
        tabs={<ModeTabs passageId={passage.id} current="simple" />}
        actions={<Button size="sm" variant="outline" asChild><Link to={`/passages/${passage.id}`}><Table className="h-3.5 w-3.5" /> Show the table</Link></Button>}
      />
      <DisclaimerBar />
      <div className="hidden md:block border-b border-border">{map('h-[40vh] min-h-[280px]')}</div>
      {waypoints.length >= 2 && (
        <>
          <MapHeaderStrip from={`${waypoints[0].sequence}. ${waypoints[0].name ?? ''}`} to={`${waypoints[waypoints.length - 1].sequence}. ${waypoints[waypoints.length - 1].name ?? ''}`} totalNm={totalNm} legs={waypoints.slice(1).map((w) => ({ nm: num(w.leg_distance_nm) ?? 0, risk: (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }))} open={showMapMobile} onToggle={() => setShowMapMobile((v) => !v)} />
          {showMapMobile && <div className="md:hidden border-b border-border">{map('h-64')}</div>}
        </>
      )}
      <div className="p-4 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <section className="panel border-t-2 border-t-accent p-4 sm:p-5 space-y-4 min-w-0">
          <div>
            <div className="label text-accent/90">Passage</div>
            <h2 className="text-xl font-semibold leading-tight mt-0.5">{passage.name}</h2>
            <p className="text-xs text-text-2 mt-1">{vessel?.name ?? 'no vessel'} · {waypoints.length} waypoints · <span className="num">{totalNm.toFixed(1)} nm</span> · departs <span className="num">{fmtUtc(passage.actual_departure ?? passage.planned_departure)}</span></p>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {tiles.map((t) => (
              <div key={t.label} className="tile px-3 py-2.5 min-h-[64px] flex flex-col justify-center">
                <div className="label">{t.label}</div>
                <div className="mt-1.5 text-sm">{t.value}</div>
                {t.sub && <div className="text-[11px] text-text-3 mt-0.5 truncate">{t.sub}</div>}
              </div>
            ))}
          </div>
          {worstPt && (
            <div className="tile px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
              <div className="min-w-0">
                <div className="label">Worst point along the passage</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                  <RiskPill flag={worstPt.point.risk} reasons={worstPt.point.riskReasons} />
                  <span className="font-medium truncate">{worstPt.leg.from?.name ?? ''} → {worstPt.leg.to?.name ?? ''}</span>
                  <span className="num text-text-2">{worstPt.point.distanceNm.toFixed(1)} nm in · {fmtUtc(worstPt.point.eta)}</span>
                  <SquallBadge risk={worstPt.point.squall} capeJkg={worstPt.point.capeJkg} precipPct={worstPt.point.precipPct} size="sm" />
                </div>
                <div className="text-[11px] text-text-3 mt-0.5 num">{worstWhy}</div>
              </div>
              <Link to={`/passages/${passage.id}`} className="ml-auto inline-flex items-center gap-1 text-xs text-accent hover:underline underline-offset-2">Leg profile <ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          )}
          <div className="border-t border-border pt-4">
            <BriefingCard bare hero briefing={br.briefing} busy={br.busy} error={br.error} onGenerate={() => void br.generate(passage.status === 'active' ? 'remaining' : 'full')} passageId={passage.id} tableHref={`/passages/${passage.id}`} />
          </div>
        </section>
        <aside className="panel p-3 text-sm self-start min-w-0">
          <div className="flex items-baseline justify-between mb-1"><div className="label">Legs</div><div className="text-[11px] text-text-3">p50–p90 wind</div></div>
          <ul>
            {waypoints.map((w) => { const c = byWp.get(w.id); return (
              <li key={w.id} className="flex items-center gap-2.5 py-2 border-b border-border/70 last:border-0">
                <span className="num inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg-2 text-[11px] text-text-2">{w.sequence}</span>
                <span className={cn('flex-1 truncate', w.arrived && 'text-text-2')}>{w.name}</span>
                <span className="num text-xs text-text-2 shrink-0">{c && c.wind_p50_kn !== null ? `${Math.round(num(c.wind_p50_kn) ?? 0)}–${Math.round(num(c.wind_p90_kn) ?? 0)} kn` : ''}</span>
                <RiskPill flag={(c?.risk_flag ?? 'unknown') as RiskFlag} reasons={(c?.risk_reasons as string[]) ?? []} size="sm" />
              </li>); })}
          </ul>
          <Link to={`/passages/${passage.id}`} className="mt-3 inline-flex items-center gap-1 text-xs text-accent hover:underline underline-offset-2">Full table with every number <ArrowUpRight className="h-3 w-3" /></Link>
        </aside>
      </div>
    </div>
  );
}
