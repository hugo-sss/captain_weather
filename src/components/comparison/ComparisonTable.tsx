// Comparison table: primary ensemble against the comparison model per waypoint, differences, flagged rows in violet, source and run shown.
import type { WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { sourceName, utcStamp } from '@/lib/plain.ts';
import { DirArrow } from '@/components/dashboard/WindBand.tsx';
import { DisagreementBadge } from '@/components/dashboard/DisagreementBadge.tsx';
import { cn } from '@/lib/utils.ts';

const Gap = ({ reason }: { reason: string }) => <span className="inline-block h-3 w-10 gap-hatch rounded-sm align-middle" title={reason} />;
const Unit = ({ children }: { children: React.ReactNode }) => <span className="text-text-3 text-[11px] font-sans ml-0.5">{children}</span>;

export function ComparisonTable({ waypoints, conditions, thresholds }: { waypoints: WaypointRow[]; conditions: WaypointConditionsRow[]; thresholds: { wind_speed_kn: number; wind_dir_deg: number; light_air_floor_kn: number } }) {
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="data-table min-w-full">
          <thead>
            <tr className="groups">
              <th colSpan={3}>Waypoint</th>
              <th colSpan={4} className="!text-accent/90">Primary ensemble</th>
              <th colSpan={4} className="!text-flag-violet/90">Comparison model</th>
              <th colSpan={3}>Difference</th>
            </tr>
            <tr>
              <th className="r">No.</th><th>Name</th><th>ETA UTC</th>
              <th>Source</th><th>p10 / p50 / p90</th><th>From</th><th>Run</th>
              <th>Source</th><th className="r">Wind</th><th>From</th><th>Run</th>
              <th className="r">Speed</th><th className="r">Direction</th><th>Models</th>
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
                  <td className="num text-text-3 r">{wp.sequence}</td><td className="font-medium">{wp.name ?? `Waypoint ${wp.sequence}`}</td><td className="num text-text-2">{fmtUtc(c?.eta ?? wp.eta)}</td>
                  <td className="text-[12px] text-text-2">{sourceName(c?.atmos_source) ?? <Gap reason="no atmospheric data" />}</td>
                  <td className="num">{c?.wind_p50_kn !== null && c?.wind_p50_kn !== undefined ? <><span className="text-text-2">{fmtNum(num(c.wind_p10_kn), 0)}</span> <span className="text-text-3">/</span> <span className="font-medium">{fmtNum(num(c.wind_p50_kn), 0)}</span> <span className="text-text-3">/</span> <span className="text-text-2">{fmtNum(num(c.wind_p90_kn), 0)}</span><Unit>kn</Unit></> : <Gap reason="no atmospheric data" />}</td>
                  <td><DirArrow deg={c?.wind_dir_mean_deg} spread={c?.wind_dir_spread_deg} /></td>
                  <td className="num text-[11px] text-text-3">{utcStamp(c?.atmos_init_time) ?? <Gap reason="no run" />}</td>
                  <td className="text-[12px] text-text-2">{sourceName(c?.comparison_source) ?? <Gap reason="no comparison model" />}</td>
                  <td className="num r">{c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined ? <><span className="font-medium">{fmtNum(num(c.comparison_wind_kn), 0)}</span><Unit>kn</Unit></> : <Gap reason="no comparison row for this hour" />}</td>
                  <td><DirArrow deg={c?.comparison_wind_dir_deg} muted /></td>
                  <td className="num text-[11px] text-text-3">{utcStamp(dd?.comparison_init_time) ?? <Gap reason="no comparison run" />}</td>
                  <td className={cn('num r', dS !== null && dS > thresholds.wind_speed_kn ? 'text-flag-violet font-medium' : 'text-text-2')}>{dS !== null ? <>{fmtNum(dS, 1)}<Unit>kn</Unit></> : <Gap reason="one side missing" />}</td>
                  <td className={cn('num r', dD !== null && dD > thresholds.wind_dir_deg ? 'text-flag-violet font-medium' : 'text-text-2')}>{dD !== null ? `${fmtNum(dD, 0)}°` : <Gap reason="one side missing" />}</td>
                  <td className="text-[12px]">
                    {flagged ? <DisagreementBadge active size="sm" speedDelta={dS} dirDelta={dD} primary={c?.atmos_source} comparison={c?.comparison_source} />
                      : dd?.fired?.light_air_suppressed ? <span className="text-[11px] text-text-3" title={`difference over the threshold but the median is below ${thresholds.light_air_floor_kn} kn`}>Light air, ignored</span>
                      : c ? <span className="text-[11px] text-text-3">Agree</span> : <Gap reason="no run" />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-5 py-3 text-[12px] text-text-3 border-t border-border-soft">
        The models disagree when the speed differs by more than <span className="num text-text-2">{thresholds.wind_speed_kn} kn</span> or the direction by more than <span className="num text-text-2">{thresholds.wind_dir_deg}°</span>, and only when the primary median is at least <span className="num text-text-2">{thresholds.light_air_floor_kn} kn</span>. The models are independent; both arrive through Open-Meteo.
      </p>
    </div>
  );
}
