// Anchorage stay (PRD §9.5 screen 7): the stay window as a hero, stats, wind rose, tide chart with the swell switch.
import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useTideSwellSeries } from '@/hooks/useTideSwellSeries.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { nearestTargetRow } from '@/hooks/useBandSeries.ts';
import { useNow } from '@/hooks/useNow.ts';
import { num } from '@/types/domain.ts';
import { StayWindowView } from '@/components/anchorage/StayWindowView.tsx';
import { WindRose } from '@/components/anchorage/WindRose.tsx';
import { TideSwellChart } from '@/components/dashboard/TideSwellChart.tsx';
import { TideChart } from '@/components/dashboard/TideChart.tsx';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';
import { PageHeader } from '@/components/PageHeader.tsx';
import { Section } from '@/components/ui/section.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { windRose } from '../../supabase/functions/_shared/departure-windows.ts';
import { localDateTime, localDayTime } from '@/lib/plain.ts';

export default function AnchorageStay() {
  const { id, wpId } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const { prefs } = useDisplayPrefs();
  const off = prefs.local_utc_offset_min;
  const wp = data?.waypoints.find((w) => w.id === wpId) ?? null;
  const anch = cond.data?.anchorages.find((a) => a.waypoint_id === wpId) ?? null;
  const targets = useMemo(() => cond.data?.targets ?? [], [cond.data]);
  const tideSwell = useTideSwellSeries(wp, data?.vessel ?? null, targets);
  const [hours, setHours] = useState<{ dir_deg: number | null; speed_kn: number | null }[]>([]);
  const [showSwell, setShowSwell] = useState(false);
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
  if (loading) return <PageSkeleton variant="passage" />;
  if (!data) return <div className="p-6 text-[14px] text-text-2">Passage not found.</div>;
  if (!wp) return <div className="p-6 text-[14px] text-text-2">Waypoint not found.</div>;
  const desc = [stayStart && stayEnd ? `${localDateTime(stayStart, off)} to ${localDayTime(stayEnd, off)} local` : null, !wp.is_anchorage ? 'Not marked as an anchorage in the route' : null].filter(Boolean).join(' · ');
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PageHeader back={{ to: `/passages/${data.passage.id}`, label: data.passage.name }} title={`Stay at ${wp.name ?? `waypoint ${wp.sequence}`}`} description={<span>{desc}</span>} />
      <div className="px-4 md:px-6 pb-8 space-y-8 max-w-[1280px] w-full mx-auto">
        <StayWindowView a={anch} utcOffsetMin={off} minUkcM={num(data.vessel?.min_ukc_m)} />
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] items-start">
          <Section title="Tide over the stay" description="Station tide, never a model sea level." actions={<label className="flex items-center gap-2 text-[13px] text-text-2 cursor-pointer">Show swell and under-keel clearance <Switch checked={showSwell} onCheckedChange={setShowSwell} aria-label="Show swell and under-keel clearance" /></label>}>
            <div className="card p-4 md:p-5">
              {showSwell
                ? <TideSwellChart bare points={tideSwell.points} minUkcM={num(data.vessel?.min_ukc_m)} datum={tideSwell.datum} etaIso={stayStart} stayEndIso={stayEnd} />
                : <TideChart bare series={tideSwell.points.map((p) => ({ t: p.t, height: p.tide }))} datum={tideSwell.datum} nowMs={nowMs} etaMarks={[...(stayStart ? [{ t: Date.parse(stayStart), label: 'Arrive' }] : []), ...(stayEnd ? [{ t: Date.parse(stayEnd), label: 'Leave' }] : [])]} />}
            </div>
          </Section>
          <Section title="Wind during the stay" description="Where the wind blows from, hour by hour. Colour is the median speed.">
            <div className="card p-4 md:p-5">
              <WindRose bins={windRose(hours)} size={252} />
              <div className="mt-3 pt-3 border-t border-border-soft t-caption flex items-center justify-between"><span><span className="num text-text-1">{hours.length}</span> forecast hours</span><span>Exposure: <span className="text-text-1">{wp.anchorage_exposure_tag ?? 'not set'}</span></span></div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}
