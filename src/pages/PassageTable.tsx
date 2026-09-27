// /passages/:id/table: the full professional table. Every number from the latest check, one row per waypoint.
// Reached from the Detailed toggle and the overflow menu; never the landing view.
import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { GitCompareArrows, Printer } from 'lucide-react';
import { usePassage } from '@/hooks/usePassage.ts';
import { useConditions } from '@/hooks/useConditions.ts';
import { useDisplayPrefs } from '@/hooks/useDisplayPrefs.ts';
import { useLegConditions, useLegProfiles } from '@/hooks/useLegConditions.ts';
import { useNow } from '@/hooks/useNow.ts';
import { num, type ConfidenceLevel, type RiskFlag } from '@/types/domain.ts';
import { PageHeader } from '@/components/PageHeader.tsx';
import { KpiStrip } from '@/components/dashboard/KpiStrip.tsx';
import { LegTable } from '@/components/dashboard/LegTable.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { OfflineBanner } from '@/components/OfflineBanner.tsx';
import { Button } from '@/components/ui/button.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { PageSkeleton } from '@/components/ui/skeleton.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { Table2 } from 'lucide-react';
import { agePhrase, sourceName, utcStamp } from '@/lib/plain.ts';
import { fmtHours, fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { asSquall, SQUALL_RANK } from '@/lib/leg-profile.ts';
import { worstRisk } from '../../supabase/functions/_shared/risk.ts';
import { passageConfidence } from '../../supabase/functions/_shared/confidence.ts';

export default function PassageTable() {
  const { id } = useParams();
  const { data, loading } = usePassage(id);
  const cond = useConditions(id);
  const { prefs } = useDisplayPrefs();
  const nowMs = useNow(60_000);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState(true);
  const waypoints = useMemo(() => data?.waypoints ?? [], [data]);
  const conditions = useMemo(() => cond.data?.conditions ?? [], [cond.data]);
  const run = cond.data?.run ?? null;
  const legRows = useLegConditions(run?.id ?? null, id);
  const legs = useLegProfiles(legRows.rows, waypoints);
  if (loading) return <PageSkeleton variant="table" />;
  if (!data) return <div className="p-6 text-[14px] text-text-2">Passage not found.</div>;
  const { passage, vessel } = data;
  const maxWind = num(vessel?.max_wind_kn), maxWaveLimit = num(vessel?.max_wave_m);
  const totalNm = waypoints.reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const arrival = waypoints[waypoints.length - 1]?.eta ?? null;
  const flags = [...conditions.map((c) => c.risk_flag as RiskFlag), ...legs.map((l) => l.summary.worstRisk)];
  const worst = flags.length ? worstRisk(flags) : 'unknown';
  const confidence = conditions.length ? passageConfidence(conditions.map((c) => c.confidence_level as ConfidenceLevel)) : null;
  const maxOf = (vals: (number | null)[]) => vals.reduce<number | null>((m, v) => (v === null ? m : Math.max(m ?? -Infinity, v)), null);
  const maxP90 = maxOf([...conditions.map((c) => num(c.wind_p90_kn)), ...legs.map((l) => l.summary.maxWindP90)]);
  const maxWave = maxOf([...conditions.map((c) => num(c.wave_height_m)), ...legs.map((l) => l.summary.maxHs)]);
  const squallWorst = [...conditions.map((c) => asSquall(c.squall_risk)), ...legs.map((l) => l.summary.worstSquall)].reduce((w, s) => (SQUALL_RANK[s] > SQUALL_RANK[w] ? s : w), 'none' as const);
  const redCount = flags.filter((f) => f === 'red').length, amberCount = flags.filter((f) => f === 'amber').length, divergeCount = conditions.filter((c) => c.source_disagreement).length;
  const first = conditions[0];
  const sources = first ? `Wind ${sourceName(first.atmos_source)} (run ${utcStamp(first.atmos_init_time)}), comparison ${sourceName(first.comparison_source)}, sea state ${sourceName(conditions.find((c) => c.marine_source)?.marine_source) ?? 'none'}, tide ${sourceName(conditions.find((c) => c.tidal_source)?.tidal_source) ?? 'none'}.` : null;
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <OfflineBanner />
      <PageHeader back={{ to: `/passages/${passage.id}`, label: passage.name }} title="Full table"
        description={<span>Every number from the latest check, one row per waypoint. {run ? `Checked ${agePhrase(run.completed_at ?? run.created_at, nowMs)}.` : 'Not checked yet.'}</span>}
        actions={<>
          <label className="hidden sm:flex items-center gap-2 text-[13px] text-text-2 cursor-pointer mr-2">Comparison columns <Switch checked={showComparison} onCheckedChange={setShowComparison} aria-label="Show comparison columns" /></label>
          <Button variant="secondary" size="sm" asChild><Link to={`/passages/${passage.id}/comparison`}><GitCompareArrows /> Compare models</Link></Button>
          <Button variant="ghost" size="sm" onClick={() => window.open(`/passages/${passage.id}/print`, '_blank', 'noopener')}><Printer /> Print</Button>
        </>} />
      <div className="px-4 md:px-6 pb-8 space-y-5 w-full">
        <div className="card px-5 py-4">
          <KpiStrip items={[
            { label: 'Distance', value: `${totalNm.toFixed(1)} nm`, aside: `${waypoints.length} waypoints` },
            { label: 'Arrival', value: arrival ? fmtUtc(arrival) : null, aside: arrival ? fmtLocal(arrival, prefs.local_utc_offset_min) : undefined },
            { label: 'Passage time', value: arrival ? fmtHours((Date.parse(arrival) - Date.parse(passage.actual_departure ?? passage.planned_departure)) / 3_600_000) : null },
            { label: 'Max wind p90', value: maxP90 === null ? null : `${fmtNum(maxP90, 0)} kn`, aside: maxWind !== null ? `limit ${maxWind} kn${legs.length ? ', along-leg included' : ''}` : undefined, tone: maxWind !== null && maxP90 !== null && maxP90 > maxWind ? 'red' : maxWind !== null && maxP90 !== null && maxP90 > 0.75 * maxWind ? 'amber' : 'default' },
            { label: 'Max wave', value: maxWave === null ? null : `${fmtNum(maxWave, 1)} m`, aside: maxWaveLimit !== null ? `limit ${maxWaveLimit} m` : undefined, tone: maxWaveLimit !== null && maxWave !== null && maxWave > maxWaveLimit ? 'red' : maxWaveLimit !== null && maxWave !== null && maxWave > 0.75 * maxWaveLimit ? 'amber' : 'default' },
            { label: 'Flags', value: conditions.length ? <span className="inline-flex items-center gap-1.5"><RiskPill flag={worst} size="sm" /><SquallBadge risk={squallWorst} size="sm" /></span> : null, aside: conditions.length ? `${redCount} red, ${amberCount} amber, ${divergeCount} disagree` : undefined },
            { label: 'Confidence', value: confidence ? <ConfidenceDot level={confidence} withLabel /> : null },
          ]} />
        </div>
        {sources && <p className="t-caption">{sources}</p>}
        {conditions.length === 0 ? (
          <EmptyState icon={Table2} title="Not checked yet" body="Check conditions on the passage page. The rows below then fill with every number." action={<Button asChild><Link to={`/passages/${passage.id}`}>Open the passage</Link></Button>} />
        ) : null}
        <div className="card overflow-hidden">
          <LegTable waypoints={waypoints} conditions={conditions} maxWindKn={maxWind} selectedId={selectedId} onSelect={setSelectedId} showComparison={showComparison} utcOffsetMin={prefs.local_utc_offset_min} passageId={passage.id} legs={legs} />
        </div>
        <p className="text-[12px] text-text-3">Wind in knots: 10th, 50th and 90th percentile of the primary ensemble. Direction is where the wind blows from; current is where it sets toward. Hatched cells have no data; hover for the reason.</p>
      </div>
    </div>
  );
}
