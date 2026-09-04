// Mobile: the leg row as a stacked card with the same fields (PRD §9.5 "Mobile").
import { Link } from 'react-router-dom';
import type { WaypointConditionsRow, WaypointRow, RiskFlag, ConfidenceLevel } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { fmtLocal, fmtUtc } from '@/lib/time.ts';
import { fmtNum } from '@/lib/units.ts';
import { RiskPill } from './RiskPill.tsx';
import { DisagreementBadge } from './DisagreementBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { FieldCard } from './FieldCard.tsx';
import { DirArrow } from './WindBand.tsx';
import { cn } from '@/lib/utils.ts';

export function LegCard({ wp, c, selected, onSelect, passageId, utcOffsetMin }: { wp: WaypointRow; c: WaypointConditionsRow | null; selected: boolean; onSelect: () => void; passageId?: string; utcOffsetMin: number | null }) {
  const eta = c?.eta ?? wp.eta;
  return (
    <div onClick={onSelect} className={cn('rounded-lg border border-border bg-bg-1 p-3 space-y-2', selected && 'ring-1 ring-accent')}>
      <div className="flex items-center gap-2">
        <span className="num text-text-3">{wp.sequence}</span><span className="font-medium flex-1 truncate">{wp.name ?? 'Waypoint'}</span>
        <DisagreementBadge active={!!c?.source_disagreement} speedDelta={num(c?.wind_speed_delta_kn)} dirDelta={num(c?.wind_dir_delta_deg)} primary={c?.atmos_source} comparison={c?.comparison_source} />
        <RiskPill flag={(c?.risk_flag ?? 'unknown') as RiskFlag} reasons={(c?.risk_reasons as string[]) ?? []} />
        <ConfidenceDot level={(c?.confidence_level ?? 'low') as ConfidenceLevel} triggers={(c?.confidence_triggers as string[]) ?? []} />
      </div>
      <div className="num text-xs text-text-2">ETA {fmtUtc(eta)} · {fmtLocal(eta, utcOffsetMin)} · lead {c?.lead_time_hours !== null && c?.lead_time_hours !== undefined ? `${Math.round(Number(c.lead_time_hours))} h` : '—'}</div>
      <div className="grid grid-cols-2 gap-1.5">
        <FieldCard label="Wind p10/50/90" value={c?.wind_p50_kn !== null && c?.wind_p50_kn !== undefined ? `${fmtNum(num(c.wind_p10_kn), 0)}/${fmtNum(num(c.wind_p50_kn), 0)}/${fmtNum(num(c.wind_p90_kn), 0)}` : null} unit="kn" reason="no atmospheric data" />
        <div className="rounded-md border border-border bg-bg-2 px-3 py-2"><div className="label">Dir · gust p90</div><div className="mt-0.5 flex items-center gap-2"><DirArrow deg={c?.wind_dir_mean_deg} spread={c?.wind_dir_spread_deg} /><span className="num">{fmtNum(num(c?.gust_p90_kn), 0)} kn</span></div></div>
        <FieldCard label="Wave / period" value={c?.wave_height_m !== null && c?.wave_height_m !== undefined ? `${fmtNum(num(c.wave_height_m), 1)} m / ${fmtNum(num(c.wave_period_s), 0)} s` : null} reason="no marine data" />
        <FieldCard label="Swell / dir" value={c?.swell_height_m !== null && c?.swell_height_m !== undefined ? `${fmtNum(num(c.swell_height_m), 1)} m / ${Math.round(num(c.swell_dir_deg) ?? 0)}°` : null} reason="no marine data" />
        <FieldCard label="Tide" value={num(c?.tide_height_m)} unit={`m ${c?.tide_datum ?? ''}`} sub={c?.tide_state ?? undefined} reason="no tidal data" />
        <FieldCard label="Current → toward" value={c?.current_speed_kn !== null && c?.current_speed_kn !== undefined ? `${fmtNum(num(c.current_speed_kn), 1)} kn → ${Math.round(num(c.current_dir_deg) ?? 0)}°` : null} reason="no marine data" />
        <FieldCard label="UKC" value={num(c?.ukc_estimate_m)} unit="m" sub={c?.ukc_basis ?? undefined} reason="needs draft, depth and tide" />
        <FieldCard label="Comparison" value={c?.comparison_wind_kn !== null && c?.comparison_wind_kn !== undefined ? `${fmtNum(num(c.comparison_wind_kn), 0)} kn / ${Math.round(num(c.comparison_wind_dir_deg) ?? 0)}°` : null} sub={c?.comparison_source ?? undefined} reason="no comparison row" />
      </div>
      {wp.is_anchorage && passageId && <Link to={`/passages/${passageId}/anchorage/${wp.id}`} onClick={(e) => e.stopPropagation()} className="text-[11px] text-accent">Anchorage stay view →</Link>}
    </div>
  );
}
