import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { IngestTargetRow, VesselRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { nearestTargetRow } from './useBandSeries.ts';
import { departureWindows, type DepartureWindow, type HourSample } from '../../supabase/functions/_shared/departure-windows.ts';
import { sourceDisagreement } from '../../supabase/functions/_shared/risk.ts';

/** Data-derived departure windows at the first waypoint over the next 72 h. A hint from the raw series, not advice. */
export function useDepartureWindows(origin: WaypointRow | null, vessel: VesselRow | null, targets: IngestTargetRow[], primarySource: string, comparisonSource: string) {
  const [samples, setSamples] = useState<HourSample[]>([]);
  const atmos = origin ? nearestTargetRow(targets, 'atmospheric', Number(origin.lat), Number(origin.lon)) : null;
  const marine = origin ? nearestTargetRow(targets, 'marine', Number(origin.lat), Number(origin.lon)) : null;
  const key = `${atmos?.id ?? ''}|${marine?.id ?? ''}|${primarySource}|${comparisonSource}`;
  useEffect(() => {
    if (!atmos) return;
    let cancelled = false;
    (async () => {
      const latest = async (source: string) => (await supabase.from('forecast_atmospheric').select('init_time').eq('target_id', atmos.id).eq('source', source).order('init_time', { ascending: false }).limit(1).maybeSingle()).data?.init_time ?? null;
      const [pInit, cInit] = await Promise.all([latest(primarySource), latest(comparisonSource)]);
      if (!pInit) return;
      const end = new Date(Date.now() + 72 * 3_600_000).toISOString();
      const [{ data: p }, { data: c }, mrows] = await Promise.all([
        supabase.from('forecast_atmospheric').select('forecast_time, wind_p50_kn, wind_p90_kn, gust_p90_kn, wind_dir_mean_deg').eq('target_id', atmos.id).eq('source', primarySource).eq('init_time', pInit).lte('forecast_time', end).order('forecast_time'),
        cInit ? supabase.from('forecast_atmospheric').select('forecast_time, wind_p50_kn, wind_dir_mean_deg').eq('target_id', atmos.id).eq('source', comparisonSource).eq('init_time', cInit).lte('forecast_time', end) : Promise.resolve({ data: [] }),
        marine ? (async () => { const mi = (await supabase.from('forecast_marine').select('init_time').eq('target_id', marine.id).order('init_time', { ascending: false }).limit(1).maybeSingle()).data?.init_time; return mi ? (await supabase.from('forecast_marine').select('forecast_time, wave_height_m').eq('target_id', marine.id).eq('init_time', mi).lte('forecast_time', end)).data ?? [] : []; })() : Promise.resolve([] as { forecast_time: string; wave_height_m: number | null }[]),
      ]);
      if (cancelled) return;
      const cmp = new Map((c ?? []).map((r) => [r.forecast_time, r]));
      const wave = new Map((mrows ?? []).map((r) => [r.forecast_time, num(r.wave_height_m)]));
      setSamples((p ?? []).map((r) => {
        const k = cmp.get(r.forecast_time);
        const d = k ? sourceDisagreement({ primarySource, primaryWindP50Kn: num(r.wind_p50_kn), primaryWindDirDeg: num(r.wind_dir_mean_deg), comparisonSource, comparisonWindKn: num(k.wind_p50_kn), comparisonWindDirDeg: num(k.wind_dir_mean_deg) }).disagreement : null;
        return { time: r.forecast_time, wind_p50_kn: num(r.wind_p50_kn), wind_p90_kn: num(r.wind_p90_kn), gust_p90_kn: num(r.gust_p90_kn), wave_height_m: wave.get(r.forecast_time) ?? null, disagreement: d };
      }));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const windows: DepartureWindow[] = useMemo(() => vessel ? departureWindows(samples, { max_wind_kn: num(vessel.max_wind_kn), max_gust_kn: num(vessel.max_gust_kn), max_wave_m: num(vessel.max_wave_m), max_current_kn: num(vessel.max_current_kn), min_ukc_m: num(vessel.min_ukc_m) }) : [], [samples, vessel]);
  return { windows, sampled: samples.length };
}
