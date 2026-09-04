import type { DepartureWindow } from '../../../supabase/functions/_shared/departure-windows.ts';
import { fmtUtc } from '@/lib/time.ts';

/** Two sources, clearly labelled: rule-derived windows from the raw series, and the model's suggestions from the briefing. */
export function DepartureWindows({ derived, sampled, suggested }: { derived: DepartureWindow[]; sampled: number; suggested: { start: string; end: string; reason: string }[] }) {
  return (
    <div className="rounded-lg border border-border bg-bg-1 p-3 text-sm space-y-2">
      <div className="label">Departure windows at the first waypoint, next 72 h</div>
      <div>
        <div className="text-[11px] text-text-3 mb-1">From the raw series (rule: p90 wind, gust and wave under 0.75× the vessel limits, models in agreement; {sampled} forecast hours scanned)</div>
        {derived.length === 0 ? <p className="text-xs text-text-2">{sampled === 0 ? 'No forecast series for the departure point yet.' : 'No contiguous window of 3 h or more meets the rule. The table has the numbers.'}</p>
          : <ul className="num text-xs space-y-0.5">{derived.map((w, i) => <li key={i}>{fmtUtc(w.start)} → {fmtUtc(w.end)} <span className="text-text-2 font-sans">{w.hours} h, p90 ≤ {Math.round(w.max_wind_p90_kn ?? 0)} kn</span></li>)}</ul>}
      </div>
      {suggested.length > 0 && (
        <div>
          <div className="text-[11px] text-text-3 mb-1">From the briefing model (advisory; verify against official forecasts)</div>
          <ul className="num text-xs space-y-0.5">{suggested.map((w, i) => <li key={i}>{fmtUtc(w.start)} → {fmtUtc(w.end)} <span className="text-text-2 font-sans">{w.reason}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
