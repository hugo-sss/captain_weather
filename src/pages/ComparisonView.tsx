import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { ComparisonTable } from '@/components/comparison/ComparisonTable.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { fmtUtc } from '@/lib/time.ts';

const DEFAULT_TH = { wind_speed_kn: 5, wind_dir_deg: 15, light_air_floor_kn: 8 };

export default function ComparisonView() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const [th, setTh] = useState(DEFAULT_TH);
  useEffect(() => {
    let cancelled = false;
    supabase.from('app_settings').select('value').eq('key', 'disagreement_thresholds').maybeSingle().then(({ data: s }) => {
      if (!cancelled && s?.value) setTh({ ...DEFAULT_TH, ...(s.value as Partial<typeof DEFAULT_TH>) });
    });
    return () => { cancelled = true; };
  }, []);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  if (loading || !data) return <div className="p-4 text-text-2">{loading ? 'Loading…' : 'Passage not found.'}</div>;
  const flagged = conditions.filter((c) => c.source_disagreement).length;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="px-4 py-2 border-b border-border bg-bg-1 flex flex-wrap items-center gap-3">
        <div><div className="text-base font-semibold leading-tight">{data.passage.name}</div><div className="text-[11px] text-text-3">run {cond.data?.run ? `${cond.data.run.status} · ${fmtUtc(cond.data.run.completed_at ?? cond.data.run.created_at)}` : 'none'} · {flagged} leg{flagged === 1 ? '' : 's'} flagged</div></div>
        <ModeTabs passageId={data.passage.id} current="cmp" />
      </div>
      <ComparisonTable waypoints={data.waypoints} conditions={conditions} thresholds={th} />
    </div>
  );
}
