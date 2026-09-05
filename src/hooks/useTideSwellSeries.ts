import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { IngestTargetRow, WaypointRow, VesselRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { nearestTargetRow } from './useBandSeries.ts';
import type { TideSwellPoint } from '@/components/dashboard/TideSwellChart.tsx';
import { ukcEstimate } from '../../supabase/functions/_shared/ukc.ts';

/** Tide (adapter) + swell (marine) on one axis for a waypoint; UKC computed hour by hour from the same pair. */
export function useTideSwellSeries(wp: WaypointRow | null, vessel: VesselRow | null, targets: IngestTargetRow[]) {
  const [points, setPoints] = useState<TideSwellPoint[]>([]);
  const [datum, setDatum] = useState<string | null>(null);
  const tidal = wp ? nearestTargetRow(targets, 'tidal', Number(wp.lat), Number(wp.lon)) : null;
  const marine = wp ? nearestTargetRow(targets, 'marine', Number(wp.lat), Number(wp.lon)) : null;
  const key = `${wp?.id ?? ''}|${tidal?.id ?? ''}|${marine?.id ?? ''}|${vessel?.draft_m ?? ''}|${wp?.charted_depth_m ?? ''}`;
  useEffect(() => {
    if (!wp) return;
    let cancelled = false;
    (async () => {
      const [t, m] = await Promise.all([
        tidal ? supabase.from('forecast_tidal').select('forecast_time, tide_height_m, datum').eq('target_id', tidal.id).order('forecast_time') : Promise.resolve({ data: [] as { forecast_time: string; tide_height_m: number | null; datum: string }[] }),
        marine ? (async () => {
          const latest = (await supabase.from('forecast_marine').select('init_time').eq('target_id', marine.id).order('init_time', { ascending: false }).limit(1).maybeSingle()).data?.init_time;
          return latest ? supabase.from('forecast_marine').select('forecast_time, swell_height_m').eq('target_id', marine.id).eq('init_time', latest).order('forecast_time') : { data: [] as { forecast_time: string; swell_height_m: number | null }[] };
        })() : Promise.resolve({ data: [] as { forecast_time: string; swell_height_m: number | null }[] }),
      ]);
      if (cancelled) return;
      const tideBy = new Map((t.data ?? []).map((r) => [Date.parse(r.forecast_time), num(r.tide_height_m)]));
      const swellBy = new Map((m.data ?? []).map((r) => [Date.parse(r.forecast_time), num(r.swell_height_m)]));
      const times = [...new Set([...tideBy.keys(), ...swellBy.keys()])].sort((a, b) => a - b);
      const draft = num(vessel?.draft_m), depth = num(wp.charted_depth_m);
      setDatum((t.data ?? [])[0]?.datum ?? null);
      setPoints(times.map((tt) => {
        const tide = tideBy.get(tt) ?? null, swell = swellBy.get(tt) ?? null;
        const u = ukcEstimate({ draftM: draft, chartedDepthM: depth, tideHeightM: tide, swellHeightM: swell, isAnchorage: wp.is_anchorage });
        return { t: tt, tide, swell, ukc: u.ukcEstimateM };
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { points: wp ? points : [], datum, tidalTarget: tidal, marineTarget: marine };
}
