// Live preview of what the current passage's flags would be with the edited thresholds (PRD §9.5 screen 5).
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase.ts';
import type { PassageRow, WaypointConditionsRow, WaypointRow, RiskFlag } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { riskFlag, type VesselThresholds } from '../../../supabase/functions/_shared/risk.ts';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ukcEstimate } from '../../../supabase/functions/_shared/ukc.ts';

export function ThresholdPreview({ vesselId, thresholds, draftM }: { vesselId: string | null; thresholds: VesselThresholds; draftM: number | null }) {
  const [passage, setPassage] = useState<PassageRow | null>(null);
  const [rows, setRows] = useState<{ wp: WaypointRow; c: WaypointConditionsRow }[]>([]);
  useEffect(() => {
    if (!vesselId) return;
    let cancelled = false;
    (async () => {
      const { data: p } = await supabase.from('passages').select('*').eq('vessel_id', vesselId).in('status', ['planned', 'active']).order('planned_departure', { ascending: false }).limit(1).maybeSingle();
      if (!p || cancelled) { setPassage(null); setRows([]); return; }
      setPassage(p);
      const { data: run } = await supabase.from('conditions_runs').select('id').eq('passage_id', p.id).eq('status', 'complete').order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (!run) { setRows([]); return; }
      const [{ data: wps }, { data: cs }] = await Promise.all([supabase.from('waypoints').select('*').eq('passage_id', p.id).order('sequence'), supabase.from('waypoint_conditions').select('*').eq('run_id', run.id)]);
      if (cancelled) return;
      const byWp = new Map((cs ?? []).map((c) => [c.waypoint_id, c]));
      setRows((wps ?? []).flatMap((wp) => { const c = byWp.get(wp.id); return c ? [{ wp, c }] : []; }));
    })();
    return () => { cancelled = true; };
  }, [vesselId]);
  if (!vesselId) return <p className="text-xs text-text-3">Save the vessel first to preview flags against a passage.</p>;
  if (!passage) return <p className="text-xs text-text-3">No planned or active passage for this vessel yet.</p>;
  if (rows.length === 0) return <p className="text-xs text-text-3">Passage “{passage.name}” has no computed conditions yet.</p>;
  return (
    <div>
      <div className="label mb-2">Preview on “{passage.name}” with the values above</div>
      <table className="text-sm w-full">
        <tbody>
          {rows.map(({ wp, c }) => {
            const ukc = ukcEstimate({ draftM, chartedDepthM: num(c.charted_depth_m), tideHeightM: num(c.tide_height_m), swellHeightM: num(c.swell_height_m), isAnchorage: wp.is_anchorage });
            const r = riskFlag({ windP50Kn: num(c.wind_p50_kn), windP90Kn: num(c.wind_p90_kn), gustP90Kn: num(c.gust_p90_kn), waveHeightM: num(c.wave_height_m), currentSpeedKn: num(c.current_speed_kn), ukcEstimateM: ukc.ukcEstimateM, sourceDisagreement: c.source_disagreement, atmosphericGap: c.wind_p50_kn === null }, thresholds);
            const changed = r.flag !== c.risk_flag;
            return (
              <tr key={wp.id} className="border-b border-border">
                <td className="num text-text-3 pr-2 py-1">{wp.sequence}</td><td className="py-1 pr-2">{wp.name}</td>
                <td className="py-1 pr-2"><RiskPill flag={c.risk_flag as RiskFlag} /></td>
                <td className="py-1 pr-2 text-text-3">→</td>
                <td className="py-1"><RiskPill flag={r.flag} reasons={r.reasons} />{changed && <span className="ml-2 text-[11px] text-flag-violet">changes</span>}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
