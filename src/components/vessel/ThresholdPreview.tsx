// Live preview of what the current passage's flags would be with the edited thresholds (PRD §9.5 screen 5).
import { useEffect, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase.ts';
import type { PassageRow, WaypointConditionsRow, WaypointRow, RiskFlag } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { riskFlag, type VesselThresholds } from '../../../supabase/functions/_shared/risk.ts';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ukcEstimate } from '../../../supabase/functions/_shared/ukc.ts';
import { Skeleton } from '@/components/ui/skeleton.tsx';

const Empty = ({ children }: { children: React.ReactNode }) => <div className="gap-hatch rounded-md border border-dashed border-border p-4 text-xs text-text-3 text-center">{children}</div>;

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
  if (!vesselId) return <Empty>Save the vessel first to preview flags against a passage.</Empty>;
  if (!loaded) return <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-8" />)}</div>;
  if (!passage) return <Empty>No planned or active passage for this vessel yet.</Empty>;
  if (rows.length === 0) return <Empty>Passage “{passage.name}” has no computed conditions yet.</Empty>;
  const changed = rows.filter(({ wp, c }) => {
    const ukc = ukcEstimate({ draftM, chartedDepthM: num(c.charted_depth_m), tideHeightM: num(c.tide_height_m), swellHeightM: num(c.swell_height_m), isAnchorage: wp.is_anchorage });
    return riskFlag({ windP50Kn: num(c.wind_p50_kn), windP90Kn: num(c.wind_p90_kn), gustP90Kn: num(c.gust_p90_kn), waveHeightM: num(c.wave_height_m), currentSpeedKn: num(c.current_speed_kn), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: c.source_disagreement, atmosphericGap: c.wind_p50_kn === null }, thresholds).flag !== c.risk_flag;
  }).length;
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <div className="label">On “{passage.name}”</div>
        <div className="text-[11px] text-text-3">{changed === 0 ? 'no flags change' : <span className="text-flag-violet">{changed} flag{changed === 1 ? '' : 's'} would change</span>}</div>
      </div>
      <table className="data-table">
        <thead><tr><th className="r">#</th><th>Waypoint</th><th>Stored</th><th /><th>With edits</th></tr></thead>
        <tbody>
          {rows.map(({ wp, c }) => {
            const ukc = ukcEstimate({ draftM, chartedDepthM: num(c.charted_depth_m), tideHeightM: num(c.tide_height_m), swellHeightM: num(c.swell_height_m), isAnchorage: wp.is_anchorage });
            const r = riskFlag({ windP50Kn: num(c.wind_p50_kn), windP90Kn: num(c.wind_p90_kn), gustP90Kn: num(c.gust_p90_kn), waveHeightM: num(c.wave_height_m), currentSpeedKn: num(c.current_speed_kn), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: c.source_disagreement, atmosphericGap: c.wind_p50_kn === null }, thresholds);
            const diff = r.flag !== c.risk_flag;
            return (
              <tr key={wp.id} className={diff ? 'is-flagged' : undefined}>
                <td className="num text-text-3 r">{wp.sequence}</td><td className="truncate max-w-[140px]">{wp.name}</td>
                <td><RiskPill flag={c.risk_flag as RiskFlag} size="sm" /></td>
                <td className="text-text-3"><ArrowRight className="h-3 w-3" /></td>
                <td><span className="inline-flex items-center gap-2"><RiskPill flag={r.flag} reasons={r.reasons} size="sm" />{diff && <span className="text-[10px] uppercase tracking-[0.05em] text-flag-violet">changes</span>}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
