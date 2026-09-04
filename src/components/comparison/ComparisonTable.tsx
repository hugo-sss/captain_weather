// Comparison view: primary ensemble vs comparison model per leg, deltas, flagged rows in violet, source + init shown (PRD §9.5 screen 4).
import { GitCompareArrows } from 'lucide-react';
import type { WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { DirArrow } from '@/components/dashboard/WindBand.tsx';
import { cn } from '@/lib/utils.ts';

const Gap = ({ reason }: { reason: string }) => <span className="inline-block h-3 w-10 gap-hatch rounded-sm border border-border/60 align-middle" title={reason} />;
const Unit = ({ children }: { children: React.ReactNode }) => <span className="text-text-3 text-[11px] font-sans ml-0.5">{children}</span>;

export function ComparisonTable({ waypoints, conditions, thresholds }: { waypoints: WaypointRow[]; conditions: WaypointConditionsRow[]; thresholds: { wind_speed_kn: number; wind_dir_deg: number; light_air_floor_kn: number } }) {
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr className="groups">
              <th colSpan={3}>Leg</th>
              <th colSpan={4} className="!text-accent/90">Primary ensemble</th>
              <th colSpan={4} className="!text-flag-violet/90">Comparison model</th>
              <th colSpan={3}>Delta · flag</th>
            </tr>
            <tr>
              <th className="r">#</th><th>Waypoint</th><th>ETA UTC</th>
              <th>Source</th><th>p10 / p50 / p90</th><th>Dir from</th><th>Init</th>
              <th>Source</th><th className="r">Wind</th><th>Dir from</th><th>Init</th>
              <th className="r">Δ speed</th><th className="r">Δ dir</th><th>Flag</th>
            </tr>
          </thead>
          <tbody>
            {waypoints.map((wp) => {
              const c = byWp.get(wp.id);
              const dd = c?.disagreement_detail as { comparison_init_time?: string; fired?: { light_air_suppressed?: boolean } } | null | undefined;
              const flagged = !!c?.source_disagreement;
              const dS = num(c?.wind_speed_delta_kn), dD = num(c?.wind_dir_delta_deg);
              return (
                <tr key={wp.id} className={cn(flagged && 'is-flagged')}>
                  <td className="num text-text-3 r">{wp.sequence}</td><td className="font-medium">{wp.name ?? '—'}</td><td className="num text-text-2">{fmtUtc(c?.eta ?? wp.eta)}</td>
                  <td className="num text-[11px] text-text-2">{c?.atmos_source ?? '—'}</td>
                  <td className="num">{c?.wind_p50_kn !== null && c?.wind_p50_kn !== undefined ? <><span className="text-text-2">{fmtNum(num(c.wind_p10_kn), 0)}</span> <span className="text-text-3">/</span> <span className="font-medium">{fmtNum(num(c.wind_p50_kn), 0)}</span> <span className="text-text-3">/</span> <span className="text-text-2">{fmtNum(num(c.wind_p90_kn), 0)}</span><Unit>kn</Unit></> : <Gap reason="no atmospheric data" />}</td>
                  <td><DirArrow deg={c?.wind_dir_mean_deg} spread={c?.wind_dir_spread_deg} /></td>
                  <td className="num text-[11px] text-text-3">{fmtUtc(c?.atmos_init_time)}</td>
                  <td className="num text-[11px] text-text-2">{c?.comparison_source ?? '—'}</td>
                  <td className="num r">{c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined ? <><span className="font-medium">{fmtNum(num(c.comparison_wind_kn), 0)}</span><Unit>kn</Unit></> : <Gap reason="no comparison row for this hour" />}</td>
                  <td><DirArrow deg={c?.comparison_wind_dir_deg} muted /></td>
                  <td className="num text-[11px] text-text-3">{fmtUtc(dd?.comparison_init_time)}</td>
                  <td className={cn('num r', dS !== null && dS > thresholds.wind_speed_kn ? 'text-flag-violet font-medium' : 'text-text-2')}>{dS !== null ? <>{fmtNum(dS, 1)}<Unit>kn</Unit></> : '—'}</td>
                  <td className={cn('num r', dD !== null && dD > thresholds.wind_dir_deg ? 'text-flag-violet font-medium' : 'text-text-2')}>{dD !== null ? `${fmtNum(dD, 0)}°` : '—'}</td>
                  <td className="text-xs">
                    {flagged ? <span className="inline-flex h-5 items-center gap-1 rounded-sm border border-flag-violet/50 bg-flag-violet/15 px-1.5 text-[10.5px] font-semibold uppercase tracking-[0.05em] text-flag-violet"><GitCompareArrows className="h-3 w-3" /> Diverge</span>
                      : dd?.fired?.light_air_suppressed ? <span className="text-[10px] uppercase tracking-[0.05em] text-text-3" title={`delta over threshold but p50 below ${thresholds.light_air_floor_kn} kn`}>light air</span>
                      : <span className="text-[10px] uppercase tracking-[0.05em] text-text-3/70">agree</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2.5 text-[11px] text-text-3 border-t border-border">
        <span className="label mr-2">Thresholds</span>speed Δ &gt; <span className="num text-text-2">{thresholds.wind_speed_kn} kn</span> or direction Δ &gt; <span className="num text-text-2">{thresholds.wind_dir_deg}°</span>, only when the primary p50 is at least <span className="num text-text-2">{thresholds.light_air_floor_kn} kn</span>. The models are independent; the delivery pipe (Open-Meteo) is shared.
      </p>
    </div>
  );
}
