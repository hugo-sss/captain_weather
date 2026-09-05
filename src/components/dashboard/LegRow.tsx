import { Anchor, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WaypointConditionsRow, WaypointRow, RiskFlag, ConfidenceLevel } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { etaDeltaMinutes, type LegProfileData } from '@/lib/leg-profile.ts';
import { ukcBasisText } from '@/lib/gebco.ts';
import { RiskPill } from './RiskPill.tsx';
import { DisagreementBadge } from './DisagreementBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { DirArrow, TideGlyph, TowardArrow, WindBand } from './WindBand.tsx';
import { GustSourceChip } from './GustSourceChip.tsx';
import { SquallBadge } from './SquallBadge.tsx';
import { DepthSourceChip } from './DepthSourceChip.tsx';
import { LegAlongSummary } from './LegAlongSummary.tsx';
import { cn } from '@/lib/utils.ts';

export type LegRowProps = {
  wp: WaypointRow; c: WaypointConditionsRow | null; maxWindKn: number | null; selected: boolean; onSelect: () => void; showComparison: boolean; utcOffsetMin: number | null; passageId?: string;
  /** Along-leg profile for the leg INTO this waypoint (Phase 5). */
  leg?: LegProfileData | null;
};

const Td = ({ children, className, title }: { children: React.ReactNode; className?: string; title?: string }) => <td title={title} className={className}>{children}</td>;
/** Hatched gap with the reason on hover: a gap is visible, never blank (PRD §9.1). */
const Gap = ({ reason, w = 'w-10' }: { reason: string; w?: string }) => <span className={cn('inline-block h-3 gap-hatch rounded-sm border border-border/60 align-middle', w)} title={reason} aria-label={`no data: ${reason}`} />;
const Unit = ({ children }: { children: React.ReactNode }) => <span className="text-text-3 text-[11px] font-sans ml-0.5">{children}</span>;

