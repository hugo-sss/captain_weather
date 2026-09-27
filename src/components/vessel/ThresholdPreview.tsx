// What the edited limits would change on the current passage (PRD §9.5 screen 5).
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import type { PassageRow, WaypointConditionsRow, WaypointRow, RiskFlag } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { riskFlag, type VesselThresholds } from '../../../supabase/functions/_shared/risk.ts';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ukcEstimate } from '../../../supabase/functions/_shared/ukc.ts';
import { Skeleton } from '@/components/ui/skeleton.tsx';

const Empty = ({ children }: { children: React.ReactNode }) => <div className="gap-hatch rounded-lg p-5 text-[13px] text-text-3 text-center">{children}</div>;

export function ThresholdPreview({ vesselId, thresholds, draftM }: { vesselId: string | null; thresholds: VesselThresholds; draftM: number | null }) {
  const [passage, setPassage] = useState<PassageRow | null>(null);
  const [rows, setRows] = useState<{ wp: WaypointRow; c: WaypointConditionsRow }[]>([]);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!vesselId) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase.from('passages').select('*').eq('vessel_id', vesselId).in('status', ['planned', 'active']).order('planned_departure', { ascending: false }).limit(1).maybeSingle();
      if (!p || cancelled) { setPassage(null); setRows([]); setLoaded(true); return; }
      setPassage(p);
      const { data: run } = await supabase.from('conditions_runs').select('id').eq('passage_id', p.id).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!run) { setRows([]); setLoaded(true); return; }
      const [{ data: wps }, { data: cs }] = await Promise.all([supabase.from('waypoints').select('*').eq('passage_id', p.id).order('sequence'), supabase.from('waypoint_conditions').select('*').eq('run_id', run.id)]);
      if (cancelled) return;
      const byWp = new Map((cs ?? []).map((c) => [c.waypoint_id, c]));
      setRows((wps ?? []).flatMap((wp) => { const c = byWp.get(wp.id); return c ? [{ wp, c }] : []; }));
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [vesselId]);
  if (!vesselId) return <Empty>Save the vessel first to preview its flags against a passage.</Empty>;
  if (!loaded) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-9" />)}</div>;
  if (!passage) return <Empty>No planned or underway passage for this vessel yet.</Empty>;
  if (rows.length === 0) return <Empty>{passage.name} has not been checked yet.</Empty>;
  const flagFor = (wp: WaypointRow, c: WaypointConditionsRow) => {
    const ukc = ukcEstimate({ draftM, chartedDepthM: num(c.charted_depth_m), tideHeightM: num(c.tide_height_m), swellHeightM: num(c.swell_height_m), isAnchorage: wp.is_anchorage });
    return riskFlag({ windP50Kn: num(c.wind_p50_kn), windP90Kn: num(c.wind_p90_kn), gustP90Kn: num(c.gust_p90_kn), waveHeightM: num(c.wave_height_m), currentSpeedKn: num(c.current_speed_kn), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: c.source_disagreement, atmosphericGap: c.wind_p50_kn === null }, thresholds);
  };
  const changed = rows.filter(({ wp, c }) => flagFor(wp, c).flag !== c.risk_flag).length;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="t-card">{passage.name}</div>
        <div className="t-caption">{changed === 0 ? 'No flags change' : <span className="text-flag-violet">{changed} {changed === 1 ? 'flag changes' : 'flags change'}</span>}</div>
      </div>
      <div className="overflow-x-auto">
      <table className="data-table table-fixed [&_td]:px-1.5 [&_th]:px-1.5">
        <colgroup><col /><col style={{ width: 78 }} /><col style={{ width: 22 }} /><col style={{ width: 86 }} /></colgroup>
        <thead><tr><th>Waypoint</th><th>Now</th><th /><th>With edits</th></tr></thead>
        <tbody>
          {rows.map(({ wp, c }) => {
            const r = flagFor(wp, c);
            const diff = r.flag !== c.risk_flag;
            return (
              <tr key={wp.id} className={diff ? 'is-flagged' : undefined}>
                <td className="truncate"><span className="num text-text-3 mr-2">{wp.sequence}</span>{wp.name}</td>
                <td><RiskPill flag={c.risk_flag as RiskFlag} size="sm" /></td>
                <td className="text-text-3"><ArrowRight className="h-3.5 w-3.5" /></td>
                <td><RiskPill flag={r.flag} reasons={r.reasons} size="sm" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>
    </div>
  );
}
