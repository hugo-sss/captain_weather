// Professional dashboard: the default landing view. Raw data first (non-negotiable 1).
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download, RefreshCw } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { nearestTargetRow, useBandSeries } from '@/hooks/useBandSeries.ts';
import { num, type ConfidenceLevel, type RiskFlag } from '@/types/domain.ts';
import { KpiStrip } from '@/components/dashboard/KpiStrip.tsx';
import { LegTable } from '@/components/dashboard/LegTable.tsx';
import { BandChart } from '@/components/dashboard/BandChart.tsx';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { PassageMap } from '@/components/map/PassageMap.tsx';
import { DisclaimerBar } from '@/components/map/DisclaimerBar.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.tsx';
import { fmtAge, fmtHours, fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { toGpx } from '@/lib/gpx.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';
import { passageConfidence } from '../../supabase/functions/_shared/confidence.ts';

export default function DashboardPro() {
  const { id } = useParams();
  const { data, loading, reload } = usePassage(id);
  const cond = useConditions(id);
  const { prefs, update } = useDisplayPrefs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(true);

  const waypoints = data?.waypoints ?? [];
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const byWp = useMemo(() => new Map(conditions.map((c) => [c.waypoint_id, c])), [conditions]);
  const selected = waypoints.find((w) => w.id === selectedId) ?? waypoints[1] ?? waypoints[0] ?? null;
  const selC = selected ? byWp.get(selected.id) ?? null : null;
  const atmosTarget = selected && cond.data ? nearestTargetRow(cond.data.targets, 'atmospheric', Number(selected.lat), Number(selected.lon)) : null;
  const primarySource = selC?.atmos_source ?? 'google_weathernext2_ensemble';
  const comparisonSource = selC?.comparison_source ?? 'ncep_gfs_global';
  const band = useBandSeries(atmosTarget?.id ?? null, primarySource, comparisonSource);

  if (loading || !data) return <div className="p-4 text-text-2">{loading ? 'Loading passage…' : 'Passage not found.'}</div>;
  const { passage, vessel } = data;
  const maxWind = num(vessel?.max_wind_kn);
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const arrival = waypoints[waypoints.length - 1]?.eta ?? null;
  const flags = conditions.map((c) => c.risk_flag as RiskFlag);
  const worst = flags.length ? worstRisk(flags) : 'unknown';
  const confidence = conditions.length ? passageConfidence(conditions.map((c) => c.confidence_level as ConfidenceLevel)) : null;
  const maxP90 = conditions.reduce<number | null>((m, c) => { const v = num(c.wind_p90_kn); return v === null ? m : Math.max(m ?? -Infinity, v); }, null);
  const maxWave = conditions.reduce<number | null>((m, c) => { const v = num(c.wave_height_m); return v === null ? m : Math.max(m ?? -Infinity, v); }, null);
  const run = cond.data?.run ?? null;
  const targets = cond.data?.targets ?? [];
  const layerStatus = (['atmospheric', 'comparison', 'marine', 'tidal'] as const).map((layer) => {
    const ts = targets.filter((t) => t.layer === layer);
    const fetched = ts.filter((t) => t.last_fetched_at && !t.last_error).length;
    const err = ts.find((t) => t.last_error)?.last_error ?? null;
    const last = ts.map((t) => t.last_fetched_at).filter(Boolean).sort().pop() ?? null;
    return { layer, count: ts.length, fetched, err, last };
  });

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

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-bg-1 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-base font-semibold leading-tight">{passage.name}</div>
          <div className="text-[11px] text-text-3">{vessel?.name ?? 'no vessel'} · {passage.status} · departs {fmtUtc(passage.actual_departure ?? passage.planned_departure)} · run {run ? `${run.status} ${fmtAge(run.completed_at ?? run.created_at)}` : 'none yet'}</div>
        </div>
        <Tabs value="pro" className="ml-2"><TabsList><TabsTrigger value="pro">Professional</TabsTrigger><TabsTrigger value="simple" disabled title="Phase 2">Simplified</TabsTrigger><TabsTrigger value="cmp" disabled title="Phase 2">Comparison</TabsTrigger></TabsList></Tabs>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => void cond.planTargets()} disabled={!!cond.busy}>Plan targets</Button>
          <Button size="sm" variant="secondary" onClick={() => void cond.fetchNow()} disabled={!!cond.busy} title="Calls ingest-tick for every layer with force=true"><RefreshCw className="h-3.5 w-3.5" /> Fetch now</Button>
          <Button size="sm" onClick={() => void cond.compute(passage.status === 'active' ? 'recheck' : 'initial')} disabled={!!cond.busy}>{passage.status === 'active' ? 'Re-check conditions' : 'Compute conditions'}</Button>
          <Button size="sm" variant="ghost" onClick={exportGpx}><Download className="h-3.5 w-3.5" /> GPX</Button>
          <Button size="sm" variant="ghost" asChild><Link to={`/passages/${passage.id}/edit`}>Edit</Link></Button>
          {passage.status === 'planned' && <Button size="sm" variant="outline" onClick={() => void setStatus('active')}>Mark active</Button>}
          {passage.status === 'active' && <Button size="sm" variant="outline" onClick={() => void setStatus('completed')}>Mark completed</Button>}
        </div>
      </div>
      {(cond.busy || cond.error) && <div className={`px-4 py-1.5 text-xs ${cond.error ? 'bg-risk-red/10 text-risk-red' : 'bg-bg-2 text-text-2'}`}>{cond.error ?? cond.busy}</div>}

      <div className="px-4 py-3 border-b border-border">
        <KpiStrip items={[
          { label: 'Distance', value: `${totalNm.toFixed(1)} nm`, aside: `${waypoints.length} wps` },
          { label: 'Arrival', value: arrival ? fmtUtc(arrival) : '—', aside: arrival ? fmtLocal(arrival, prefs.local_utc_offset_min) : undefined },
          { label: 'Passage time', value: arrival ? fmtHours((Date.parse(arrival) - Date.parse(passage.actual_departure ?? passage.planned_departure)) / 3_600_000) : '—' },
          { label: 'Max wind p90', value: maxP90 === null ? '—' : `${fmtNum(maxP90, 0)} kn`, tone: maxWind !== null && maxP90 !== null && maxP90 > maxWind ? 'red' : maxWind !== null && maxP90 !== null && maxP90 > 0.75 * maxWind ? 'amber' : 'default' },
          { label: 'Max wave', value: maxWave === null ? '—' : `${fmtNum(maxWave, 1)} m` },
          { label: 'Flags', value: <span className="flex gap-1"><RiskPill flag={worst} /></span>, aside: `${flags.filter((f) => f === 'red').length} red · ${flags.filter((f) => f === 'amber').length} amber · ${conditions.filter((c) => c.source_disagreement).length} diverge` },
          { label: 'Confidence', value: confidence ? <ConfidenceDot level={confidence} withLabel /> : '—' },
        ]} />
      </div>

      <div className="px-4 py-2 border-b border-border flex items-center gap-4 text-xs">
        <span className="label">Sources</span>
        {layerStatus.map((l) => (
          <span key={l.layer} className={l.err ? 'text-risk-amber' : l.fetched ? 'text-text-2' : 'text-text-3'} title={l.err ?? undefined}>
            {l.layer}: {l.count === 0 ? 'no targets' : l.err ? (l.err.startsWith('not configured') ? l.err : `error (${l.fetched}/${l.count} ok)`) : `${l.fetched}/${l.count} fetched ${l.last ? fmtAge(l.last) : ''}`}
          </span>
        ))}
        <label className="ml-auto flex items-center gap-2"><span>Comparison columns</span><Switch checked={showComparison} onCheckedChange={setShowComparison} /></label>
      </div>

      {conditions.length === 0 && <div className="px-4 py-2 text-xs text-text-2 bg-bg-1">No conditions run yet. Plan targets, fetch, then compute. Rows below show the engine's ETAs only.</div>}
      <LegTable waypoints={waypoints} conditions={conditions} maxWindKn={maxWind} selectedId={selected?.id ?? null} onSelect={setSelectedId} showComparison={showComparison} utcOffsetMin={prefs.local_utc_offset_min} />

      <div className="grid lg:grid-cols-2 gap-3 p-4 border-t border-border">
        <div className="space-y-3">
          <div className="flex items-baseline gap-2"><span className="label">Selected</span><span className="font-medium">{selected ? `${selected.sequence}. ${selected.name ?? ''}` : '—'}</span>
            {selC && <span className="text-[11px] text-text-3">atmos init {fmtUtc(selC.atmos_init_time)} · marine init {fmtUtc(selC.marine_init_time)}</span>}</div>
          <BandChart points={band.points} limitKn={maxWind} etaIso={selC?.eta ?? selected?.eta} comparisonLabel={comparisonSource} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <FieldCard label="Wind p50 / p90" value={selC?.wind_p50_kn !== null && selC?.wind_p50_kn !== undefined ? `${fmtNum(num(selC.wind_p50_kn), 0)} / ${fmtNum(num(selC.wind_p90_kn), 0)}` : null} unit="kn" reason="no atmospheric data within 55 km / ±6 h of ETA" />
            <FieldCard label="Gust p90" value={num(selC?.gust_p90_kn)} unit="kn" reason="no atmospheric data" />
            <FieldCard label="Wave / period" value={selC?.wave_height_m !== null && selC?.wave_height_m !== undefined ? `${fmtNum(num(selC.wave_height_m), 1)} m / ${fmtNum(num(selC.wave_period_s), 0)} s` : null} reason="no marine grid point within 55 km" />
            <FieldCard label="Swell / dir" value={selC?.swell_height_m !== null && selC?.swell_height_m !== undefined ? `${fmtNum(num(selC.swell_height_m), 1)} m / ${Math.round(num(selC.swell_dir_deg) ?? 0)}°` : null} reason="no marine data" />
            <FieldCard label="Tide (adapter)" value={num(selC?.tide_height_m)} unit={`m ${selC?.tide_datum ?? ''}`} sub={selC?.tide_state ? `${selC.tide_state} · station ${selC.tide_station_id ?? '?'}` : undefined} reason="no tidal data: station unresolved, or TIDESATLAS_API_KEY not configured" />
            <FieldCard label="Current · sets toward" value={selC?.current_speed_kn !== null && selC?.current_speed_kn !== undefined ? `${fmtNum(num(selC.current_speed_kn), 1)} kn → ${Math.round(num(selC.current_dir_deg) ?? 0)}°` : null} reason="no marine data (SMOC currents are weak in straits)" />
            <FieldCard label="UKC estimate" value={num(selC?.ukc_estimate_m)} unit="m" sub={selC?.ukc_basis ?? undefined} reason="needs vessel draft, charted depth and tide" />
            <FieldCard label="Visibility p50" value={num(selC?.visibility_p50_m) !== null ? Math.round(num(selC?.visibility_p50_m)! / 100) / 10 : null} unit="km" reason="not carried by this model" />
            <FieldCard label="MSLP p50" value={num(selC?.mslp_p50_hpa)} unit="hPa" reason="no atmospheric data" />
            <FieldCard label="Precip prob" value={num(selC?.precip_prob_pct)} unit="%" reason="no atmospheric data" />
            <FieldCard label="Comparison wind" value={selC?.comparison_wind_kn !== null && selC?.comparison_wind_kn !== undefined ? `${fmtNum(num(selC.comparison_wind_kn), 0)} kn / ${Math.round(num(selC.comparison_wind_dir_deg) ?? 0)}°` : null} sub={selC?.comparison_source ?? undefined} reason="no comparison row at this hour" />
            <FieldCard label="Charted depth" value={num(selected?.charted_depth_m)} unit="m" reason="enter in the waypoint sheet (manual in v1)" />
          </div>
          {selC && (selC.risk_reasons as string[]).length > 0 && <ul className="text-xs text-text-2 list-disc pl-4">{(selC.risk_reasons as string[]).map((r) => <li key={r}>{r}</li>)}</ul>}
        </div>
        <div className="flex flex-col min-h-[320px]">
          <DisclaimerBar />
          <div className="relative flex-1 min-h-[280px]">
            <PassageMap waypoints={waypoints.map((w) => ({ id: w.id, sequence: w.sequence, name: w.name, lat: Number(w.lat), lon: Number(w.lon), is_anchorage: w.is_anchorage, risk: (byWp.get(w.id)?.risk_flag as RiskFlag | undefined) ?? null }))} selectedId={selected?.id ?? null} showOpenSeaMap={prefs.show_openseamap} colourByRisk onSelect={setSelectedId} />
            <div className="absolute top-2 right-2 z-[1000] rounded-md border border-border bg-bg-1/90 px-2 py-1 text-[11px] flex items-center gap-2"><span>OpenSeaMap</span><Switch checked={prefs.show_openseamap} onCheckedChange={(v) => update({ show_openseamap: v })} /></div>
          </div>
        </div>
      </div>
    </div>
  );
}