export function LegRow({ wp, c, maxWindKn, selected, onSelect, showComparison, utcOffsetMin, passageId, leg }: LegRowProps) {
  const eta = c?.eta ?? wp.eta;
  const risk = (c?.risk_flag ?? 'unknown') as RiskFlag;
  const reasons = (c?.risk_reasons as string[] | undefined) ?? [];
  const triggers = (c?.confidence_triggers as string[] | undefined) ?? [];
  const gapA = !c || c.wind_p50_kn === null;
  const gapM = !c || (c.wave_height_m === null && c.current_speed_kn === null);
  const gapT = !c || c.tide_height_m === null;
  const hasCmp = c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined;
  const flagged = !!c?.source_disagreement;
  const etaDelta = etaDeltaMinutes(c?.eta_planned, c?.eta);
  return (
    <tr onClick={onSelect} className={cn('cursor-pointer', selected && 'is-selected', wp.arrived && 'text-text-2')} aria-selected={selected}>
      <Td className="num text-text-3 r">{wp.sequence}</Td>
      <Td className="max-w-[150px]">
        <span className="flex items-center gap-1.5 min-w-0">
          <span className={cn('truncate', !wp.arrived && 'text-text-1 font-medium')}>{wp.name ?? '—'}</span>
          {wp.arrived && <Check className="h-3 w-3 text-text-3 shrink-0" aria-label="arrived" />}
          {wp.is_anchorage && (passageId
            ? <Link to={`/passages/${passageId}/anchorage/${wp.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-accent hover:bg-accent/15" title="Anchorage stay view"><Anchor className="h-3 w-3" /></Link>
            : <Anchor className="h-3 w-3 text-accent shrink-0" aria-label="anchorage" />)}
        </span>
      </Td>
      <Td className="num"><div className="leading-tight">{fmtUtc(eta)}</div><div className="text-[11px] text-text-3 leading-tight">{fmtLocal(eta, utcOffsetMin)}</div>{etaDelta !== null && c?.eta_planned && <div className="text-[10px] text-text-3 leading-tight" title={`planned-speed ETA ${fmtUtc(c.eta_planned)}`}>planned {fmtUtc(c.eta_planned).slice(6)}</div>}</Td>
      <Td className="num text-text-2 r">{c?.lead_time_hours !== null && c?.lead_time_hours !== undefined ? <>{Math.round(Number(c.lead_time_hours))}<Unit>h</Unit></> : '—'}</Td>
      <Td>
        {gapA ? <Gap reason="no atmospheric data within 55 km / ±6 h of ETA" w="w-24" /> : (
          <div className="flex flex-col gap-1">
            <span className="num text-xs leading-none"><span className="text-text-2">{fmtNum(num(c?.wind_p10_kn), 0)}</span> <span className="text-text-3">/</span> <span className="font-medium">{fmtNum(num(c?.wind_p50_kn), 0)}</span> <span className="text-text-3">/</span> <span className="text-text-2">{fmtNum(num(c?.wind_p90_kn), 0)}</span></span>
            <WindBand p10={c?.wind_p10_kn} p50={c?.wind_p50_kn} p90={c?.wind_p90_kn} limit={maxWindKn} />
          </div>
        )}
      </Td>
      <Td><DirArrow deg={c?.wind_dir_mean_deg} spread={c?.wind_dir_spread_deg} /></Td>
      <Td className="num r whitespace-nowrap">{gapA ? <Gap reason="no atmospheric data" w="w-8" /> : <>{fmtNum(num(c?.gust_p90_kn), 0)} <GustSourceChip source={c?.gust_source} /></>}</Td>
      <Td className="num">{gapM ? <Gap reason="no marine grid point within 55 km or ±6 h" /> : <>{fmtNum(num(c?.wave_height_m), 1)}<Unit>m</Unit> <span className="text-text-3 text-[11px]">{fmtNum(num(c?.wave_period_s), 0)} s</span></>}</Td>
      <Td className="num">{gapM ? <Gap reason="no marine data" /> : <>{fmtNum(num(c?.swell_height_m), 1)}<Unit>m</Unit> <DirArrow deg={c?.swell_dir_deg} muted /></>}</Td>
      <Td className="num">{gapT ? <Gap reason="no tidal data (station unresolved or key not configured)" /> : <>{fmtNum(num(c?.tide_height_m), 2)}<Unit>m</Unit> <TideGlyph state={c?.tide_state} /><span className="text-[10px] text-text-3 ml-1">{c?.tide_datum ?? 'datum?'}</span></>}</Td>
      <Td className="num">{gapM ? <Gap reason="no marine data" /> : <>{fmtNum(num(c?.current_speed_kn), 1)}<Unit>kn</Unit> <TowardArrow deg={c?.current_dir_deg} /></>}</Td>
      <Td className="num r" title={ukcBasisText(c?.ukc_basis, wp.charted_depth_source) ? `basis: ${ukcBasisText(c?.ukc_basis, wp.charted_depth_source)}` : undefined}>
        {c?.ukc_estimate_m !== null && c?.ukc_estimate_m !== undefined ? <span className="inline-flex flex-col items-end gap-0.5"><span>{fmtNum(num(c.ukc_estimate_m), 1)}<Unit>m</Unit></span><DepthSourceChip source={wp.charted_depth_source} /></span> : <span className="text-text-3">—</span>}
      </Td>
      {showComparison && (
        <Td className="num text-xs">
          {hasCmp ? (
            <div className="leading-tight">
              <div>{fmtNum(num(c!.comparison_wind_kn), 0)}<Unit>kn</Unit> <DirArrow deg={c!.comparison_wind_dir_deg} muted /></div>
              <div className={cn('text-[11px]', flagged ? 'text-flag-violet' : 'text-text-3')}>Δ{fmtNum(num(c!.wind_speed_delta_kn), 0)} kn · {fmtNum(num(c!.wind_dir_delta_deg), 0)}°</div>
            </div>
          ) : <Gap reason="no comparison row for this hour" />}
        </Td>
      )}
      <Td className="max-w-[260px]"><LegAlongSummary summary={leg?.summary ?? null} etaDeltaMin={etaDelta} speedLossPct={num(c?.speed_loss_pct)} /></Td>
      <Td><DisagreementBadge active={flagged} speedDelta={num(c?.wind_speed_delta_kn)} dirDelta={num(c?.wind_dir_delta_deg)} primary={c?.atmos_source} comparison={c?.comparison_source} /></Td>
      <Td><span className="inline-flex items-center gap-1.5"><RiskPill flag={risk} reasons={reasons} /><SquallBadge risk={c?.squall_risk} capeJkg={num(c?.cape_p50_jkg)} precipPct={num(c?.precip_prob_pct)} size="sm" /></span></Td>
      <Td className="text-center"><ConfidenceDot level={(c?.confidence_level ?? 'low') as ConfidenceLevel} triggers={triggers} /></Td>
    </tr>
  );
}
