// Compare models: the primary ensemble against the comparison model, leg by leg (PRD §9.5 screen 4).
import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Table2 } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useNow } from '@/hooks/useNow.ts';
import { ComparisonTable } from '@/components/comparison/ComparisonTable.tsx';
import { PageHeader } from '@/components/PageHeader.tsx';
import { Button } from '@/components/ui/button.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { agePhrase, sourceName } from '@/lib/plain.ts';

const DEFAULT_TH = { wind_speed_kn: 5, wind_dir_deg: 15, light_air_floor_kn: 8 };

export default function ComparisonView() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const nowMs = useNow(60_000);
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
  if (!data) return <div className="p-6 text-[14px] text-text-2">Passage not found.</div>;
  const flagged = conditions.filter((c) => c.source_disagreement).length;
  const primary = sourceName(conditions[0]?.atmos_source), comparison = sourceName(conditions[0]?.comparison_source);
  const run = cond.data?.run ?? null;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <PageHeader back={{ to: `/passages/${data.passage.id}`, label: data.passage.name }} title="Compare models"
        description={<span>{primary && comparison ? `${primary} against ${comparison}, leg by leg. ` : ''}{flagged === 0 ? 'The models agree at every waypoint.' : `They disagree at ${flagged} ${flagged === 1 ? 'waypoint' : 'waypoints'}.`}{run ? ` Checked ${agePhrase(run.completed_at ?? run.created_at, nowMs)}.` : ''}</span>}
        actions={<Button variant="secondary" size="sm" asChild><Link to={`/passages/${data.passage.id}/table`}><Table2 /> Full table</Link></Button>} />
      <div className="px-4 md:px-6 pb-8 space-y-4 w-full">
        {conditions.length === 0
          ? <EmptyState icon={Table2} title="Not checked yet" body="Check conditions on the passage page, then compare the two models here." action={<Button asChild><Link to={`/passages/${data.passage.id}`}>Open the passage</Link></Button>} />
          : <div className="card overflow-hidden"><ComparisonTable waypoints={data.waypoints} conditions={conditions} thresholds={th} /></div>}
      </div>
    </div>
  );
}
