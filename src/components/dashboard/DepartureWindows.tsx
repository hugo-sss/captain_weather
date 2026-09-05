import type { DepartureWindow } from '../../../supabase/functions/_shared/departure-windows.ts';
import { fmtUtc } from '@/lib/time.ts';

const Tag = ({ children }: { children: React.ReactNode }) => <span className="inline-flex h-[18px] items-center rounded-sm border border-border bg-bg-2 px-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-text-2">{children}</span>;

/** Two sources, clearly labelled: rule-derived windows from the raw series, and the model's suggestions from the briefing. */
export function DepartureWindows({ derived, sampled, suggested }: { derived: DepartureWindow[]; sampled: number; suggested: { start: string; end: string; reason: string }[] }) {
  return (
    <div className="panel p-3 space-y-3">
      <div className="label text-text-2">Departure windows <span className="text-text-3">· first waypoint · next 72 h</span></div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2"><Tag>Raw series</Tag><span className="text-[11px] text-text-3">p90 wind, gust and wave under 0.75× the vessel limits, models in agreement · <span className="num">{sampled}</span> h scanned</span></div>
        {derived.length === 0
          ? <p className="text-xs text-text-2">{sampled === 0 ? 'No forecast series for the departure point yet.' : 'No contiguous window of 3 h or more meets the rule. The table has the numbers.'}</p>
          : <ul className="space-y-0.5 text-xs">{derived.map((w, i) => <li key={i} className="flex flex-wrap items-baseline gap-x-2"><span className="num text-text-1">{fmtUtc(w.start)} → {fmtUtc(w.end)}</span><span className="num text-text-3">{w.hours} h · p90 ≤ {Math.round(w.max_wind_p90_kn ?? 0)} kn</span></li>)}</ul>}
      </div>
      {suggested.length > 0 && (
        <div className="space-y-1.5 border-t border-border pt-2.5">
          <div className="flex items-center gap-2"><Tag>Briefing model</Tag><span className="text-[11px] text-text-3">advisory; verify against official forecasts</span></div>
          <ul className="space-y-0.5 text-xs">{suggested.map((w, i) => <li key={i} className="flex flex-wrap items-baseline gap-x-2"><span className="num text-text-1">{fmtUtc(w.start)} → {fmtUtc(w.end)}</span><span className="text-text-2">{w.reason}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}
