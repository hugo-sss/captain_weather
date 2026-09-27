// Stay window summary (Feature 10): the window, its flag and confidence, then five stats in plain words.
import { Anchor } from 'lucide-react';
import type { AnchorageConditionsRow, ConfidenceLevel, RiskFlag } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { SquallBadge } from '@/components/dashboard/SquallBadge.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { Stat } from '@/components/ui/stat.tsx';
import { EmptyState } from '@/components/ui/empty-state.tsx';
import { compassWord, durationPhrase, localDateTime, localDayTime } from '@/lib/plain.ts';
import { fmtNum } from '@/lib/units.ts';
import { RISK_HEX } from '@/lib/risk-colors.ts';

export function StayWindowView({ a, utcOffsetMin, minUkcM = null }: { a: AnchorageConditionsRow | null; utcOffsetMin: number | null; minUkcM?: number | null }) {
  if (!a) return <EmptyState compact icon={Anchor} title="No stay summary yet" body="Check conditions with the stay window set to get wind, swell, tide range and clearance for the stay." />;
  const hrs = (Date.parse(a.stay_end) - Date.parse(a.stay_start)) / 3_600_000;
  const reasons = a.risk_reasons as string[];
  const p50 = num(a.wind_p50_kn), p90 = num(a.wind_max_p90_kn), gust = num(a.gust_max_p90_kn), swell = num(a.swell_max_m), swellDir = compassWord(num(a.swell_dir_predominant_deg));
  const tMin = num(a.tide_min_m), tMax = num(a.tide_max_m), tRange = num(a.tide_range_m), ukc = num(a.min_ukc_estimate_m);
  const windDir = compassWord(num(a.wind_dir_predominant_deg));
  const ukcTone = ukc !== null && minUkcM !== null ? (ukc < minUkcM ? 'red' : ukc < minUkcM * 1.5 ? 'amber' : 'default') : 'default';
  return (
    <div className="card p-5 md:p-6 space-y-5">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="label">Stay window</div>
          <div className="mt-0.5 text-[18px] font-semibold leading-snug">{localDateTime(a.stay_start, utcOffsetMin)} to {localDayTime(a.stay_end, utcOffsetMin)} local</div>
          <div className="t-caption mt-0.5">{durationPhrase(hrs)}, {a.hours_evaluated ?? 0} forecast hours evaluated{a.exposure_tag ? `, ${a.exposure_tag} anchorage` : ''}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <SquallBadge risk={a.squall_risk} size="sm" />
          <ConfidenceDot level={a.confidence_level as ConfidenceLevel} triggers={a.confidence_triggers as string[]} withLabel />
          <RiskPill flag={a.risk_flag as RiskFlag} reasons={reasons} />
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-4">
        <Stat label="Wind" value={p50 !== null ? `${Math.round(p50)} kn${p90 !== null && p90 > p50 ? `, up to ${Math.round(p90)}` : ''}${windDir ? ` from the ${windDir}` : ''}` : null} reason="No atmospheric hours in the window" hint="Median wind over the stay, and the high-end (90th percentile) at the worst hour." sub={num(a.wind_dir_range_deg) !== null ? `Direction swings ${Math.round(num(a.wind_dir_range_deg)!)}°` : undefined} />
        <Stat label="Worst gust" value={gust !== null ? `${Math.round(gust)} kn` : null} reason="No atmospheric hours in the window" hint="Highest 90th-percentile gust during the stay." />
        <Stat label="Swell" value={swell !== null ? `${fmtNum(swell, 1)} m${swellDir ? ` from the ${swellDir}` : ''}` : null} reason="No marine grid point within 55 km" hint="Largest swell during the stay and where it comes from." sub={num(a.wave_max_m) !== null ? `Sea up to ${fmtNum(num(a.wave_max_m), 1)} m` : undefined} />
        <Stat label="Tide range" value={tMin !== null && tMax !== null ? `${fmtNum(tMin, 1)} to ${fmtNum(tMax, 1)} m` : null} sub={tRange !== null ? `${fmtNum(tRange, 1)} m range` : undefined} reason="No tide data: station unresolved or tide key not configured" />
        <Stat label="Minimum clearance" value={ukc !== null ? `${fmtNum(ukc, 1)} m` : null} tone={ukcTone} sub="Lowest tide with the largest swell, no squat" reason="Needs vessel draft, charted depth and tide" />
      </div>
      {reasons.length > 0 && (
        <div className="tile px-4 py-3">
          <div className="label mb-1">Why this flag</div>
          <ul className="text-[13px] space-y-0.5">{reasons.map((r) => <li key={r} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 rounded-full shrink-0" style={{ background: RISK_HEX[(a.risk_flag as RiskFlag) ?? 'unknown'] }} /><span className="num text-text-2">{r}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
