import type { AnchorageConditionsRow, ConfidenceLevel, RiskFlag } from '@/types/domain.ts';
import { num } from '@/types/domain.ts';
import { FieldCard } from '@/components/dashboard/FieldCard.tsx';
import { RiskPill } from '@/components/dashboard/RiskPill.tsx';
import { ConfidenceDot } from '@/components/briefing/ConfidenceDot.tsx';
import { fmtNum } from '@/lib/units.ts';
import { fmtHours, fmtUtc } from '@/lib/time.ts';

/** Stay window summary tiles (Feature 10). Every tile is hatched with its reason when null. */
export function StayWindowView({ a }: { a: AnchorageConditionsRow | null }) {
  if (!a) return <div className="panel p-4 gap-hatch border-dashed text-sm text-text-2">No anchorage summary in the latest run. Compute conditions with the stay window set.</div>;
  const hrs = (Date.parse(a.stay_end) - Date.parse(a.stay_start)) / 3_600_000;
  const reasons = a.risk_reasons as string[];
  return (
    <div className="panel p-3 space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <div>
          <div className="label">Stay window</div>
          <div className="num text-[15px] font-medium leading-tight mt-0.5">{fmtUtc(a.stay_start)} <span className="text-text-3">→</span> {fmtUtc(a.stay_end)}</div>
        </div>
        <div className="text-[11px] text-text-3 num self-end pb-0.5">{fmtHours(hrs)} · {a.hours_evaluated ?? 0} forecast hours evaluated</div>
        <div className="ml-auto flex items-center gap-2">
          {a.exposure_tag && <span className="inline-flex h-5 items-center rounded-sm border border-border bg-bg-2 px-1.5 text-[10.5px] uppercase tracking-[0.05em] text-text-2" title="Exposure (manual in v1)">{a.exposure_tag}</span>}
          <ConfidenceDot level={a.confidence_level as ConfidenceLevel} triggers={a.confidence_triggers as string[]} withLabel />
          <RiskPill flag={a.risk_flag as RiskFlag} reasons={reasons} />
        </div>
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
      {reasons.length > 0 && <ul className="text-xs text-text-2 space-y-0.5">{reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-risk-amber">▲</span><span className="num">{r}</span></li>)}</ul>}
    </div>
  );
}
