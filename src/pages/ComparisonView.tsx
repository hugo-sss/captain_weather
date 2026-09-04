import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { ComparisonTable } from '@/components/comparison/ComparisonTable.tsx';
import { ModeTabs } from '@/components/dashboard/ModeTabs.tsx';
import { PageHeader, Sep } from '@/components/PageHeader.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
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
  if (loading) return <PageSkeleton variant="table" />;
  if (!data) return <div className="p-6 text-sm text-text-2">Passage not found.</div>;
  const flagged = conditions.filter((c) => c.source_disagreement).length;
  const sources = [...new Set(conditions.flatMap((c) => [c.atmos_source, c.comparison_source]).filter(Boolean))];
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader
        title={data.passage.name}
        meta={<><span>run {cond.data?.run ? <><span className="text-text-2">{cond.data.run.status}</span> · <span className="num">{fmtUtc(cond.data.run.completed_at ?? cond.data.run.created_at)}</span></> : 'none'}</span><Sep /><span className={flagged ? 'text-flag-violet' : undefined}><span className="num">{flagged}</span> leg{flagged === 1 ? '' : 's'} flagged</span>{sources.length > 0 && <><Sep /><span className="num">{sources.join(' vs ')}</span></>}</>}
        tabs={<ModeTabs passageId={data.passage.id} current="cmp" />}
      />
      {conditions.length === 0 && <div className="mx-4 mt-3 rounded-md border border-dashed border-border gap-hatch px-3 py-2 text-xs text-text-2">No conditions run yet, so there is nothing to compare. Compute conditions from the Professional view.</div>}
      <ComparisonTable waypoints={data.waypoints} conditions={conditions} thresholds={th} />
    </div>
  );
}
