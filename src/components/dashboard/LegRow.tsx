import type { WaypointConditionsRow, WaypointRow, RiskFlag, ConfidenceLevel } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { RiskPill } from './RiskPill.tsx';
import { DisagreementBadge } from './DisagreementBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { DirArrow, TideGlyph, TowardArrow, WindBand } from './WindBand.tsx';
import { cn } from '@/lib/utils.ts';
import { Link } from 'react-router-dom';

export type LegRowProps = {
  wp: WaypointRow; c: WaypointConditionsRow | null; maxWindKn: number | null; selected: boolean; onSelect: () => void; showComparison: boolean; utcOffsetMin: number | null; passageId?: string;
};

const Td = ({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) => <td title={title} className={cn('px-2 py-1.5 whitespace-nowrap align-middle', className)}>{children}</td>;
const Gap = ({ reason }: { reason: string }) => <span className="inline-block h-3 w-8 gap-hatch rounded-sm align-middle" title={reason} />;

export function LegRow({ wp, c, maxWindKn, selected, onSelect, showComparison, utcOffsetMin, passageId }: LegRowProps) {
  const eta = c?.eta ?? wp.eta;
  const risk = (c?.risk_flag ?? 'unknown') as RiskFlag;
  const reasons = (c?.risk_reasons as string[] | undefined) ?? [];
  const triggers = (c?.confidence_triggers as string[] | undefined) ?? [];
  const gapA = !c || c.wind_p50_kn === null;
  const gapM = !c || (c.wave_height_m === null && c.current_speed_kn === null);
  const gapT = !c || c.tide_height_m === null;
  return (
    <tr onClick={onSelect} className={cn('border-b border-border cursor-pointer hover:bg-bg-2/60', selected && 'bg-bg-2')}>
      <Td className="num text-text-3">{wp.sequence}</Td>
      <Td className="max-w-[140px] truncate">{wp.name ?? '—'}{wp.is_anchorage && <span className="ml-1 text-[10px] text-text-3 uppercase">anch</span>}</Td>
      <Td className="num"><div>{fmtUtc(eta)}</div><div className="text-[11px] text-text-3">{fmtLocal(eta, utcOffsetMin)}</div></Td>
      <Td className="num text-text-2">{c?.lead_time_hours !== null && c?.lead_time_hours !== undefined ? `${Math.round(Number(c.lead_time_hours))} h` : '—'}</Td>
      <Td><WindBand p10={c?.wind_p10_kn} p50={c?.wind_p50_kn} p90={c?.wind_p90_kn} limit={maxWindKn} /></Td>
      <Td className="num text-xs">{gapA ? <Gap reason="no atmospheric data" /> : `${fmtNum(num(c?.wind_p10_kn), 0)} / ${fmtNum(num(c?.wind_p50_kn), 0)} / ${fmtNum(num(c?.wind_p90_kn), 0)}`}</Td>
      <Td><DirArrow deg={c?.wind_dir_mean_deg} spread={c?.wind_dir_spread_deg} /></Td>
      <Td className="num">{gapA ? <Gap reason="no atmospheric data" /> : fmtNum(num(c?.gust_p90_kn), 0)}</Td>
      <Td className="num">{gapM ? <Gap reason="no marine grid point within 55 km or ±6 h" /> : <>{fmtNum(num(c?.wave_height_m), 1)} m <span className="text-text-3 text-xs">{fmtNum(num(c?.wave_period_s), 0)} s</span></>}</Td>
      <Td className="num">{gapM ? <Gap reason="no marine data" /> : <>{fmtNum(num(c?.swell_height_m), 1)} m <DirArrow deg={c?.swell_dir_deg} /></>}</Td>
      <Td className="num">{gapT ? <Gap reason="no tidal data (station unresolved or key not configured)" /> : <>{fmtNum(num(c?.tide_height_m), 2)} m <TideGlyph state={c?.tide_state} /><span className="text-[10px] text-text-3 ml-1">{c?.tide_datum ?? 'datum?'}</span></>}</Td>
      <Td className="num">{gapM ? <Gap reason="no marine data" /> : <>{fmtNum(num(c?.current_speed_kn), 1)} kn <TowardArrow deg={c?.current_dir_deg} /></>}</Td>
      <Td className="num" title={c?.ukc_basis ?? undefined}>{c?.ukc_estimate_m !== null && c?.ukc_estimate_m !== undefined ? `${fmtNum(num(c.ukc_estimate_m), 1)} m` : <span className="text-text-3">—</span>}</Td>
      {showComparison && (
        <>
          <Td className="num text-xs">{c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined ? `${fmtNum(num(c.comparison_wind_kn), 0)} kn` : <Gap reason="no comparison row for this hour" />} <DirArrow deg={c?.comparison_wind_dir_deg} /></Td>
          <Td className="num text-xs text-text-2">{c?.wind_speed_delta_kn !== null && c?.wind_speed_delta_kn !== undefined ? `Δ${fmtNum(num(c.wind_speed_delta_kn), 0)} kn / ${fmtNum(num(c.wind_dir_delta_deg), 0)}°` : '—'}</Td>
        </>
      )}
      <Td><DisagreementBadge active={!!c?.source_disagreement} speedDelta={num(c?.wind_speed_delta_kn)} dirDelta={num(c?.wind_dir_delta_deg)} primary={c?.atmos_source} comparison={c?.comparison_source} /></Td>
      <Td><RiskPill flag={risk} reasons={reasons} /></Td>
      <Td><ConfidenceDot level={(c?.confidence_level ?? 'low') as ConfidenceLevel} triggers={triggers} /></Td>
      <Td>{wp.is_anchorage && passageId ? <Link to={`/passages/${passageId}/anchorage/${wp.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-accent">stay view</Link> : null}</Td>
    </tr>
  );
}
