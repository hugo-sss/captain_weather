import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { IngestTargetRow } from '@/types/domain.ts';
import { haversineNm } from '@/lib/passage-engine/geo.ts';

export type BandPoint = { t: number; time: string; p10: number | null; p50: number | null; p90: number | null; gust90: number | null; dir: number | null; cmp: number | null; cmpDir: number | null };

export function nearestTargetRow(targets: IngestTargetRow[], layer: string, lat: number, lon: number): IngestTargetRow | null {
  let best: IngestTargetRow | null = null, bd = Infinity;
  for (const t of targets) {
    if (t.layer !== layer || !t.active) continue;
    const d = haversineNm(lat, lon, Number(t.grid_lat), Number(t.grid_lon));
    if (d < bd) { bd = d; best = t; }
  }
  return best;
}

/** Latest-init primary ensemble series plus the deterministic comparison series for one atmospheric target. */
export function useBandSeries(targetId: number | null, primarySource: string, comparisonSource: string) {
  const [points, setPoints] = useState<BandPoint[]>([]);
  const [meta, setMeta] = useState<{ primaryInit: string | null; comparisonInit: string | null }>({ primaryInit: null, comparisonInit: null });
  useEffect(() => {
    if (targetId === null) return;
    let cancelled = false;
    (async () => {
      const latest = async (source: string) => (await supabase.from('forecast_atmospheric').select('init_time').eq('target_id', targetId).eq('source', source).order('init_time', { ascending: false }).limit(1).maybeSingle()).data?.init_time ?? null;
      const [pInit, cInit] = await Promise.all([latest(primarySource), latest(comparisonSource)]);
      const [{ data: p }, { data: c }] = await Promise.all([
        pInit ? supabase.from('forecast_atmospheric').select('forecast_time, wind_p10_kn, wind_p50_kn, wind_p90_kn, gust_p90_kn, wind_dir_mean_deg').eq('target_id', targetId).eq('source', primarySource).eq('init_time', pInit).order('forecast_time') : Promise.resolve({ data: [] }),
        cInit ? supabase.from('forecast_atmospheric').select('forecast_time, wind_p50_kn, wind_dir_mean_deg').eq('target_id', targetId).eq('source', comparisonSource).eq('init_time', cInit).order('forecast_time') : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      const cmp = new Map((c ?? []).map((r) => [r.forecast_time, r]));
      setPoints((p ?? []).map((r) => {
        const k = cmp.get(r.forecast_time);
        return { t: Date.parse(r.forecast_time), time: r.forecast_time, p10: r.wind_p10_kn, p50: r.wind_p50_kn, p90: r.wind_p90_kn, gust90: r.gust_p90_kn, dir: r.wind_dir_mean_deg, cmp: k?.wind_p50_kn ?? null, cmpDir: k?.wind_dir_mean_deg ?? null };
      }));
      setMeta({ primaryInit: pInit, comparisonInit: cInit });
    })();
    return () => { cancelled = true; };
  }, [targetId, primarySource, comparisonSource]);
  return { points: targetId === null ? [] : points, meta };
}
