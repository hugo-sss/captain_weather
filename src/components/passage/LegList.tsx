// Vertical leg list next to the map: one card per waypoint from the second onwards, in plain English.
// When the passage is underway the list gains the progress bar and arrived toggles the Monitor screen had.
import { Link } from 'react-router-dom';
import { Anchor, ArrowUpRight, Check } from 'lucide-react';
import type { DetailLevel, RiskFlag, WaypointConditionsRow, WaypointRow } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import type { LegProfileData } from '@/lib/leg-profile.ts';
import { RISK_RANK } from '@/lib/leg-profile.ts';
import { RISK_HEX } from '@/lib/risk-colors.ts';
import { distancePhrase, localClock, localDayTime, seaPhrase, tidePhrase, windPhrase } from '@/lib/plain.ts';
import { fmtUtc } from '@/lib/time.ts';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { DisagreementBadge } from '@/components/dashboard/DisagreementBadge.tsx';
import { GustSourceChip } from '@/components/dashboard/GustSourceChip.tsx';
import { Switch } from '@/components/ui/switch.tsx';
import { cn } from '@/lib/utils.ts';

type Props = {
  passageId: string; waypoints: WaypointRow[]; byWp: Map<string, WaypointConditionsRow>; legInto: Map<string, LegProfileData>;
  selectedId: string | null; onSelect: (id: string) => void; utcOffsetMin: number | null; detail: DetailLevel;
  underway: boolean; onArrived?: (wpId: string, arrived: boolean) => void; totalNm: number;
};

const asRisk = (v: unknown): RiskFlag => (v === 'green' || v === 'amber' || v === 'red' ? v : 'unknown');
const worse = (a: RiskFlag, b: RiskFlag) => (RISK_RANK[b] > RISK_RANK[a] ? b : a);

