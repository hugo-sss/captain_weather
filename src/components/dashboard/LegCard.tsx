// Mobile: the leg row as a stacked card with the same fields (PRD §9.5 "Mobile").
import { Link } from 'react-router-dom';
import { Anchor, ArrowUpRight, Check } from 'lucide-react';
import type { WaypointConditionsRow, WaypointRow, RiskFlag, ConfidenceLevel } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { RiskPill } from './RiskPill.tsx';
import { DisagreementBadge } from './DisagreementBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { FieldCard } from './FieldCard.tsx';
import { DirArrow, WindBand } from './WindBand.tsx';
import { cn } from '@/lib/utils.ts';

export function LegCard({ wp, c, selected, onSelect, passageId, utcOffsetMin, maxWindKn = null }: { wp: WaypointRow; c: WaypointConditionsRow | null; selected: boolean; onSelect: () => void; passageId?: string; utcOffsetMin: number | null; maxWindKn?: number | null }) {
  const eta = c?.eta ?? wp.eta;
  const gapA = !c || c.wind_p50_kn === null;
  return (
    <div onClick={onSelect} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } }}
      className={cn('panel p-3 space-y-2.5 transition-colors', selected ? 'border-accent/60 shadow-[inset_2px_0_0_#2DD4BF]' : 'hover:border-text-3/50')}>
      <div className="flex items-center gap-2">
        <span className="num inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-bg-2 text-[11px] text-text-2">{wp.sequence}</span>
        <span className="font-medium flex-1 truncate flex items-center gap-1.5">{wp.name ?? 'Waypoint'}{wp.is_anchorage && <Anchor className="h-3 w-3 text-accent shrink-0" aria-label="anchorage" />}{wp.arrived && <Check className="h-3 w-3 text-text-3 shrink-0" aria-label="arrived" />}</span>
        <DisagreementBadge active={!!c?.source_disagreement} speedDelta={num(c?.wind_speed_delta_kn)} dirDelta={num(c?.wind_dir_delta_deg)} primary={c?.atmos_source} comparison={c?.comparison_source} />
        <RiskPill flag={(c?.risk_flag ?? 'unknown') as RiskFlag} reasons={(c?.risk_reasons as string[]) ?? []} />
        <ConfidenceDot level={(c?.confidence_level ?? 'low') as ConfidenceLevel} triggers={(c?.confidence_triggers as string[]) ?? []} />
      </div>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-xs">
        <span className="num text-text-1">{fmtUtc(eta)}</span><span className="num text-text-3">{fmtLocal(eta, utcOffsetMin)}</span>
        <span className="text-text-3 ml-auto">lead <span className="num text-text-2">{c?.lead_time_hours !== null && c?.lead_time_hours !== undefined ? `${Math.round(Number(c.lead_time_hours))} h` : '—'}</span></span>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div className={cn('tile px-3 py-2 min-h-[58px] flex flex-col justify-center', gapA && 'gap-hatch border-dashed')} title={gapA ? 'no atmospheric data' : undefined}>
          <div className="label">Wind p10/50/90</div>
          {gapA ? <div className="mt-1 text-[12px] text-text-3">no data</div> : (
            <>
              <div className="num text-[15px] font-medium leading-tight mt-1">{fmtNum(num(c.wind_p10_kn), 0)}/{fmtNum(num(c.wind_p50_kn), 0)}/{fmtNum(num(c.wind_p90_kn), 0)}<span className="font-sans text-[11px] text-text-3 ml-1 font-normal">kn</span></div>
              <WindBand p10={c.wind_p10_kn} p50={c.wind_p50_kn} p90={c.wind_p90_kn} limit={maxWindKn} className="mt-1.5 w-full" />
            </>
          )}
        </div>
        <div className={cn('tile px-3 py-2 min-h-[58px] flex flex-col justify-center', gapA && 'gap-hatch border-dashed')}>
          <div className="label">Dir from · gust p90</div>
          {gapA ? <div className="mt-1 text-[12px] text-text-3">no data</div> : <div className="mt-1 flex items-center gap-2"><DirArrow deg={c.wind_dir_mean_deg} spread={c.wind_dir_spread_deg} /><span className="num text-[15px] font-medium">{fmtNum(num(c.gust_p90_kn), 0)}<span className="font-sans text-[11px] text-text-3 ml-1 font-normal">kn</span></span></div>}
        </div>
        <FieldCard label="Wave / period" value={c?.wave_height_m !== null && c?.wave_height_m !== undefined ? `${fmtNum(num(c.wave_height_m), 1)} m / ${fmtNum(num(c.wave_period_s), 0)} s` : null} reason="no marine grid point within 55 km" />
        <FieldCard label="Swell / dir" value={c?.swell_height_m !== null && c?.swell_height_m !== undefined ? `${fmtNum(num(c.swell_height_m), 1)} m / ${Math.round(num(c.swell_dir_deg) ?? 0)}°` : null} reason="no marine data" />
        <FieldCard label="Tide" value={num(c?.tide_height_m)} unit={`m ${c?.tide_datum ?? ''}`} sub={c?.tide_state ?? undefined} reason="no tidal data" />
        <FieldCard label="Current → toward" value={c?.current_speed_kn !== null && c?.current_speed_kn !== undefined ? `${fmtNum(num(c.current_speed_kn), 1)} kn → ${Math.round(num(c.current_dir_deg) ?? 0)}°` : null} reason="no marine data" />
        <FieldCard label="UKC" value={num(c?.ukc_estimate_m)} unit="m" sub={c?.ukc_basis ?? undefined} reason="needs draft, depth and tide" />
        <FieldCard label="Comparison" value={c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined ? `${fmtNum(num(c.comparison_wind_kn), 0)} kn / ${Math.round(num(c.comparison_wind_dir_deg) ?? 0)}°` : null} sub={c?.comparison_source ?? undefined} reason="no comparison row" />
      </div>
      {wp.is_anchorage && passageId && <Link to={`/passages/${passageId}/anchorage/${wp.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 text-[12px] text-accent hover:underline underline-offset-2">Anchorage stay view <ArrowUpRight className="h-3 w-3" /></Link>}
    </div>
  );
}
