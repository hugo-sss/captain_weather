import type { AnchorageConditionsRow, ConfidenceLevel, RiskFlag } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { fmtNum } from '@/lib/units.ts';
import { fmtHours, fmtUtc } from '@/lib/time.ts';

/** Stay window summary tiles (Feature 10). Every tile is hatched with its reason when null. */
export function StayWindowView({ a }: { a: AnchorageConditionsRow | null }) {
  if (!a) return <p className="text-sm text-text-2">No anchorage summary in the latest run. Compute conditions with the stay window set.</p>;
  const hrs = (Date.parse(a.stay_end) - Date.parse(a.stay_start)) / 3_600_000;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="num">{fmtUtc(a.stay_start)} → {fmtUtc(a.stay_end)}</span><span className="text-text-3">{fmtHours(hrs)} · {a.hours_evaluated ?? 0} forecast hours evaluated</span>
        <RiskPill flag={a.risk_flag as RiskFlag} reasons={a.risk_reasons as string[]} />
        <ConfidenceDot level={a.confidence_level as ConfidenceLevel} triggers={a.confidence_triggers as string[]} withLabel />
        {a.exposure_tag && <span className="rounded-sm border border-border px-1.5 py-0.5 text-[11px] uppercase text-text-2">{a.exposure_tag}</span>}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        <FieldCard label="Wind median p50" value={num(a.wind_p50_kn)} unit="kn" reason="no atmospheric hours in the window" />
        <FieldCard label="Wind worst p90" value={num(a.wind_max_p90_kn)} unit="kn" reason="no atmospheric hours in the window" />
        <FieldCard label="Gust worst p90" value={num(a.gust_max_p90_kn)} unit="kn" reason="no atmospheric hours in the window" />
        <FieldCard label="Wind predominant / veer" value={a.wind_dir_predominant_deg !== null ? `${Math.round(num(a.wind_dir_predominant_deg) ?? 0)}° / ${Math.round(num(a.wind_dir_range_deg) ?? 0)}°` : null} reason="no direction data" sub="from / arc covered during the stay" />
        <FieldCard label="Wave max" value={num(a.wave_max_m)} unit="m" reason="no marine grid point within 55 km" />
        <FieldCard label="Swell max / dir" value={a.swell_max_m !== null ? `${fmtNum(num(a.swell_max_m), 1)} m / ${Math.round(num(a.swell_dir_predominant_deg) ?? 0)}°` : null} reason="no marine data" />
        <FieldCard label="Tide min / max / range" value={a.tide_min_m !== null ? `${fmtNum(num(a.tide_min_m), 2)} / ${fmtNum(num(a.tide_max_m), 2)} / ${fmtNum(num(a.tide_range_m), 2)}` : null} unit="m" reason="no tidal data: station unresolved or TIDESATLAS_API_KEY not configured" />
        <FieldCard label="Minimum UKC estimate" value={num(a.min_ukc_estimate_m)} unit="m" reason="needs vessel draft, charted depth and tide" sub="lowest tide paired with largest swell, no squat" />
      </div>
      {(a.risk_reasons as string[]).length > 0 && <ul className="text-xs text-text-2 list-disc pl-4">{(a.risk_reasons as string[]).map((r) => <li key={r}>{r}</li>)}</ul>}
    </div>
  );
}
