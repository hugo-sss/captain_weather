// Anchorage stay view (PRD §9.5 screen 7): summary tiles, tide + swell paired chart, wind rose for the window, exposure tag.
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useTideSwellSeries } from '@/hooks/useTideSwellSeries.ts';
import { nearestTargetRow } from '@/hooks/useBandSeries.ts';
import { num } from '@/types/domain.ts';
import { StayWindowView } from '@/components/anchorage/StayWindowView.tsx';
import { WindRose } from '@/components/anchorage/WindRose.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { windRose } from '../../supabase/functions/_shared/departure-windows.ts';
import { fmtUtc } from '@/lib/time.ts';

export default function AnchorageStay() {
  const { id, wpId } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const wp = data?.waypoints.find((w) => w.id === wpId) ?? null;
  const anch = cond.data?.anchorages.find((a) => a.waypoint_id === wpId) ?? null;
  const targets = useMemo(() => cond.data?.targets ?? [], [cond.data]);
  const tideSwell = useTideSwellSeries(wp, data?.vessel ?? null, targets);
  const [hours, setHours] = useState<{ dir_deg: number | null; speed_kn: number | null }[]>([]);
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
  if (loading || !data) return <div className="p-4 text-text-2">Loading…</div>;
  if (!wp) return <div className="p-4 text-text-2">Waypoint not found.</div>;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-bg-1 flex flex-wrap items-center gap-3">
        <div><div className="text-base font-semibold leading-tight">Anchorage: {wp.sequence}. {wp.name}</div><div className="text-[11px] text-text-3">{data.passage.name} · ETA {fmtUtc(wp.eta)} · stay end {fmtUtc(wp.planned_departure_from_here)}{!wp.is_anchorage && ' · not marked as an anchorage'}</div></div>
        <ModeTabs passageId={data.passage.id} current="pro" />
        <Link to={`/passages/${data.passage.id}`} className="ml-auto text-xs text-accent">Back to the table</Link>
      </div>
      <div className="p-4 grid gap-4 lg:grid-cols-[1fr_260px]">
        <div className="space-y-4">
          <StayWindowView a={anch} />
          <div><div className="label mb-1">Tide + swell over the stay (one axis, UKC line, datum {tideSwell.datum ?? 'unknown'})</div>
            <TideSwellChart points={tideSwell.points} minUkcM={num(data.vessel?.min_ukc_m)} datum={tideSwell.datum} etaIso={stayStart} stayEndIso={stayEnd} /></div>
        </div>
        <div className="rounded-lg border border-border bg-bg-1 p-3">
          <div className="label mb-2">Wind rose for the window (from, p50)</div>
          <WindRose bins={windRose(hours)} />
          <div className="text-[11px] text-text-3 mt-2">{hours.length} forecast hours · exposure: {wp.anchorage_exposure_tag ?? 'not set'} (manual in v1)</div>
        </div>
      </div>
    </div>
  );
}
