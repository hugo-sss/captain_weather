// Departure windows as short cards. Two sources, both labelled: the raw forecast series and the briefing model.
import { CalendarClock } from 'lucide-react';
import type { DepartureWindow } from '../../../supabase/functions/_shared/departure-windows.ts';
import { Section } from '@/components/ui/section.tsx';
import { localDateTime, localDayTime } from '@/lib/plain.ts';
import { cn } from '@/lib/utils.ts';

type Suggested = { start: string; end: string; reason: string };

function windowLabel(start: string, end: string, utcOffsetMin: number | null): string {
  const a = localDateTime(start, utcOffsetMin), b = localDayTime(end, utcOffsetMin);
  if (!a || !b) return '';
  const sameDay = a.slice(0, 3) === b.slice(0, 3);
  return `${a} to ${sameDay ? b.slice(4) : b} local`;
}

export function DepartureWindowsSection({ derived, sampled, suggested, utcOffsetMin, originName }: { derived: DepartureWindow[]; sampled: number; suggested: Suggested[]; utcOffsetMin: number | null; originName: string | null }) {
  const rows: { start: string; end: string; text: string; source: 'series' | 'briefing' }[] = [
    ...derived.map((w) => ({ start: w.start, end: w.end, text: `winds under ${Math.round(w.max_wind_p90_kn ?? 0)} kn for ${w.hours} h, models agree`, source: 'series' as const })),
    ...suggested.map((w) => ({ start: w.start, end: w.end, text: w.reason, source: 'briefing' as const })),
  ].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return (
    <Section id="windows" title="Departure windows" description={<span>Stretches in the next 72 h when wind, gusts and sea at {originName ?? 'the first waypoint'} stay under three quarters of your limits and the models agree.</span>}>
      <div className="card p-4 md:p-5">
        {rows.length === 0 ? (
          <p className="t-caption text-[13px]">{sampled === 0 ? 'No forecast series for the departure point yet. Check conditions first.' : 'No stretch of 3 hours or more meets the rule in the next 72 h. The full table has the hourly numbers.'}</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rows.map((w, i) => (
              <li key={i} className={cn('tile px-4 py-3 flex items-start gap-3', w.source === 'briefing' && 'ring-1 ring-accent/25')}>
                <CalendarClock className="h-4 w-4 text-text-3 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <div className="text-[14px] font-medium">{windowLabel(w.start, w.end, utcOffsetMin)}</div>
                  <div className="t-caption mt-0.5">{w.text}</div>
                  <div className="text-[11px] text-text-3 mt-1">{w.source === 'series' ? 'From the forecast series' : 'Suggested in the briefing'}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
        {sampled > 0 && <p className="text-[12px] text-text-3 mt-3">Both kinds are hints from the data ({sampled} forecast hours scanned). Verify against official forecasts.</p>}
      </div>
    </Section>
  );
}
