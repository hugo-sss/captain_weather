// Anchorage stay view (PRD §9.5 screen 7): summary tiles, tide + swell paired chart, wind rose for the window, exposure tag.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Anchor, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useTideSwellSeries } from '@/hooks/useTideSwellSeries.ts';
import { nearestTargetRow } from '@/hooks/useBandSeries.ts';
import { num } from '@/types/domain.ts';
import { StayWindowView } from '@/components/anchorage/StayWindowView.tsx';
import { WindRose } from '@/components/anchorage/WindRose.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { TideChart } from '@/components/dashboard/TideChart.tsx';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';
import { cn } from '@/lib/utils.ts';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { PageHeader, Sep } from '@/components/PageHeader.tsx';
import { Button } from '@/components/ui/button.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { windRose } from '../../supabase/functions/_shared/departure-windows.ts';
import { fmtUtc } from '@/lib/time.ts';
import { useNow } from '@/hooks/useNow.ts';

export default function AnchorageStay() {
  const { id, wpId } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const wp = data?.waypoints.find((w) => w.id === wpId) ?? null;
  const anch = cond.data?.anchorages.find((a) => a.waypoint_id === wpId) ?? null;
  const targets = useMemo(() => cond.data?.targets ?? [], [cond.data]);
  const tideSwell = useTideSwellSeries(wp, data?.vessel ?? null, targets);
  const [hours, setHours] = useState<{ dir_deg: number | null; speed_kn: number | null }[]>([]);
  const [tideMode, setTideMode] = useState<'pair' | 'tide'>('pair');
  const nowMs = useNow(60_000);
  const atmos = wp ? nearestTargetRow(targets, 'atmospheric', Number(wp.lat), Number(wp.lon)) : null;
  const stayStart = anch?.stay_start ?? wp?.eta ?? null;
  const stayEnd = anch?.stay_end ?? wp?.planned_departure_from_here ?? null;
  useEffect(() => {
    if (!atmos || !stayStart || !stayEnd) return;
    let cancelled = false;
    (async () => {
      const src = cond.data?.conditions[0]?.atmos_source ?? 'google_weathernext2_ensemble';
      const latest = (await supabase.from('forecast_atmospheric').select('init_time').eq('target_id', atmos.id).eq('source', src).order('init_time', { ascending: false }).limit(1).maybeSingle()).data?.init_time;
      if (!latest || cancelled) return;
      const { data: rows } = await supabase.from('forecast_atmospheric').select('forecast_time, wind_dir_mean_deg, wind_p50_kn').eq('target_id', atmos.id).eq('source', src).eq('init_time', latest).gte('forecast_time', stayStart).lte('forecast_time', stayEnd).order('forecast_time');
      if (cancelled) return;
      setHours((rows ?? []).map((r) => ({ dir_deg: num(r.wind_dir_mean_deg), speed_kn: num(r.wind_p50_kn) })));
    })();
    return () => { cancelled = true; };
  }, [atmos, stayStart, stayEnd, cond.data]);
  if (loading) return <PageSkeleton variant="table" />;
  if (!data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
  if (!wp) return <div className="p-6 text-sm text-text-2">Waypoint not found.</div>;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PageHeader
        title={<span className="inline-flex items-center gap-2"><Anchor className="h-4 w-4 text-accent" /><span className="num text-text-3 font-normal">{wp.sequence}.</span>{wp.name}</span>}
        meta={<><span>{data.passage.name}</span><Sep /><span>ETA <span className="num text-text-2">{fmtUtc(wp.eta)}</span></span><Sep /><span>stay end <span className="num text-text-2">{fmtUtc(wp.planned_departure_from_here)}</span></span>{!wp.is_anchorage && <><Sep /><span className="text-risk-amber">not marked as an anchorage</span></>}</>}
        tabs={<ModeTabs passageId={data.passage.id} current="pro" />}
        actions={<Button size="sm" variant="ghost" asChild><Link to={`/passages/${data.passage.id}`}><ArrowLeft className="h-3.5 w-3.5" /> Back to the table</Link></Button>}
      />
      <div className="p-4 grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4 min-w-0">
          <StayWindowView a={anch} />
          {anch && anch.squall_risk !== 'none' && <div className="flex items-center gap-2 text-xs text-text-2"><SquallBadge risk={anch.squall_risk} /> squall risk over the stay window, from CAPE and precipitation probability</div>}
          <div className="flex items-center gap-3">
            <span className="label">Tide</span>
            <div role="radiogroup" aria-label="Tide chart mode" className="inline-flex h-7 items-center rounded-md border border-border bg-bg-0 p-0.5 text-[11px]">
              {([['pair', 'Tide + swell'], ['tide', 'Tide only']] as const).map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={tideMode === v} onClick={() => setTideMode(v)} className={cn('h-6 rounded-[4px] px-2 font-medium transition-colors', tideMode === v ? 'bg-bg-2 text-text-1 shadow-[inset_0_-2px_0_#2DD4BF]' : 'text-text-2 hover:text-text-1')}>{l}</button>)}
            </div>
            <span className="text-[11px] text-text-3">station data only; never a model sea level</span>
          </div>
          {tideMode === 'pair'
            ? <TideSwellChart title="Tide + swell over the stay" meta={`UKC on the right axis · datum ${tideSwell.datum ?? 'unknown'}`} points={tideSwell.points} minUkcM={num(data.vessel?.min_ukc_m)} datum={tideSwell.datum} etaIso={stayStart} stayEndIso={stayEnd} />
            : <TideChart title="Tide over the stay" meta={`station ${tideSwell.tidalTarget?.station_id ?? '?'} · HW and LW from the series`} series={tideSwell.points.map((p) => ({ t: p.t, height: p.tide }))} datum={tideSwell.datum} nowMs={nowMs} etaMarks={[...(stayStart ? [{ t: Date.parse(stayStart), label: 'arrive' }] : []), ...(stayEnd ? [{ t: Date.parse(stayEnd), label: 'stay end' }] : [])]} />}
        </div>
        <aside className="panel p-3 self-start">
          <div className="label text-text-2 mb-1">Wind rose <span className="text-text-3">· stay window</span></div>
          <div className="text-[11px] text-text-3 mb-3">direction the wind blows from, p50 · colour is mean speed</div>
          <WindRose bins={windRose(hours)} size={236} />
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between text-[11px] text-text-3">
            <span><span className="num text-text-2">{hours.length}</span> forecast hours</span>
            <span>exposure <span className="inline-flex h-[18px] items-center rounded-sm border border-border bg-bg-2 px-1.5 uppercase tracking-[0.05em] text-text-2 ml-1">{wp.anchorage_exposure_tag ?? 'not set'}</span></span>
          </div>
        </aside>
      </div>
    </div>
  );
}