export function LegList({ passageId, waypoints, byWp, legInto, selectedId, onSelect, utcOffsetMin, detail, underway, onArrived, totalNm }: Props) {
  const arrivedCount = waypoints.filter((w) => w.arrived).length;
  const doneNm = waypoints.filter((w) => w.arrived).reduce((s, w) => s + (num(w.leg_distance_nm) ?? 0), 0);
  const pct = totalNm > 0 ? Math.round((doneNm / totalNm) * 100) : 0;
  const nextWp = underway ? waypoints.find((w) => !w.arrived) ?? null : null;
  const origin = waypoints[0] ?? null;
  return (
    <div className="space-y-3 min-w-0">
      {underway && origin && (
        <div className="card p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <div className="text-[14px] font-semibold"><span className="num">{pct}%</span> of the way</div>
            <div className="t-caption num">{arrivedCount} of {waypoints.length} waypoints · {doneNm.toFixed(1)} of {totalNm.toFixed(1)} nm</div>
          </div>
          <div className="mt-2 h-2 rounded-full bg-bg-0 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-accent transition-[width] duration-300" style={{ width: `${pct}%` }} /></div>
          {nextWp && <div className="t-caption mt-2">Next: <span className="text-text-1">{nextWp.name}</span>, arriving {localDayTime(byWp.get(nextWp.id)?.eta ?? nextWp.eta, utcOffsetMin)} local</div>}
          <label className="mt-3 flex items-center justify-between gap-3 text-[13px] text-text-2 cursor-pointer" onClick={(e) => e.stopPropagation()}>
            <span className="flex items-center gap-2 min-w-0"><span className={cn('inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full', origin.arrived ? 'bg-accent text-bg-0' : 'bg-bg-2 text-text-3')}>{origin.arrived ? <Check className="h-3 w-3" strokeWidth={3} /> : <span className="num text-[10px]">1</span>}</span><span className="truncate">Departed {origin.name}{origin.arrived && origin.arrived_at ? `, ${localDayTime(origin.arrived_at, utcOffsetMin)} local` : ''}</span></span>
            <Switch checked={origin.arrived} onCheckedChange={(v) => onArrived?.(origin.id, v)} aria-label={`Departed ${origin.name}`} />
          </label>
        </div>
      )}
      {waypoints.slice(1).map((wp, i) => {
        const c = byWp.get(wp.id) ?? null;
        const leg = legInto.get(wp.id) ?? null;
        const from = waypoints[i];
        const risk = worse(asRisk(c?.risk_flag), leg?.summary.worstRisk ?? 'unknown');
        const eta = c?.eta ?? wp.eta;
        const selected = selectedId === wp.id;
        const isCurrent = nextWp?.id === wp.id;
        const wind = c ? windPhrase(c.wind_p50_kn, c.wind_p90_kn, c.wind_dir_mean_deg, c.gust_p90_kn) : null;
        const sea = c ? seaPhrase(c.wave_height_m, c.wave_period_s, c.swell_height_m, c.swell_dir_deg) : null;
        const tide = c && wp.is_anchorage ? tidePhrase(c.tide_height_m, c.tide_datum, c.tide_state) : null;
        const wpP90 = num(c?.wind_p90_kn);
        const worsePoint = leg?.summary.worstPoint ?? null;
        const worseMidLeg = leg && worsePoint && ((leg.summary.maxWindP90 ?? 0) > (wpP90 ?? 0) + 2 || RISK_RANK[leg.summary.worstRisk] > RISK_RANK[asRisk(c?.risk_flag)]);
        return (
          <article key={wp.id} role="button" tabIndex={0} aria-pressed={selected} onClick={() => onSelect(wp.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(wp.id); } }}
            className={cn('card relative overflow-hidden p-4 pl-5 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent', selected ? 'bg-bg-elev ring-1 ring-accent/50' : 'hover:bg-bg-elev', wp.arrived && 'opacity-70')}>
            <span aria-hidden className="absolute left-0 top-0 bottom-0 w-1" style={{ background: risk === 'unknown' ? 'repeating-linear-gradient(180deg, #66748F 0 4px, transparent 4px 8px)' : RISK_HEX[risk] }} />
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="label">Leg {i + 1}</span>
                  {isCurrent && <span className="inline-flex h-5 items-center rounded-full bg-accent/12 px-2 text-[11px] font-medium text-accent">Current leg</span>}
                  {wp.arrived && <span className="inline-flex items-center gap-1 text-[11px] text-text-3"><Check className="h-3 w-3" /> Arrived</span>}
                </div>
                <div className="mt-0.5 text-[15px] font-semibold leading-snug flex flex-wrap items-center gap-x-1.5">
                  <span className="text-text-2 font-medium">{from?.name ?? 'Start'}</span><span className="text-text-3">→</span><span>{wp.name ?? `Waypoint ${wp.sequence}`}</span>
                  {wp.is_anchorage && <Link to={`/passages/${passageId}/anchorage/${wp.id}`} onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md bg-bg-2 px-1.5 h-5 text-[11px] font-medium text-accent hover:bg-accent/15" title="Anchorage stay"><Anchor className="h-3 w-3" /> Stay <ArrowUpRight className="h-3 w-3" /></Link>}
                </div>
                <div className="t-caption mt-1 flex flex-wrap items-center gap-x-2">
                  <span>{wp.arrived && wp.arrived_at ? `Arrived ${localDayTime(wp.arrived_at, utcOffsetMin)} local` : eta ? `${localDayTime(eta, utcOffsetMin)} local` : 'No ETA'}</span>
                  {detail === 'detailed' && eta && <span className="num text-text-3">{fmtUtc(eta)}</span>}
                  {num(wp.leg_distance_nm) !== null && <><span className="text-text-3">·</span><span className="num">{distancePhrase(num(wp.leg_distance_nm))}</span></>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <RiskPill flag={risk} reasons={[...((c?.risk_reasons as string[] | null) ?? []), ...(worsePoint?.riskReasons ?? [])]} size="sm" />
                {underway && onArrived && <label className="flex items-center gap-1.5 text-[11px] text-text-3 cursor-pointer" onClick={(e) => e.stopPropagation()}>Arrived <Switch checked={wp.arrived} onCheckedChange={(v) => onArrived(wp.id, v)} aria-label={`Arrived at ${wp.name}`} /></label>}
              </div>
            </div>
            <div className="mt-2.5 space-y-0.5 text-[14px] leading-snug">
              {wind ? <p>{wind}{detail === 'detailed' && <GustSourceChip source={c?.gust_source} className="ml-1.5" />}</p> : <p className="text-text-3" title="No atmospheric grid point within 55 km or 6 h of the ETA">No wind data at this point</p>}
              {sea ? <p className="text-text-2">{sea}</p> : <p className="text-text-3" title="No marine grid point within 55 km">No sea state data</p>}
              {wp.is_anchorage && (tide ? <p className="text-text-2">Tide {tide} on arrival</p> : <p className="text-text-3">No tide data</p>)}
            </div>
            {(c?.source_disagreement || worseMidLeg) && (
              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                <DisagreementBadge active={!!c?.source_disagreement} speedDelta={num(c?.wind_speed_delta_kn)} dirDelta={num(c?.wind_dir_delta_deg)} primary={c?.atmos_source} comparison={c?.comparison_source} size="sm" />
                {worseMidLeg && worsePoint && <span className="inline-flex items-center gap-1.5 rounded-md bg-bg-2 px-1.5 h-[18px] text-[11px] font-medium text-text-2 whitespace-nowrap"><span className="h-1.5 w-1.5 rounded-full" style={{ background: RISK_HEX[leg.summary.worstRisk] }} />Worse mid-leg: {Math.round(leg.summary.maxWindP90 ?? worsePoint.windP90 ?? 0)} kn at {localClock(worsePoint.eta, utcOffsetMin)}</span>}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
