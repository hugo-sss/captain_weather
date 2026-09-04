// Comparison view: primary ensemble vs comparison model per leg, deltas, flagged rows in violet, source + init shown (PRD §9.5 screen 4).
import type { WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { DirArrow } from '@/components/dashboard/WindBand.tsx';
import { cn } from '@/lib/utils.ts';

const Th = ({ children, className }: { children: React.ReactNode; className?: string }) => <th className={cn('label text-left px-2 py-1.5 font-medium whitespace-nowrap', className)}>{children}</th>;
const Td = ({ children, className }: { children: React.ReactNode; className?: string }) => <td className={cn('px-2 py-1.5 whitespace-nowrap align-middle', className)}>{children}</td>;

export function ComparisonTable({ waypoints, conditions, thresholds }: { waypoints: WaypointRow[]; conditions: WaypointConditionsRow[]; thresholds: { wind_speed_kn: number; wind_dir_deg: number; light_air_floor_kn: number } }) {
  const byWp = new Map(conditions.map((c) => [c.waypoint_id, c]));
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="border-b border-border">
          <tr>
            <Th>#</Th><Th>Waypoint</Th><Th>ETA UTC</Th>
            <Th className="text-accent">Primary ensemble</Th><Th className="text-accent">p10 / p50 / p90</Th><Th className="text-accent">Dir</Th><Th className="text-accent">Init</Th>
            <Th className="text-flag-violet">Comparison</Th><Th className="text-flag-violet">Wind</Th><Th className="text-flag-violet">Dir</Th><Th className="text-flag-violet">Init</Th>
            <Th>Δ speed</Th><Th>Δ dir</Th><Th>Flag</Th>
          </tr>
        </thead>
        <tbody>
          {waypoints.map((wp) => {
            const c = byWp.get(wp.id);
            const dd = c?.disagreement_detail as { comparison_init_time?: string; fired?: { light_air_suppressed?: boolean } } | null | undefined;
            const flagged = !!c?.source_disagreement;
            return (
              <tr key={wp.id} className={cn('border-b border-border', flagged && 'bg-flag-violet/10')}>
                <Td className="num text-text-3">{wp.sequence}</Td><Td>{wp.name ?? '—'}</Td><Td className="num">{fmtUtc(c?.eta ?? wp.eta)}</Td>
                <Td className="text-xs">{c?.atmos_source ?? '—'}</Td>
                <Td className="num">{c?.wind_p50_kn !== null && c?.wind_p50_kn !== undefined ? `${fmtNum(num(c.wind_p10_kn), 0)} / ${fmtNum(num(c.wind_p50_kn), 0)} / ${fmtNum(num(c.wind_p90_kn), 0)} kn` : <span className="inline-block h-3 w-10 gap-hatch rounded-sm" />}</Td>
                <Td><DirArrow deg={c?.wind_dir_mean_deg} spread={c?.wind_dir_spread_deg} /></Td>
                <Td className="num text-xs text-text-2">{fmtUtc(c?.atmos_init_time)}</Td>
                <Td className="text-xs">{c?.comparison_source ?? '—'}</Td>
                <Td className="num">{c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined ? `${fmtNum(num(c.comparison_wind_kn), 0)} kn` : <span className="inline-block h-3 w-10 gap-hatch rounded-sm" title="no comparison row for this hour" />}</Td>
                <Td><DirArrow deg={c?.comparison_wind_dir_deg} /></Td>
                <Td className="num text-xs text-text-2">{fmtUtc(dd?.comparison_init_time)}</Td>
                <Td className={cn('num', num(c?.wind_speed_delta_kn) !== null && num(c?.wind_speed_delta_kn)! > thresholds.wind_speed_kn && 'text-flag-violet')}>{c?.wind_speed_delta_kn !== null && c?.wind_speed_delta_kn !== undefined ? `${fmtNum(num(c.wind_speed_delta_kn), 1)} kn` : '—'}</Td>
                <Td className={cn('num', num(c?.wind_dir_delta_deg) !== null && num(c?.wind_dir_delta_deg)! > thresholds.wind_dir_deg && 'text-flag-violet')}>{c?.wind_dir_delta_deg !== null && c?.wind_dir_delta_deg !== undefined ? `${fmtNum(num(c.wind_dir_delta_deg), 0)}°` : '—'}</Td>
                <Td className="text-xs">{flagged ? <span className="text-flag-violet font-semibold">DIVERGE</span> : dd?.fired?.light_air_suppressed ? <span className="text-text-3" title={`delta over threshold but p50 below ${thresholds.light_air_floor_kn} kn`}>light air</span> : <span className="text-text-3">agree</span>}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="px-2 py-2 text-[11px] text-text-3">Thresholds: speed Δ &gt; {thresholds.wind_speed_kn} kn or direction Δ &gt; {thresholds.wind_dir_deg}°, only when the primary p50 is at least {thresholds.light_air_floor_kn} kn. The models are independent; the delivery pipe (Open-Meteo) is shared.</p>
    </div>
  );
}
