// Professional dashboard: the default landing view. Raw data first (non-negotiable 1).
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Activity, Download, Pencil, Printer, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { nearestTargetRow, useBandSeries } from '@/hooks/useBandSeries.ts';
import { useLegConditions, useLegProfiles } from '@/hooks/useLegConditions.ts';
import { useNotifications } from '@/hooks/useNotifications.ts';
import { useNow } from '@/hooks/useNow.ts';
import { num, type ConfidenceLevel, type RiskFlag } from '@/types/domain.ts';
import { KpiStrip } from '@/components/dashboard/KpiStrip.tsx';
import { LegTable } from '@/components/dashboard/LegTable.tsx';
import { BandChart } from '@/components/dashboard/BandChart.tsx';
import { LegProfile } from '@/components/dashboard/LegProfile.tsx';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { GustSourceChip } from '@/components/dashboard/GustSourceChip.tsx';
import { DepthSourceChip } from '@/components/dashboard/DepthSourceChip.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { MaterialChangesBanner } from '@/components/briefing/MaterialChangesBanner.tsx';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { MapHeaderStrip } from '@/components/map/MapHeaderStrip.tsx';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { StatusBadge } from '@/components/ui/badge.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { PageHeader, Sep } from '@/components/PageHeader.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { BriefingCard } from '@/components/briefing/BriefingCard.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { TideChart } from '@/components/dashboard/TideChart.tsx';
import { OverlayToggles, RiskLegend } from '@/components/map/OverlayToggles.tsx';
import { useBriefing } from '@/hooks/useBriefing.ts';
import { useTideSwellSeries } from '@/hooks/useTideSwellSeries.ts';
import { useDepartureWindows } from '@/hooks/useDepartureWindows.ts';
import { DepartureWindows } from '@/components/dashboard/DepartureWindows.tsx';
import { fmtAge, fmtHours, fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { toGpx } from '@/lib/gpx.ts';
import { asSquall, buildRouteSegments, etaDeltaMinutes, fmtEtaDelta, SQUALL_LABEL, SQUALL_RANK } from '@/lib/leg-profile.ts';
import { ukcBasisText } from '@/lib/gebco.ts';
import { changesFromPayload, unreadMaterialChangesFor } from '@/lib/notifications.ts';
import { cn } from '@/lib/utils.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';
import { passageConfidence } from '../../supabase/functions/_shared/confidence.ts';

/** Two-state segmented toggle used for chart modes. */
function Toggle<T extends string>({ value, options, onChange, label }: { value: T; options: { v: T; label: string; disabled?: boolean }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-7 items-center rounded-md border border-border bg-bg-0 p-0.5 text-[11px]">
      {options.map((o) => <button key={o.v} type="button" role="radio" aria-checked={value === o.v} disabled={o.disabled} onClick={() => onChange(o.v)} className={cn('h-6 rounded-[4px] px-2 font-medium transition-colors disabled:opacity-40', value === o.v ? 'bg-bg-2 text-text-1 shadow-[inset_0_-2px_0_#2DD4BF]' : 'text-text-2 hover:text-text-1')}>{o.label}</button>)}
    </div>
  );
}

export default function DashboardPro() {
  const { id } = useParams();
  const { data, loading, reload } = usePassage(id);
  const cond = useConditions(id);
  const { prefs, update } = useDisplayPrefs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(true);
  const [chartMode, setChartMode] = useState<'profile' | 'band' | null>(null);
  const [tideMode, setTideMode] = useState<'pair' | 'tide'>('pair');

  const waypoints = useMemo(() => data?.waypoints ?? [], [data]);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  const run = cond.data?.run ?? null;
  const legRows = useLegConditions(run?.id ?? null, id);
  const legs = useLegProfiles(legRows.rows, waypoints);
  const legInto = useMemo(() => new Map(legs.map((l) => [l.toId, l])), [legs]);
  const segments = useMemo(() => (legs.length ? buildRouteSegments(waypoints, legs, (wpId) => (byWp.get(wpId)?.risk_flag as RiskFlag | undefined) ?? null) : null), [legs, waypoints, byWp]);
  const selected = waypoints.find((w) => w.id === selectedId) ?? waypoints[1] ?? waypoints[0] ?? null;
  const selC = selected ? byWp.get(selected.id) ?? null : null;
  const selLeg = selected ? legInto.get(selected.id) ?? legs[0] ?? null : null;
  const atmosTarget = selected && cond.data ? nearestTargetRow(cond.data.targets, 'atmospheric', Number(selected.lat), Number(selected.lon)) : null;
  const primarySource = selC?.atmos_source ?? 'google_weathernext2_ensemble';
  const comparisonSource = selC?.comparison_source ?? 'ncep_gfs_global';
  const band = useBandSeries(atmosTarget?.id ?? null, primarySource, comparisonSource);
  const br = useBriefing(id);
  const [encStatus, setEncStatus] = useState<string | null>(null);
  const tideSwell = useTideSwellSeries(selected ?? null, data?.vessel ?? null, cond.data?.targets ?? []);
  const dep = useDepartureWindows(waypoints[0] ?? null, data?.vessel ?? null, cond.data?.targets ?? [], primarySource, comparisonSource);
  const [showMapMobile, setShowMapMobile] = useState(false);
  const notes = useNotifications();
  const alert = unreadMaterialChangesFor(notes.notifications, id)[0] ?? null;
  const nowMs = useNow(60_000);

  if (loading) return <PageSkeleton variant="table" />;
  if (!data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
  const { passage, vessel } = data;
  const maxWind = num(vessel?.max_wind_kn);
  const maxWaveLimit = num(vessel?.max_wave_m);
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const arrival = waypoints[waypoints.length - 1]?.eta ?? null;
  const flags = [...conditions.map((c) => c.risk_flag as RiskFlag), ...legs.map((l) => l.summary.worstRisk)];
  const worst = flags.length ? worstRisk(flags) : 'unknown';
  const confidence = conditions.length ? passageConfidence(conditions.map((c) => c.confidence_level as ConfidenceLevel)) : null;
  const maxOf = (vals: (number | null)[]) => vals.reduce<number | null>((m, v) => (v === null ? m : Math.max(m ?? -Infinity, v)), null);
  const maxP90 = maxOf([...conditions.map((c) => num(c.wind_p90_kn)), ...legs.map((l) => l.summary.maxWindP90)]);
  const maxWave = maxOf([...conditions.map((c) => num(c.wave_height_m)), ...legs.map((l) => l.summary.maxHs)]);
  const squallWorst = [...conditions.map((c) => asSquall(c.squall_risk)), ...legs.map((l) => l.summary.worstSquall)].reduce((w, s) => (SQUALL_RANK[s] > SQUALL_RANK[w] ? s : w), 'none' as const);
  const targets = cond.data?.targets ?? [];
  const layerStatus = (['atmospheric', 'comparison', 'marine', 'tidal'] as const).map((layer) => {
    const ts = targets.filter((t) => t.layer === layer);
    const fetched = ts.filter((t) => t.last_fetched_at && !t.last_error).length;
    const err = ts.find((t) => t.last_error)?.last_error ?? null;
    const last = ts.map((t) => t.last_fetched_at).filter(Boolean).sort().pop() ?? null;
    return { layer, count: ts.length, fetched, err, last };
  });
  const redCount = flags.filter((f) => f === 'red').length, amberCount = flags.filter((f) => f === 'amber').length, divergeCount = conditions.filter((c) => c.source_disagreement).length;
  const mode = chartMode ?? (selLeg && selLeg.points.length ? 'profile' : 'band');
  const etaDelta = etaDeltaMinutes(selC?.eta_planned, selC?.eta);
  const tideOnly = tideSwell.points.map((p) => ({ t: p.t, height: p.tide }));

  const setStatus = async (status: string) => {
    const patch: { status: string; actual_departure?: string } = { status };
    if (status === 'active' && !passage.actual_departure) patch.actual_departure = new Date().toISOString();
    await supabase.from('passages').update(patch).eq('id', passage.id);
    await reload();
  };
  const exportGpx = () => {
    const blob = new Blob([toGpx(passage.name, waypoints.map((w) => ({ name: w.name, lat: Number(w.lat), lon: Number(w.lon), eta: w.eta })))], { type: 'application/gpx+xml' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${passage.name.replace(/[^\w-]+/g, '_')}.gpx`; a.click(); URL.revokeObjectURL(a.href);
  };
  const exportPdf = () => { window.open(`/passages/${passage.id}/print`, '_blank', 'noopener'); };

  const mapWps = waypoints.map((w) => ({ id: w.id, sequence: w.sequence, name: w.name, lat: Number(w.lat), lon: Number(w.lon), is_anchorage: w.is_anchorage, risk: (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }));
  const mapBlock = (heightClass: string) => (
    <div className="panel overflow-hidden">
      <DisclaimerBar />
      <div className={cn('relative', heightClass)}>
        <PassageMap waypoints={mapWps} selectedId={selected?.id ?? null} showOpenSeaMap={prefs.show_openseamap} showNoaaEnc={prefs.show_noaa_enc} onEncStatus={setEncStatus} colourByRisk segments={segments} onSelect={setSelectedId} />
        <OverlayToggles prefs={prefs} update={update} encStatus={encStatus} />
        <RiskLegend segmented={!!segments} />
      </div>
    </div>
  );
  const briefing = (
    <BriefingCard briefing={br.briefing} busy={br.busy} error={br.error} onGenerate={() => void br.generate(passage.status === 'active' ? 'remaining' : 'full')} passageId={passage.id} compact collapseMaterialChanges={!!alert} />
  );
  const primaryAction = passage.status === 'active'
    ? <Button size="sm" onClick={() => void cond.compute('recheck')} disabled={!!cond.busy}><RefreshCw className={cn('h-3.5 w-3.5', cond.busy && 'animate-spin')} /> Re-check conditions</Button>
    : <Button size="sm" onClick={() => void cond.compute('initial')} disabled={!!cond.busy}><Activity className="h-3.5 w-3.5" /> Compute conditions</Button>;

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PageHeader
        title={passage.name}
        meta={<>{vessel?.name ?? 'no vessel'}<Sep /><StatusBadge status={passage.status} /><Sep /><span>departs <span className="num text-text-2">{fmtUtc(passage.actual_departure ?? passage.planned_departure)}</span></span><Sep /><span>run {run ? <><span className="text-text-2">{run.status}</span> {fmtAge(run.completed_at ?? run.created_at)}{run.trigger === 'scheduled' && <span className="text-text-3"> · scheduled</span>}</> : 'none yet'}</span></>}
        tabs={<ModeTabs passageId={passage.id} current="pro" />}
        actions={<>
          <Button size="sm" variant="ghost" onClick={() => void cond.planTargets()} disabled={!!cond.busy}>Plan targets</Button>
          <Button size="sm" variant="secondary" onClick={() => void cond.fetchNow()} disabled={!!cond.busy} title="Calls ingest-tick for every layer with force=true"><Download className="h-3.5 w-3.5" /> Fetch now</Button>
          {primaryAction}
          <span className="hidden sm:block h-5 w-px bg-border mx-1" />
          <Button size="sm" variant="ghost" onClick={exportGpx} title="Export GPX">GPX</Button>
          <Button size="sm" variant="ghost" onClick={exportPdf} title="Opens a print-optimised page and the print dialog"><Printer className="h-3.5 w-3.5" /> Export PDF</Button>
          <Button size="sm" variant="ghost" asChild><Link to={`/passages/${passage.id}/edit`}><Pencil className="h-3.5 w-3.5" /> Edit</Link></Button>
          {passage.status === 'planned' && <Button size="sm" variant="outline" onClick={() => void setStatus('active')}>Mark active</Button>}
          {passage.status === 'active' && <Button size="sm" variant="outline" asChild><Link to={`/passages/${passage.id}/active`}>Monitor</Link></Button>}
        </>}
      />
      {(cond.busy || cond.error) && <div role="status" className={cn('px-4 py-1.5 text-xs flex items-center gap-2', cond.error ? 'bg-risk-red/10 text-risk-red border-b border-risk-red/30' : 'bg-bg-2 text-text-2 border-b border-border')}>{!cond.error && <RefreshCw className="h-3 w-3 animate-spin" />}{cond.error ?? cond.busy}</div>}
      {alert && <div className="px-4 pt-3"><MaterialChangesBanner changes={changesFromPayload(alert.payload)} meta={<>{alert.title} · {fmtAge(alert.created_at)}</>} onDismiss={() => void notes.markRead([alert.id])} /></div>}

      <div className="px-4 py-3 border-b border-border bg-bg-1/40">
        <KpiStrip items={[
          { label: 'Distance', value: `${totalNm.toFixed(1)} nm`, aside: `${waypoints.length} wps` },
          { label: 'Arrival', value: arrival ? fmtUtc(arrival) : '—', aside: arrival ? fmtLocal(arrival, prefs.local_utc_offset_min) : undefined },
          { label: 'Passage time', value: arrival ? fmtHours((Date.parse(arrival) - Date.parse(passage.actual_departure ?? passage.planned_departure)) / 3_600_000) : '—' },
          { label: 'Max wind p90', value: maxP90 === null ? '—' : `${fmtNum(maxP90, 0)} kn`, aside: maxWind !== null ? `limit ${maxWind}${legs.length ? ' · incl. along-leg' : ''}` : undefined, tone: maxWind !== null && maxP90 !== null && maxP90 > maxWind ? 'red' : maxWind !== null && maxP90 !== null && maxP90 > 0.75 * maxWind ? 'amber' : 'default' },
          { label: 'Max wave', value: maxWave === null ? '—' : `${fmtNum(maxWave, 1)} m`, aside: maxWaveLimit !== null ? `limit ${maxWaveLimit}` : undefined, tone: maxWaveLimit !== null && maxWave !== null && maxWave > maxWaveLimit ? 'red' : maxWaveLimit !== null && maxWave !== null && maxWave > 0.75 * maxWaveLimit ? 'amber' : 'default' },
          { label: 'Flags', value: <span className="inline-flex items-center gap-1.5"><RiskPill flag={worst} /><SquallBadge risk={squallWorst} size="sm" /></span>, aside: conditions.length ? <span className="num"><span className={redCount ? 'text-risk-red' : ''}>{redCount} red</span> · <span className={amberCount ? 'text-risk-amber' : ''}>{amberCount} amber</span> · <span className={divergeCount ? 'text-flag-violet' : ''}>{divergeCount} diverge</span></span> : 'no run' },
          { label: 'Confidence', value: confidence ? <ConfidenceDot level={confidence} withLabel /> : '—' },
        ]} />
      </div>

      <div className="px-4 py-2 border-b border-border flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
        <span className="label">Sources</span>
        {layerStatus.map((l) => {
          const state = l.count === 0 ? 'none' : l.err ? 'err' : l.fetched === l.count ? 'ok' : 'partial';
          return (
            <span key={l.layer} className="inline-flex items-center gap-1.5" title={l.err ?? undefined}>
              <span className={cn('inline-block h-1.5 w-1.5 rounded-full', state === 'ok' ? 'bg-risk-green' : state === 'err' ? 'bg-risk-amber' : state === 'partial' ? 'bg-text-2' : 'bg-text-3/50')} />
              <span className="text-text-2">{l.layer}</span>
              <span className="num text-text-3">{l.count === 0 ? 'no targets' : l.err ? (l.err.startsWith('not configured') ? l.err : `error · ${l.fetched}/${l.count} ok`) : `${l.fetched}/${l.count}${l.last ? ` · ${fmtAge(l.last)}` : ''}`}</span>
            </span>
          );
        })}
        {legs.length > 0 && <span className="inline-flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full bg-risk-green" /><span className="text-text-2">along-leg</span><span className="num text-text-3">{legRows.rows.length} points · {legs.length} legs</span></span>}
        <label className="ml-auto flex items-center gap-2 text-text-2 cursor-pointer"><span>Comparison columns</span><Switch checked={showComparison} onCheckedChange={setShowComparison} aria-label="Show comparison columns" /></label>
      </div>

      {waypoints.length >= 2 && (
        <>
          <MapHeaderStrip from={`${waypoints[0].sequence}. ${waypoints[0].name ?? ''}`} to={`${waypoints[waypoints.length - 1].sequence}. ${waypoints[waypoints.length - 1].name ?? ''}`} totalNm={totalNm} legs={waypoints.slice(1).map((w) => ({ nm: num(w.leg_distance_nm) ?? 0, risk: legInto.get(w.id)?.summary.worstRisk ?? (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }))} open={showMapMobile} onToggle={() => setShowMapMobile((v) => !v)} />
          {showMapMobile && <div className="md:hidden p-3 border-b border-border">{mapBlock('h-64')}</div>}
        </>
      )}

      {prefs.narrative_emphasis >= 0.5 && <div className="p-4 border-b border-border">{briefing}</div>}
      {conditions.length === 0 && <div className="mx-4 mt-3 rounded-md border border-dashed border-border gap-hatch px-3 py-2 text-xs text-text-2">No conditions run yet. Plan targets, fetch, then compute. Rows below show the engine's ETAs only.</div>}
      <LegTable waypoints={waypoints} conditions={conditions} maxWindKn={maxWind} selectedId={selected?.id ?? null} onSelect={setSelectedId} showComparison={showComparison} utcOffsetMin={prefs.local_utc_offset_min} passageId={passage.id} legs={legs} />

      <div className="grid lg:grid-cols-[1.15fr_1fr] gap-4 p-4 border-t border-border">
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="label">Selected</span>
            <span className="text-[15px] font-semibold">{selected ? <><span className="num text-text-3 mr-1.5">{selected.sequence}.</span>{selected.name ?? ''}</> : '—'}</span>
            {selC && <span className="num text-[11px] text-text-3">atmos init {fmtUtc(selC.atmos_init_time)} · marine init {fmtUtc(selC.marine_init_time)}</span>}
            <span className="ml-auto"><Toggle label="Wind chart mode" value={mode} onChange={setChartMode} options={[{ v: 'profile', label: 'Leg profile', disabled: !selLeg }, { v: 'band', label: 'Waypoint band' }]} /></span>
          </div>
          {mode === 'profile' && selLeg ? (
            <div className="panel p-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-2">
                <span className="label text-text-2">Along the leg</span>
                <span className="text-[11px] text-text-3">{selLeg.from?.name ?? ''} → {selLeg.to?.name ?? ''} · {selLeg.distanceNm.toFixed(1)} nm · every ~6 h of ETA</span>
                <div className="chart-legend ml-auto">
                  <span className="inline-flex items-center"><span className="swatch" style={{ background: 'rgba(45,212,191,0.35)' }} />p10–p90</span>
                  <span className="inline-flex items-center"><span className="swatch" style={{ background: '#2DD4BF' }} />p50</span>
                  <span className="inline-flex items-center"><span className="swatch" style={{ background: 'transparent', borderTop: '2px solid #9AA8C0', height: 0 }} />gust p90</span>
                  <span className="inline-flex items-center"><span className="swatch" style={{ background: '#9AA8C0' }} />Hs · current</span>
                  <span className="inline-flex items-center"><span className="swatch" style={{ background: 'rgba(52,211,153,0.35)' }} />risk tint</span>
                  <span className="inline-flex items-center"><span className="swatch gap-hatch border border-border" />no data</span>
                  <span className="inline-flex items-center gap-1"><SquallBadge risk="possible" size="sm" /><span className="text-text-3">row</span></span>
                </div>
              </div>
              <LegProfile leg={selLeg} maxWindKn={maxWind} maxWaveM={maxWaveLimit} utcOffsetMin={prefs.local_utc_offset_min} />
            </div>
          ) : (
            <BandChart title="Wind at this waypoint" meta={atmosTarget ? `grid ${Number(atmosTarget.grid_lat).toFixed(2)}, ${Number(atmosTarget.grid_lon).toFixed(2)}` : undefined} points={band.points} limitKn={maxWind} etaIso={selC?.eta ?? selected?.eta} comparisonLabel={comparisonSource} />
          )}
          <div className="flex items-center gap-3">
            <span className="label">Tide</span>
            <Toggle label="Tide chart mode" value={tideMode} onChange={setTideMode} options={[{ v: 'pair', label: 'Tide + swell' }, { v: 'tide', label: 'Tide only' }]} />
            <span className="text-[11px] text-text-3">station data only; never a model sea level</span>
          </div>
          {tideMode === 'pair'
            ? <TideSwellChart title="Tide + swell at this waypoint" meta="one axis for sea, UKC on the right" points={tideSwell.points} minUkcM={num(vessel?.min_ukc_m)} datum={tideSwell.datum} etaIso={selC?.eta ?? selected?.eta} stayEndIso={selected?.is_anchorage ? selected.planned_departure_from_here : null} />
            : <TideChart title="Tide at this waypoint" meta={tideSwell.tidalTarget ? `station ${tideSwell.tidalTarget.station_id ?? '?'} · HW and LW from the series` : 'HW and LW from the series'} series={tideOnly} datum={tideSwell.datum} nowMs={nowMs} etaMarks={waypoints.filter((w) => w.eta).map((w) => ({ t: Date.parse(byWp.get(w.id)?.eta ?? w.eta!), label: `${w.sequence}. ETA` })).filter((m) => tideOnly.length && m.t >= tideOnly[0].t && m.t <= tideOnly[tideOnly.length - 1].t)} />}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <FieldCard label="Wind p50 / p90" value={selC?.wind_p50_kn !== null && selC?.wind_p50_kn !== undefined ? `${fmtNum(num(selC.wind_p50_kn), 0)} / ${fmtNum(num(selC.wind_p90_kn), 0)}` : null} unit="kn" reason="no atmospheric data within 55 km / ±6 h of ETA" />
            <FieldCard label="Gust p90" value={num(selC?.gust_p90_kn)} unit="kn" aside={<GustSourceChip source={selC?.gust_source} />} reason="no atmospheric data" />
            <FieldCard label="Squall risk" value={selC ? SQUALL_LABEL[asSquall(selC.squall_risk)] : null} aside={<SquallBadge risk={selC?.squall_risk} capeJkg={num(selC?.cape_p50_jkg)} precipPct={num(selC?.precip_prob_pct)} size="sm" />} sub={selC ? `CAPE ${num(selC.cape_p50_jkg) === null ? '—' : Math.round(num(selC.cape_p50_jkg)!) + ' J/kg'} · precip ${num(selC.precip_prob_pct) === null ? '—' : Math.round(num(selC.precip_prob_pct)!) + ' %'}` : undefined} reason="no atmospheric data" />
            <FieldCard label="Wave / period" value={selC?.wave_height_m !== null && selC?.wave_height_m !== undefined ? `${fmtNum(num(selC.wave_height_m), 1)} m / ${fmtNum(num(selC.wave_period_s), 0)} s` : null} reason="no marine grid point within 55 km" />
            <FieldCard label="Swell / dir" value={selC?.swell_height_m !== null && selC?.swell_height_m !== undefined ? `${fmtNum(num(selC.swell_height_m), 1)} m / ${Math.round(num(selC.swell_dir_deg) ?? 0)}°` : null} reason="no marine data" />
            <FieldCard label="Tide (adapter)" value={num(selC?.tide_height_m)} unit={`m ${selC?.tide_datum ?? ''}`} sub={selC?.tide_state ? `${selC.tide_state} · station ${selC.tide_station_id ?? '?'}` : undefined} reason="no tidal data: station unresolved, or TIDESATLAS_API_KEY not configured" />
            <FieldCard label="Current · sets toward" value={selC?.current_speed_kn !== null && selC?.current_speed_kn !== undefined ? `${fmtNum(num(selC.current_speed_kn), 1)} kn → ${Math.round(num(selC.current_dir_deg) ?? 0)}°` : null} reason="no marine data (SMOC currents are weak in straits)" />
            <FieldCard label="ETA · sea state" value={selC?.eta ? fmtUtc(selC.eta) : null} sub={selC?.eta_planned ? `planned ${fmtUtc(selC.eta_planned)}${etaDelta !== null ? ` · ${fmtEtaDelta(etaDelta)} sea state` : ' · no change'}${num(selC.speed_loss_pct) !== null ? ` · loss ${fmtNum(num(selC.speed_loss_pct), 0)} %` : ''}` : 'no planned-speed ETA in this run'} reason="no run" />
            <FieldCard label="UKC estimate" value={num(selC?.ukc_estimate_m)} unit="m" sub={ukcBasisText(selC?.ukc_basis, selected?.charted_depth_source)} aside={<DepthSourceChip source={selected?.charted_depth_source} />} reason="needs vessel draft, charted depth and tide" />
            <FieldCard label="Visibility p50" value={num(selC?.visibility_p50_m) !== null ? Math.round(num(selC?.visibility_p50_m)! / 100) / 10 : null} unit="km" reason="not carried by this model" />
            <FieldCard label="MSLP p50" value={num(selC?.mslp_p50_hpa)} unit="hPa" reason="no atmospheric data" />
            <FieldCard label="Precip prob" value={num(selC?.precip_prob_pct)} unit="%" reason="no atmospheric data" />
            <FieldCard label="Comparison wind" value={selC?.comparison_wind_kn !== null && selC?.comparison_wind_kn !== undefined ? `${fmtNum(num(selC.comparison_wind_kn), 0)} kn / ${Math.round(num(selC.comparison_wind_dir_deg) ?? 0)}°` : null} sub={selC?.comparison_source ?? undefined} reason="no comparison row at this hour" />
            <FieldCard label={selected?.charted_depth_source === 'gebco' ? 'Depth (GEBCO grid)' : 'Charted depth'} value={num(selected?.charted_depth_m)} unit="m" aside={<DepthSourceChip source={selected?.charted_depth_source} />} sub={selected?.charted_depth_source === 'gebco' ? 'accepted from the GEBCO grid, not a charted sounding' : selected?.charted_depth_source === 'user' ? 'entered by hand' : undefined} reason="enter in the waypoint sheet, or accept a GEBCO grid suggestion there" />
          </div>
          {selC && (selC.risk_reasons as string[]).length > 0 && (
            <div className="panel p-3">
              <div className="label mb-1.5">Risk reasons</div>
              <ul className="text-xs space-y-0.5">{(selC.risk_reasons as string[]).map((r) => <li key={r} className="flex gap-2"><span className={selC.risk_flag === 'red' ? 'text-risk-red' : 'text-risk-amber'}>{selC.risk_flag === 'red' ? '■' : '▲'}</span><span className="num text-text-2">{r}</span></li>)}</ul>
            </div>
          )}
        </div>
        <div className="space-y-3 min-w-0">
          <div className="hidden md:block">{mapBlock('h-[360px]')}</div>
          {prefs.narrative_emphasis < 0.5 && briefing}
          <DepartureWindows derived={dep.windows} sampled={dep.sampled} suggested={(br.briefing?.suggested_departure_windows as { start: string; end: string; reason: string }[] | null) ?? []} />
        </div>
      </div>
    </div>
  );
}
